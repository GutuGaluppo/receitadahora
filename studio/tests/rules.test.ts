import { describe, expect, it } from "vitest";
import { findDuplicates, type RecipeFingerprint } from "@/worker/lib/duplicates";
import { matchIngredient, toRef } from "@/worker/lib/matching";
import { buildImagePrompt } from "@/worker/lib/prompt";
import { publishBlockers } from "@/worker/lib/publish";
import { computeAutoStatus } from "@/worker/lib/status";
import { ingredientKey, slugify } from "@/worker/lib/text";
import type { RecipeFull } from "@/worker/lib/repo";

const lib = [
  toRef({ id: "i_tomate", name: "Tomate", slug: "tomate", normalized_name: ingredientKey("Tomate") }, [ingredientKey("tomate cereja")]),
  toRef({ id: "i_pimentao", name: "Pimentão vermelho", slug: "pimentao-vermelho", normalized_name: ingredientKey("Pimentão vermelho") }, []),
  toRef({ id: "i_cebola", name: "Cebola", slug: "cebola", normalized_name: ingredientKey("Cebola") }, []),
  toRef({ id: "i_azeite", name: "Azeite de oliva", slug: "azeite-de-oliva", normalized_name: ingredientKey("Azeite de oliva") }, []),
];

describe("normalização", () => {
  it("variações do mesmo ingrediente têm a mesma chave", () => {
    const k = ingredientKey("Tomate");
    expect(ingredientKey("Tomates")).toBe(k);
    expect(ingredientKey("tomate fresco")).toBe(k);
    expect(ingredientKey("Tomates frescos (maduros)")).toBe(k);
    expect(ingredientKey("Limões")).toBe(ingredientKey("limão"));
    expect(ingredientKey("Pães")).toBe(ingredientKey("pão"));
  });
  it("slug sem acentos", () => expect(slugify("Grão-de-bico Ação")).toBe("grao-de-bico-acao"));
});

describe("matching de ingredientes", () => {
  it("reutiliza por nome, plural e modificadores", () => {
    for (const n of ["Tomates", "tomate fresco", "TOMATE"]) {
      const m = matchIngredient(n, lib);
      expect(m.kind).toBe("exact");
    }
  });
  it("reutiliza por alias", () => {
    const m = matchIngredient("Tomate cereja", lib);
    expect(m).toMatchObject({ kind: "exact", via: "alias" });
  });
  it("pede decisão quando um nome contém o outro", () => {
    expect(matchIngredient("Pimentão", lib).kind).toBe("possible");
    expect(matchIngredient("Azeite", lib).kind).toBe("possible");
  });
  it("ingredientes diferentes não se confundem", () => {
    expect(matchIngredient("Cebolinha", lib).kind).toBe("none");
    expect(matchIngredient("Pimenta", lib).kind).toBe("none");
    expect(matchIngredient("Abacate", lib).kind).toBe("none");
  });
});

const fp = (over: Partial<RecipeFingerprint>): RecipeFingerprint => ({
  id: "a", name: "Torrada de Abacate com Ovo", slug: "t", category: "Café da manhã",
  instructions: ["Toste o pão.", "Amasse o abacate.", "Monte com o ovo."],
  ingredients: [
    { ingredient_id: "abacate", quantity: 1, unit: "un" }, { ingredient_id: "ovo", quantity: 2, unit: "un" }, { ingredient_id: "pao", quantity: 2, unit: "fatias" },
  ],
  ...over,
});

describe("duplicidade de receitas", () => {
  it("nome diferente, mesmos ingredientes e preparo → alta", () => {
    const hits = findDuplicates(fp({ id: "b", name: "Torrada com Abacate e Ovo" }), [fp({})]);
    expect(hits[0]?.level).toBe("high");
  });
  it("receitas diferentes não geram alerta", () => {
    const other = fp({
      id: "c", name: "Sopa de Lentilha", category: "Sopas", instructions: ["Refogue a cebola.", "Cozinhe a lentilha."],
      ingredients: [{ ingredient_id: "lentilha", quantity: 1, unit: "xícara" }, { ingredient_id: "cebola", quantity: 1, unit: "un" }],
    });
    expect(findDuplicates(other, [fp({})])).toHaveLength(0);
  });
  it("nome igual mas ingredientes e preparo diferentes não é alta", () => {
    const hits = findDuplicates(fp({ id: "d", ingredients: [{ ingredient_id: "tomate", quantity: 2, unit: "un" }], instructions: ["Grelhe."], category: "Lanches" }), [fp({})]);
    expect(hits.every((h) => h.level !== "high")).toBe(true);
  });
  it("não compara a receita consigo mesma", () => expect(findDuplicates(fp({}), [fp({})])).toHaveLength(0));
});

