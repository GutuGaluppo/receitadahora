import { Hono } from "hono";
import type { AppEnv } from "../env";
import { isUploadError, storeAsset, validateImage } from "../lib/assets";
import { findDuplicates } from "../lib/duplicates";
import { fail, parseBody } from "../lib/http";
import { now } from "../lib/ids";
import { matchIngredient } from "../lib/matching";
import { buildImagePrompt } from "../lib/prompt";
import { publishBlockers } from "../lib/publish";
import { createRecipe, recipeInput, updateRecipe, type SaveResult } from "../lib/recipes";
import { fingerprints, getRecipeFull, loadLibrary, refreshRecipeStatus } from "../lib/repo";
import { ALLOWED_TRANSITIONS, type RecipeStatus } from "../lib/status";
import { ingredientKey, slugify } from "../lib/text";

export const recipes = new Hono<AppEnv>();

const saveErrorResponse = (c: import("hono").Context<AppEnv>, r: Extract<SaveResult, { ok: false }> | { ok: false; error: "not_found" }) => {
  if (r.error === "not_found") return fail(c, 404, "not_found", "Receita não encontrada.");
  if (r.error === "needs_decision") return fail(c, 409, "needs_decision", "Há ingredientes com possível correspondência. Escolha usar o existente ou criar um novo.", { undecided: r.undecided });
  return fail(c, 409, "duplicate", "Possível duplicidade de receita.", { duplicates: r.duplicates });
};

/* GET /api/recipes?search&status&category&ingredient&batch&from&to */
recipes.get("/", async (c) => {
  const q = c.req.query();
  let sql = `
    SELECT r.id, r.name, r.slug, r.category, r.prep_time, r.cook_time, r.status, r.updated_at, r.batch_id, b.number AS batch_number,
           (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) AS ingredient_count,
           (SELECT COUNT(*) FROM recipe_ingredients ri LEFT JOIN ingredients i ON i.id = ri.ingredient_id LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL
             WHERE ri.recipe_id = r.id AND (a.id IS NULL OR a.status != 'approved')) AS ingredients_without_asset,
           ha.r2_key AS hero_key, ha.status AS hero_status
      FROM recipes r
      LEFT JOIN batches b ON b.id = r.batch_id
      LEFT JOIN assets ha ON ha.id = r.hero_asset_id AND ha.deleted_at IS NULL
     WHERE r.deleted_at IS NULL`;
  const binds: unknown[] = [];
  if (q.search) { sql += " AND (r.name LIKE ? OR r.slug LIKE ?)"; binds.push(`%${q.search}%`, `%${slugify(q.search)}%`); }
  if (q.status) { sql += " AND r.status = ?"; binds.push(q.status); }
  if (q.category) { sql += " AND r.category = ?"; binds.push(q.category); }
  if (q.ingredient) { sql += " AND EXISTS (SELECT 1 FROM recipe_ingredients x WHERE x.recipe_id = r.id AND x.ingredient_id = ?)"; binds.push(q.ingredient); }
  if (q.batch) { sql += " AND r.batch_id = ?"; binds.push(q.batch); }
  if (q.from) { sql += " AND r.updated_at >= ?"; binds.push(q.from); }
  if (q.to) { sql += " AND r.updated_at <= ?"; binds.push(`${q.to}T23:59:59.999Z`); }
  sql += " ORDER BY r.updated_at DESC LIMIT 500";

  const rows = (await c.env.DB.prepare(sql).bind(...binds).all<Record<string, unknown> & { hero_key: string | null }>()).results;
  return c.json({ items: rows.map((r) => ({ ...r, hero_url: r.hero_key ? `/api/assets/${r.hero_key}` : null })) });
});

recipes.get("/categories", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT DISTINCT category FROM recipes WHERE deleted_at IS NULL AND category != '' ORDER BY category").all<{ category: string }>()).results;
  return c.json({ items: rows.map((r) => r.category) });
});

