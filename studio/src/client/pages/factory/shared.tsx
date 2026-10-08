import { NavLink } from "react-router-dom";
import { Badge } from "../../components/ui";

/* ───────── tipos da API ───────── */
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled" | "disabled";
export type JobType = "recipe" | "recipe_image" | "ingredient_image" | "description" | "metadata";
export type FactoryState = "Idle" | "Generating" | "Validating" | "Needs review" | "Blocked" | "Completed" | "Failed";

export interface Job {
  id: string; code: string; type: JobType; status: JobStatus; batch_id: string | null; batch_number?: number | null; template_version: string | null;
  provider: string | null; model: string | null; target_type: string | null; target_id: string | null; input: Record<string, any>; output: Record<string, any> | null;
  has_raw_output: boolean; error_kind: "external" | "structural" | "blocked" | null; error_message: string | null; attempts: number; max_attempts: number; items_count: number;
  estimated_cost: number; actual_cost: number; currency: string; created_by: string | null; created_at: string; started_at: string | null; completed_at: string | null; duration_ms: number | null;
}
export interface Summary {
  generated: number; created: number; ready_for_review: number; awaiting_assets: number; approved: number; rejected: number; duplicates: number; needs_decision: number;
  invalid: number; discarded: number; ingredient_assets_reused: number; ingredient_assets_missing: number; recipe_images_pending: number;
}
export interface FactoryConfig {
  flags: { content_generation: boolean; image_generation: boolean; auto_batch_generation: boolean };
  guardrails: { daily_generation_limit: number; monthly_generation_budget: number };
  providers: { recipe: string; image: string };
  spend: { today: number; month: number; currency: string };
  messages: { content: string | null; image: string | null };
}

export const TYPE_LABEL: Record<JobType, string> = {
  recipe: "Recipe generation", recipe_image: "Recipe image", ingredient_image: "Ingredient image", description: "Description", metadata: "Instructions",
};

export const fmtDuration = (ms: number | null) => (ms == null ? "—" : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
export const money = (n: number, cur = "USD") => `${cur === "USD" ? "$" : cur + " "}${n.toFixed(2)}`;

/* ───────── badges ───────── */
const JOB_TONE: Record<JobStatus, ["neutral" | "yellow" | "blue" | "green" | "red", string, string]> = {
  queued: ["neutral", "○", "Queued"], processing: ["blue", "◐", "Processing"], completed: ["green", "✓", "Completed"],
  failed: ["red", "✕", "Failed"], cancelled: ["neutral", "–", "Cancelled"], disabled: ["yellow", "!", "Disabled"],
};
export function JobStatusBadge({ status }: { status: JobStatus }) {
  const [tone, icon, label] = JOB_TONE[status];
  return <Badge tone={tone} icon={icon}>{label}</Badge>;
}

const STATE_TONE: Record<FactoryState, ["neutral" | "yellow" | "blue" | "green" | "red", string]> = {
  Idle: ["neutral", "○"], Generating: ["blue", "◐"], Validating: ["blue", "◑"], "Needs review": ["yellow", "!"], Blocked: ["red", "■"], Completed: ["green", "✓"], Failed: ["red", "✕"],
};
export function FactoryStateBadge({ state }: { state: FactoryState }) {
  const [tone, icon] = STATE_TONE[state];
  return <Badge tone={tone} icon={icon}>{state}</Badge>;
}

/* ───────── navegação da seção ───────── */
const TABS = [
  { to: "/factory/generate", label: "Generate" },
  { to: "/factory/queue", label: "Queue" },
  { to: "/factory/history", label: "History" },
  { to: "/factory/templates", label: "Templates" },
  { to: "/factory/settings", label: "Settings" },
];
export function FactoryTabs() {
  return (
    <nav aria-label="Factory" className="mb-6 flex gap-1 border-b border-zinc-200">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `-mb-px border-b-2 px-3 py-2 text-sm ${isActive ? "border-zinc-900 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Fluxo da linha de produção (§45). `active` marca a etapa atual. */
export function Pipeline({ active }: { active: number }) {
  const steps = ["Input", "Generate", "Inspect", "Resolve", "Approve", "Publish"];
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" aria-label="Linha de produção">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 ${i === active ? "bg-zinc-900 text-white" : i < active ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-500"}`}>{s}</span>
          {i < steps.length - 1 && <span aria-hidden className="text-zinc-300">→</span>}
        </li>
      ))}
    </ol>
  );
}

export function DisabledNotice({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <p className="font-medium">Disabled</p>
      <p className="mt-0.5">{message}</p>
    </div>
  );
}
