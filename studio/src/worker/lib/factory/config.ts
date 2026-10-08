import type { Env } from "../../env";

const on = (v: string | undefined) => v?.trim().toLowerCase() === "true";
const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export type Flags = {
  content: boolean;
  image: boolean;
  autoBatch: boolean;
  dailyLimit: number;
  monthlyBudget: number;
};

export const flagsFrom = (env: Env): Flags => ({
  content: on(env.CONTENT_GENERATION_ENABLED),
  image: on(env.IMAGE_GENERATION_ENABLED),
  autoBatch: on(env.AUTO_BATCH_GENERATION_ENABLED),
  dailyLimit: num(env.DAILY_GENERATION_LIMIT),
  monthlyBudget: num(env.MONTHLY_GENERATION_BUDGET),
});

export const DISABLED_MESSAGE = {
  content: "Content generation is currently disabled. Enable CONTENT_GENERATION_ENABLED to use this feature.",
  image: "Image generation is currently disabled. Enable IMAGE_GENERATION_ENABLED to use this feature.",
} as const;

export type BudgetDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * Guardrail (§28). Providers gratuitos (mock) sempre passam; providers pagos só com limite configurado
 * e dentro dele. Nunca excede silenciosamente: a resposta é sempre "allowed" ou "blocked + motivo".
 */
export function checkBudget(p: {
  paid: boolean;
  estimatedCost: number;
  dailyLimit: number;
  monthlyBudget: number;
  paidJobsToday: number;
  spentThisMonth: number;
}): BudgetDecision {
  if (!p.paid) return { allowed: true };
  if (p.dailyLimit <= 0) return { allowed: false, reason: "DAILY_GENERATION_LIMIT=0: nenhuma geração paga é permitida. Configure um limite para usar providers pagos." };
  if (p.paidJobsToday >= p.dailyLimit) return { allowed: false, reason: `Limite diário atingido (${p.paidJobsToday}/${p.dailyLimit} jobs pagos hoje).` };
  if (p.monthlyBudget <= 0) return { allowed: false, reason: "MONTHLY_GENERATION_BUDGET=0: nenhum gasto é permitido. Configure um orçamento mensal." };
  if (p.spentThisMonth + p.estimatedCost > p.monthlyBudget) {
    return { allowed: false, reason: `Orçamento mensal excedido: gasto ${p.spentThisMonth.toFixed(2)} + estimado ${p.estimatedCost.toFixed(2)} > ${p.monthlyBudget.toFixed(2)} USD.` };
  }
  return { allowed: true };
}

export async function spendSnapshot(db: D1Database, nowIso = new Date().toISOString()) {
  const day = nowIso.slice(0, 10);
  const month = nowIso.slice(0, 7);
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN substr(created_at,1,10) = ? THEN actual_cost ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN substr(created_at,1,7) = ? THEN actual_cost ELSE 0 END), 0) AS month,
         COALESCE(SUM(CASE WHEN substr(created_at,1,10) = ? AND (actual_cost > 0 OR estimated_cost > 0) AND status != 'disabled' AND status != 'cancelled' THEN 1 ELSE 0 END), 0) AS paid_jobs_today
       FROM generation_jobs`,
    )
    .bind(day, month, day)
    .first<{ today: number; month: number; paid_jobs_today: number }>();
  return { today: row?.today ?? 0, month: row?.month ?? 0, paidJobsToday: row?.paid_jobs_today ?? 0 };
}
