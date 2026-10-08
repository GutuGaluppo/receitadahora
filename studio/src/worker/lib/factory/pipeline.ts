import { z } from "zod";
import type { Env } from "../../env";
import { storeAsset, isUploadError } from "../assets";
import type { DuplicateHit } from "../duplicates";
import { ALLOWED_MIME, MAX_UPLOAD } from "../http";
import { newId, now } from "../ids";
import { createRecipe, updateRecipe, type RecipeInput, type Undecided } from "../recipes";
import { fingerprints, getRecipeFull, refreshRecipeStatus, refreshRecipesUsingIngredient } from "../repo";
import { normalize } from "../text";
import { checkBudget, DISABLED_MESSAGE, flagsFrom, spendSnapshot } from "./config";
import { createJob, getJob, logEvent, logOps, MAX_ATTEMPTS, type JobRow } from "./jobs";
import {
  extractJson, generatedRecipeSchema, normalizeRecipe, parseEnvelope, StructuralError, titleDuplicates, type NormalizedRecipe,
} from "./normalize";
import {
  getImageProvider, getRecipeProvider, ProviderError, type RecipeGenContext, type RegenPart, type RecipeGenerationProvider,
} from "./providers";
import { activeTemplate, composeIngredientImagePrompt, composeRecipeImagePrompt, render } from "./templates";

/* ───────── tipos ───────── */

export type GenerateParams = {
  count: number; category?: string; meal_time?: string; max_time?: number; difficulty?: string;
  restrictions?: string[]; wanted_ingredients?: string[]; avoid_ingredients?: string[]; notes?: string;
};
export type RecipeJobInput =
  | { mode: "batch"; params: GenerateParams }
  | { mode: "regenerate"; part: RegenPart; recipe_id: string; variant: number };

export type Coverage = { total: number; reused: number; created: string[]; approved: number; in_review: number; missing: { id: string; name: string }[] };
export type ItemDetails = {
  warnings?: string[]; issues?: string[]; duplicates?: DuplicateHit[]; undecided?: Undecided[]; coverage?: Coverage; error?: string;
};
export type Decision = { name: string; ingredient_id?: string; create?: boolean };

export class FactoryBlocked extends Error {
  constructor(public code: "content_disabled" | "image_disabled" | "budget_blocked", message: string) {
    super(message);
  }
}

const parseJson = <T>(s: string | null | undefined, fb: T): T => {
  if (!s) return fb;
  try { return JSON.parse(s) as T; } catch { return fb; }
};

/* ───────── guardrails ───────── */

async function assertBudget(env: Env, paid: boolean, estimated: number) {
  const f = flagsFrom(env);
  const snap = await spendSnapshot(env.DB);
  const d = checkBudget({ paid, estimatedCost: estimated, dailyLimit: f.dailyLimit, monthlyBudget: f.monthlyBudget, paidJobsToday: snap.paidJobsToday, spentThisMonth: snap.month });
  if (!d.allowed) throw new FactoryBlocked("budget_blocked", d.reason);
}

/* ───────── criação do job de receitas ───────── */

export async function startRecipeBatchJob(env: Env, actor: string, params: GenerateParams, idempotencyKey: string | null) {
  const f = flagsFrom(env);
  if (!f.content) throw new FactoryBlocked("content_disabled", DISABLED_MESSAGE.content);

  const provider = getRecipeProvider(env);
  await assertBudget(env, provider.paid, provider.estimateCost({ ...params, avoid_recipe_ids: [], existing_recipe_names: [], existing_ingredients: [] }));
  const template = await activeTemplate(env.DB, "recipe");

  const { job, deduped } = await createJob(env.DB, {
    type: "recipe", template, provider: provider.name, model: provider.model, idempotencyKey, input: { mode: "batch", params } satisfies RecipeJobInput,
    estimatedCost: provider.estimateCost({ ...params, avoid_recipe_ids: [], existing_recipe_names: [], existing_ingredients: [] }), actor,
  });
  if (deduped) return { job, deduped };
  await executeRecipeJob(env, job, actor);
  return { job: (await getJob(env.DB, job.id))!, deduped: false };
}

