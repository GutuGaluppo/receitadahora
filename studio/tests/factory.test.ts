import { describe, expect, it } from "vitest";
import type { Env } from "@/worker/env";
import { checkBudget, flagsFrom } from "@/worker/lib/factory/config";
import { extractJson, generatedRecipeSchema, normalizeRecipe, parseEnvelope, parseQuantity, StructuralError, titleDuplicates } from "@/worker/lib/factory/normalize";
import { DisabledImageGenerationProvider, getImageProvider, getRecipeProvider, MockRecipeGenerationProvider, ProviderError, type RecipeGenContext } from "@/worker/lib/factory/providers";
import { deriveFactoryState } from "@/worker/lib/factory/state";
import { composeIngredientImagePrompt, composeRecipeImagePrompt, DEFAULT_TEMPLATES, render } from "@/worker/lib/factory/templates";
import { MOCK_CATALOG } from "@/worker/lib/factory/mock-catalog";

const env = (v: Record<string, string> = {}) => v as unknown as Env;
const ctx = (over: Partial<RecipeGenContext> = {}): RecipeGenContext => ({ count: 5, avoid_recipe_ids: [], existing_recipe_names: [], existing_ingredients: [], ...over });
const tpl = { id: "t", version: "v1", prompt: "" };

describe("feature flags", () => {
  it("tudo nasce desligado quando a variável não existe", () => {
    const f = flagsFrom(env());
    expect(f).toEqual({ content: false, image: false, autoBatch: false, dailyLimit: 0, monthlyBudget: 0 });
  });
  it("só 'true' liga; qualquer outra coisa desliga", () => {
    expect(flagsFrom(env({ IMAGE_GENERATION_ENABLED: "true" })).image).toBe(true);
    expect(flagsFrom(env({ IMAGE_GENERATION_ENABLED: "1" })).image).toBe(false);
    expect(flagsFrom(env({ IMAGE_GENERATION_ENABLED: "false" })).image).toBe(false);
  });
  it("limites inválidos viram 0 (nunca liberam gasto por engano)", () => {
    const f = flagsFrom(env({ DAILY_GENERATION_LIMIT: "abc", MONTHLY_GENERATION_BUDGET: "-5" }));
    expect([f.dailyLimit, f.monthlyBudget]).toEqual([0, 0]);
  });
  it("imagem: sem a flag, mesmo IMAGE_PROVIDER=openai com chave devolve o provider desativado (sem rede)", () => {
    const p = getImageProvider(env({ IMAGE_PROVIDER: "openai", OPENAI_API_KEY: "sk-x" }), false);
    expect(p).toBeInstanceOf(DisabledImageGenerationProvider);
  });
  it("imagem: openai sem chave falha de forma explícita", () => {
    expect(() => getImageProvider(env({ IMAGE_PROVIDER: "openai" }), true)).toThrow(ProviderError);
  });
  it("provider de receitas desconhecido é erro estrutural claro", () => {
    expect(() => getRecipeProvider(env({ RECIPE_PROVIDER: "xyz" }))).toThrow(/não está configurado/);
    expect(getRecipeProvider(env()).name).toBe("mock");
  });
  it("DisabledImageGenerationProvider devolve status disabled", async () => {
    const p = new DisabledImageGenerationProvider();
    expect(await p.generateRecipeImage()).toEqual({ status: "disabled" });
    expect(await p.generateIngredientImage()).toEqual({ status: "disabled" });
  });
});

describe("guardrails de custo", () => {
  const base = { paid: true, estimatedCost: 1, dailyLimit: 5, monthlyBudget: 20, paidJobsToday: 0, spentThisMonth: 0 };
  it("provider gratuito sempre passa", () => expect(checkBudget({ ...base, paid: false, dailyLimit: 0, monthlyBudget: 0 }).allowed).toBe(true));
  it("pago com limites 0 é bloqueado", () => {
    expect(checkBudget({ ...base, dailyLimit: 0 }).allowed).toBe(false);
    expect(checkBudget({ ...base, monthlyBudget: 0 }).allowed).toBe(false);
  });
  it("limite diário e orçamento mensal", () => {
    expect(checkBudget({ ...base, paidJobsToday: 5 }).allowed).toBe(false);
    expect(checkBudget({ ...base, spentThisMonth: 19.5 }).allowed).toBe(false);
    expect(checkBudget({ ...base, spentThisMonth: 19 }).allowed).toBe(true);
  });
  it("o bloqueio sempre explica o motivo", () => {
    const d = checkBudget({ ...base, paidJobsToday: 5 });
    expect(!d.allowed && d.reason).toMatch(/Limite diário/);
  });
});

