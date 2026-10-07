import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { fail, parseBody } from "../lib/http";
import { newId, now } from "../lib/ids";
import { createRecipe, recipeInput } from "../lib/recipes";

export const batches = new Hono<AppEnv>();

type Summary = { id: string; number: number; status: string; created_at: string; completed_at: string | null };

/** Progresso do lote: imagens principais, assets dos ingredientes do lote e receitas aprovadas. */
export async function batchProgress(db: D1Database, batchId: string) {
  const recipes = (
    await db
      .prepare(
        `SELECT r.id, r.name, r.slug, r.status, r.hero_asset_id, r.instructions,
                ha.status AS hero_status,
                (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ing_total,
                (SELECT COUNT(*) FROM recipe_ingredients ri LEFT JOIN ingredients i ON i.id = ri.ingredient_id LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
                  WHERE ri.recipe_id = r.id AND (a.id IS NULL OR a.status != 'approved')) AS ing_missing
           FROM recipes r LEFT JOIN assets ha ON ha.id = r.hero_asset_id AND ha.deleted_at IS NULL
          WHERE r.batch_id = ? AND r.deleted_at IS NULL ORDER BY r.created_at, r.name`,
      )
      .bind(batchId)
      .all<{ id: string; name: string; slug: string; status: string; hero_asset_id: string | null; hero_status: string | null; instructions: string; ing_total: number; ing_missing: number }>()
  ).results;

  // ingredientes distintos do lote e quantos já têm asset aprovado; "novos" = criados desde o início do lote
  const ing = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS with_asset,
              SUM(CASE WHEN i.created_at >= b.created_at THEN 1 ELSE 0 END) AS new_total,
              SUM(CASE WHEN i.created_at >= b.created_at AND a.status = 'approved' THEN 1 ELSE 0 END) AS new_with_asset
         FROM (SELECT DISTINCT ri.ingredient_id FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE r.batch_id = ?) u
         JOIN ingredients i ON i.id = u.ingredient_id
         JOIN batches b ON b.id = ?
         LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL`,
    )
    .bind(batchId, batchId)
    .first<{ total: number; with_asset: number | null; new_total: number | null; new_with_asset: number | null }>();

  const n = recipes.length;
  const heroes = recipes.filter((r) => r.hero_asset_id && r.hero_status !== "rejected").length;
  const approved = recipes.filter((r) => r.status === "approved" || r.status === "published").length;
  const ingTotal = ing?.total ?? 0;
  const ingWith = ing?.with_asset ?? 0;
  const ratios = [n ? heroes / n : 0, ingTotal ? ingWith / ingTotal : n ? 0 : 0, n ? approved / n : 0];
  return {
    recipes_total: n,
    heroes,
    approved,
    ingredients_total: ingTotal,
    ingredients_with_asset: ingWith,
    new_ingredients: ing?.new_total ?? 0,
    new_ingredients_with_asset: ing?.new_with_asset ?? 0,
    percent: n ? Math.round((ratios.reduce((s, x) => s + x, 0) / 3) * 100) : 0,
    counts: {
      approved,
      review: recipes.filter((r) => r.status === "review").length,
      pending: recipes.filter((r) => !["approved", "published", "review"].includes(r.status)).length,
    },
    items: recipes.map((r, idx) => {
      const steps = (() => { try { return (JSON.parse(r.instructions) as string[]).length; } catch { return 0; } })();
      return {
        position: idx + 1, id: r.id, name: r.name, slug: r.slug, status: r.status,
        recipe_ok: r.ing_total > 0 && steps > 0,
        hero: r.hero_asset_id ? (r.hero_status === "approved" ? "approved" : r.hero_status === "rejected" ? "rejected" : "review") : "missing",
        ingredients_missing: r.ing_missing,
        approved: r.status === "approved" || r.status === "published",
      };
    }),
  };
}

batches.get("/", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM batches ORDER BY number DESC").all<Summary>()).results;
  const items = await Promise.all(rows.map(async (b) => ({ ...b, progress: await batchProgress(c.env.DB, b.id) })));
  return c.json({ items });
});

batches.post("/", async (c) => {
  const last = await c.env.DB.prepare("SELECT MAX(number) AS n FROM batches").first<{ n: number | null }>();
  const id = newId("batch");
  const number = (last?.n ?? 0) + 1;
  await c.env.DB.prepare("INSERT INTO batches (id, number, status, created_at) VALUES (?, ?, 'open', ?)").bind(id, number, now()).run();
  return c.json({ id, number }, 201);
});

batches.get("/:id", async (c) => {
  const b = await c.env.DB.prepare("SELECT * FROM batches WHERE id = ?").bind(c.req.param("id")).first<Summary>();
  if (!b) return fail(c, 404, "not_found", "Lote não encontrado.");
  return c.json({ ...b, progress: await batchProgress(c.env.DB, b.id) });
});

batches.post("/:id/complete", async (c) => {
  const res = await c.env.DB.prepare("UPDATE batches SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'open'").bind(now(), c.req.param("id")).run();
  return res.meta.changes ? c.json({ ok: true }) : fail(c, 409, "not_open", "O lote não existe ou já foi concluído.");
});

/* associa receitas já existentes a um lote */
batches.post("/:id/recipes", async (c) => {
  const body = await parseBody(c, z.object({ recipe_ids: z.array(z.string()).min(1).max(200) }));
  if (!body.ok) return body.res;
  const id = c.req.param("id");
  const b = await c.env.DB.prepare("SELECT id FROM batches WHERE id = ?").bind(id).first();
  if (!b) return fail(c, 404, "not_found", "Lote não encontrado.");
  await c.env.DB.batch(body.data.recipe_ids.map((rid) => c.env.DB.prepare("UPDATE recipes SET batch_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").bind(id, now(), rid)));
  return c.json({ ok: true });
});

/**
 * Importa receitas em JSON para o lote. Cada receita passa pelo mesmo caminho da criação manual:
 * ingredientes reutilizados antes de criar, possíveis correspondências e duplicidades voltam para decisão humana.
 */
batches.post("/:id/import", async (c) => {
  const body = await parseBody(c, z.object({ recipes: z.array(recipeInput).min(1).max(50) }));
  if (!body.ok) return body.res;
  const id = c.req.param("id");
  const b = await c.env.DB.prepare("SELECT id, status FROM batches WHERE id = ?").bind(id).first<{ id: string; status: string }>();
  if (!b) return fail(c, 404, "not_found", "Lote não encontrado.");
  if (b.status !== "open") return fail(c, 409, "not_open", "O lote já foi concluído.");

  const results: Record<string, unknown>[] = [];
  for (const input of body.data.recipes) {
    try {
      const r = await createRecipe(c.env, { ...input, batch_id: id });
      if (r.ok) results.push({ name: input.name, result: "created", id: r.id, status: r.status, created_ingredients: r.created_ingredients, reused_ingredients: r.reused_ingredients });
      else if (r.error === "duplicate") results.push({ name: input.name, result: "duplicate", duplicates: r.duplicates });
      else results.push({ name: input.name, result: "needs_decision", undecided: r.undecided });
    } catch (e) {
      results.push({ name: input.name, result: "error", message: e instanceof Error ? e.message : "erro" });
    }
  }
  return c.json({ results, created: results.filter((r) => r.result === "created").length });
});
