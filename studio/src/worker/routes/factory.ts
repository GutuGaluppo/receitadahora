import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { DISABLED_MESSAGE, flagsFrom, spendSnapshot } from "../lib/factory/config";
import { getJob, jobCode, jobView, JOB_STATUSES, type JobRow } from "../lib/factory/jobs";
import { cancelJob, createImageJobs, FactoryBlocked, resolveItem, retryJob, startRecipeBatchJob, startRegeneration } from "../lib/factory/pipeline";
import { ProviderError } from "../lib/factory/providers";
import { deriveFactoryState } from "../lib/factory/state";
import { jobItems, jobSummary } from "../lib/factory/summary";
import { DEFAULT_TEMPLATES, ensureTemplates, type TemplateRow } from "../lib/factory/templates";
import { fail, parseBody } from "../lib/http";
import { getRecipeFull } from "../lib/repo";

export const factory = new Hono<AppEnv>();

const list = z.preprocess((v) => (typeof v === "string" ? v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().trim().min(1).max(80)).max(30)).optional();

const generateBody = z.object({
  idempotency_key: z.string().trim().min(8).max(80).optional(),
  count: z.coerce.number().int().min(1).max(30),
  category: z.string().trim().max(60).optional(),
  meal_time: z.string().trim().max(40).optional(),
  max_time: z.coerce.number().int().min(1).max(1440).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  restrictions: list,
  wanted_ingredients: list,
  avoid_ingredients: list,
  notes: z.string().trim().max(500).optional(),
});

/** Converte bloqueios de política em respostas claras. O backend decide; o frontend só reflete. */
function blocked(c: Context<AppEnv>, e: unknown) {
  if (e instanceof FactoryBlocked) {
    const status = e.code === "budget_blocked" ? 409 : 403;
    return c.json({ error: e.code, message: e.message }, status);
  }
  if (e instanceof ProviderError) return fail(c, 422, "provider", e.message);
  throw e;
}

/* ───────── configuração e visão geral ───────── */

async function configView(c: Context<AppEnv>) {
  const f = flagsFrom(c.env);
  const spend = await spendSnapshot(c.env.DB);
  return {
    flags: { content_generation: f.content, image_generation: f.image, auto_batch_generation: f.autoBatch },
    guardrails: { daily_generation_limit: f.dailyLimit, monthly_generation_budget: f.monthlyBudget },
    providers: { recipe: (c.env.RECIPE_PROVIDER ?? "mock").toLowerCase(), image: f.image ? (c.env.IMAGE_PROVIDER ?? "disabled").toLowerCase() : "disabled" },
    spend: { today: spend.today, month: spend.month, currency: "USD" },
    messages: { content: f.content ? null : DISABLED_MESSAGE.content, image: f.image ? null : DISABLED_MESSAGE.image },
  };
}

factory.get("/config", async (c) => c.json(await configView(c)));

factory.get("/overview", async (c) => {
  const db = c.env.DB;
  const f = flagsFrom(c.env);
  const processing = await db.prepare("SELECT raw_output IS NOT NULL AS has_raw FROM generation_jobs WHERE status = 'processing' LIMIT 1").first<{ has_raw: number }>();
  const latest = await db.prepare("SELECT * FROM generation_jobs WHERE type = 'recipe' AND status != 'cancelled' ORDER BY seq DESC LIMIT 1").first<JobRow>();
  const pending = (await db.prepare("SELECT COUNT(*) AS n FROM generation_items WHERE outcome IN ('duplicate','needs_decision')").first<{ n: number }>())?.n ?? 0;
  const awaiting = (await db.prepare("SELECT COUNT(*) AS n FROM recipes WHERE deleted_at IS NULL AND source_type = 'generated' AND status IN ('draft','image_pending','review')").first<{ n: number }>())?.n ?? 0;

  const state = deriveFactoryState({
    processing: processing ? { hasRawOutput: !!processing.has_raw } : null,
    latest: latest ? { status: latest.status, errorKind: latest.error_kind } : null,
    pendingDecisions: pending, recipesAwaitingReview: awaiting, contentEnabled: f.content,
  });

  let current = null;
  if (latest?.batch_id) {
    const batch = await db.prepare("SELECT id, number FROM batches WHERE id = ?").bind(latest.batch_id).first<{ id: string; number: number }>();
    current = { job: jobView(latest), batch, summary: await jobSummary(db, latest.id) };
  }
  return c.json({ state, current, config: await configView(c) });
});

