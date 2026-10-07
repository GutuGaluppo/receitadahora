import { jaccard, normalize, tokens } from "./text";

export type RecipeFingerprint = {
  id: string;
  name: string;
  slug: string;
  category: string;
  instructions: string[];
  ingredients: { ingredient_id: string; quantity: number | null; unit: string }[];
};

export type DuplicateHit = { id: string; name: string; slug: string; score: number; level: "high" | "medium"; reasons: string[] };

const W = { name: 0.3, ingredients: 0.3, proportion: 0.15, category: 0.1, technique: 0.15 };
export const DUPLICATE_THRESHOLDS = { high: 0.75, medium: 0.55 };

function proportionSimilarity(a: RecipeFingerprint, b: RecipeFingerprint): number {
  const bm = new Map(b.ingredients.map((i) => [i.ingredient_id, i]));
  const ratios: number[] = [];
  for (const i of a.ingredients) {
    const o = bm.get(i.ingredient_id);
    if (!o || i.quantity == null || o.quantity == null || normalize(i.unit) !== normalize(o.unit) || !i.quantity || !o.quantity) continue;
    ratios.push(Math.min(i.quantity, o.quantity) / Math.max(i.quantity, o.quantity));
  }
  return ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0;
}

/** Nome + ingredientes + proporção aproximada + categoria + técnica. Sem IA, sem embeddings. */
export function compareRecipes(a: RecipeFingerprint, b: RecipeFingerprint): { score: number; reasons: string[] } {
  const name = jaccard(tokens(a.name), tokens(b.name));
  const ing = jaccard(a.ingredients.map((i) => i.ingredient_id), b.ingredients.map((i) => i.ingredient_id));
  const prop = proportionSimilarity(a, b);
  const cat = a.category && normalize(a.category) === normalize(b.category) ? 1 : 0;
  const tech = jaccard(tokens(a.instructions.join(" ")), tokens(b.instructions.join(" ")));
  const score = W.name * name + W.ingredients * ing + W.proportion * prop + W.category * cat + W.technique * tech;

  const reasons: string[] = [];
  if (name >= 0.6) reasons.push("nome parecido");
  if (ing >= 0.6) reasons.push("mesmos ingredientes");
  if (prop >= 0.7) reasons.push("proporções parecidas");
  if (tech >= 0.5) reasons.push("preparo parecido");
  return { score, reasons };
}

export function findDuplicates(candidate: RecipeFingerprint, existing: RecipeFingerprint[]): DuplicateHit[] {
  return existing
    .filter((e) => e.id !== candidate.id)
    .map((e) => ({ e, ...compareRecipes(candidate, e) }))
    .filter((x) => x.score >= DUPLICATE_THRESHOLDS.medium)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5)
    .map((x) => ({
      id: x.e.id,
      name: x.e.name,
      slug: x.e.slug,
      score: Math.round(x.score * 100) / 100,
      level: x.score >= DUPLICATE_THRESHOLDS.high ? ("high" as const) : ("medium" as const),
      reasons: x.reasons,
    }));
}
