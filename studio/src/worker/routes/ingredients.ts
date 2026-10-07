import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { isUploadError, storeAsset, validateImage } from "../lib/assets";
import { fail, parseBody } from "../lib/http";
import { newId, now } from "../lib/ids";
import { matchIngredient } from "../lib/matching";
import { assetView, loadLibrary, refreshRecipesUsingIngredient, uniqueSlug, type AssetRow } from "../lib/repo";
import { ingredientKey, normalize, slugify } from "../lib/text";

export const ingredients = new Hono<AppEnv>();

type Row = {
  id: string; name: string; slug: string; created_at: string; updated_at: string;
  recipe_count: number; asset_id: string | null; r2_key: string | null; asset_status: string | null; asset_version: number | null;
};

const LIST_SQL = `
  SELECT i.id, i.name, i.slug, i.created_at, i.updated_at,
         (SELECT COUNT(DISTINCT ri.recipe_id) FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = i.id) AS recipe_count,
         a.id AS asset_id, a.r2_key, a.status AS asset_status, a.version AS asset_version
    FROM ingredients i
    LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
   WHERE i.deleted_at IS NULL`;

const toItem = (r: Row) => ({
  id: r.id, name: r.name, slug: r.slug, recipe_count: r.recipe_count, created_at: r.created_at, updated_at: r.updated_at,
  asset: r.asset_id ? { id: r.asset_id, key: r.r2_key!, url: `/api/assets/${r.r2_key}`, status: r.asset_status as AssetRow["status"], version: r.asset_version! } : null,
  /** missing = sem asset | review = aguardando aprovação | approved | rejected */
  state: r.asset_id ? r.asset_status! : "missing",
});

