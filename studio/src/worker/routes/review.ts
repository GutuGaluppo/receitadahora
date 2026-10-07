import { Hono } from "hono";
import type { AppEnv } from "../env";
import { RECIPE_STATUS_LABEL, type RecipeStatus } from "../lib/status";

export const review = new Hono<AppEnv>();

/** Inbox operacional: tudo que está esperando uma pessoa. */
review.get("/", async (c) => {
  const db = c.env.DB;

  const recipes = (
    await db.prepare(
      `SELECT r.id, r.name, r.slug, r.category, r.status, r.updated_at, ha.r2_key AS hero_key, ha.status AS hero_status
         FROM recipes r LEFT JOIN assets ha ON ha.id = r.hero_asset_id AND ha.deleted_at IS NULL
        WHERE r.deleted_at IS NULL AND r.status = 'review' ORDER BY r.updated_at`,
    ).all<{ id: string; name: string; slug: string; category: string; status: RecipeStatus; updated_at: string; hero_key: string | null; hero_status: string | null }>()
  ).results.map((r) => ({
    kind: "recipe" as const, id: r.id, name: r.name, slug: r.slug, status: r.status, status_label: RECIPE_STATUS_LABEL[r.status],
    preview_url: r.hero_key ? `/api/assets/${r.hero_key}` : null,
    issue: r.hero_status === "approved" ? "Revisar dados e aprovar a receita" : "Aprovar a imagem principal antes de publicar",
  }));

  const heroes = (
    await db.prepare(
      `SELECT a.id AS asset_id, a.r2_key, a.version, r.id AS recipe_id, r.name FROM assets a JOIN recipes r ON r.hero_asset_id = a.id AND r.deleted_at IS NULL
        WHERE a.deleted_at IS NULL AND a.status = 'review' ORDER BY a.created_at`,
    ).all<{ asset_id: string; r2_key: string; version: number; recipe_id: string; name: string }>()
  ).results.map((a) => ({
    kind: "recipe_image" as const, id: a.asset_id, owner_id: a.recipe_id, name: a.name, version: a.version, preview_url: `/api/assets/${a.r2_key}`, issue: `Imagem principal v${a.version} aguardando aprovação`,
  }));

  const ingImages = (
    await db.prepare(
      `SELECT a.id AS asset_id, a.r2_key, a.version, i.id AS ingredient_id, i.name FROM assets a JOIN ingredients i ON i.asset_id = a.id AND i.deleted_at IS NULL
        WHERE a.deleted_at IS NULL AND a.status = 'review' ORDER BY a.created_at`,
    ).all<{ asset_id: string; r2_key: string; version: number; ingredient_id: string; name: string }>()
  ).results.map((a) => ({
    kind: "ingredient_image" as const, id: a.asset_id, owner_id: a.ingredient_id, name: a.name, version: a.version, preview_url: `/api/assets/${a.r2_key}`, issue: "Imagem do ingrediente aguardando aprovação",
  }));

  const missing = (
    await db.prepare(
      `SELECT i.id, i.name, a.status AS asset_status,
              (SELECT COUNT(DISTINCT ri.recipe_id) FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = i.id) AS recipe_count
         FROM ingredients i LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
        WHERE i.deleted_at IS NULL AND (a.id IS NULL OR a.status = 'rejected')
          AND EXISTS (SELECT 1 FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = i.id)
        ORDER BY recipe_count DESC, i.name`,
    ).all<{ id: string; name: string; asset_status: string | null; recipe_count: number }>()
  ).results.map((i) => ({
    kind: "ingredient" as const, id: i.id, name: i.name, recipe_count: i.recipe_count,
    issue: i.asset_status === "rejected" ? "Imagem rejeitada: enviar outra" : "Sem imagem",
  }));

  return c.json({
    recipes, images: [...heroes, ...ingImages], ingredients: missing,
    counts: { recipes: recipes.length, images: heroes.length + ingImages.length, ingredients: missing.length },
  });
});
