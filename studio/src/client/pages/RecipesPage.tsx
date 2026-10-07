import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RECIPE_STATUS_LABEL, fmtDay, useApi, type Batch, type IngredientItem, type RecipeStatus } from "../api";
import { AssetPreview } from "../components/assets";
import { DataTable, type Column } from "../components/table";
import { Button, EmptyState, ErrorState, FilterBar, Loading, PageHeader, SearchInput, Select, StatusBadge, inputCls } from "../components/ui";

type Row = {
  id: string; name: string; slug: string; category: string; prep_time: number; cook_time: number; status: RecipeStatus; updated_at: string;
  batch_number: number | null; ingredient_count: number; ingredients_without_asset: number; hero_url: string | null;
};

export function RecipesPage() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState("");
  const f = { status: sp.get("status") ?? "", category: sp.get("category") ?? "", ingredient: sp.get("ingredient") ?? "", batch: sp.get("batch") ?? "", from: sp.get("from") ?? "", to: sp.get("to") ?? "" };
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); };

  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), ...(search ? { search } : {}) }).toString();
  const { data, error, loading, reload } = useApi<{ items: Row[] }>(`/recipes${qs ? `?${qs}` : ""}`);
  const cats = useApi<{ items: string[] }>("/recipes/categories");
  const ings = useApi<{ items: IngredientItem[] }>("/ingredients");
  const batches = useApi<{ items: Batch[] }>("/batches");
  const nav = useNavigate();
  const filtered = !!(search || Object.values(f).some(Boolean));

  const columns: Column<Row>[] = [
    {
      key: "name", header: "Receita",
      render: (r) => (
        <div className="flex items-center gap-3">
          <AssetPreview url={r.hero_url} alt={r.name} size="sm" />
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { key: "cat", header: "Categoria", render: (r) => r.category || <span className="text-zinc-400">—</span> },
    { key: "time", header: "Tempo", className: "tabular", render: (r) => (r.prep_time + r.cook_time ? `${r.prep_time + r.cook_time} min` : "—") },
    {
      key: "ing", header: "Ingredientes",
      render: (r) => (
        <span className="tabular">
          {r.ingredient_count}
          {r.ingredients_without_asset > 0 && <span className="ml-2 text-amber-700" title="Ingredientes sem imagem aprovada">! {r.ingredients_without_asset} sem asset</span>}
        </span>
      ),
    },
    { key: "batch", header: "Lote", className: "tabular", render: (r) => (r.batch_number ? `#${String(r.batch_number).padStart(3, "0")}` : <span className="text-zinc-400">—</span>) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "upd", header: "Atualizado", className: "tabular text-zinc-500", render: (r) => fmtDay(r.updated_at) },
  ];

  return (
    <>
      <PageHeader title="Receitas" actions={<Link to="/receitas/nova"><Button variant="primary">Nova receita</Button></Link>} />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar receita…" />
        <Select label="Status" value={f.status} onChange={(v) => set("status", v)}>
          <option value="">Todos os status</option>
          {(Object.keys(RECIPE_STATUS_LABEL) as RecipeStatus[]).map((s) => <option key={s} value={s}>{RECIPE_STATUS_LABEL[s]}</option>)}
        </Select>
        <Select label="Categoria" value={f.category} onChange={(v) => set("category", v)}>
          <option value="">Todas as categorias</option>
          {cats.data?.items.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select label="Ingrediente" value={f.ingredient} onChange={(v) => set("ingredient", v)}>
          <option value="">Qualquer ingrediente</option>
          {ings.data?.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </Select>
        <Select label="Lote" value={f.batch} onChange={(v) => set("batch", v)}>
          <option value="">Todos os lotes</option>
          {batches.data?.items.map((b) => <option key={b.id} value={b.id}>Lote #{String(b.number).padStart(3, "0")}</option>)}
        </Select>
        <input type="date" aria-label="Atualizada a partir de" className={`${inputCls} w-auto`} value={f.from} onChange={(e) => set("from", e.target.value)} />
        <input type="date" aria-label="Atualizada até" className={`${inputCls} w-auto`} value={f.to} onChange={(e) => set("to", e.target.value)} />
        {filtered && <Button variant="ghost" onClick={() => { setSearch(""); setSp({}); }}>Limpar</Button>}
      </FilterBar>

      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <DataTable
          columns={columns} rows={data?.items ?? []} rowKey={(r) => r.id} onRowClick={(r) => nav(`/receitas/${r.id}`)}
          empty={filtered
            ? <EmptyState title="Nenhuma receita com esses filtros." hint="Remova algum filtro para ver mais resultados." />
            : <EmptyState title="Nenhuma receita ainda." hint="Crie uma receita ou importe um lote em JSON." action={<Link to="/receitas/nova"><Button variant="primary">Nova receita</Button></Link>} />}
        />
      )}
    </>
  );
}
