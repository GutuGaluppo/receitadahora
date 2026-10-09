import { catalogSchema, CATALOG_SCHEMA_VERSION, type StudioCatalog, type StudioPublicRecipe } from "@contracts/catalog";
import type { Env } from "../env";
import { parseJson } from "./metadata";
import { publicAssetUrl } from "./repo";

type Row = Record<string, string | number | null>;

const lower = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/**
 * Constrói o catálogo v1: SOMENTE receitas publicadas e completas. Uma receita cujos metadados
 * obrigatórios estejam ausentes é omitida (e registrada), nunca exposta com valores inventados.
 */
export async function buildCatalog(env: Env): Promise<{ catalog: StudioCatalog; skipped: { id: string; reason: string }[] }> {
  const rows = (
    await env.DB.prepare(
      `SELECT r.*, ha.r2_key AS hero_key
         FROM recipes r
         LEFT JOIN assets ha ON ha.id = r.hero_asset_id AND ha.status = 'approved' AND ha.deleted_at IS NULL
        WHERE r.deleted_at IS NULL AND r.status = 'published'
        ORDER BY r.published_at DESC, r.id`,
    ).all<Row>()
  ).results;

  const ingRows = (
    await env.DB.prepare(
      `SELECT ri.recipe_id, ri.quantity, ri.unit, ri.note, i.name, a.r2_key
         FROM recipe_ingredients ri
         JOIN ingredients i ON i.id = ri.ingredient_id
         JOIN recipes r ON r.id = ri.recipe_id AND r.status = 'published' AND r.deleted_at IS NULL
         LEFT JOIN assets a ON a.id = i.asset_id AND a.status = 'approved' AND a.deleted_at IS NULL
        ORDER BY ri.recipe_id, ri.sort_order, ri.id`,
    ).all<{ recipe_id: string; quantity: number | null; unit: string; note: string; name: string; r2_key: string | null }>()
  ).results;
  const byRecipe = new Map<string, typeof ingRows>();
  for (const i of ingRows) byRecipe.set(i.recipe_id, [...(byRecipe.get(i.recipe_id) ?? []), i]);

  const recipes: StudioPublicRecipe[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const r of rows) {
    const id = String(r.id);
    const allergens = parseJson<string[] | null>(r.allergens as string | null, null);
    const ings = byRecipe.get(id) ?? [];
    const steps = parseJson<string[]>(r.instructions as string, []);
    // Alérgenos não revisados: nunca expor, mesmo que alguém tenha publicado por outro caminho.
    if (allergens === null) { skipped.push({ id, reason: "allergens_not_reviewed" }); continue; }

    const extraTags = parseJson<string[]>(r.ingredients_tags as string | null, []);
    const tags = [...new Set([...extraTags.map(lower), ...ings.map((i) => lower(i.name)), ...allergens.map(lower)])];

    const candidate = {
      id, slug: r.slug, legacyIds: parseJson<string[]>(r.legacy_ids as string, []),
      title: r.name, description: r.description,
      imageUrl: r.hero_key ? publicAssetUrl(String(r.hero_key)) : null,
      prepTimeMinutes: Number(r.prep_time) + Number(r.cook_time),
      servings: r.servings, cuisine: r.cuisine,
      ...(r.featured ? { featured: true } : {}),
      mealTypes: parseJson(r.meal_types as string | null, null),
      dietaryTags: parseJson(r.dietary_tags as string | null, null),
      ingredientsTags: tags, allergens,
      ...(r.nutrition ? { nutrition: parseJson(r.nutrition as string, undefined) } : {}),
      traits: parseJson(r.traits as string | null, null),
      weatherAffinity: parseJson(r.weather_affinity as string | null, null),
      paletteKey: r.palette_key,
      ingredients: ings.map((i) => ({
        item: i.name, quantity: i.quantity, unit: i.unit ?? "",
        ...(i.note ? { note: i.note } : {}),
        imageUrl: i.r2_key ? publicAssetUrl(i.r2_key) : null,
      })),
      steps: steps.map((instruction, n) => ({ number: n + 1, instruction })),
      publishedAt: r.published_at,
    };

    // A validação com o MESMO schema do app evita servir algo que o app recusaria (e derrubaria o catálogo inteiro).
    const parsed = catalogSchema.shape.recipes.element.safeParse(candidate);
    if (parsed.success) recipes.push(parsed.data);
    else skipped.push({ id, reason: `invalid_contract:${parsed.error.issues[0]?.path.join(".")}` });
  }

  return { catalog: { schemaVersion: CATALOG_SCHEMA_VERSION, generatedAt: new Date().toISOString(), recipes }, skipped };
}

export async function etagOf(body: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return `"${[...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("")}"`;
}
