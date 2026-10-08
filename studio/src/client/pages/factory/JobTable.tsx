import { Link, useNavigate } from "react-router-dom";
import { api, fmtDate } from "../../api";
import { DataTable, type Column } from "../../components/table";
import { useToast } from "../../components/toast";
import { Button, EmptyState } from "../../components/ui";
import { fmtDuration, JobStatusBadge, money, TYPE_LABEL, type Job } from "./shared";

export function JobTable({ jobs, onChanged, detailed = false, empty }: { jobs: Job[]; onChanged: () => void; detailed?: boolean; empty: React.ReactNode }) {
  const nav = useNavigate();
  const toast = useToast();

  async function run(job: Job, action: "retry" | "cancel") {
    try {
      await api(`/factory/jobs/${job.id}/${action}`, { method: "POST" });
      toast.ok(action === "retry" ? `${job.code} executado de novo` : `${job.code} cancelado`);
    } catch (e) {
      toast.error(action === "retry" ? "Não foi possível executar." : "Não foi possível cancelar.", (e as Error).message);
    }
    onChanged();
  }

  const columns: Column<Job>[] = [
    { key: "j", header: "Job", render: (j) => <span className="tabular whitespace-nowrap font-medium">#{j.code}</span> },
    { key: "t", header: "Tipo", render: (j) => <div>{TYPE_LABEL[j.type]}{j.target_id && <p className="max-w-[16rem] truncate text-xs text-zinc-500">{(j.input.target_name as string) ?? ""}</p>}</div> },
    { key: "b", header: "Lote", className: "tabular", render: (j) => (j.batch_id ? <Link className="underline underline-offset-4" to={`/lotes/${j.batch_id}`} onClick={(e) => e.stopPropagation()}>#{String(j.batch_number ?? "").padStart(3, "0")}</Link> : "—") },
    { key: "s", header: "Status", render: (j) => <JobStatusBadge status={j.status} /> },
    { key: "i", header: "Itens", className: "tabular", render: (j) => (j.type === "recipe" && !j.target_id ? `${j.items_count} recipes` : j.items_count ? "1" : "—") },
    ...(detailed
      ? ([
          { key: "v", header: "Template", className: "text-zinc-500", render: (j) => j.template_version ?? "—" },
          { key: "p", header: "Provider", className: "text-zinc-500", render: (j) => (j.provider ? `${j.provider}` : "—") },
          { key: "c", header: "Custo", className: "tabular text-zinc-500", render: (j) => money(j.actual_cost, j.currency) },
        ] as Column<Job>[])
      : []),
    { key: "d", header: "Criado", className: "tabular text-zinc-500", render: (j) => fmtDate(j.created_at) },
    { key: "u", header: "Duração", className: "tabular text-zinc-500", render: (j) => fmtDuration(j.duration_ms) },
    {
      key: "a", header: "", className: "text-right",
      render: (j) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" onClick={() => nav(`/factory/jobs/${j.id}`)}>View</Button>
          {["failed", "queued"].includes(j.status) && j.attempts < j.max_attempts && <Button onClick={() => run(j, "retry")}>{j.status === "queued" ? "Run" : "Retry"}</Button>}
          {["queued", "disabled", "failed"].includes(j.status) && <Button variant="ghost" onClick={() => run(j, "cancel")}>Cancel</Button>}
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={jobs} rowKey={(j) => j.id} onRowClick={(j) => nav(`/factory/jobs/${j.id}`)} empty={empty} />;
}

export const NoJobs = ({ text }: { text: string }) => <EmptyState title={text} hint="Use Generate para iniciar uma rodada." />;