export async function startRegeneration(env: Env, actor: string, recipeId: string, part: RegenPart | "image", idempotencyKey: string | null) {
  const f = flagsFrom(env);
  const recipe = await getRecipeFull(env.DB, recipeId);
  if (!recipe) throw new FactoryBlocked("content_disabled", "Receita não encontrada.");

  if (part === "image") {
    // regenerar imagem = pedir explicitamente a substituição; a execução respeita as flags
    const { jobs } = await createImageJobs(env, { parentJobId: null, actor, batchId: recipe.batch?.id ?? null, recipeHero: { id: recipe.id, replace: true }, ingredients: [] });
    if (jobs[0]) return { job: jobs[0], deduped: false };
    // já existe um job de imagem ativo para esta receita: devolve-o em vez de criar outro
    const active = await env.DB.prepare("SELECT * FROM generation_jobs WHERE type = 'recipe_image' AND target_id = ? AND status IN ('queued','processing','disabled') ORDER BY seq DESC LIMIT 1").bind(recipeId).first<JobRow>();
    return { job: active, deduped: true };
  }

  if (!f.content) throw new FactoryBlocked("content_disabled", DISABLED_MESSAGE.content);
  const provider = getRecipeProvider(env);
  await assertBudget(env, provider.paid, 0);
  const template = await activeTemplate(env.DB, part === "description" ? "description" : part === "instructions" ? "metadata" : "recipe");
  const prior = (await env.DB.prepare("SELECT COUNT(*) AS n FROM generation_jobs WHERE target_id = ? AND type IN ('recipe','description','metadata')").bind(recipeId).first<{ n: number }>())?.n ?? 0;
  const { job, deduped } = await createJob(env.DB, {
    type: part === "description" ? "description" : part === "instructions" ? "metadata" : "recipe", template, provider: provider.name, model: provider.model,
    batchId: recipe.batch?.id ?? null, idempotencyKey, targetType: "recipe", targetId: recipeId, input: { mode: "regenerate", part, recipe_id: recipeId, variant: prior } satisfies RecipeJobInput, actor,
  });
  if (deduped) return { job, deduped };
  await executeRecipeJob(env, job, actor);
  return { job: (await getJob(env.DB, job.id))!, deduped: false };
}

/* ───────── execução ───────── */

async function fail(env: Env, job: JobRow, kind: "external" | "structural" | "blocked", message: string, started: number) {
  await env.DB.prepare("UPDATE generation_jobs SET status='failed', error_kind=?, error_message=?, completed_at=? WHERE id=?").bind(kind, message, now(), job.id).run();
  await logEvent(env.DB, job.id, "job.failed", message, { kind });
  logOps("job.failed", job, { kind, duration_ms: Date.now() - started });
}

/** Re-executável (retry). A saída bruta do provider é gravada antes de qualquer validação e nunca é perdida. */
export async function executeRecipeJob(env: Env, job: JobRow, actor: string): Promise<void> {
  const started = Date.now();
  const f = flagsFrom(env);
  if (!f.content) {
    await fail(env, job, "blocked", DISABLED_MESSAGE.content, started);
    return;
  }
  const attempt = job.attempts + 1;
  await env.DB.prepare("UPDATE generation_jobs SET status='processing', started_at=?, completed_at=NULL, error_kind=NULL, error_message=NULL, attempts=? WHERE id=?").bind(now(), attempt, job.id).run();
  await logEvent(env.DB, job.id, "job.started", `Tentativa ${attempt}/${MAX_ATTEMPTS}.`);
  logOps("job.started", job, { attempt });

  try {
    const input = parseJson<RecipeJobInput>(job.input_payload, { mode: "batch", params: { count: 1 } });
    const provider = getRecipeProvider(env);
    const template = await activeTemplate(env.DB, job.type === "description" ? "description" : job.type === "metadata" ? "metadata" : "recipe");
    if (job.template_id && job.template_id !== template.id) {
      // mantém o template com que o job nasceu (auditoria); só avisa se mudou
      await logEvent(env.DB, job.id, "template.changed", `Template ativo mudou desde a criação (${job.template_version} → ${template.version}). Usando ${job.template_version}.`);
    }
    if (input.mode === "batch") await runBatch(env, job, input.params, provider, { id: template.id, version: job.template_version ?? template.version, prompt: template.prompt }, attempt, actor, started);
    else await runRegeneration(env, job, input, provider, { id: template.id, version: job.template_version ?? template.version, prompt: template.prompt }, attempt, started);
  } catch (e) {
    const cur = (await getJob(env.DB, job.id)) ?? job;
    if (e instanceof ProviderError) await fail(env, cur, e.kind, e.message, started);
    else if (e instanceof StructuralError) await fail(env, cur, "structural", `${e.message} O resultado bruto foi preservado.`, started);
    else if (e instanceof FactoryBlocked) await fail(env, cur, "blocked", e.message, started);
    else await fail(env, cur, "structural", e instanceof Error ? e.message : "Erro inesperado.", started);
  }
}