/* POST /api/recipes/check — mostra o que o sistema decidiria, sem gravar nada */
recipes.post("/check", async (c) => {
  const body = await parseBody(c, recipeInput);
  if (!body.ok) return body.res;
  const lib = await loadLibrary(c.env.DB);
  const ingredients = body.data.ingredients.map((i) => {
    const m = matchIngredient(i.name, lib);
    return m.kind === "exact" ? { name: i.name, kind: "exact" as const, via: m.via, ingredient: { id: m.ingredient.id, name: m.ingredient.name } }
      : m.kind === "possible" ? { name: i.name, kind: "possible" as const, candidates: m.candidates.map((x) => ({ id: x.ingredient.id, name: x.ingredient.name, score: Math.round(x.score * 100) / 100 })) }
      : { name: i.name, kind: "none" as const };
  });
  // duplicidade só com o que já dá para identificar
  const idByName = new Map(ingredients.flatMap((i) => (i.kind === "exact" ? [[ingredientKey(i.name), i.ingredient.id] as const] : [])));
  const dups = findDuplicates(
    {
      id: "candidate", name: body.data.name, slug: "", category: body.data.category, instructions: body.data.instructions,
      ingredients: body.data.ingredients.flatMap((i) => { const id = idByName.get(ingredientKey(i.name)); return id ? [{ ingredient_id: id, quantity: i.quantity ?? null, unit: i.unit }] : []; }),
    },
    await fingerprints(c.env.DB),
  );
  return c.json({ ingredients, duplicates: dups });
});

/* POST /api/recipes */
recipes.post("/", async (c) => {
  const body = await parseBody(c, recipeInput);
  if (!body.ok) return body.res;
  try {
    const r = await createRecipe(c.env, body.data);
    return r.ok ? c.json(r, 201) : saveErrorResponse(c, r);
  } catch (e) {
    return fail(c, 422, "validation", e instanceof Error ? e.message : "Dados inválidos.");
  }
});

async function detail(c: import("hono").Context<AppEnv>, id: string) {
  const r = await getRecipeFull(c.env.DB, id);
  if (!r) return null;
  const prompt = buildImagePrompt({ name: r.name, description: r.description, category: r.category, visualIngredients: r.visual_ingredients });
  return { ...r, publish_blockers: publishBlockers(r), image_prompt: prompt };
}

recipes.get("/:id", async (c) => {
  const r = await detail(c, c.req.param("id"));
  return r ? c.json(r) : fail(c, 404, "not_found", "Receita não encontrada.");
});

recipes.put("/:id", async (c) => {
  const body = await parseBody(c, recipeInput);
  if (!body.ok) return body.res;
  try {
    const r = await updateRecipe(c.env, c.req.param("id"), body.data);
    return r.ok ? c.json(r) : saveErrorResponse(c, r);
  } catch (e) {
    return fail(c, 422, "validation", e instanceof Error ? e.message : "Dados inválidos.");
  }
});

/* DELETE — soft delete. Receita publicada precisa ser despublicada antes. */
recipes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const r = await c.env.DB.prepare("SELECT status FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ status: string }>();
  if (!r) return fail(c, 404, "not_found", "Receita não encontrada.");
  if (r.status === "published") return fail(c, 409, "published", "Despublique a receita antes de excluí-la.");
  await c.env.DB.prepare("UPDATE recipes SET deleted_at = ?, updated_at = ? WHERE id = ?").bind(now(), now(), id).run();
  return c.json({ ok: true });
});

/* ───────── imagem principal ───────── */