describe("parse e validação da saída do modelo", () => {
  const recipe = { name: "Teste", description: "d", category: "Jantar", prep_time: 5, cook_time: 10, servings: 2, difficulty: "easy", ingredients: [{ name: "Ovo", quantity: "2", unit: "un" }], instructions: ["a"], tags: [] };
  it("aceita JSON puro, com cerca de markdown e com texto em volta", () => {
    const json = JSON.stringify({ recipes: [recipe] });
    expect(extractJson(json)).toBeTruthy();
    expect(extractJson("```json\n" + json + "\n```")).toBeTruthy();
    expect(extractJson("Aqui está:\n" + json + "\nBom apetite!")).toBeTruthy();
  });
  it("texto que não é JSON → StructuralError (resultado bruto é preservado pelo pipeline)", () => {
    expect(() => parseEnvelope("1) Macarrão…")).toThrow(StructuralError);
  });
  it("formato errado ou vazio → StructuralError", () => {
    expect(() => parseEnvelope('{"items":[]}')).toThrow(/formato esperado/);
    expect(() => parseEnvelope('{"recipes":[]}')).toThrow(/nenhuma receita/);
  });
  it("schema rejeita receita sem ingredientes/preparo", () => {
    expect(generatedRecipeSchema.safeParse({ ...recipe, ingredients: [] }).success).toBe(false);
    expect(generatedRecipeSchema.safeParse({ ...recipe, instructions: [] }).success).toBe(false);
    expect(generatedRecipeSchema.safeParse(recipe).success).toBe(true);
  });
  it("normaliza dificuldade em pt/en e rejeita desconhecida", () => {
    const ok = (d: string) => normalizeRecipe(generatedRecipeSchema.parse({ ...recipe, difficulty: d }));
    expect(ok("Fácil")).toMatchObject({ ok: true, recipe: { difficulty: "easy" } });
    expect(ok("médio")).toMatchObject({ ok: true, recipe: { difficulty: "medium" } });
    expect(ok("impossível")).toMatchObject({ ok: false });
  });
  it("normaliza categoria em inglês e remove ingredientes repetidos com aviso", () => {
    const r = normalizeRecipe(generatedRecipeSchema.parse({ ...recipe, category: "dinner", ingredients: [{ name: "Ovo", quantity: "1" }, { name: "ovo", quantity: "2" }] }));
    expect(r.ok && r.recipe.category).toBe("Jantar");
    expect(r.ok && r.recipe.ingredients).toHaveLength(1);
    expect(r.ok && r.recipe.warnings[0]).toMatch(/repetido/);
  });
});

describe("quantidades", () => {
  it.each([
    ["200", 200], ["1/2", 0.5], ["1 1/2", 1.5], ["1,5", 1.5], [3, 3], ["a gosto", null], ["", null], [null, null],
  ])("%s → %s", (q, v) => expect(parseQuantity(q as string).value).toBe(v));
  it("texto não interpretável vira null e é sinalizado", () => expect(parseQuantity("um punhado")).toEqual({ value: null, unparsed: "um punhado" }));
});

describe("duplicidade por título (1º nível)", () => {
  const existing = [{ id: "1", name: "Omelete Simples", slug: "omelete-simples" }];
  it("mesmo título normalizado é duplicata (acentos/caixa)", () => {
    expect(titleDuplicates("omelete  SIMPLES", existing)).toHaveLength(1);
    expect(titleDuplicates("Omelete Simples!", existing)).toHaveLength(1);
  });
  it("títulos diferentes passam", () => expect(titleDuplicates("Omelete de Queijo", existing)).toHaveLength(0));
});