async function runBatch(
  env: Env, job: JobRow, params: GenerateParams, provider: RecipeGenerationProvider, template: { id: string; version: string; prompt: string },
  attempt: number, actor: string, started: number,
) {
  const db = env.DB;
  const existing = await fingerprints(db);
  const ings = (await db.prepare("SELECT name FROM ingredients WHERE deleted_at IS NULL ORDER BY name LIMIT 400").all<{ name: string }>()).results.map((r) => r.name);
  const ctx: RecipeGenContext = { ...params, avoid_recipe_ids: [], existing_recipe_names: existing.map((r) => r.name), existing_ingredients: ings };
  const rendered = { ...template, prompt: render(template.prompt, { context: JSON.stringify(ctx) }) };

  await assertBudget(env, provider.paid, provider.estimateCost(ctx));
  const result = await provider.generate(ctx, rendered, attempt);
  await db.prepare("UPDATE generation_jobs SET raw_output = ?, actual_cost = ? WHERE id = ?").bind(result.raw, result.cost, job.id).run();
  await logEvent(db, job.id, "provider.responded", `Resposta recebida de ${provider.name}/${provider.model}.`, { usage: result.usage ?? null, cost: result.cost });

  // JSON parse → schema (envelope) → cada receita: schema → normalização
  const rawRecipes = parseEnvelope(result.raw);
  const batchId = job.batch_id ?? (await createFactoryBatch(env, job));
  await db.prepare("DELETE FROM generation_items WHERE job_id = ?").bind(job.id).run(); // retry começa limpo (nada havia sido criado)

  let reusedIngredients = 0;
  const createdIngredients = new Set<string>();
  const counts = { created: 0, duplicate: 0, needs_decision: 0, invalid: 0, error: 0 };
  let assetJobs = 0;

  for (const [position, raw] of rawRecipes.entries()) {
    const parsed = generatedRecipeSchema.safeParse(raw);
    const guessName = typeof (raw as { name?: unknown })?.name === "string" ? (raw as { name: string }).name : `Receita ${position + 1}`;
    if (!parsed.success) {
      await saveItem(db, job.id, position, guessName, "invalid", null, raw, { issues: parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`) });
      counts.invalid++;
      await logEvent(db, job.id, "recipe.invalid", `"${guessName}" não passou na validação.`);
      continue;
    }
    const norm = normalizeRecipe(parsed.data);
    if (!norm.ok) {
      await saveItem(db, job.id, position, parsed.data.name, "invalid", null, raw, { issues: norm.issues });
      counts.invalid++;
      await logEvent(db, job.id, "recipe.invalid", `"${parsed.data.name}": ${norm.issues[0]}`);
      continue;
    }
    const r = await persistRecipe(env, job, batchId, norm.recipe, { force: false, provider, template }, actor);
    await saveItem(db, job.id, position, norm.recipe.name, r.outcome, r.recipe_id ?? null, norm.recipe, r.details);
    counts[r.outcome === "created" ? "created" : r.outcome === "duplicate" ? "duplicate" : r.outcome === "needs_decision" ? "needs_decision" : "error"]++;
    if (r.outcome === "created") {
      reusedIngredients += r.details.coverage!.reused;
      r.details.coverage!.created.forEach((n) => createdIngredients.add(n));
      assetJobs += r.assetJobs ?? 0;
    }
  }

  const summary = {
    requested: params.count, generated: rawRecipes.length, ...counts, reused_ingredients: reusedIngredients,
    created_ingredients: [...createdIngredients], asset_jobs: assetJobs, batch_id: batchId,
  };
  await db.prepare("UPDATE generation_jobs SET status='completed', items_count=?, output_payload=?, completed_at=?, batch_id=? WHERE id=?").bind(rawRecipes.length, JSON.stringify(summary), now(), batchId, job.id).run();
  await logEvent(db, job.id, "job.completed", `${counts.created} receitas criadas como rascunho; ${counts.duplicate} possíveis duplicidades; ${counts.needs_decision} com ingredientes a decidir; ${counts.invalid} inválidas.`, summary);
  logOps("job.completed", job, { duration_ms: Date.now() - started, items: rawRecipes.length, cost: result.cost, usage: result.usage ?? null });
}

async function createFactoryBatch(env: Env, job: JobRow): Promise<string> {
  for (let i = 0; i < 4; i++) {
    const last = await env.DB.prepare("SELECT MAX(number) AS n FROM batches").first<{ n: number | null }>();
    const id = newId("batch");
    try {
      await env.DB.prepare("INSERT INTO batches (id, number, status, source, created_at) VALUES (?, ?, 'open', 'factory', ?)").bind(id, (last?.n ?? 0) + 1, now()).run();
      await env.DB.prepare("UPDATE generation_jobs SET batch_id = ? WHERE id = ?").bind(id, job.id).run();
      await logEvent(env.DB, job.id, "batch.created", "Lote criado para esta geração.", { batch_id: id });
      return id;
    } catch (e) {
      if (i === 3) throw e;
    }
  }
  throw new Error("batch_create_failed");
}

async function saveItem(db: D1Database, jobId: string, position: number, name: string, outcome: string, recipeId: string | null, payload: unknown, details: ItemDetails) {
  const t = now();
  await db
    .prepare("INSERT INTO generation_items (id, job_id, position, name, outcome, recipe_id, payload, details, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(newId("item"), jobId, position, name, outcome, recipeId, JSON.stringify(payload), JSON.stringify(details), t, t)
    .run();
}

/* ───────── persistência de uma receita gerada ───────── */

type PersistResult = { outcome: "created" | "duplicate" | "needs_decision" | "error"; recipe_id?: string; details: ItemDetails; assetJobs?: number };

export async function persistRecipe(
  env: Env, job: JobRow, batchId: string, norm: NormalizedRecipe,
  opts: { force: boolean; decisions?: Decision[]; provider: { name: string; model: string }; template: { version: string } }, actor: string,
): Promise<PersistResult> {
  const db = env.DB;
  const warnings = norm.warnings;

  // 1º nível: título normalizado. 2º nível (ingredientes/categoria/técnica) roda dentro de createRecipe.
  if (!opts.force) {
    const hits = titleDuplicates(norm.name, await fingerprints(db));
    if (hits.length) {
      await logEvent(db, job.id, "duplicate.detected", `"${norm.name}" tem o mesmo título de "${hits[0].name}".`, { duplicates: hits });
      return { outcome: "duplicate", details: { warnings, duplicates: hits } };
    }
  }

  const input: RecipeInput = {
    name: norm.name, description: norm.description, category: norm.category, prep_time: norm.prep_time, cook_time: norm.cook_time, servings: norm.servings,
    difficulty: norm.difficulty, instructions: norm.instructions, tags: norm.tags, batch_id: batchId, force_duplicate: opts.force,
    ingredients: norm.ingredients.map((i) => {
      const d = opts.decisions?.find((x) => normalize(x.name) === normalize(i.name));
      return { name: i.name, quantity: i.quantity, unit: i.unit, note: i.note, ingredient_id: d?.ingredient_id, create: d?.create };
    }),
  };

  let res;
  try {
    res = await createRecipe(env, input);
  } catch (e) {
    return { outcome: "error", details: { warnings, error: e instanceof Error ? e.message : "Erro ao criar a receita." } };
  }
  if (!res.ok) {
    if (res.error === "needs_decision") {
      await logEvent(db, job.id, "ingredient.ambiguous", `"${norm.name}": ${res.undecided.length} ingrediente(s) com correspondência ambígua; nada foi criado.`, { undecided: res.undecided.map((u) => u.name) });
      return { outcome: "needs_decision", details: { warnings, undecided: res.undecided } };
    }
    await logEvent(db, job.id, "duplicate.detected", `"${norm.name}" é muito parecida com "${res.duplicates[0].name}" (${Math.round(res.duplicates[0].score * 100)}%).`, { duplicates: res.duplicates });
    return { outcome: "duplicate", details: { warnings, duplicates: res.duplicates } };
  }

  // proveniência (§26)
  await db
    .prepare("UPDATE recipes SET source_type='generated', source_job_id=?, template_version=?, provider=?, model=?, generated_at=? WHERE id=?")
    .bind(job.id, opts.template.version, opts.provider.name, opts.provider.model, now(), res.id)
    .run();
  await logEvent(db, job.id, "recipe.generated", `"${norm.name}" salva como rascunho no lote.`, { recipe_id: res.id });

  // reutilização e cobertura de assets (§15)
  const full = (await getRecipeFull(db, res.id))!;
  const coverage: Coverage = {
    total: full.ingredients.length,
    reused: full.ingredients.length - res.created_ingredients.length,
    created: res.created_ingredients,
    approved: full.ingredients.filter((i) => i.asset?.status === "approved").length,
    in_review: full.ingredients.filter((i) => i.asset?.status === "review").length,
    missing: full.ingredients.filter((i) => !i.asset || i.asset.status === "rejected").map((i) => ({ id: i.ingredient_id, name: i.name })),
  };
  if (coverage.reused) await logEvent(db, job.id, "ingredient.matched", `${coverage.reused} ingrediente(s) reutilizado(s) em "${norm.name}".`);
  if (coverage.created.length) await logEvent(db, job.id, "ingredient.created", `Novos ingredientes: ${coverage.created.join(", ")}.`, { names: coverage.created });
  if (coverage.approved) await logEvent(db, job.id, "asset.reused", `${coverage.approved} asset(s) aprovado(s) reaproveitado(s) em "${norm.name}".`);
  if (coverage.missing.length) await logEvent(db, job.id, "asset.missing", `Sem asset aprovado: ${coverage.missing.map((m) => m.name).join(", ")}.`, { ingredients: coverage.missing });

  const { jobs } = await createImageJobs(env, {
    parentJobId: job.id, actor, batchId, recipeHero: full.hero ? null : { id: res.id, replace: false },
    ingredients: coverage.missing,
  });
  return { outcome: "created", recipe_id: res.id, details: { warnings, coverage }, assetJobs: jobs.length };
}

/* ───────── regeneração granular (§25) ───────── */

async function runRegeneration(
  env: Env, job: JobRow, input: Extract<RecipeJobInput, { mode: "regenerate" }>, provider: RecipeGenerationProvider,
  template: { id: string; version: string; prompt: string }, attempt: number, started: number,
) {
  const db = env.DB;
  await assertBudget(env, provider.paid, 0);
  const recipe = await getRecipeFull(db, input.recipe_id);
  if (!recipe) throw new StructuralError("empty", "A receita não existe mais.");

  const result = await provider.regenerate(
    {
      part: input.part, variant: input.variant,
      recipe: { name: recipe.name, description: recipe.description, category: recipe.category, instructions: recipe.instructions, ingredients: recipe.ingredients.map((i) => i.name), prep_time: recipe.prep_time, cook_time: recipe.cook_time },
    },
    template, attempt,
  );
  await db.prepare("UPDATE generation_jobs SET raw_output = ?, actual_cost = ? WHERE id = ?").bind(result.raw, result.cost, job.id).run();
  const json = extractJson(result.raw);
  const t = now();
  const demote = recipe.status === "approved" || recipe.status === "published";
  const stamp = () =>
    db.prepare("UPDATE recipes SET source_job_id=?, template_version=?, provider=?, model=?, generated_at=?, source_type = CASE WHEN source_type='manual' AND ? = 'recipe' THEN 'generated' ELSE source_type END WHERE id=?")
      .bind(job.id, template.version, provider.name, provider.model, t, input.part, recipe.id);

  if (input.part === "description") {
    const p = z.object({ description: z.string().trim().min(5).max(600) }).safeParse(json);
    if (!p.success) throw new StructuralError("invalid_schema", 'Esperado { "description": "…" }.');
    await db.batch([
      db.prepare("UPDATE recipes SET description=?, status=CASE WHEN ? THEN 'review' ELSE status END, published_at=CASE WHEN ? THEN NULL ELSE published_at END, updated_at=? WHERE id=?").bind(p.data.description, demote ? 1 : 0, demote ? 1 : 0, t, recipe.id),
      stamp(),
    ]);
  } else if (input.part === "instructions") {
    const p = z.object({ instructions: z.array(z.string().trim().min(1)).min(1) }).safeParse(json);
    if (!p.success) throw new StructuralError("invalid_schema", 'Esperado { "instructions": ["…"] }.');
    await db.batch([
      db.prepare("UPDATE recipes SET instructions=?, status=CASE WHEN ? THEN 'review' ELSE status END, published_at=CASE WHEN ? THEN NULL ELSE published_at END, updated_at=? WHERE id=?").bind(JSON.stringify(p.data.instructions), demote ? 1 : 0, demote ? 1 : 0, t, recipe.id),
      stamp(),
    ]);
  } else {
    const first = parseEnvelope(result.raw)[0];
    const parsed = generatedRecipeSchema.safeParse(first);
    if (!parsed.success) throw new StructuralError("invalid_schema", "A nova versão da receita não passou na validação.");
    const norm = normalizeRecipe(parsed.data);
    if (!norm.ok) throw new StructuralError("invalid_schema", norm.issues[0]);
    const n = norm.recipe;
    const upd = await updateRecipe(env, recipe.id, {
      name: n.name, description: n.description, category: n.category, prep_time: n.prep_time, cook_time: n.cook_time, servings: n.servings, difficulty: n.difficulty,
      instructions: n.instructions, tags: n.tags, force_duplicate: true,
      ingredients: n.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, note: i.note })),
    });
    if (!upd.ok) {
      if (upd.error === "needs_decision") throw new StructuralError("invalid_schema", `Ingredientes ambíguos (${upd.undecided.map((u) => u.name).join(", ")}). Resolva manualmente na receita; o resultado bruto foi preservado.`);
      throw new StructuralError("empty", "A receita não existe mais.");
    }
    await stamp().run();
    await refreshRecipeStatus(db, recipe.id);
  }
  await db.prepare("UPDATE generation_jobs SET status='completed', items_count=1, output_payload=?, completed_at=? WHERE id=?").bind(JSON.stringify({ recipe_id: recipe.id, part: input.part, demoted_to_review: demote }), now(), job.id).run();
  await logEvent(db, job.id, "job.completed", `Regenerado: ${input.part === "recipe" ? "receita inteira" : input.part === "description" ? "descrição" : "modo de preparo"}.${demote ? " A receita voltou para revisão." : ""}`);
  logOps("job.completed", job, { duration_ms: Date.now() - started, cost: result.cost });
}

/* ───────── resolução humana dos itens ───────── */

export async function resolveItem(
  env: Env, itemId: string, action: "discard" | "keep" | "resolve", actor: string, decisions: Decision[] = [],
): Promise<{ ok: true; outcome: string; recipe_id?: string } | { ok: false; status: 404 | 409; error: string; message: string }> {
  const db = env.DB;
  const item = await db.prepare("SELECT * FROM generation_items WHERE id = ?").bind(itemId).first<{ id: string; job_id: string; position: number; name: string; outcome: string; payload: string; details: string }>();
  if (!item) return { ok: false, status: 404, error: "not_found", message: "Item não encontrado." };
  if (!["duplicate", "needs_decision", "invalid", "error"].includes(item.outcome)) return { ok: false, status: 409, error: "not_pending", message: `Este item já está resolvido (${item.outcome}).` };
  const job = (await getJob(db, item.job_id))!;

  if (action === "discard") {
    await db.prepare("UPDATE generation_items SET outcome='discarded', updated_at=? WHERE id=?").bind(now(), itemId).run(); // nunca descarta sem registro
    await logEvent(db, job.id, "item.discarded", `"${item.name}" descartada por ${actor}.`, { was: item.outcome });
    return { ok: true, outcome: "discarded" };
  }
  if (item.outcome === "invalid") return { ok: false, status: 409, error: "invalid_item", message: "Receitas inválidas só podem ser descartadas (ou regeneradas em um novo job)." };
  if (action === "keep" && item.outcome !== "duplicate") return { ok: false, status: 409, error: "not_duplicate", message: "Só duplicidades podem ser mantidas como rascunho." };

  const norm = parseJson<NormalizedRecipe | null>(item.payload, null);
  if (!norm || !job.batch_id) return { ok: false, status: 409, error: "no_payload", message: "Dados da receita indisponíveis." };

  const r = await persistRecipe(
    env, job, job.batch_id, norm,
    { force: action === "keep", decisions, provider: { name: job.provider ?? "unknown", model: job.model ?? "unknown" }, template: { version: job.template_version ?? "?" } },
    actor,
  );
  await db.prepare("UPDATE generation_items SET outcome=?, recipe_id=?, details=?, updated_at=? WHERE id=?").bind(r.outcome, r.recipe_id ?? null, JSON.stringify(r.details), now(), itemId).run();
  if (r.outcome === "created") await logEvent(db, job.id, "item.resolved", `"${item.name}" mantida como rascunho por ${actor}.`);
  return { ok: true, outcome: r.outcome, recipe_id: r.recipe_id };
}

/* ───────── jobs de imagem (§16–§22) ───────── */

type ImageTargets = {
  parentJobId: string | null; actor: string; batchId: string | null;
  recipeHero: { id: string; replace: boolean } | null;
  ingredients: { id: string; name: string }[];
};

/** Cria (sem executar) os jobs de imagem que faltam. Com a flag desligada nascem `disabled`. Nunca duplica um job ativo do mesmo alvo. */
export async function createImageJobs(env: Env, t: ImageTargets) {
  const f = flagsFrom(env);
  const db = env.DB;
  const provider = getImageProvider(env, f.image);
  const status = f.image ? ("queued" as const) : ("disabled" as const);
  const jobs: JobRow[] = [];

  const alreadyActive = async (type: string, id: string) =>
    !!(await db.prepare("SELECT 1 AS x FROM generation_jobs WHERE type = ? AND target_id = ? AND status IN ('queued','processing','disabled')").bind(type, id).first());

  for (const ing of t.ingredients) {
    if (await alreadyActive("ingredient_image", ing.id)) continue;
    const tpl = await activeTemplate(db, "ingredient_image");
    const prompt = composeIngredientImagePrompt(tpl, ing);
    const { job } = await createJob(db, {
      type: "ingredient_image", status, batchId: t.batchId, template: tpl, provider: provider.name, model: provider.model, targetType: "ingredient", targetId: ing.id,
      input: { prompt, target_name: ing.name, parent_job_id: t.parentJobId, replace: false }, estimatedCost: provider.estimateCost(), actor: t.actor,
    });
    jobs.push(job);
  }
  if (t.recipeHero && !(await alreadyActive("recipe_image", t.recipeHero.id))) {
    const r = await getRecipeFull(db, t.recipeHero.id);
    if (r) {
      const tpl = await activeTemplate(db, "recipe_image");
      const prompt = composeRecipeImagePrompt(tpl, r);
      const { job } = await createJob(db, {
        type: "recipe_image", status, batchId: t.batchId, template: tpl, provider: provider.name, model: provider.model, targetType: "recipe", targetId: r.id,
        input: { prompt, target_name: r.name, parent_job_id: t.parentJobId, replace: t.recipeHero.replace }, estimatedCost: provider.estimateCost(), actor: t.actor,
      });
      jobs.push(job);
    }
  }
  for (const j of jobs) {
    await logEvent(db, j.id, status === "disabled" ? "job.disabled" : "job.queued", status === "disabled" ? DISABLED_MESSAGE.image + " Nenhuma requisição foi feita." : "Na fila; execute manualmente.");
    if (t.parentJobId) await logEvent(db, t.parentJobId, "asset.job_created", `Job de imagem ${j.type === "recipe_image" ? "da receita" : "do ingrediente"} criado (${status}).`, { job_id: j.id });
  }
  return { jobs };
}

export async function executeImageJob(env: Env, job: JobRow, actor: string): Promise<void> {
  const started = Date.now();
  const f = flagsFrom(env);
  const db = env.DB;

  // 1) flag desligada: nenhuma instância de provider com rede, nenhuma chamada
  if (!f.image) {
    await db.prepare("UPDATE generation_jobs SET status='disabled' WHERE id=?").bind(job.id).run();
    await logEvent(db, job.id, "job.disabled", `${DISABLED_MESSAGE.image} No API request was made.`);
    return;
  }

  const attempt = job.attempts + 1;
  await db.prepare("UPDATE generation_jobs SET status='processing', started_at=?, completed_at=NULL, error_kind=NULL, error_message=NULL, attempts=? WHERE id=?").bind(now(), attempt, job.id).run();
  await logEvent(db, job.id, "job.started", `Tentativa ${attempt}/${MAX_ATTEMPTS}.`);

  try {
    const input = parseJson<{ prompt: string; replace?: boolean }>(job.input_payload, { prompt: "" });
    const provider = getImageProvider(env, true);
    await db.prepare("UPDATE generation_jobs SET provider = ?, model = ?, estimated_cost = ? WHERE id = ?").bind(provider.name, provider.model, provider.estimateCost(), job.id).run();
    await assertBudget(env, provider.paid, provider.estimateCost());

    const isRecipe = job.type === "recipe_image";
    let slug = "", currentStatus: string | null = null, ownerId = job.target_id!;
    if (isRecipe) {
      const r = await getRecipeFull(db, ownerId);
      if (!r) throw new StructuralError("empty", "A receita não existe mais.");
      slug = r.slug; currentStatus = r.hero?.status ?? null;
    } else {
      const ing = await db.prepare("SELECT i.slug, a.status AS asset_status FROM ingredients i LEFT JOIN assets a ON a.id = i.asset_id AND a.deleted_at IS NULL WHERE i.id = ? AND i.deleted_at IS NULL").bind(ownerId).first<{ slug: string; asset_status: string | null }>();
      if (!ing) throw new StructuralError("empty", "O ingrediente não existe mais.");
      slug = ing.slug; currentStatus = ing.asset_status;
    }

    // 2) nunca regenerar automaticamente um asset aprovado (§21)
    if (currentStatus === "approved" && !input.replace) {
      await db.prepare("UPDATE generation_jobs SET status='completed', output_payload=?, completed_at=? WHERE id=?").bind(JSON.stringify({ reused: true }), now(), job.id).run();
      await logEvent(db, job.id, "asset.reused", "Já existe um asset aprovado: reutilizado, nada foi gerado.");
      return;
    }

    const res = isRecipe ? await provider.generateRecipeImage({ prompt: input.prompt, label: slug }) : await provider.generateIngredientImage({ prompt: input.prompt, label: slug });
    if (res.status === "disabled") {
      await db.prepare("UPDATE generation_jobs SET status='disabled' WHERE id=?").bind(job.id).run();
      await logEvent(db, job.id, "job.disabled", "O provider de imagens está desativado. No API request was made.");
      return;
    }
    if (!ALLOWED_MIME[res.mimeType] || res.bytes.byteLength === 0 || res.bytes.byteLength > MAX_UPLOAD) throw new StructuralError("invalid_schema", "A imagem retornada não passou na validação (formato/tamanho).");

    // 3) R2 + registro como nova versão em revisão; nunca publica direto (§18)
    const file = new File([res.bytes as Uint8Array<ArrayBuffer>], `${slug}.${ALLOWED_MIME[res.mimeType]}`, { type: res.mimeType });
    const asset = await storeAsset(env, { type: isRecipe ? "recipe_hero" : "ingredient", ownerId, slug, file, status: "review" });
    if (isUploadError(asset)) throw new ProviderError("external", asset.message);
    await db.prepare("UPDATE assets SET source_type='generated', generation_template_id=?, generation_template_version=?, provider=?, model=?, prompt=? WHERE id=?")
      .bind(job.template_id, job.template_version, provider.name, res.model, input.prompt, asset.id).run();

    if (isRecipe) {
      const cur = await db.prepare("SELECT status FROM recipes WHERE id = ?").bind(ownerId).first<{ status: string }>();
      const demote = cur?.status === "approved" || cur?.status === "published";
      await db.prepare("UPDATE recipes SET hero_asset_id=?, status=CASE WHEN ? THEN 'review' ELSE status END, published_at=CASE WHEN ? THEN NULL ELSE published_at END, updated_at=? WHERE id=?").bind(asset.id, demote ? 1 : 0, demote ? 1 : 0, now(), ownerId).run();
      await refreshRecipeStatus(db, ownerId);
    } else {
      await db.prepare("UPDATE ingredients SET asset_id=?, updated_at=? WHERE id=?").bind(asset.id, now(), ownerId).run();
      await refreshRecipesUsingIngredient(db, ownerId);
    }
    await db.prepare("UPDATE generation_jobs SET status='completed', items_count=1, actual_cost=?, output_payload=?, completed_at=? WHERE id=?").bind(res.cost, JSON.stringify({ asset_id: asset.id, version: asset.version }), now(), job.id).run();
    await logEvent(db, job.id, "job.completed", `Imagem v${asset.version} enviada ao R2 e aguardando revisão.`, { asset_id: asset.id });
    logOps("job.completed", job, { duration_ms: Date.now() - started, cost: res.cost });
  } catch (e) {
    const cur = (await getJob(db, job.id)) ?? job;
    if (e instanceof ProviderError) await fail(env, cur, e.kind, e.message, started);
    else if (e instanceof FactoryBlocked) await fail(env, cur, "blocked", e.message, started);
    else if (e instanceof StructuralError) await fail(env, cur, "structural", e.message, started);
    else await fail(env, cur, "structural", e instanceof Error ? e.message : "Erro inesperado.", started);
  }
}

/* ───────── retry / cancel ───────── */

export async function retryJob(env: Env, id: string, actor: string): Promise<{ ok: true } | { ok: false; status: 404 | 409 | 403; error: string; message: string }> {
  const job = await getJob(env.DB, id);
  if (!job) return { ok: false, status: 404, error: "not_found", message: "Job não encontrado." };
  if (!["failed", "queued", "disabled"].includes(job.status)) return { ok: false, status: 409, error: "not_retryable", message: `Jobs ${job.status} não podem ser executados de novo.` };
  if (job.attempts >= MAX_ATTEMPTS) return { ok: false, status: 409, error: "max_attempts", message: `Limite de ${MAX_ATTEMPTS} tentativas atingido. Crie um novo job.` };
  const isImage = job.type === "recipe_image" || job.type === "ingredient_image";
  const f = flagsFrom(env);
  if (isImage && !f.image) return { ok: false, status: 403, error: "image_disabled", message: DISABLED_MESSAGE.image };
  if (!isImage && !f.content) return { ok: false, status: 403, error: "content_disabled", message: DISABLED_MESSAGE.content };
  await logEvent(env.DB, job.id, "job.retry", `Retry manual por ${actor}.`);
  if (isImage) await executeImageJob(env, job, actor);
  else await executeRecipeJob(env, job, actor);
  return { ok: true };
}

export async function cancelJob(db: D1Database, id: string, actor: string) {
  const res = await db.prepare("UPDATE generation_jobs SET status='cancelled', completed_at=? WHERE id=? AND status IN ('queued','disabled','failed')").bind(now(), id).run();
  if (!res.meta.changes) return false;
  await logEvent(db, id, "job.cancelled", `Cancelado por ${actor}.`);
  return true;
}
