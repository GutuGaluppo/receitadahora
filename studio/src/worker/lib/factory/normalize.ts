import { z } from "zod";
import { normalize } from "../text";

/* Nunca confiar diretamente na saída do modelo: parse → schema → normalização (§7). */

export class StructuralError extends Error {
  constructor(public code: "invalid_json" | "invalid_schema" | "empty", message: string) {
    super(message);
  }
}

/** Aceita JSON puro ou embrulhado em ```json … ``` / texto antes e depois. */
export function extractJson(raw: string): unknown {
  const text = raw.trim();
  const candidates = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* próxima tentativa */
    }
  }
  throw new StructuralError("invalid_json", "A resposta do provider não é um JSON válido.");
}

export const envelopeSchema = z.object({ recipes: z.array(z.unknown()) });

const quantityField = z.union([z.string(), z.number(), z.null()]).optional();
export const generatedRecipeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600).default(""),
  category: z.string().trim().min(1).max(60),
  prep_time: z.coerce.number().int().min(0).max(1440),
  cook_time: z.coerce.number().int().min(0).max(1440),
  servings: z.coerce.number().int().min(1).max(50),
  difficulty: z.string().trim().min(1),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        quantity: quantityField,
        unit: z.string().trim().max(40).optional().default(""),
        note: z.string().trim().max(200).optional().default(""),
      }),
    )
    .min(1),
  instructions: z.array(z.string().trim().min(1)).min(1),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
});
export type GeneratedRecipe = z.infer<typeof generatedRecipeSchema>;

export function parseEnvelope(raw: string): unknown[] {
  const json = extractJson(raw);
  const env = envelopeSchema.safeParse(json);
  if (!env.success) throw new StructuralError("invalid_schema", 'A resposta não tem o formato esperado: { "recipes": [...] }.');
  if (!env.data.recipes.length) throw new StructuralError("empty", "O provider não retornou nenhuma receita.");
  return env.data.recipes;
}

/** "1/2", "1 1/2", "1,5", "200" → número. "a gosto", "", null → null. */
export function parseQuantity(q: string | number | null | undefined): { value: number | null; unparsed?: string } {
  if (q == null) return { value: null };
  if (typeof q === "number") return { value: Number.isFinite(q) && q >= 0 ? q : null };
  const s = q.trim();
  if (!s) return { value: null };
  if (/^(a gosto|to taste|q\.?b\.?|qb)$/i.test(s)) return { value: null };
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed && +mixed[3]) return { value: +mixed[1] + +mixed[2] / +mixed[3] };
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac && +frac[2]) return { value: +frac[1] / +frac[2] };
  const dec = s.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(dec)) return { value: parseFloat(dec) };
  return { value: null, unparsed: s };
}

const DIFFICULTY: Record<string, "easy" | "medium" | "hard"> = {
  easy: "easy", facil: "easy", simples: "easy", medium: "medium", media: "medium", medio: "medium", intermediario: "medium", hard: "hard", dificil: "hard",
};
export const parseDifficulty = (s: string) => DIFFICULTY[normalize(s)] ?? null;

const CATEGORY: Record<string, string> = {
  breakfast: "Café da manhã", "cafe da manha": "Café da manhã", lunch: "Almoço", almoco: "Almoço", dinner: "Jantar", jantar: "Jantar",
  dessert: "Sobremesa", sobremesa: "Sobremesa", snack: "Lanche", lanche: "Lanche", salad: "Saladas", salada: "Saladas", saladas: "Saladas",
  pasta: "Massas", massas: "Massas", soup: "Sopas", sopa: "Sopas", sopas: "Sopas", bowls: "Bowls", bowl: "Bowls",
};
export const canonicalCategory = (s: string) => CATEGORY[normalize(s)] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export type NormalizedRecipe = {
  name: string; description: string; category: string; prep_time: number; cook_time: number; servings: number;
  difficulty: "easy" | "medium" | "hard"; instructions: string[]; tags: string[];
  ingredients: { name: string; quantity: number | null; unit: string; note: string }[];
  warnings: string[];
};

export function normalizeRecipe(g: GeneratedRecipe): { ok: true; recipe: NormalizedRecipe } | { ok: false; issues: string[] } {
  const difficulty = parseDifficulty(g.difficulty);
  if (!difficulty) return { ok: false, issues: [`difficulty: valor desconhecido "${g.difficulty}" (use easy, medium ou hard)`] };

  const warnings: string[] = [];
  const seen = new Set<string>();
  const ingredients: NormalizedRecipe["ingredients"] = [];
  for (const i of g.ingredients) {
    const key = normalize(i.name);
    if (seen.has(key)) { warnings.push(`Ingrediente repetido ignorado: ${i.name}`); continue; }
    seen.add(key);
    const q = parseQuantity(i.quantity);
    ingredients.push({ name: i.name.replace(/\s+/g, " "), quantity: q.value, unit: i.unit, note: [i.note, q.unparsed ? `(${q.unparsed})` : ""].filter(Boolean).join(" ") });
    if (q.unparsed) warnings.push(`Quantidade não interpretada em "${i.name}": ${q.unparsed}`);
  }
  if (g.prep_time + g.cook_time === 0) warnings.push("Tempo total zerado.");

  return {
    ok: true,
    recipe: {
      name: g.name.replace(/\s+/g, " "), description: g.description, category: canonicalCategory(g.category), prep_time: g.prep_time, cook_time: g.cook_time,
      servings: g.servings, difficulty, instructions: g.instructions, tags: [...new Set(g.tags.map((t) => t.toLowerCase()))], ingredients, warnings,
    },
  };
}

/** Primeiro nível de duplicidade (§12): mesmo título normalizado. */
export function titleDuplicates(name: string, existing: { id: string; name: string; slug: string }[]) {
  const key = normalize(name);
  return existing.filter((e) => normalize(e.name) === key).map((e) => ({ id: e.id, name: e.name, slug: e.slug, score: 1, level: "high" as const, reasons: ["mesmo título"] }));
}
