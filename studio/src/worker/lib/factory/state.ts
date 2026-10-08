/** Estados padronizados da Factory (§31), derivados do que está no banco. */
export const FACTORY_STATES = ["Idle", "Generating", "Validating", "Needs review", "Blocked", "Completed", "Failed"] as const;
export type FactoryState = (typeof FACTORY_STATES)[number];

export function deriveFactoryState(p: {
  processing: { hasRawOutput: boolean } | null;
  latest: { status: string; errorKind: string | null } | null;
  pendingDecisions: number;
  recipesAwaitingReview: number;
  contentEnabled: boolean;
}): FactoryState {
  if (p.processing) return p.processing.hasRawOutput ? "Validating" : "Generating";
  if (p.latest?.status === "failed") return p.latest.errorKind === "blocked" ? "Blocked" : "Failed";
  if (p.pendingDecisions > 0 || p.recipesAwaitingReview > 0) return "Needs review";
  if (!p.contentEnabled && p.latest?.status === "queued") return "Blocked";
  if (p.latest?.status === "completed") return "Completed";
  return "Idle";
}
