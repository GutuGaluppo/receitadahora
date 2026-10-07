import { z } from "zod";
import type { Env } from "../env";
import { findDuplicates, type DuplicateHit, type RecipeFingerprint } from "./duplicates";
import { newId, now } from "./ids";
import { matchIngredient } from "./matching";
import { fingerprints, loadLibrary, refreshRecipeStatus, uniqueSlug } from "./repo";
import { ingredientKey, slugify } from "./text";

export const ingredientInput = z.object({
  name: z.string().trim().min(1).max(160),
  quantity: z.number().nonnegative().nullable().optional(),
  unit: z.string().trim().max(40).default(""),
  note: z.string().trim().max(200).default(""),
  /** decisão explícita do humano */
  ingredient_id: z.string().optional(),
  create: z.boolean().optional(),
});

export const recipeInput = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().max(160).optional(),
  description: z.string().trim().max(600).default(""),
  category: z.string().trim().max(60).default(""),
  prep_time: z.number().int().nonnegative().default(0),
  cook_time: z.number().int().nonnegative().default(0),
  servings: z.number().int().positive().default(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  instructions: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
  visual_ingredients: z.array(z.string().trim().min(1)).optional(),
  batch_id: z.string().nullable().optional(),
  ingredients: z.array(ingredientInput).default([]),
  force_duplicate: z.boolean().default(false),
});
export type RecipeInput = z.infer<typeof recipeInput>;

type Resolved = { ingredient_id: string; raw_name: string; quantity: number | null; unit: string; note: string };
type NewIngredient = { id: string; name: string; slug: string; key: string };
export type Undecided = { name: string; candidates: { id: string; name: string; score: number }[] };

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const parenthetical = (s: string) => s.match(/\(([^)]*)\)/)?.[1]?.trim() ?? "";
const cleanName = (s: string) => cap(s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());

/**
 * Regra de ouro: reutilizar antes de criar.
 * exato/alias/slug → reutiliza; parecido → o humano decide; nada → cria (sem asset).
 */
