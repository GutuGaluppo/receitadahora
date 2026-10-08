import { newId, now } from "./ids";
import { toRef, type IngredientRef } from "./matching";
import { computeAutoStatus, type RecipeStatus } from "./status";
import { slugify } from "./text";
import type { RecipeFingerprint } from "./duplicates";

export type D = D1Database;

export type AssetRow = {
  id: string; type: string; owner_id: string | null; r2_key: string; filename: string; mime_type: string;
  size_bytes: number; version: number; status: "review" | "approved" | "rejected"; reject_reason: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
};

export type RecipeRow = {
  id: string; name: string; slug: string; description: string; category: string; prep_time: number; cook_time: number;
  servings: number; difficulty: "easy" | "medium" | "hard"; instructions: string; tags: string; visual_ingredients: string;
  status: RecipeStatus; reject_reason: string | null; batch_id: string | null; hero_asset_id: string | null;
  created_at: string; updated_at: string; published_at: string | null; deleted_at: string | null;
  source_type: "manual" | "generated" | "imported"; source_job_id: string | null; template_version: string | null; provider: string | null; model: string | null;
  generated_at: string | null; approved_by: string | null; approved_at: string | null;
};

export const assetUrl = (key: string) => `/api/assets/${key}`;
export const publicAssetUrl = (key: string) => `/api/public/assets/${key}`;

export function assetView(a: AssetRow | null | undefined) {
  if (!a) return null;
  return {
    id: a.id, key: a.r2_key, url: assetUrl(a.r2_key), filename: a.filename, mime_type: a.mime_type, size_bytes: a.size_bytes,
    version: a.version, status: a.status, reject_reason: a.reject_reason, created_at: a.created_at, updated_at: a.updated_at,
  };
}

const json = <T>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

/* ───────── ingredientes ───────── */

export async function loadLibrary(db: D): Promise<IngredientRef[]> {
  const ings = (await db.prepare("SELECT id, name, slug, normalized_name FROM ingredients WHERE deleted_at IS NULL").all<{ id: string; name: string; slug: string; normalized_name: string }>()).results;
  const aliases = (await db.prepare("SELECT ingredient_id, normalized_alias FROM ingredient_aliases").all<{ ingredient_id: string; normalized_alias: string }>()).results;
  const byIng = new Map<string, string[]>();
  for (const a of aliases) byIng.set(a.ingredient_id, [...(byIng.get(a.ingredient_id) ?? []), a.normalized_alias]);
  return ings.map((i) => toRef(i, byIng.get(i.id) ?? []));
}

export async function uniqueSlug(db: D, table: "recipes" | "ingredients", base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "item";
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const row = await db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).bind(candidate).first<{ id: string }>();
    if (!row || row.id === excludeId) return candidate;
  }
  return `${root}-${newId("alias").slice(-6)}`;
}

/* ───────── receitas ───────── */

export async function getRecipeFull(db: D, id: string) {
  const r = await db.prepare("SELECT * FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<RecipeRow>();
  if (!r) return null;

  const ings = (
    await db
      .prepare(
        `SELECT ri.id, ri.ingredient_id, ri.quantity, ri.unit, ri.note, ri.raw_name, ri.sort_order,
                i.name, i.slug,
                a.id AS asset_id, a.r2_key, a.status AS asset_status, a.version AS asset_version
           FROM recipe_ingredients ri
           JOIN ingredients i ON i.id = ri.ingredient_id
           LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
          WHERE ri.recipe_id = ? ORDER BY ri.sort_order, ri.id`,
      )
      .bind(id)
      .all<{
        id: string; ingredient_id: string; quantity: number | null; unit: string; note: string; raw_name: string; sort_order: number;
        name: string; slug: string; asset_id: string | null; r2_key: string | null; asset_status: string | null; asset_version: number | null;
      }>()
  ).results;

  const versions = (
    await db.prepare("SELECT * FROM assets WHERE owner_id = ? AND type = 'recipe_hero' AND deleted_at IS NULL ORDER BY version DESC").bind(id).all<AssetRow>()
  ).results;
  const hero = versions.find((v) => v.id === r.hero_asset_id) ?? null;
  const batch = r.batch_id ? await db.prepare("SELECT id, number FROM batches WHERE id = ?").bind(r.batch_id).first<{ id: string; number: number }>() : null;

  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description, category: r.category,
    prep_time: r.prep_time, cook_time: r.cook_time, servings: r.servings, difficulty: r.difficulty,
    instructions: json<string[]>(r.instructions, []), tags: json<string[]>(r.tags, []),
    visual_ingredients: json<string[]>(r.visual_ingredients, []),
    status: r.status, reject_reason: r.reject_reason, batch, created_at: r.created_at, updated_at: r.updated_at, published_at: r.published_at,
    provenance: {
      source_type: r.source_type, source_job_id: r.source_job_id, template_version: r.template_version, provider: r.provider, model: r.model,
      generated_at: r.generated_at, approved_by: r.approved_by, approved_at: r.approved_at,
    },
    hero: assetView(hero),
    hero_versions: versions.map((v) => assetView(v)!),
    ingredients: ings.map((i) => ({
      id: i.id, ingredient_id: i.ingredient_id, name: i.name, slug: i.slug, raw_name: i.raw_name,
      quantity: i.quantity, unit: i.unit, note: i.note,
      asset: i.asset_id ? { id: i.asset_id, key: i.r2_key!, url: assetUrl(i.r2_key!), status: i.asset_status as AssetRow["status"], version: i.asset_version! } : null,
    })),
  };
}

