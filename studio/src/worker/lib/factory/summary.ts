import { compareRecipes } from "../duplicates";
import { fingerprints, getRecipeFull } from "../repo";
import type { Coverage, ItemDetails } from "./pipeline";
import type { NormalizedRecipe } from "./normalize";

type ItemRow = { id: string; job_id: string; position: number; name: string; outcome: string; recipe_id: string | null; payload: string; details: string };

const parse = <T>(s: string, fb: T): T => {
  try { return JSON.parse(s) as T; } catch { return fb; }
};

/** Resumo vivo do job (§23): reflete o que já foi aprovado/enviado depois da geração. */
export async function jobSummary(db: D1Database, jobId: string) {
  const items = (await db.prepare("SELECT * FROM generation_items WHERE job_id = ? ORDER BY position").bind(jobId).all<ItemRow>()).results;
  const by = (o: string) => items.filter((i) => i.outcome === o).length;
  const recipeIds = items.filter((i) => i.outcome === "created" && i.recipe_id).map((i) => i.recipe_id!);

  let statuses: Record<string, number> = {};
  let ingTotal = 0, ingApproved = 0, heroesPending = 0;
  if (recipeIds.length) {
    const ph = recipeIds.map(() => "?").join(",");
    const st = (await db.prepare(`SELECT status, COUNT(*) AS n FROM recipes WHERE id IN (${ph}) AND deleted_at IS NULL GROUP BY status`).bind(...recipeIds).all<{ status: string; n: number }>()).results;
    statuses = Object.fromEntries(st.map((s) => [s.status, s.n]));
    const ing = await db
      .prepare(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) AS approved
           FROM (SELECT DISTINCT ri.ingredient_id FROM recipe_ingredients ri WHERE ri.recipe_id IN (${ph})) u
           JOIN ingredients i ON i.id = u.ingredient_id LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL`,
      )
      .bind(...recipeIds)
      .first<{ total: number; approved: number | null }>();
    ingTotal = ing?.total ?? 0;
    ingApproved = ing?.approved ?? 0;
    heroesPending = (
      await db.prepare(`SELECT COUNT(*) AS n FROM recipes r LEFT JOIN assets a ON a.id = r.hero_asset_id AND a.deleted_at IS NULL WHERE r.id IN (${ph}) AND (a.id IS NULL OR a.status != 'approved')`).bind(...recipeIds).first<{ n: number }>()
    )?.n ?? 0;
  }
  return {
    generated: items.length,
    created: recipeIds.length,
    ready_for_review: statuses.review ?? 0,
    awaiting_assets: (statuses.image_pending ?? 0) + (statuses.draft ?? 0),
    approved: (statuses.approved ?? 0) + (statuses.published ?? 0),
    rejected: statuses.rejected ?? 0,
    duplicates: by("duplicate"),
    needs_decision: by("needs_decision"),
    invalid: by("invalid") + by("error"),
    discarded: by("discarded"),
    ingredient_assets_reused: ingApproved,
    ingredient_assets_missing: ingTotal - ingApproved,
    recipe_images_pending: heroesPending,
  };
}

/** Itens com o que a tela de revisão precisa para decidir rápido (§24). */
export async function jobItems(db: D1Database, jobId: string) {
  const rows = (await db.prepare("SELECT * FROM generation_items WHERE job_id = ? ORDER BY position").bind(jobId).all<ItemRow>()).results;
  const fps = rows.some((r) => r.recipe_id) ? await fingerprints(db) : [];
  const out = [];
  for (const r of rows) {
    const details = parse<ItemDetails>(r.details, {});
    const base = { id: r.id, position: r.position, name: r.name, outcome: r.outcome, recipe_id: r.recipe_id, details, payload: parse<NormalizedRecipe | Record<string, unknown>>(r.payload, {}) };
    if (r.outcome !== "created" || !r.recipe_id) { out.push({ ...base, recipe: null }); continue; }
    const full = await getRecipeFull(db, r.recipe_id);
    if (!full) { out.push({ ...base, recipe: null }); continue; }
    const me = fps.find((f) => f.id === full.id);
    let nearest: { name: string; score: number } | null = null;
    if (me) for (const o of fps) if (o.id !== me.id) {
      const s = compareRecipes(me, o).score;
      if (!nearest || s > nearest.score) nearest = { name: o.name, score: Math.round(s * 100) / 100 };
    }
    const missing = full.ingredients.filter((i) => i.asset?.status !== "approved");
    const warnings = [...(details.warnings ?? [])];
    if (!full.hero) warnings.push("Sem imagem principal.");
    else if (full.hero.status !== "approved") warnings.push("Imagem principal ainda não aprovada.");
    if (missing.length) warnings.push(`${missing.length} ingrediente(s) sem asset aprovado.`);
    out.push({
      ...base,
      recipe: {
        id: full.id, slug: full.slug, name: full.name, description: full.description, category: full.category, prep_time: full.prep_time, cook_time: full.cook_time,
        servings: full.servings, difficulty: full.difficulty, status: full.status, instructions: full.instructions, tags: full.tags,
        ingredients: full.ingredients.map((i) => ({ id: i.ingredient_id, name: i.name, quantity: i.quantity, unit: i.unit, asset: i.asset?.status ?? "missing" })),
        hero: full.hero?.status ?? "missing",
        asset_coverage: { approved: full.ingredients.length - missing.length, total: full.ingredients.length },
        nearest, warnings,
        new_ingredients: details.coverage ? (details.coverage as Coverage).created : [],
      },
    });
  }
  return out;
}