export async function resolveIngredients(env: Env, inputs: RecipeInput["ingredients"]) {
  const lib = await loadLibrary(env.DB);
  const created = new Map<string, NewIngredient>();
  const usedSlugs = new Set<string>();
  const items: Resolved[] = [];
  const undecided: Undecided[] = [];
  let reused = 0;

  for (const inp of inputs) {
    const base = {
      raw_name: inp.name,
      quantity: inp.quantity ?? null,
      unit: inp.unit,
      note: inp.note || parenthetical(inp.name),
    };

    if (inp.ingredient_id) {
      const found = lib.find((l) => l.id === inp.ingredient_id) ?? [...created.values()].find((c) => c.id === inp.ingredient_id);
      if (!found) throw new Error(`ingredient_not_found:${inp.ingredient_id}`);
      items.push({ ...base, ingredient_id: inp.ingredient_id });
      reused++;
      continue;
    }

    const key = ingredientKey(inp.name);
    if (!key) throw new Error(`invalid_ingredient:${inp.name}`);

    const local = created.get(key);
    if (local) { items.push({ ...base, ingredient_id: local.id }); continue; }

    if (!inp.create) {
      const m = matchIngredient(inp.name, lib);
      if (m.kind === "exact") { items.push({ ...base, ingredient_id: m.ingredient.id }); reused++; continue; }
      if (m.kind === "possible") {
        undecided.push({ name: inp.name, candidates: m.candidates.map((x) => ({ id: x.ingredient.id, name: x.ingredient.name, score: Math.round(x.score * 100) / 100 })) });
        continue;
      }
    }

    let slug = await uniqueSlug(env.DB, "ingredients", cleanName(inp.name));
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(cleanName(inp.name))}-${n}`;
    usedSlugs.add(slug);
    const ni: NewIngredient = { id: newId("ingredient"), name: cleanName(inp.name), slug, key };
    created.set(key, ni);
    items.push({ ...base, ingredient_id: ni.id });
  }

  return { items, undecided, newIngredients: [...created.values()], reused };
}

export type SaveResult =
  | { ok: true; id: string; status: string; created_ingredients: string[]; reused_ingredients: number }
  | { ok: false; error: "needs_decision"; undecided: Undecided[] }
  | { ok: false; error: "duplicate"; duplicates: DuplicateHit[] };

function writeStatements(env: Env, recipeId: string, p: Awaited<ReturnType<typeof resolveIngredients>>, t: string) {
  const stmts: D1PreparedStatement[] = p.newIngredients.map((n) =>
    env.DB.prepare("INSERT INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES (?,?,?,?,?,?)").bind(n.id, n.name, n.slug, n.key, t, t),
  );
  p.items.forEach((i, idx) =>
    stmts.push(
      env.DB.prepare("INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, note, raw_name, sort_order) VALUES (?,?,?,?,?,?,?,?)").bind(
        newId("ri"), recipeId, i.ingredient_id, i.quantity, i.unit, i.note, i.raw_name, idx,
      ),
    ),
  );
  return stmts;
}

export async function createRecipe(env: Env, input: RecipeInput): Promise<SaveResult> {
  const resolved = await resolveIngredients(env, input.ingredients);
  if (resolved.undecided.length) return { ok: false, error: "needs_decision", undecided: resolved.undecided };

  const slug = await uniqueSlug(env.DB, "recipes", input.slug || input.name);
  const id = newId("recipe");

  if (!input.force_duplicate) {
    const candidate: RecipeFingerprint = {
      id, name: input.name, slug, category: input.category, instructions: input.instructions,
      ingredients: resolved.items.map((i) => ({ ingredient_id: i.ingredient_id, quantity: i.quantity, unit: i.unit })),
    };
    const dups = findDuplicates(candidate, await fingerprints(env.DB));
    if (dups.length) return { ok: false, error: "duplicate", duplicates: dups };
  }

  const t = now();
  const visual = input.visual_ingredients ?? input.ingredients.slice(0, 6).map((i) => cleanName(i.name).toLowerCase());
  const stmts = [
    ...writeStatements(env, id, resolved, t).slice(0, resolved.newIngredients.length), // ingredientes novos primeiro (FK)
    env.DB.prepare(
      `INSERT INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, batch_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'draft', ?, ?, ?)`,
    ).bind(id, input.name, slug, input.description, input.category, input.prep_time, input.cook_time, input.servings, input.difficulty,
      JSON.stringify(input.instructions), JSON.stringify(input.tags), JSON.stringify(visual), input.batch_id ?? null, t, t),
    ...writeStatements(env, id, resolved, t).slice(resolved.newIngredients.length),
  ];
  await env.DB.batch(stmts);
  const status = (await refreshRecipeStatus(env.DB, id)) ?? "draft";
  return { ok: true, id, status, created_ingredients: resolved.newIngredients.map((n) => n.name), reused_ingredients: resolved.reused };
}

export async function updateRecipe(env: Env, id: string, input: RecipeInput): Promise<SaveResult | { ok: false; error: "not_found" }> {
  const cur = await env.DB.prepare("SELECT id, status, slug FROM recipes WHERE id = ? AND deleted_at IS NULL").bind(id).first<{ id: string; status: string; slug: string }>();
  if (!cur) return { ok: false, error: "not_found" };

  const resolved = await resolveIngredients(env, input.ingredients);
  if (resolved.undecided.length) return { ok: false, error: "needs_decision", undecided: resolved.undecided };

  const slug = input.slug ? await uniqueSlug(env.DB, "recipes", input.slug, id) : cur.slug;
  const t = now();
  // editar conteúdo aprovado/publicado volta para revisão: nada muda no app público sem passar por aprovação
  const demote = cur.status === "approved" || cur.status === "published";
  const visual = input.visual_ingredients ?? input.ingredients.slice(0, 6).map((i) => cleanName(i.name).toLowerCase());

  const w = writeStatements(env, id, resolved, t);
  await env.DB.batch([
    ...w.slice(0, resolved.newIngredients.length),
    env.DB.prepare(
      `UPDATE recipes SET name=?, slug=?, description=?, category=?, prep_time=?, cook_time=?, servings=?, difficulty=?, instructions=?, tags=?, visual_ingredients=?,
              batch_id = COALESCE(?, batch_id), status = CASE WHEN ? THEN 'review' ELSE status END, published_at = CASE WHEN ? THEN NULL ELSE published_at END, updated_at=? WHERE id=?`,
    ).bind(input.name, slug, input.description, input.category, input.prep_time, input.cook_time, input.servings, input.difficulty,
      JSON.stringify(input.instructions), JSON.stringify(input.tags), JSON.stringify(visual), input.batch_id ?? null, demote ? 1 : 0, demote ? 1 : 0, t, id),
    env.DB.prepare("DELETE FROM recipe_ingredients WHERE recipe_id = ?").bind(id),
    ...w.slice(resolved.newIngredients.length),
  ]);
  const status = (await refreshRecipeStatus(env.DB, id)) ?? cur.status;
  return { ok: true, id, status, created_ingredients: resolved.newIngredients.map((n) => n.name), reused_ingredients: resolved.reused };
}