describe("MockRecipeGenerationProvider", () => {
  const p = new MockRecipeGenerationProvider();
  const gen = async (c: Partial<RecipeGenContext> = {}, attempt = 1) => JSON.parse((await p.generate(ctx(c), tpl, attempt)).raw).recipes as { name: string; category: string; prep_time: number; cook_time: number; difficulty: string; ingredients: { name: string }[] }[];

  it("todo o catálogo passa pelo schema e pela normalização (formato idêntico ao de um modelo real)", () => {
    for (const r of MOCK_CATALOG) {
      const parsed = generatedRecipeSchema.safeParse({ ...r });
      expect(parsed.success, r.name).toBe(true);
      expect(normalizeRecipe(parsed.data!).ok, r.name).toBe(true);
    }
  });
  it("é determinístico e não custa nada", async () => {
    expect(await gen({ count: 4 })).toEqual(await gen({ count: 4 }));
    expect((await p.generate(ctx(), tpl, 1)).cost).toBe(0);
    expect(p.paid).toBe(false);
  });
  it("respeita quantidade, categoria, tempo máximo e dificuldade", async () => {
    expect(await gen({ count: 3 })).toHaveLength(3);
    for (const r of await gen({ count: 20, category: "Massas" })) expect(r.category).toBe("Massas");
    // categorias de refeição ("Jantar") casam com pratos desse momento do dia
    expect((await gen({ count: 20, category: "Jantar" })).length).toBeGreaterThan(3);
    for (const r of await gen({ count: 20, max_time: 15 })) expect(r.prep_time + r.cook_time).toBeLessThanOrEqual(15);
    for (const r of await gen({ count: 20, difficulty: "easy" })) expect(r.difficulty).toBe("easy");
  });
  it("não repete nomes existentes e evita ingredientes indesejados", async () => {
    const first = await gen({ count: 20 });
    const rest = await gen({ count: 20, existing_recipe_names: [first[0].name] });
    expect(rest.some((r) => r.name === first[0].name)).toBe(false);
    for (const r of await gen({ count: 20, avoid_ingredients: ["ovo"] })) expect(r.ingredients.some((i) => /ovo/i.test(i.name))).toBe(false);
  });
  it("ingredientes desejados sobem na fila", async () => {
    expect((await gen({ count: 1, wanted_ingredients: ["cogumelo"] }))[0].ingredients.some((i) => /cogumelo/i.test(i.name))).toBe(true);
  });
  it("diretivas de teste: malformed, invalid e falha externa só na 1ª tentativa", async () => {
    await expect(p.generate(ctx({ notes: "[mock:fail-external]" }), tpl, 1)).rejects.toMatchObject({ kind: "external" });
    await expect(p.generate(ctx({ notes: "[mock:fail-external]" }), tpl, 2)).resolves.toBeTruthy();
    const malformed = (await p.generate(ctx({ notes: "[mock:malformed]" }), tpl, 1)).raw;
    expect(() => parseEnvelope(malformed)).toThrow(StructuralError);
    const bad = (await gen({ count: 3, notes: "[mock:invalid]" })).at(-1)!;
    expect(normalizeRecipe(generatedRecipeSchema.parse({ ...bad, instructions: ["x"] })).ok).toBe(false);
  });
  it("regeneração granular devolve só a parte pedida", async () => {
    const recipe = { name: "Sopa", description: "", category: "Sopas", instructions: ["Cozinhe."], ingredients: ["Abóbora"], prep_time: 5, cook_time: 5 };
    const d = JSON.parse((await p.regenerate({ part: "description", variant: 0, recipe }, tpl, 1)).raw);
    expect(Object.keys(d)).toEqual(["description"]);
    const i = JSON.parse((await p.regenerate({ part: "instructions", variant: 0, recipe }, tpl, 1)).raw);
    expect(Object.keys(i)).toEqual(["instructions"]);
  });
});

describe("estado da Factory", () => {
  const base = { processing: null, latest: null, pendingDecisions: 0, recipesAwaitingReview: 0, contentEnabled: true };
  it("Idle sem jobs", () => expect(deriveFactoryState(base)).toBe("Idle"));
  it("Generating / Validating enquanto processa", () => {
    expect(deriveFactoryState({ ...base, processing: { hasRawOutput: false } })).toBe("Generating");
    expect(deriveFactoryState({ ...base, processing: { hasRawOutput: true } })).toBe("Validating");
  });
  it("Failed vs Blocked", () => {
    expect(deriveFactoryState({ ...base, latest: { status: "failed", errorKind: "structural" } })).toBe("Failed");
    expect(deriveFactoryState({ ...base, latest: { status: "failed", errorKind: "blocked" } })).toBe("Blocked");
  });
  it("Needs review quando há decisões ou receitas aguardando; Completed quando tudo resolvido", () => {
    expect(deriveFactoryState({ ...base, latest: { status: "completed", errorKind: null }, pendingDecisions: 1 })).toBe("Needs review");
    expect(deriveFactoryState({ ...base, latest: { status: "completed", errorKind: null }, recipesAwaitingReview: 3 })).toBe("Needs review");
    expect(deriveFactoryState({ ...base, latest: { status: "completed", errorKind: null } })).toBe("Completed");
  });
});

describe("templates e prompts", () => {
  it("todos os templates padrão estão versionados e têm placeholders conhecidos", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.version).toMatch(/^v\d/);
      expect([...t.prompt.matchAll(/\{\{(\w+)\}\}/g)].every((m) => ["context", "name", "category", "ingredients", "instructions", "description", "presentation", "mood", "negative"].includes(m[1]))).toBe(true);
    }
    expect(new Set(DEFAULT_TEMPLATES.map((t) => `${t.name}@${t.version}`)).size).toBe(DEFAULT_TEMPLATES.length);
  });
  it("render troca placeholders e ignora os desconhecidos", () => expect(render("Oi {{a}} {{b}}", { a: "x" })).toBe("Oi x "));
  it("prompt de imagem da receita é montado pelo template e inclui negativos e só os ingredientes visuais", () => {
    const t = DEFAULT_TEMPLATES.find((x) => x.type === "recipe_image")!;
    const p = composeRecipeImagePrompt(t, { name: "Massa Cremosa", description: "Cremosa.", category: "Massas", visual_ingredients: ["abóbora", "parmesão"] });
    expect(p).toContain("Massa Cremosa");
    expect(p).toContain("abóbora, parmesão");
    expect(p).toContain("shallow warm-white ceramic bowl");
    expect(p).toMatch(/Negative constraints:[\s\S]*people/);
    expect(p).not.toContain("{{");
  });
  it("prompt de ingrediente", () => {
    const p = composeIngredientImagePrompt(DEFAULT_TEMPLATES.find((x) => x.type === "ingredient_image")!, { name: "Tomate-cereja" });
    expect(p).toContain("Tomate-cereja");
    expect(p).not.toContain("{{");
  });
});
