import { describe, expect, it } from "vitest";
import fixture from "@contracts/catalog.fixture.json";
import { ContractError, parseBlocklist, parseCatalog, resolveAssetUrl, selectFallback, toRecipe, type Snapshot } from "@/lib/catalog-adapter";
import { translateLegacyIds } from "@/lib/legacy-ids";
import { emptyData, type AppData } from "@/services/storage";
import { isValidRecipe } from "@/services/recommendation";
import { sign, verify } from "@/lib/webhook-signature";
import { PALETTES } from "@/data/palettes";

const dto = fixture.recipes[0] as Parameters<typeof toRecipe>[0];
const NOW = Date.parse("2026-10-08T13:00:00Z");

describe("adapter do contrato v1", () => {
  it("aceita a fixture compartilhada com o Studio", () => expect(parseCatalog(fixture).recipes).toHaveLength(1));
  it("recusa schemaVersion desconhecido", () => expect(() => parseCatalog({ ...fixture, schemaVersion: 2 })).toThrow(ContractError));
  it("recusa receita sem allergens (nada de conteúdo parcial)", () => {
    const { allergens: _a, ...rest } = fixture.recipes[0];
    void _a;
    expect(() => parseCatalog({ ...fixture, recipes: [rest] })).toThrow(ContractError);
  });
  it("converte para Recipe: paleta expandida, imagem absoluta, quantity null preservada", () => {
    const r = toRecipe(dto, "https://content.exemplo.com");
    expect(r.palette).toEqual(PALETTES.warm);
    expect(r.imageUrl).toBe("https://content.exemplo.com/api/public/assets/recipes/pasta-cremosa-de-abobora/hero-v1.webp");
    expect(r.ingredients.find((i) => i.item === "Sal")!.quantity).toBeNull();
    expect(r.legacyIds).toEqual(["pasta-cremosa-abobora"]);
    expect(r.featured).toBe(true);
  });
  it("resolveAssetUrl: absoluta fica; relativa da API recebe a base; caminho do app fica", () => {
    expect(resolveAssetUrl("https://x/y.png", "https://b")).toBe("https://x/y.png");
    expect(resolveAssetUrl("/api/public/assets/a.png", "https://b")).toBe("https://b/api/public/assets/a.png");
    expect(resolveAssetUrl("/recipes/a.webp", "https://b")).toBe("/recipes/a.webp");
    expect(resolveAssetUrl(null, "https://b")).toBe("");
  });
});

describe("segurança alimentar no recomendador", () => {
  it("receita com o alérgeno do usuário nunca é válida (tags + ingredientes)", () => {
    const r = toRecipe(dto, null);
    const base = { dietaryPreferences: [], excludedIngredients: [] };
    expect(isValidRecipe(r, { ...base, allergies: ["leite"] })).toBe(false);
    expect(isValidRecipe(r, { ...base, allergies: ["glúten"] })).toBe(false);
    expect(isValidRecipe(r, { ...base, allergies: ["amendoim"] })).toBe(true);
  });
});

describe("snapshot de contingência", () => {
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ ...(fixture as Snapshot), source: "studio", generatedAt: "2026-10-08T00:00:00Z", ...over });
  const opts = { now: NOW, maxAgeHours: 72, blocklist: new Set<string>() };
  it("usa o snapshot do Studio dentro da idade máxima", () => expect(selectFallback(snap(), opts).ok).toBe(true));
  it("recusa snapshot acima da idade máxima", () => expect(selectFallback(snap({ generatedAt: "2026-09-01T00:00:00Z" }), opts)).toEqual({ ok: false, reason: "too_old" }));
  it("recusa snapshot de exemplo (seed) com o Studio configurado", () => expect(selectFallback(snap({ source: "seed" }), opts)).toEqual({ ok: false, reason: "seed_snapshot" }));
  it("lista de bloqueio remove por id, slug ou id antigo", () => {
    for (const k of ["recipe_fixture0000000001", "pasta-cremosa-de-abobora", "pasta-cremosa-abobora"]) {
      expect(selectFallback(snap(), { ...opts, blocklist: parseBlocklist(`x, ${k}`) })).toEqual({ ok: false, reason: "empty" });
    }
  });
});

describe("tradução de ids legados", () => {
  const map = new Map([["velho", "recipe_novo"]]);
  const d = (): AppData => ({
    ...emptyData(),
    saved: [{ id: "s1", userId: "u", recipeId: "velho", savedAt: "2026-02-01" }, { id: "s2", userId: "u", recipeId: "recipe_novo", savedAt: "2026-01-01" }, { id: "s3", userId: "u", recipeId: "sumiu", savedAt: "2026-03-01" }],
    feedback: [{ id: "f", userId: "u", recipeId: "velho", type: "liked", contextSnapshot: { hour: 1, dayOfWeek: 1 }, createdAt: "x" }],
    events: [{ id: "e", userId: "u", recipeId: "velho", eventType: "recipe_shown", createdAt: "x" }],
  });
  it("traduz, colapsa duplicados mantendo o savedAt mais antigo e preserva ids sem tradução", () => {
    const { data, changed } = translateLegacyIds(d(), map);
    expect(changed).toBe(true);
    expect(data.saved.map((s) => s.recipeId).sort()).toEqual(["recipe_novo", "sumiu"]);
    expect(data.saved.find((s) => s.recipeId === "recipe_novo")!.savedAt).toBe("2026-01-01");
    expect(data.feedback[0].recipeId).toBe("recipe_novo");
    expect(data.events[0].recipeId).toBe("recipe_novo");
  });
  it("é idempotente", () => {
    const once = translateLegacyIds(d(), map).data;
    const twice = translateLegacyIds(once, map);
    expect(twice.changed).toBe(false);
    expect(twice.data).toBe(once);
  });
});

describe("webhook de revalidação", () => {
  const body = '{"event":"catalog.changed"}';
  const ts = String(Math.floor(NOW / 1000));
  const ok = { secret: "s3", timestamp: ts, signature: sign("s3", ts, body), body, nowSeconds: Math.floor(NOW / 1000) };
  it("aceita assinatura válida", () => expect(verify(ok)).toBe("ok"));
  it("rejeita assinatura inválida", () => expect(verify({ ...ok, signature: sign("outro", ts, body) })).toBe("bad_signature"));
  it("rejeita corpo adulterado", () => expect(verify({ ...ok, body: body + " " })).toBe("bad_signature"));
  it("rejeita timestamp antigo (> 5 min)", () => expect(verify({ ...ok, nowSeconds: ok.nowSeconds + 301 })).toBe("stale_timestamp"));
  it("rejeita sem cabeçalhos", () => expect(verify({ ...ok, signature: null })).toBe("missing_headers"));
  it("assinatura com tamanho errado não lança", () => expect(verify({ ...ok, signature: "abcd" })).toBe("bad_signature"));
});