factory.get("/templates", async (c) => {
  await ensureTemplates(c.env.DB);
  const rows = (await c.env.DB.prepare("SELECT * FROM generation_templates ORDER BY type, created_at DESC, version DESC").all<TemplateRow>()).results;
  return c.json({ items: rows.map((r) => ({ ...r, is_active: !!r.is_active })), defaults: DEFAULT_TEMPLATES.length });
});

/* ───────── jobs ───────── */

factory.post("/jobs", async (c) => {
  const body = await parseBody(c, generateBody);
  if (!body.ok) return body.res;
  const { idempotency_key, ...params } = body.data;
  const key = c.req.header("Idempotency-Key") ?? idempotency_key ?? null;
  try {
    const r = await startRecipeBatchJob(c.env, c.get("user"), params, key);
    return c.json({ job: jobView(r.job), deduped: r.deduped }, r.deduped ? 200 : 201);
  } catch (e) {
    return blocked(c, e);
  }
});

factory.get("/jobs", async (c) => {
  const q = c.req.query();
  let sql = `SELECT j.*, b.number AS batch_number FROM generation_jobs j LEFT JOIN batches b ON b.id = j.batch_id WHERE 1=1`;
  const binds: unknown[] = [];
  if (q.scope === "queue") sql += " AND j.status IN ('queued','processing','failed','disabled')";
  if (q.status && (JOB_STATUSES as readonly string[]).includes(q.status)) { sql += " AND j.status = ?"; binds.push(q.status); }
  if (q.type) { sql += " AND j.type = ?"; binds.push(q.type); }
  if (q.batch) { sql += " AND j.batch_id = ?"; binds.push(q.batch); }
  if (q.template_version) { sql += " AND j.template_version = ?"; binds.push(q.template_version); }
  if (q.from) { sql += " AND j.created_at >= ?"; binds.push(q.from); }
  if (q.to) { sql += " AND j.created_at <= ?"; binds.push(`${q.to}T23:59:59.999Z`); }
  sql += " ORDER BY j.seq DESC LIMIT 300";
  const rows = (await c.env.DB.prepare(sql).bind(...binds).all<JobRow & { batch_number: number | null }>()).results;
  const versions = (await c.env.DB.prepare("SELECT DISTINCT template_version AS v FROM generation_jobs WHERE template_version IS NOT NULL ORDER BY v").all<{ v: string }>()).results.map((r) => r.v);
  return c.json({ items: rows.map((r) => jobView(r, { batch_number: r.batch_number })), template_versions: versions });
});

factory.get("/jobs/:id", async (c) => {
  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job) return fail(c, 404, "not_found", "Job não encontrado.");
  const events = (await c.env.DB.prepare("SELECT id, event_type, message, data, created_at FROM generation_events WHERE job_id = ? ORDER BY created_at, rowid").bind(job.id).all<{ id: string; event_type: string; message: string; data: string | null; created_at: string }>()).results;
  const batch = job.batch_id ? await c.env.DB.prepare("SELECT id, number FROM batches WHERE id = ?").bind(job.batch_id).first<{ id: string; number: number }>() : null;
  const isRecipeBatch = job.type === "recipe" && job.target_id === null;
  let target: { id: string; name: string; kind: string } | null = null;
  if (job.target_id) {
    const name = job.target_type === "recipe" ? (await c.env.DB.prepare("SELECT name FROM recipes WHERE id = ?").bind(job.target_id).first<{ name: string }>())?.name : (await c.env.DB.prepare("SELECT name FROM ingredients WHERE id = ?").bind(job.target_id).first<{ name: string }>())?.name;
    target = { id: job.target_id, name: name ?? "(removido)", kind: job.target_type ?? "" };
  }
  return c.json({
    job: jobView(job, { batch_number: batch?.number ?? null }), batch, target, events: events.map((e) => ({ ...e, data: e.data ? JSON.parse(e.data) : null })),
    summary: isRecipeBatch ? await jobSummary(c.env.DB, job.id) : null,
    items: isRecipeBatch ? await jobItems(c.env.DB, job.id) : [],
  });
});