async function coverage(db: D1Database) {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS approved,
              SUM(CASE WHEN a.status = 'review' THEN 1 ELSE 0 END) AS review,
              SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) AS rejected
         FROM ingredients i LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
        WHERE i.deleted_at IS NULL`,
    )
    .first<{ total: number; approved: number | null; review: number | null; rejected: number | null }>();
  const total = r?.total ?? 0;
  const approved = r?.approved ?? 0;
  return {
    total, with_image: approved, pending: total - approved,
    review: r?.review ?? 0, rejected: r?.rejected ?? 0, missing: total - approved - (r?.review ?? 0) - (r?.rejected ?? 0),
    percent: total ? Math.round((approved / total) * 100) : 100,
  };
}
export { coverage as ingredientCoverage };

/* GET /api/ingredients?search=&state= */
ingredients.get("/", async (c) => {
  const search = c.req.query("search")?.trim();
  const state = c.req.query("state"); // missing | review | approved | rejected | pending
  let sql = LIST_SQL;
  const binds: unknown[] = [];
  if (search) {
    sql += ` AND (i.normalized_name LIKE ? OR i.slug LIKE ? OR EXISTS (SELECT 1 FROM ingredient_aliases al WHERE al.ingredient_id = i.id AND al.normalized_alias LIKE ?))`;
    const like = `%${normalize(search).replace(/ /g, "%")}%`;
    binds.push(like, `%${slugify(search)}%`, like);
  }
  if (state === "missing") sql += " AND a.id IS NULL";
  else if (state === "pending") sql += " AND (a.id IS NULL OR a.status != 'approved')";
  else if (state === "review" || state === "approved" || state === "rejected") { sql += " AND a.status = ?"; binds.push(state); }
  sql += " ORDER BY i.name COLLATE NOCASE";
  const rows = (await c.env.DB.prepare(sql).bind(...binds).all<Row>()).results;
  return c.json({ items: rows.map(toItem), coverage: await coverage(c.env.DB) });
});

/* POST /api/ingredients/match {names} — usado pelo formulário de receita */
ingredients.post("/match", async (c) => {
  const body = await parseBody(c, z.object({ names: z.array(z.string()).max(200) }));
  if (!body.ok) return body.res;
  const lib = await loadLibrary(c.env.DB);
  return c.json({
    results: body.data.names.map((name) => {
      const m = matchIngredient(name, lib);
      return m.kind === "exact" ? { name, kind: m.kind, via: m.via, ingredient: { id: m.ingredient.id, name: m.ingredient.name } }
        : m.kind === "possible" ? { name, kind: m.kind, candidates: m.candidates.map((x) => ({ id: x.ingredient.id, name: x.ingredient.name, score: Math.round(x.score * 100) / 100 })) }
        : { name, kind: m.kind };
    }),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  /** ignora a detecção de "possível correspondência" */
  force: z.boolean().default(false),
});

/* POST /api/ingredients */
ingredients.post("/", async (c) => {
  const body = await parseBody(c, createSchema);
  if (!body.ok) return body.res;
  const { name, aliases, force } = body.data;

  const key = ingredientKey(name);
  if (!key) return fail(c, 422, "validation", "O nome do ingrediente é inválido.");
  const lib = await loadLibrary(c.env.DB);
  const m = matchIngredient(name, lib);
  if (m.kind === "exact") {
    return fail(c, 409, "exists", `"${m.ingredient.name}" já existe na biblioteca.`, { ingredient: { id: m.ingredient.id, name: m.ingredient.name } });
  }
  if (m.kind === "possible" && !force) {
    return fail(c, 409, "possible_match", "Possível correspondência encontrada.", { candidates: m.candidates.map((x) => ({ id: x.ingredient.id, name: x.ingredient.name, score: x.score })) });
  }

  const id = newId("ingredient");
  const slug = await uniqueSlug(c.env.DB, "ingredients", name);
  const t = now();
  const stmts = [c.env.DB.prepare("INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES (?,?,?,?,?,?)").bind(id, name, slug, key, t, t)];
  const seen = new Set<string>([key]);
  for (const alias of aliases) {
    const ak = ingredientKey(alias);
    if (!ak || seen.has(ak)) continue;
    seen.add(ak);
    stmts.push(c.env.DB.prepare("INSERT OR IGNORE INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES (?,?,?,?)").bind(newId("alias"), id, alias, ak));
  }
  await c.env.DB.batch(stmts);
  return c.json({ id, slug }, 201);
});

async function loadOne(db: D1Database, id: string) {
  return db.prepare(`${LIST_SQL} AND i.id = ?`).bind(id).first<Row>();
}

/* GET /api/ingredients/:id */
ingredients.get("/:id", async (c) => {
  const row = await loadOne(c.env.DB, c.req.param("id"));
  if (!row) return fail(c, 404, "not_found", "Ingrediente não encontrado.");
  const aliases = (await c.env.DB.prepare("SELECT id, alias FROM ingredient_aliases WHERE ingredient_id = ? ORDER BY alias").bind(row.id).all<{ id: string; alias: string }>()).results;
  const versions = (await c.env.DB.prepare("SELECT * FROM assets WHERE owner_id = ? AND type = 'ingredient' AND deleted_at IS NULL ORDER BY version DESC").bind(row.id).all<AssetRow>()).results;
  const used_by = (
    await c.env.DB.prepare(
      `SELECT DISTINCT r.id, r.name, r.slug, r.status FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = ? ORDER BY r.name`,
    ).bind(row.id).all<{ id: string; name: string; slug: string; status: string }>()
  ).results;
  const current = versions.find((v) => v.id === row.asset_id) ?? null;
  return c.json({ ...toItem(row), aliases, asset_detail: assetView(current), versions: versions.map((v) => assetView(v)!), used_by });
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
});

/* PATCH /api/ingredients/:id — slug editável sem quebrar relacionamentos (usam IDs) */
ingredients.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await parseBody(c, patchSchema);
  if (!body.ok) return body.res;
  const cur = await c.env.DB.prepare("SELECT id, name, slug FROM ingredients WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; name: string; slug: string }>();
  if (!cur) return fail(c, 404, "not_found", "Ingrediente não encontrado.");

  const stmts: D1PreparedStatement[] = [];
  const t = now();
  if (body.data.name !== undefined || body.data.slug !== undefined) {
    const name = body.data.name ?? cur.name;
    const key = ingredientKey(name);
    const clash = await c.env.DB.prepare("SELECT id FROM ingredients WHERE normalized_name = ? AND id != ? AND deleted_at IS NULL").bind(key, id).first();
    if (clash) return fail(c, 409, "exists", "Já existe outro ingrediente com esse nome.");
    const slug = body.data.slug ? await uniqueSlug(c.env.DB, "ingredients", body.data.slug, id) : cur.slug;
    stmts.push(c.env.DB.prepare("UPDATE ingredients SET name = ?, slug = ?, normalized_name = ?, updated_at = ? WHERE id = ?").bind(name, slug, key, t, id));
  }
  if (body.data.aliases) {
    stmts.push(c.env.DB.prepare("DELETE FROM ingredient_aliases WHERE ingredient_id = ?").bind(id));
    const seen = new Set<string>();
    for (const alias of body.data.aliases) {
      const ak = ingredientKey(alias);
      if (!ak || seen.has(ak)) continue;
      seen.add(ak);
      stmts.push(c.env.DB.prepare("INSERT OR IGNORE INTO ingredient_aliases (id, ingredient_id, alias, normalized_alias) VALUES (?,?,?,?)").bind(newId("alias"), id, alias, ak));
    }
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

/* DELETE /api/ingredients/:id — soft delete; bloqueado enquanto estiver em uso (mostra o impacto) */
ingredients.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const used = (
    await c.env.DB.prepare(
      `SELECT DISTINCT r.id, r.name FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.deleted_at IS NULL WHERE ri.ingredient_id = ?`,
    ).bind(id).all<{ id: string; name: string }>()
  ).results;
  if (used.length) {
    return fail(c, 409, "in_use", `Este ingrediente é usado por ${used.length} ${used.length === 1 ? "receita" : "receitas"}.`, { used_by: used });
  }
  const res = await c.env.DB.prepare("UPDATE ingredients SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL").bind(now(), now(), id).run();
  if (!res.meta.changes) return fail(c, 404, "not_found", "Ingrediente não encontrado.");
  return c.json({ ok: true });
});

/* POST /api/ingredients/:id/asset — multipart: file, approve? */
ingredients.post("/:id/asset", async (c) => {
  const id = c.req.param("id");
  const ing = await c.env.DB.prepare("SELECT id, slug FROM ingredients WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; slug: string }>();
  if (!ing) return fail(c, 404, "not_found", "Ingrediente não encontrado.");

  const form = await c.req.formData().catch(() => null);
  if (!form) return fail(c, 400, "invalid_form", "Envie o arquivo como multipart/form-data.");
  const v = validateImage(form.get("file"));
  if (isUploadError(v)) return fail(c, v.status, v.error, v.message);

  const asset = await storeAsset(c.env, { type: "ingredient", ownerId: id, slug: ing.slug, file: v.file, status: form.get("approve") === "true" ? "approved" : "review" });
  if (isUploadError(asset)) return fail(c, asset.status, asset.error, asset.message);

  // a nova versão vira a atual; versões anteriores (inclusive aprovadas) ficam no histórico
  await c.env.DB.prepare("UPDATE ingredients SET asset_id = ?, updated_at = ? WHERE id = ?").bind(asset.id, now(), id).run();
  await refreshRecipesUsingIngredient(c.env.DB, id);
  return c.json({ asset: assetView(asset) }, 201);
});

async function setAssetState(c: import("hono").Context<AppEnv>, status: "approved" | "rejected", reason?: string) {
  const id = c.req.param("id")!;
  const ing = await c.env.DB.prepare("SELECT asset_id FROM ingredients WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ asset_id: string | null }>();
  if (!ing) return fail(c, 404, "not_found", "Ingrediente não encontrado.");
  if (!ing.asset_id) return fail(c, 409, "no_asset", "Este ingrediente ainda não tem imagem.");
  await c.env.DB.prepare("UPDATE assets SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?").bind(status, status === "rejected" ? reason ?? null : null, now(), ing.asset_id).run();
  await refreshRecipesUsingIngredient(c.env.DB, id);
  return c.json({ ok: true, status });
}

ingredients.post("/:id/asset/approve", (c) => setAssetState(c, "approved"));
ingredients.post("/:id/asset/reject", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return setAssetState(c, "rejected", typeof body?.reason === "string" ? body.reason : undefined);
});

/* POST /api/ingredients/:id/asset/activate/:assetId — volta para uma versão anterior */
ingredients.post("/:id/asset/activate/:assetId", async (c) => {
  const id = c.req.param("id");
  const a = await c.env.DB.prepare("SELECT id FROM assets WHERE id = ? AND owner_id = ? AND type = 'ingredient' AND deleted_at IS NULL").bind(c.req.param("assetId"), id).first();
  if (!a) return fail(c, 404, "not_found", "Versão não encontrada.");
  await c.env.DB.prepare("UPDATE ingredients SET asset_id = ?, updated_at = ? WHERE id = ?").bind(a.id, now(), id).run();
  await refreshRecipesUsingIngredient(c.env.DB, id);
  return c.json({ ok: true });
});
