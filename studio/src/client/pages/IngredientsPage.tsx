import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api, fmtDay, useApi, type Coverage, type IngredientItem } from "../api";
import { AssetPreview } from "../components/assets";
import { DataTable, type Column } from "../components/table";
import { useToast } from "../components/toast";
import { AssetStatus, Button, ConfirmDialog, EmptyState, ErrorState, Field, FilterBar, Loading, PageHeader, ProgressBar, SearchInput, inputCls } from "../components/ui";

const TABS = [
  ["", "Todos"], ["pending", "Sem imagem aprovada"], ["missing", "Sem imagem"], ["review", "Em revisão"], ["approved", "Aprovados"], ["rejected", "Rejeitados"],
] as const;

export function IngredientsPage() {
  const [sp, setSp] = useSearchParams();
  const state = sp.get("state") ?? "";
  const [search, setSearch] = useState("");
  const qs = new URLSearchParams({ ...(state ? { state } : {}), ...(search ? { search } : {}) }).toString();
  const { data, error, loading, reload } = useApi<{ items: IngredientItem[]; coverage: Coverage }>(`/ingredients${qs ? `?${qs}` : ""}`);
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);

  const columns: Column<IngredientItem>[] = [
    { key: "name", header: "Ingrediente", render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "preview", header: "Preview", render: (i) => <AssetPreview url={i.asset?.url} alt={i.name} size="sm" /> },
    { key: "recipes", header: "Receitas", className: "tabular", render: (i) => i.recipe_count },
    { key: "asset", header: "Asset", render: (i) => (i.state === "approved" ? <span className="text-emerald-700">✓</span> : <span className="font-medium text-amber-700">!</span>) },
    { key: "status", header: "Status", render: (i) => <AssetStatus state={i.state} /> },
    { key: "updated", header: "Atualizado", className: "tabular text-zinc-500", render: (i) => fmtDay(i.updated_at) },
  ];

  return (
    <>
      <PageHeader title="Ingredientes" subtitle="Biblioteca global: cada ingrediente existe uma vez e é reutilizado por todas as receitas." actions={<Button variant="primary" onClick={() => setCreating(true)}>Novo ingrediente</Button>} />

      {data && <CoverageHeader c={data.coverage} />}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar ingrediente ou alias…" />
        <div role="tablist" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
          {TABS.map(([k, label]) => (
            <button
              key={k} role="tab" aria-selected={state === k}
              onClick={() => (k ? setSp({ state: k }) : setSp({}))}
              className={`h-9 rounded-md px-3 text-sm ${state === k ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </FilterBar>

      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(i) => i.id}
          onRowClick={(i) => nav(`/ingredientes/${i.id}`)}
          empty={
            state === "pending" || state === "missing"
              ? <EmptyState title="Nenhum ingrediente sem imagem." hint="A biblioteca está 100% coberta." />
              : <EmptyState title="Nenhum ingrediente encontrado." hint={search ? "Tente outro termo ou verifique os aliases." : "Crie o primeiro ingrediente ou importe receitas em um lote."} />
          }
        />
      )}

      <NewIngredientDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); nav(`/ingredientes/${id}`); }} />
    </>
  );
}

function CoverageHeader({ c }: { c: Coverage }) {
  return (
    <div className="mb-5 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <p><span className="tabular text-2xl font-semibold">{c.total}</span> <span className="text-zinc-500">ingredientes únicos</span></p>
        <p><span className="tabular font-medium">{c.with_image}</span> <span className="text-zinc-500">com imagem</span></p>
        <p><span className="tabular font-medium">{c.pending}</span> <span className="text-zinc-500">pendentes</span></p>
      </div>
      <div className="mt-3 max-w-md"><ProgressBar percent={c.percent} label="Cobertura da biblioteca" /></div>
      <p className="mt-1 text-xs text-zinc-500">{c.percent}% de cobertura{c.review ? ` · ${c.review} aguardando aprovação` : ""}{c.rejected ? ` · ${c.rejected} rejeitados` : ""}</p>
    </div>
  );
}

function NewIngredientDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [possible, setPossible] = useState<{ id: string; name: string }[] | null>(null);
  const toast = useToast();

  async function create(force = false) {
    try {
      const r = await api<{ id: string }>("/ingredients", { method: "POST", body: { name, aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean), force } });
      toast.ok("Ingrediente criado");
      setName(""); setAliases(""); setPossible(null);
      onCreated(r.id);
    } catch (e) {
      const err = e as ApiError;
      if (err.body.error === "possible_match") setPossible(err.body.candidates);
      else if (err.body.error === "exists") toast.error(err.message, "Use o ingrediente existente em vez de criar outro.");
      else toast.error("Não foi possível criar o ingrediente.", err.message);
    }
  }

  if (possible) {
    return (
      <ConfirmDialog
        open={open} title="Possível correspondência encontrada" confirmLabel="Criar ingrediente" onCancel={() => setPossible(null)} onConfirm={() => create(true)}
        extra={possible[0] && <Button onClick={() => { onCreated(possible[0].id); setPossible(null); }}>Usar existente</Button>}
      >
        <p><strong>{name}</strong> parece com:</p>
        <ul className="mt-1 list-inside list-disc">{possible.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog open={open} title="Novo ingrediente" confirmLabel="Criar" onCancel={onClose} onConfirm={() => name.trim() && create()}>
      <div className="space-y-3">
        <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex.: Tomate" /></Field>
        <Field label="Aliases" hint="Separe por vírgula. Ex.: tomate cereja, tomates"><input className={inputCls} value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field>
      </div>
    </ConfirmDialog>
  );
}
