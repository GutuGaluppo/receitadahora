import type { Env } from "../../env";
import { normalize } from "../text";
import { MOCK_CATALOG, type CatalogRecipe } from "./mock-catalog";

/* Toda geração externa fica atrás destas abstrações (§33): OpenAI, modelo local ou outro, sem reescrever a Factory. */

export class ProviderError extends Error {
  /** external = rede/timeout/5xx (pode tentar de novo). structural = resposta ou configuração inválida. */
  constructor(public kind: "external" | "structural", message: string) {
    super(message);
  }
}

/* ───────── texto ───────── */

export type RecipeGenContext = {
  count: number;
  category?: string;
  meal_time?: string;
  max_time?: number;
  difficulty?: string;
  restrictions?: string[];
  wanted_ingredients?: string[];
  avoid_ingredients?: string[];
  notes?: string;
  avoid_recipe_ids: string[];
  existing_recipe_names: string[];
  existing_ingredients: string[];
};

export type ProviderResult = { raw: string; cost: number; usage?: { input_tokens?: number; output_tokens?: number } };
export type TemplateRef = { id: string; version: string; prompt: string };

export type RegenPart = "recipe" | "description" | "instructions";
export type RegenInput = {
  part: RegenPart;
  variant: number;
  recipe: { name: string; description: string; category: string; instructions: string[]; ingredients: string[]; prep_time: number; cook_time: number };
  notes?: string;
};

export interface RecipeGenerationProvider {
  readonly name: string;
  readonly model: string;
  /** Providers pagos passam pelos guardrails de custo. */
  readonly paid: boolean;
  estimateCost(ctx: RecipeGenContext): number;
  generate(ctx: RecipeGenContext, template: TemplateRef, attempt: number): Promise<ProviderResult>;
  regenerate(input: RegenInput, template: TemplateRef, attempt: number): Promise<ProviderResult>;
}

const MEAL_OF: Record<string, CatalogRecipe["meal"]> = {
  "cafe da manha": "breakfast", breakfast: "breakfast", almoco: "lunch", lunch: "lunch", jantar: "dinner", dinner: "dinner", lanche: "snack", snack: "snack",
};
const RANK = { easy: 0, medium: 1, hard: 2 } as const;
const DIFF: Record<string, keyof typeof RANK> = { facil: "easy", easy: "easy", medio: "medium", media: "medium", medium: "medium", dificil: "hard", hard: "hard" };

/**
 * Conteúdo previsível para desenvolvimento (§42). Respeita filtros e evita nomes já existentes.
 * Diretivas de teste nas observações: [mock:malformed] [mock:invalid] [mock:fail-external] (falha na 1ª tentativa).
 */
export class MockRecipeGenerationProvider implements RecipeGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-catalog-v1";
  readonly paid = false;

  estimateCost() {
    return 0;
  }

  async generate(ctx: RecipeGenContext, _t: TemplateRef, attempt: number): Promise<ProviderResult> {
    const notes = ctx.notes ?? "";
    if (notes.includes("[mock:fail-external]") && attempt <= 1) throw new ProviderError("external", "Mock: falha de rede simulada (tente novamente).");
    if (notes.includes("[mock:malformed]")) return { raw: "Claro! Aqui estão as receitas:\n1) Macarrão…", cost: 0 };

    const taken = new Set(ctx.existing_recipe_names.map(normalize));
    const avoid = (ctx.avoid_ingredients ?? []).map(normalize).filter(Boolean);
    const cat = ctx.category ? normalize(ctx.category) : "";
    const meal = ctx.meal_time ? MEAL_OF[normalize(ctx.meal_time)] : undefined;
    const maxDiff = ctx.difficulty ? RANK[DIFF[normalize(ctx.difficulty)] ?? "hard"] : 2;
    const wanted = (ctx.wanted_ingredients ?? []).map(normalize).filter(Boolean);

    let pool = MOCK_CATALOG.filter((r) => !taken.has(normalize(r.name)))
      .filter((r) => !cat || normalize(r.category) === cat || (MEAL_OF[cat] && r.meal === MEAL_OF[cat]))
      .filter((r) => !meal || r.meal === meal)
      .filter((r) => !ctx.max_time || r.prep_time + r.cook_time <= ctx.max_time)
      .filter((r) => RANK[r.difficulty] <= maxDiff)
      .filter((r) => !avoid.some((a) => r.ingredients.some((i) => normalize(i.name).includes(a))));
    // ingredientes desejados sobem na fila
    const score = (r: CatalogRecipe) => wanted.filter((w) => r.ingredients.some((i) => normalize(i.name).includes(w))).length;
    pool = pool.map((r, i) => ({ r, i })).sort((a, b) => score(b.r) - score(a.r) || a.i - b.i).map((x) => x.r);

    const picked: Record<string, unknown>[] = pool.slice(0, ctx.count).map((r) => ({
      name: r.name, description: r.description, category: r.category, prep_time: r.prep_time, cook_time: r.cook_time, servings: r.servings,
      difficulty: r.difficulty, ingredients: r.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, note: i.note ?? "" })),
      instructions: r.instructions, tags: r.tags,
    }));
    if (notes.includes("[mock:invalid]") && picked.length) {
      picked[picked.length - 1] = { ...picked[picked.length - 1], difficulty: "impossível", instructions: [] };
    }
    return { raw: JSON.stringify({ recipes: picked }), cost: 0 };
  }

  async regenerate(input: RegenInput, _t: TemplateRef, _attempt: number): Promise<ProviderResult> {
    const r = input.recipe;
    const v = input.variant % 3;
    if (input.part === "description") {
      const options = [
        `${r.name}: prática, saborosa e feita com ingredientes simples do dia a dia.`,
        `Uma receita de ${r.category.toLowerCase() || "casa"} para quando o tempo é curto e a vontade é de comer bem.`,
        `Caseira e equilibrada — ${r.name.toLowerCase()} do jeito que dá certo em qualquer cozinha.`,
      ];
      return { raw: JSON.stringify({ description: options[v] }), cost: 0 };
    }
    if (input.part === "instructions") {
      const steps = r.instructions.length ? r.instructions : ["Prepare os ingredientes."];
      const rewritten = steps.map((s, i) => `${["Primeiro", "Em seguida", "Depois", "Por fim"][Math.min(i, 3)]}: ${s.charAt(0).toLowerCase()}${s.slice(1)}`);
      return { raw: JSON.stringify({ instructions: v === 0 ? rewritten : [...rewritten].map((s) => s.replace(/^[^:]+: /, "")) }), cost: 0 };
    }
    // recipe inteira: próxima do catálogo ainda não usada com a mesma categoria
    const alt = MOCK_CATALOG.find((c) => normalize(c.category) === normalize(r.category) && normalize(c.name) !== normalize(r.name));
    const base = alt ?? MOCK_CATALOG[0];
    return {
      raw: JSON.stringify({ recipes: [{ ...base, ingredients: base.ingredients.map((i) => ({ ...i, note: i.note ?? "" })) }] }),
      cost: 0,
    };
  }
}