describe("status automático", () => {
  const base = { status: "draft" as const, hasData: true, hasHero: true, missingIngredientAssets: 0 };
  it("dados incompletos → draft", () => expect(computeAutoStatus({ ...base, hasData: false })).toBe("draft"));
  it("sem imagem ou com ingrediente sem asset → image_pending", () => {
    expect(computeAutoStatus({ ...base, hasHero: false })).toBe("image_pending");
    expect(computeAutoStatus({ ...base, missingIngredientAssets: 1 })).toBe("image_pending");
  });
  it("tudo no lugar → review", () => expect(computeAutoStatus(base)).toBe("review"));
  it("nunca mexe em approved/published/rejected", () => {
    for (const s of ["approved", "published", "rejected"] as const) expect(computeAutoStatus({ ...base, status: s, hasHero: false })).toBe(s);
  });
});

const recipe = (over: Partial<RecipeFull> = {}): RecipeFull => ({
  id: "r", name: "Massa", slug: "massa", description: "", category: "Massas", prep_time: 10, cook_time: 10, servings: 2, difficulty: "easy",
  instructions: ["a"], tags: [], visual_ingredients: [], status: "approved", reject_reason: null, batch: null, created_at: "", updated_at: "", published_at: null,
  provenance: { source_type: "manual", source_job_id: null, template_version: null, provider: null, model: null, generated_at: null, approved_by: null, approved_at: null },
  hero: { id: "h", key: "k", url: "u", filename: "f", mime_type: "image/png", size_bytes: 1, version: 1, status: "approved", reject_reason: null, created_at: "", updated_at: "" },
  hero_versions: [],
  ingredients: [{ id: "x", ingredient_id: "i", name: "Tahine", slug: "tahine", raw_name: "tahine", quantity: 1, unit: "un", note: "", asset: { id: "a", key: "k", url: "u", status: "approved", version: 1 } }],
  ...over,
});

describe("validação de publicação", () => {
  it("liberada quando tudo está aprovado", () => expect(publishBlockers(recipe())).toEqual([]));
  it("lista ingredientes sem imagem aprovada pelo nome", () => {
    const r = recipe({ ingredients: [
      { id: "1", ingredient_id: "a", name: "Tahine", slug: "t", raw_name: "", quantity: 1, unit: "", note: "", asset: null },
      { id: "2", ingredient_id: "b", name: "Cebolinha", slug: "c", raw_name: "", quantity: 1, unit: "", note: "", asset: { id: "x", key: "k", url: "u", status: "review", version: 1 } },
    ] });
    const b = publishBlockers(r).find((x) => x.code === "ingredient_assets")!;
    expect(b.items).toEqual(["Tahine", "Cebolinha"]);
  });
  it("exige imagem principal aprovada e receita aprovada", () => {
    const codes = (r: RecipeFull) => publishBlockers(r).map((b) => b.code);
    expect(codes(recipe({ hero: null }))).toContain("no_hero");
    expect(codes(recipe({ hero: { ...recipe().hero!, status: "review" } }))).toContain("hero_not_approved");
    expect(codes(recipe({ status: "review" }))).toContain("not_approved");
  });
  it("exige dados válidos", () => {
    const b = publishBlockers(recipe({ instructions: [], category: "" })).find((x) => x.code === "invalid_data")!;
    expect(b.items).toEqual(expect.arrayContaining(["modo de preparo", "categoria"]));
  });
});

describe("prompt de imagem (Recipe Photography System)", () => {
  it("usa só os ingredientes visuais informados e as regras negativas", () => {
    const { prompt, negative } = buildImagePrompt({ name: "Pasta Cremosa de Abóbora", description: "creamy pasta", category: "Massas", visualIngredients: ["roasted pumpkin", "sage"] });
    expect(prompt).toContain("roasted pumpkin, sage");
    expect(prompt).toContain("shallow warm-white ceramic bowl");
    expect(prompt).toContain("No ingredients not listed in the recipe.");
    expect(negative).toContain("hands");
  });
});