recipes.post("/:id/hero", async (c) => {
  const id = c.req.param("id");
  const r = await c.env.DB.prepare("SELECT id, slug, status FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; slug: string; status: string }>();
  if (!r) return fail(c, 404, "not_found", "Receita não encontrada.");

  const form = await c.req.formData().catch(() => null);
  if (!form) return fail(c, 400, "invalid_form", "Envie o arquivo como multipart/form-data.");
  const v = validateImage(form.get("file"));
  if (isUploadError(v)) return fail(c, v.status, v.error, v.message, { recipe_preserved: true });

  const asset = await storeAsset(c.env, { type: "recipe_hero", ownerId: id, slug: r.slug, file: v.file });
  if (isUploadError(asset)) return fail(c, asset.status, asset.error, `${asset.message} A receita foi preservada.`);

  // nova versão fica ativa; as anteriores continuam no histórico (nada é sobrescrito)
  const demote = r.status === "approved" || r.status === "published";
  await c.env.DB.prepare("UPDATE recipes SET hero_asset_id = ?, status = CASE WHEN ? THEN 'review' ELSE status END, published_at = CASE WHEN ? THEN NULL ELSE published_at END, updated_at = ? WHERE id = ?")
    .bind(asset.id, demote ? 1 : 0, demote ? 1 : 0, now(), id).run();
  await refreshRecipeStatus(c.env.DB, id);
  return c.json({ asset_id: asset.id, version: asset.version }, 201);
});

async function heroState(c: import("hono").Context<AppEnv>, status: "approved" | "rejected", reason?: string) {
  const id = c.req.param("id")!;
  const r = await c.env.DB.prepare("SELECT hero_asset_id FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ hero_asset_id: string | null }>();
  if (!r) return fail(c, 404, "not_found", "Receita não encontrada.");
  if (!r.hero_asset_id) return fail(c, 409, "no_hero", "A receita ainda não tem imagem principal.");
  await c.env.DB.prepare("UPDATE assets SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?").bind(status, status === "rejected" ? reason ?? null : null, now(), r.hero_asset_id).run();
  await refreshRecipeStatus(c.env.DB, id);
  return c.json({ ok: true, status });
}
recipes.post("/:id/hero/approve", (c) => heroState(c, "approved"));
recipes.post("/:id/hero/reject", async (c) => heroState(c, "rejected", (await c.req.json().catch(() => ({})))?.reason));

recipes.post("/:id/hero/activate/:assetId", async (c) => {
  const id = c.req.param("id");
  const a = await c.env.DB.prepare("SELECT id FROM assets WHERE id = ? AND owner_id = ? AND type = 'recipe_hero' AND deleted_at IS NULL").bind(c.req.param("assetId"), id).first();
  if (!a) return fail(c, 404, "not_found", "Versão não encontrada.");
  await c.env.DB.prepare("UPDATE recipes SET hero_asset_id = ?, updated_at = ? WHERE id = ?").bind(a.id, now(), id).run();
  await refreshRecipeStatus(c.env.DB, id);
  return c.json({ ok: true });
});

/** "Regenerar": no MVP não há geração automática. Rejeita a versão atual e devolve o prompt oficial para gerar outra. */
recipes.post("/:id/hero/regenerate", async (c) => {
  const id = c.req.param("id");
  const r = await getRecipeFull(c.env.DB, id);
  if (!r) return fail(c, 404, "not_found", "Receita não encontrada.");
  if (r.hero) await c.env.DB.prepare("UPDATE assets SET status = 'rejected', reject_reason = 'Regeneração solicitada', updated_at = ? WHERE id = ?").bind(now(), r.hero.id).run();
  if (r.status === "approved" || r.status === "published") await c.env.DB.prepare("UPDATE recipes SET status = 'review', published_at = NULL WHERE id = ?").bind(id).run();
  await refreshRecipeStatus(c.env.DB, id);
  return c.json(buildImagePrompt({ name: r.name, description: r.description, category: r.category, visualIngredients: r.visual_ingredients }));
});

/* ───────── fluxo de aprovação ───────── */

async function transition(c: import("hono").Context<AppEnv>, action: keyof typeof ALLOWED_TRANSITIONS, apply: (id: string) => Promise<Response | null>) {
  const id = c.req.param("id")!;
  const r = await c.env.DB.prepare("SELECT status FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ status: RecipeStatus }>();
  if (!r) return fail(c, 404, "not_found", "Receita não encontrada.");
  if (!ALLOWED_TRANSITIONS[action].includes(r.status)) {
    return fail(c, 409, "invalid_transition", `Não é possível executar "${action}" numa receita com status "${r.status}".`, { status: r.status });
  }
  const early = await apply(id);
  return early ?? c.json({ ok: true });
}

recipes.post("/:id/approve", (c) =>
  transition(c, "approve", async (id) => { await c.env.DB.prepare("UPDATE recipes SET status = 'approved', reject_reason = NULL, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?").bind(c.get("user"), now(), now(), id).run(); return null; }));

recipes.post("/:id/reject", (c) =>
  transition(c, "reject", async (id) => {
    const reason = (await c.req.json().catch(() => ({})))?.reason;
    await c.env.DB.prepare("UPDATE recipes SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?").bind(typeof reason === "string" ? reason : null, now(), id).run();
    return null;
  }));

recipes.post("/:id/reopen", (c) =>
  transition(c, "reopen", async (id) => {
    await c.env.DB.prepare("UPDATE recipes SET status = 'draft', updated_at = ? WHERE id = ?").bind(now(), id).run();
    await refreshRecipeStatus(c.env.DB, id);
    return null;
  }));

/* Publicação: ação explícita, validada. Se não puder, explica o motivo. */
recipes.post("/:id/publish", (c) =>
  transition(c, "publish", async (id) => {
    const full = await getRecipeFull(c.env.DB, id);
    const blockers = full ? publishBlockers(full) : [];
    if (blockers.length) return fail(c, 422, "cannot_publish", "Não pode publicar", { blockers });
    await c.env.DB.prepare("UPDATE recipes SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").bind(now(), now(), id).run();
    return null;
  }));

recipes.post("/:id/unpublish", (c) =>
  transition(c, "unpublish", async (id) => { await c.env.DB.prepare("UPDATE recipes SET status = 'approved', published_at = NULL, updated_at = ? WHERE id = ?").bind(now(), id).run(); return null; }));

