import { newId, now } from "../ids";
import type { TemplateType } from "./templates";

export const JOB_STATUSES = ["queued", "processing", "completed", "failed", "cancelled", "disabled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobType = TemplateType;
export const MAX_ATTEMPTS = 3; // sem retry automático; este é o teto para retries manuais

export type JobRow = {
  id: string; seq: number; type: JobType; status: JobStatus; batch_id: string | null; template_id: string | null; template_version: string | null;
  provider: string | null; model: string | null; idempotency_key: string | null; target_type: string | null; target_id: string | null;
  input_payload: string; output_payload: string | null; raw_output: string | null; error_kind: "external" | "structural" | "blocked" | null;
  error_message: string | null; attempts: number; items_count: number; estimated_cost: number; actual_cost: number; currency: string;
  created_by: string | null; created_at: string; started_at: string | null; completed_at: string | null;
};

export const jobCode = (seq: number) => `GF-${String(seq).padStart(3, "0")}`;

const parse = <T>(s: string | null, fallback: T): T => {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

export function jobView(j: JobRow, extra: Record<string, unknown> = {}) {
  const dur = j.started_at && j.completed_at ? Date.parse(j.completed_at) - Date.parse(j.started_at) : null;
  return {
    id: j.id, code: jobCode(j.seq), type: j.type, status: j.status, batch_id: j.batch_id, template_id: j.template_id, template_version: j.template_version,
    provider: j.provider, model: j.model, target_type: j.target_type, target_id: j.target_id, input: parse<Record<string, unknown>>(j.input_payload, {}),
    output: parse<Record<string, unknown> | null>(j.output_payload, null), has_raw_output: !!j.raw_output, error_kind: j.error_kind, error_message: j.error_message,
    attempts: j.attempts, max_attempts: MAX_ATTEMPTS, items_count: j.items_count, estimated_cost: j.estimated_cost, actual_cost: j.actual_cost, currency: j.currency,
    created_by: j.created_by, created_at: j.created_at, started_at: j.started_at, completed_at: j.completed_at, duration_ms: dur, ...extra,
  };
}

export async function logEvent(db: D1Database, jobId: string, type: string, message: string, data?: unknown) {
  await db
    .prepare("INSERT INTO generation_events (id, job_id, event_type, message, data, created_at) VALUES (?,?,?,?,?,?)")
    .bind(newId("event"), jobId, type, message, data === undefined ? null : JSON.stringify(data), now())
    .run();
}

/** Observabilidade sem segredos nem payloads: só metadados operacionais. */
export function logOps(event: string, j: Pick<JobRow, "id" | "type" | "provider" | "model">, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ factory: event, job: j.id, type: j.type, provider: j.provider, model: j.model, ...extra }));
}

export async function getJob(db: D1Database, id: string) {
  return db.prepare("SELECT * FROM generation_jobs WHERE id = ?").bind(id).first<JobRow>();
}

export type NewJob = {
  type: JobType; status?: JobStatus; batchId?: string | null; template?: { id: string; version: string } | null; provider?: string; model?: string;
  idempotencyKey?: string | null; targetType?: string; targetId?: string; input: unknown; estimatedCost?: number; actor: string;
};

/** Idempotente: a mesma chave devolve o job existente em vez de criar outro (clique duplicado). */
export async function createJob(db: D1Database, p: NewJob): Promise<{ job: JobRow; deduped: boolean }> {
  if (p.idempotencyKey) {
    const hit = await db.prepare("SELECT * FROM generation_jobs WHERE idempotency_key = ?").bind(p.idempotencyKey).first<JobRow>();
    if (hit) return { job: hit, deduped: true };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const last = await db.prepare("SELECT MAX(seq) AS n FROM generation_jobs").first<{ n: number | null }>();
    const seq = (last?.n ?? 100) + 1;
    const id = newId("job");
    try {
      await db
        .prepare(
          `INSERT INTO generation_jobs (id, seq, type, status, batch_id, template_id, template_version, provider, model, idempotency_key, target_type, target_id,
             input_payload, estimated_cost, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(id, seq, p.type, p.status ?? "queued", p.batchId ?? null, p.template?.id ?? null, p.template?.version ?? null, p.provider ?? null, p.model ?? null,
          p.idempotencyKey ?? null, p.targetType ?? null, p.targetId ?? null, JSON.stringify(p.input), p.estimatedCost ?? 0, p.actor, now())
        .run();
      await logEvent(db, id, "job.created", `Job criado por ${p.actor}.`);
      return { job: (await getJob(db, id))!, deduped: false };
    } catch (e) {
      if (p.idempotencyKey) {
        const hit = await db.prepare("SELECT * FROM generation_jobs WHERE idempotency_key = ?").bind(p.idempotencyKey).first<JobRow>();
        if (hit) return { job: hit, deduped: true };
      }
      if (attempt === 3) throw e;
    }
  }
  throw new Error("job_create_failed");
}