export type RecipeFull = NonNullable<Awaited<ReturnType<typeof getRecipeFull>>>;

export async function fingerprints(db: D): Promise<RecipeFingerprint[]> {
  const rs = (await db.prepare("SELECT id, name, slug, category, instructions FROM recipes WHERE deleted_at IS NULL").all<{ id: string; name: string; slug: string; category: string; instructions: string }>()).results;
  const ri = (await db.prepare("SELECT recipe_id, ingredient_id, quantity, unit FROM recipe_ingredients").all<{ recipe_id: string; ingredient_id: string; quantity: number | null; unit: string }>()).results;
  const by = new Map<string, RecipeFingerprint["ingredients"]>();
  for (const x of ri) by.set(x.recipe_id, [...(by.get(x.recipe_id) ?? []), { ingredient_id: x.ingredient_id, quantity: x.quantity, unit: x.unit }]);
  return rs.map((r) => ({ id: r.id, name: r.name, slug: r.slug, category: r.category, instructions: json<string[]>(r.instructions, []), ingredients: by.get(r.id) ?? [] }));
}

/** Recalcula draft → image_pending → review (nunca mexe em approved/published/rejected). */
export async function refreshRecipeStatus(db: D, recipeId: string): Promise<RecipeStatus | null> {
  const r = await db.prepare("SELECT id, name, instructions, status, hero_asset_id FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(recipeId).first<Pick<RecipeRow, "id" | "name" | "instructions" | "status" | "hero_asset_id">>();
  if (!r) return null;
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN a.status = 'approved' THEN 0 ELSE 1 END) AS missing
         FROM recipe_ingredients ri
         JOIN ingredients i ON i.id = ri.ingredient_id
         LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
        WHERE ri.recipe_id = ?`,
    )
    .bind(recipeId)
    .first<{ total: number; missing: number | null }>();
  const hero = r.hero_asset_id ? await db.prepare("SELECT status FROM assets WHERE id = ? AND deleted_at IS NULL").bind(r.hero_asset_id).first<{ status: string }>() : null;

  const next = computeAutoStatus({
    status: r.status,
    hasData: !!r.name.trim() && (stats?.total ?? 0) > 0 && json<string[]>(r.instructions, []).length > 0,
    hasHero: !!hero && hero.status !== "rejected",
    missingIngredientAssets: stats?.missing ?? 0,
  });
  if (next !== r.status) await db.prepare("UPDATE recipes SET status = ?, updated_at = ? WHERE id = ?").bind(next, now(), recipeId).run();
  return next;
}

export async function refreshRecipesUsingIngredient(db: D, ingredientId: string) {
  const rows = (await db.prepare("SELECT DISTINCT recipe_id FROM recipe_ingredients WHERE ingredient_id = ?").bind(ingredientId).all<{ recipe_id: string }>()).results;
  for (const r of rows) await refreshRecipeStatus(db, r.recipe_id);
}
