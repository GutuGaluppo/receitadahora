import { Hono } from "hono";
import type { AppEnv } from "../env";
import { batchProgress } from "./batches";
import { ingredientCoverage } from "./ingredients";

export const dashboard = new Hono<AppEnv>();

/** Visão operacional rápida — sem gráficos, só o que pede ação. */
dashboard.get("/", async (c) => {
  const db = c.env.DB;
  const batch = await db.prepare("SELECT id, number, status, created_at FROM batches ORDER BY (status = 'open') DESC, number DESC LIMIT 1").first<{ id: string; number: number; status: string; created_at: string }>();

  const rec = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
         FROM recipes WHERE deleted_at IS NULL`,
    )
    .first<{ total: number; published: number | null }>();
  const total = rec?.total ?? 0;
  const published = rec?.published ?? 0;

  const reviewRecipes = (await db.prepare("SELECT COUNT(*) AS n FROM recipes WHERE deleted_at IS NULL AND status = 'review'").first<{ n: number }>())?.n ?? 0;
  const reviewImages = (
    await db.prepare(
      `SELECT COUNT(*) AS n FROM assets a WHERE a.deleted_at IS NULL AND a.status = 'review'
          AND (EXISTS (SELECT 1 FROM recipes r WHERE r.hero_asset_id = a.id AND r.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM ingredients i WHERE i.asset_id = a.id AND i.deleted_at IS NULL))`,
    ).first<{ n: number }>()
  )?.n ?? 0;
  const coverage = await ingredientCoverage(db);
  const withoutAsset = (
    await db.prepare(
      `SELECT COUNT(*) AS n FROM ingredients i LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
        WHERE i.deleted_at IS NULL AND (a.id IS NULL OR a.status = 'rejected')
          AND EXISTS (SELECT 1 FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = i.id)`,
    ).first<{ n: number }>()
  )?.n ?? 0;

  return c.json({
    batch: batch ? { ...batch, progress: await batchProgress(db, batch.id) } : null,
    recipes: { total, published, in_production: total - published },
    ingredients: coverage,
    review: { recipes: reviewRecipes, images: reviewImages, ingredients_without_asset: withoutAsset },
  });
});
