import { describe, expect, it } from "vitest";
import fixture from "@contracts/catalog.fixture.json";
import { catalogSchema, publicRecipeSchema } from "@contracts/catalog";
import { metadataInput } from "@/worker/lib/metadata";
import { signPayload } from "@/worker/lib/revalidate";

describe("contrato do catálogo v1", () => {
  it("a fixture compartilhada é válida", () => expect(catalogSchema.safeParse(fixture).success).toBe(true));
  it("recusa schemaVersion desconhecido", () => expect(catalogSchema.safeParse({ ...fixture, schemaVersion: 2 }).success).toBe(false));
  it("allergens é obrigatório (ausência não vira lista vazia)", () => {
    const { allergens: _omit, ...rest } = fixture.recipes[0];
    void _omit;
    expect(publicRecipeSchema.safeParse(rest).success).toBe(false);
  });
  it("quantidade null = 'a gosto' é aceita; negativa não", () => {
    const base = fixture.recipes[0];
    expect(publicRecipeSchema.safeParse(base).success).toBe(true);
    expect(publicRecipeSchema.safeParse({ ...base, ingredients: [{ item: "x", quantity: -1, unit: "" }] }).success).toBe(false);
  });
});

describe("metadados editoriais", () => {
  const ok = {
    meal_types: ["lunch"], dietary_tags: [], allergens: [], ingredients_tags: ["abóbora"], cuisine: "italiana",
    traits: { comfort: 80, lightness: 20, protein: 30, cost: 30, novelty: 40 }, weather_affinity: { hot: 10, mild: 50, cold: 90, rainy: 90 }, palette_key: "warm",
  };
  it("aceita corpo completo", () => expect(metadataInput.safeParse(ok).success).toBe(true));
  it("alérgeno fora do vocabulário fechado é recusado", () => expect(metadataInput.safeParse({ ...ok, allergens: ["gluten-free"] }).success).toBe(false));
  it("traits fora de 0–100 são recusados", () => expect(metadataInput.safeParse({ ...ok, traits: { ...ok.traits, comfort: 120 } }).success).toBe(false));
  it("allergens ausente é recusado (null não existe no envio)", () => {
    const { allergens: _a, ...rest } = ok;
    void _a;
    expect(metadataInput.safeParse(rest).success).toBe(false);
  });
});

describe("assinatura do webhook", () => {
  it("é determinística e depende de segredo, timestamp e corpo", async () => {
    const a = await signPayload("s", "1", "{}");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await signPayload("s", "1", "{}")).toBe(a);
    expect(await signPayload("x", "1", "{}")).not.toBe(a);
    expect(await signPayload("s", "2", "{}")).not.toBe(a);
    expect(await signPayload("s", "1", "{ }")).not.toBe(a);
  });
});
