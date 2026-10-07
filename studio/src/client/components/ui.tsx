import { useEffect, useRef, type ReactNode } from "react";
import { ASSET_STATE_LABEL, RECIPE_STATUS_LABEL, type AssetState, type RecipeStatus } from "../api";

/* ───────── botões ───────── */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" };
export function Button({ variant = "secondary", className = "", ...p }: BtnProps) {
  const v = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 border-zinc-900",
    secondary: "bg-white text-zinc-800 hover:bg-zinc-50 border-zinc-300",
    danger: "bg-white text-red-700 hover:bg-red-50 border-red-300",
    ghost: "border-transparent text-zinc-600 hover:bg-zinc-100",
  }[variant];
  return <button {...p} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />;
}

/* ───────── badges: cor + ícone + texto (nunca só cor) ───────── */
const TONES = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  red: "bg-red-50 text-red-800 ring-red-200",
} as const;

export function Badge({ tone, icon, children }: { tone: keyof typeof TONES; icon: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

const RECIPE_TONE: Record<RecipeStatus, [keyof typeof TONES, string]> = {
  draft: ["neutral", "○"], image_pending: ["yellow", "◔"], review: ["blue", "◐"], approved: ["green", "✓"], published: ["green", "●"], rejected: ["red", "✕"],
};
export function StatusBadge({ status }: { status: RecipeStatus }) {
  const [tone, icon] = RECIPE_TONE[status];
  return <Badge tone={tone} icon={icon}>{RECIPE_STATUS_LABEL[status]}</Badge>;
}

const ASSET_TONE: Record<AssetState, [keyof typeof TONES, string]> = { missing: ["yellow", "!"], review: ["blue", "◐"], approved: ["green", "✓"], rejected: ["red", "✕"] };
export function AssetStatus({ state }: { state: AssetState }) {
  const [tone, icon] = ASSET_TONE[state];
  return <Badge tone={tone} icon={icon}>{ASSET_STATE_LABEL[state]}</Badge>;
}

/* ───────── estrutura ───────── */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <p className="font-medium text-zinc-700">{title}</p>
      {hint && <p className="max-w-sm text-zinc-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-medium">Não foi possível carregar.</p>
      <p className="mt-0.5">{message}</p>
      {onRetry && <Button className="mt-3" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export const Loading = () => <p className="py-10 text-center text-zinc-500">Carregando…</p>;

export function ProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progresso"} className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-zinc-900 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="tabular w-10 text-right text-xs text-zinc-600">{percent}%</span>
    </div>
  );
}

/* ───────── formulário ───────── */
export const inputCls = "h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = "Buscar…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={`${inputCls.replace("w-full", "w-64")}`} />;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${inputCls} w-auto pr-8`}>
      {children}
    </select>
  );
}

/* ───────── diálogo ───────── */
export function ConfirmDialog({
  open, title, children, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "primary", onConfirm, onCancel, extra,
}: {
  open: boolean; title: string; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: "primary" | "danger";
  onConfirm: () => void; onCancel: () => void; extra?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onCancel} onCancel={onCancel} className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 p-0 shadow-xl backdrop:bg-black/30">
      <div className="p-5">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-zinc-600">{children}</div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {extra}
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}