/** Resultado bruto do provider, preservado mesmo quando a validação falha. */
factory.get("/jobs/:id/raw", async (c) => {
  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job) return fail(c, 404, "not_found", "Job não encontrado.");
  return c.json({ code: jobCode(job.seq), raw: job.raw_output });
});

factory.post("/jobs/:id/retry", async (c) => {
  const r = await retryJob(c.env, c.req.param("id"), c.get("user"));
  if (!r.ok) return c.json({ error: r.error, message: r.message }, r.status);
  const job = await getJob(c.env.DB, c.req.param("id"));
  return c.json({ job: jobView(job!) });
});

factory.post("/jobs/:id/cancel", async (c) => {
  const ok = await cancelJob(c.env.DB, c.req.param("id"), c.get("user"));
  return ok ? c.json({ ok: true }) : fail(c, 409, "not_cancellable", "Só jobs na fila, desativados ou com falha podem ser cancelados.");
});

/* ───────── decisões sobre os itens gerados ───────── */

const decisions = z.object({
  decisions: z.array(z.object({ name: z.string().min(1), ingredient_id: z.string().optional(), create: z.boolean().optional() })).max(60).default([]),
});

async function itemAction(c: Context<AppEnv>, action: "discard" | "keep" | "resolve", decs: z.infer<typeof decisions>["decisions"] = []) {
  const r = await resolveItem(c.env, c.req.param("id")!, action, c.get("user"), decs);
  return r.ok ? c.json(r) : fail(c, r.status, r.error, r.message);
}
factory.post("/items/:id/discard", (c) => itemAction(c, "discard"));
factory.post("/items/:id/keep", (c) => itemAction(c, "keep"));
factory.post("/items/:id/resolve", async (c) => {
  const body = await parseBody(c, decisions);
  return body.ok ? itemAction(c, "resolve", body.data.decisions) : body.res;
});

/* ───────── regeneração granular e preparo de assets ───────── */

factory.post("/recipes/:id/regenerate", async (c) => {
  const body = await parseBody(c, z.object({ part: z.enum(["recipe", "description", "instructions", "image"]), idempotency_key: z.string().min(8).max(80).optional() }));
  if (!body.ok) return body.res;
  try {
    const r = await startRegeneration(c.env, c.get("user"), c.req.param("id"), body.data.part, c.req.header("Idempotency-Key") ?? body.data.idempotency_key ?? null);
    return c.json({ job: r.job ? jobView(r.job) : null, deduped: r.deduped }, r.job && !r.deduped ? 201 : 200);
  } catch (e) {
    return blocked(c, e);
  }
});

/** "Prepare Assets": cria (sem executar) os jobs de imagem que faltam para as receitas de um job. */
factory.post("/jobs/:id/prepare-assets", async (c) => {
  const job = await getJob(c.env.DB, c.req.param("id"));
  if (!job) return fail(c, 404, "not_found", "Job não encontrado.");
  const items = (await c.env.DB.prepare("SELECT recipe_id FROM generation_items WHERE job_id = ? AND outcome = 'created' AND recipe_id IS NOT NULL").bind(job.id).all<{ recipe_id: string }>()).results;
  const ings = new Map<string, { id: string; name: string }>();
  const heroes: string[] = [];
  for (const it of items) {
    const r = await getRecipeFull(c.env.DB, it.recipe_id);
    if (!r) continue;
    r.ingredients.filter((i) => !i.asset || i.asset.status === "rejected").forEach((i) => ings.set(i.ingredient_id, { id: i.ingredient_id, name: i.name }));
    if (!r.hero) heroes.push(r.id);
  }
  let created = 0;
  try {
    created += (await createImageJobs(c.env, { parentJobId: job.id, actor: c.get("user"), batchId: job.batch_id, recipeHero: null, ingredients: [...ings.values()] })).jobs.length;
    for (const id of heroes) created += (await createImageJobs(c.env, { parentJobId: job.id, actor: c.get("user"), batchId: job.batch_id, recipeHero: { id, replace: false }, ingredients: [] })).jobs.length;
  } catch (e) {
    return blocked(c, e);
  }
  const f = flagsFrom(c.env);
  return c.json({ created, status: f.image ? "queued" : "disabled", message: f.image ? null : DISABLED_MESSAGE.image });
});

