import { useNavigate } from "react-router-dom";
import { api, fmtDay, useApi, type Batch } from "../api";
import { DataTable, type Column } from "../components/table";
import { useToast } from "../components/toast";
import { Badge, Button, EmptyState, ErrorState, Loading, PageHeader, ProgressBar } from "../components/ui";

export function BatchesPage() {
  const { data, error, loading, reload } = useApi<{ items: Batch[] }>("/batches");
  const nav = useNavigate();
  const toast = useToast();

  async function create() {
    try { const b = await api<{ id: string }>("/batches", { method: "POST" }); nav(`/lotes/${b.id}`); }
    catch (e) { toast.error("Não foi possível criar o lote.", (e as Error).message); }
  }

  const columns: Column<Batch>[] = [
    { key: "n", header: "Lote", render: (b) => <span className="flex items-center gap-2 font-medium">Lote #{String(b.number).padStart(3, "0")}{b.source === "factory" && <Badge tone="neutral" icon="⚙">Factory</Badge>}</span> },
    { key: "d", header: "Criado", className: "tabular text-zinc-500", render: (b) => fmtDay(b.created_at) },
    { key: "r", header: "Receitas", className: "tabular", render: (b) => b.progress.recipes_total },
    { key: "a", header: "Aprovadas", className: "tabular", render: (b) => `${b.progress.approved}/${b.progress.recipes_total}` },
    { key: "p", header: "Progresso", className: "w-56", render: (b) => <ProgressBar percent={b.progress.percent} /> },
    { key: "s", header: "Status", render: (b) => (b.status === "open" ? <Badge tone="blue" icon="◐">Aberto</Badge> : <Badge tone="green" icon="✓">Concluído</Badge>) },
  ];

  return (
    <>
      <PageHeader title="Lotes" subtitle="Rodadas de produção: receitas, imagens e aprovações acompanhadas juntas." actions={<Button variant="primary" onClick={create}>Novo lote</Button>} />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <DataTable columns={columns} rows={data?.items ?? []} rowKey={(b) => b.id} onRowClick={(b) => nav(`/lotes/${b.id}`)}
          empty={<EmptyState title="Nenhum lote ainda." hint="Crie o Lote #001 e importe as receitas da rodada." action={<Button variant="primary" onClick={create}>Criar lote</Button>} />} />
      )}
    </>
  );
}
