import { catalogSchema, type StudioCatalog, type StudioPublicRecipe } from "@contracts/catalog";
import { PALETTES } from "@/data/palettes";
import type { Recipe } from "@/types";

/** Resolve `imageUrl` do contrato: caminho da API pública → absoluto no host do Studio; outros caminhos são do próprio app. */
export function resolveAssetUrl(url: string | null | undefined, apiBase: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (apiBase && url.startsWith("/api/public/")) return `${apiBase}${url}`;
  return url;
}

/** DTO público (contrato v1) → `Recipe` do app. É o único lugar que conhece essa conversão. */
export function toRecipe(dto: StudioPublicRecipe, apiBase: string | null): Recipe {
  return {
    id: dto.id,
    slug: dto.slug,
    legacyIds: dto.legacyIds,
    featured: dto.featured,
    title: dto.title,
    description: dto.description,
    imageUrl: resolveAssetUrl(dto.imageUrl, apiBase),
    prepTimeMinutes: dto.prepTimeMinutes,
    servings: dto.servings,
    cuisine: dto.cuisine,
    ingredients: dto.ingredients.map((i) => ({
      item: i.item,
      quantity: i.quantity,
      unit: i.unit,
      ...(i.note ? { note: i.note } : {}),
      ...(i.note && /opcional/i.test(i.note) ? { optional: true } : {}),
    })),
    steps: dto.steps,
    mealTypes: dto.mealTypes,
    dietaryTags: dto.dietaryTags,
    ingredientsTags: dto.ingredientsTags,
    nutrition: dto.nutrition,
    traits: dto.traits,
    weatherAffinity: dto.weatherAffinity,
    palette: PALETTES[dto.paletteKey],
    active: true,
    createdAt: dto.publishedAt,
  };
}

export class ContractError extends Error {}

/** Valida o JSON recebido. Recusa `schemaVersion` desconhecido e qualquer desvio do contrato (nada de conteúdo parcial). */
export function parseCatalog(json: unknown): StudioCatalog {
  const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== 1) throw new ContractError(`schemaVersion desconhecido: ${String(version)}`);
  const parsed = catalogSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ContractError(`contrato inválido em ${issue?.path.join(".") || "(raiz)"}: ${issue?.message}`);
  }
  return parsed.data;
}

export type Snapshot = StudioCatalog & { source: "studio" | "seed" };

/**
 * Regras do snapshot de contingência (plano §8.6), para nunca reviver conteúdo retirado:
 *  1. idade máxima; 2. lista de bloqueio por id/slug; 3. só entra o que tem `allergens` revisado
 *  (o contrato torna o campo obrigatório; aqui garantimos que o snapshot veio do Studio, não do seed).
 */
export function selectFallback(
  snap: Snapshot,
  opts: { now: number; maxAgeHours: number; blocklist: ReadonlySet<string> },
): { ok: true; recipes: StudioPublicRecipe[] } | { ok: false; reason: "seed_snapshot" | "too_old" | "empty" } {
  if (snap.source !== "studio") return { ok: false, reason: "seed_snapshot" };
  const age = opts.now - Date.parse(snap.generatedAt);
  if (!Number.isFinite(age) || age > opts.maxAgeHours * 3_600_000) return { ok: false, reason: "too_old" };
  const recipes = snap.recipes.filter((r) => !opts.blocklist.has(r.id) && !opts.blocklist.has(r.slug) && !r.legacyIds.some((l) => opts.blocklist.has(l)));
  return recipes.length ? { ok: true, recipes } : { ok: false, reason: "empty" };
}

export function parseBlocklist(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}