/* ───────── imagem ───────── */

export type ImageInput = { prompt: string; negative?: string; label: string };
export type ImageResult =
  | { status: "disabled" }
  | { status: "generated"; bytes: Uint8Array; mimeType: "image/png" | "image/jpeg" | "image/webp"; model: string; cost: number };

export interface ImageGenerationProvider {
  readonly name: string;
  readonly model: string;
  readonly paid: boolean;
  estimateCost(): number;
  generateRecipeImage(input: ImageInput): Promise<ImageResult>;
  generateIngredientImage(input: ImageInput): Promise<ImageResult>;
}

/** Padrão do MVP (§43): a arquitetura de imagem inteira funciona, sem custo e sem chamada externa. */
export class DisabledImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "disabled";
  readonly model = "none";
  readonly paid = false;
  estimateCost() {
    return 0;
  }
  async generateRecipeImage(): Promise<ImageResult> {
    return { status: "disabled" };
  }
  async generateIngredientImage(): Promise<ImageResult> {
    return { status: "disabled" };
  }
}

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Só para desenvolvimento (IMAGE_PROVIDER=mock): devolve um PNG mínimo, sem rede. */
export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "mock";
  readonly model = "mock-png";
  readonly paid = false;
  estimateCost() {
    return 0;
  }
  private png(): ImageResult {
    return { status: "generated", bytes: Uint8Array.from(atob(PNG_1X1), (c) => c.charCodeAt(0)), mimeType: "image/png", model: this.model, cost: 0 };
  }
  async generateRecipeImage() {
    return this.png();
  }
  async generateIngredientImage() {
    return this.png();
  }
}

/** Implementação futura (§17). Só é instanciada com IMAGE_GENERATION_ENABLED=true e passa pelos guardrails. */
export class OpenAIImageProvider implements ImageGenerationProvider {
  readonly name = "openai";
  readonly paid = true;
  readonly model: string;
  constructor(private apiKey: string, model = "gpt-image-1") {
    this.model = model;
  }
  estimateCost() {
    return 0.05; // estimativa fixa por imagem; a API não devolve custo
  }
  generateRecipeImage(input: ImageInput) {
    return this.call(input, "1536x1024");
  }
  generateIngredientImage(input: ImageInput) {
    return this.call(input, "1024x1024");
  }
  private async call(input: ImageInput, size: string): Promise<ImageResult> {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, prompt: input.prompt, size, n: 1 }),
        signal: AbortSignal.timeout(90_000),
      });
    } catch {
      throw new ProviderError("external", "Não foi possível falar com o provider de imagens (rede ou timeout).");
    }
    if (res.status >= 500 || res.status === 429) throw new ProviderError("external", `Provider de imagens indisponível (HTTP ${res.status}).`);
    if (!res.ok) throw new ProviderError("structural", `O provider de imagens recusou a requisição (HTTP ${res.status}).`);
    const json = (await res.json().catch(() => null)) as { data?: { b64_json?: string }[] } | null;
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError("structural", "O provider de imagens não devolveu uma imagem.");
    return { status: "generated", bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), mimeType: "image/png", model: this.model, cost: this.estimateCost() };
  }
}

/* ───────── seleção por configuração ───────── */

export function getRecipeProvider(env: Env): RecipeGenerationProvider {
  const name = (env.RECIPE_PROVIDER ?? "mock").trim().toLowerCase();
  if (name === "mock") return new MockRecipeGenerationProvider();
  throw new ProviderError("structural", `RECIPE_PROVIDER="${name}" não está configurado. Providers disponíveis: mock.`);
}

export function getImageProvider(env: Env, imageEnabled: boolean): ImageGenerationProvider {
  // sem a flag, nenhuma implementação com rede é sequer instanciada
  if (!imageEnabled) return new DisabledImageGenerationProvider();
  const name = (env.IMAGE_PROVIDER ?? "disabled").trim().toLowerCase();
  if (name === "mock") return new MockImageGenerationProvider();
  if (name === "openai") {
    if (!env.OPENAI_API_KEY) throw new ProviderError("structural", "OPENAI_API_KEY não configurada (wrangler secret put OPENAI_API_KEY).");
    return new OpenAIImageProvider(env.OPENAI_API_KEY, env.OPENAI_IMAGE_MODEL);
  }
  return new DisabledImageGenerationProvider();
}
