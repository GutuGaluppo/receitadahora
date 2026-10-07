import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api, fmtDay, useApi, type AssetState, type Batch } from "../api";
import { BatchProgress } from "../components/batch";
import { useToast } from "../components/toast";
import { AssetStatus, Badge, Button, Card, ErrorState, Loading, PageHeader, StatusBadge, inputCls } from "../components/ui";

const SAMPLE = JSON.stringify(
  { recipes: [{ name: "Torrada de Abacate com Ovo", category: "Café da manhã", prep_time: 5, cook_time: 5, servings: 1, description: "Cremosa, crocante e com ovo mole por cima.",
    instructions: ["Toste o pão.", "Amasse o abacate com limão.", "Monte com o ovo."],
    ingredients: [{ name: "Abacate", quantity: 1, unit: "un" }, { name: "Pão", quantity: 2, unit: "fatias" }, { name: "Ovos", quantity: 1, unit: "un" }, { name: "Pimenta", quantity: null, unit: "a gosto" }] }] },
  null, 2,
);

type ImportResult = { name: string; result: "created" | "duplicate" | "needs_decision" | "error"; id?: string; created_ingredients?: string[]; reused_ingredients?: number; duplicates?: { name: string; level: string }[]; undecided?: { name: string; candidates: { name: string }[] }[]; message?: string };

export function BatchPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Batch>(`/batches/${id}`);
  const toast = useToast();
  const [json, setJson] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const b = data;
  const p = b.progress;

  async function doImport(forceDup = false) {
    let parsed: { recipes: Record<string, unknown>[] };
    try { parsed = JSON.parse(json); } catch { return toast.error("O JSON é inválido.", "Verifique vírgulas e aspas. Nada foi importado."); }
    if (!Array.isArray(parsed.recipes)) return toast.error("Formato inesperado.", "O JSON deve ter a forma { \"recipes\": [ … ] }.");
    setImporting(true);
    try {
      const res = await api<{ results: ImportResult[]; created: number }>(`/batches/${id}/import`, { method: "POST", body: { recipes: parsed.recipes.map((r) => ({ ...r, force_duplicate: forceDup })) } });
      setResults(res.results);
      toast.ok(`${res.created} ${res.created === 1 ? "receita importada" : "receitas importadas"}`);
      reload();
    } catch (e) {
      const err = e as ApiError;
      toast.error("A importação falhou.", `${err.message}${err.body.issues ? ` (${err.body.issues[0].path}: ${err.body.issues[0].message})` : ""} Nada foi importado.`);
    } finally { setImporting(false); }
  }

  const heroState = (h: AssetState) => <AssetStatus state={h} />;
  const open = b.status === "open";

  return (
    <>
      <PageHeader
        title={`Lote #${String(b.number).padStart(3, "0")}`}
        subtitle={<><Link to="/lotes" className="underline underline-offset-4">Lotes</Link> · criado em {fmtDay(b.created_at)} · {open ? <Badge tone="blue" icon="◐">Aberto</Badge> : <Badge tone="green" icon="✓">Concluído</Badge>}</>}
        actions={open && <Button onClick={async () => { try { await api(`/batches/${id}/complete`, { method: "POST", body: {} }); toast.ok("Lote concluído"); reload(); } catch (e) { toast.error("Não foi possível concluir.", (e as Error).message); } }}>Concluir lote</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card title="Progresso"><BatchProgress progress={p} /></Card>
        <Card title="Importar receitas (JSON)">
          {open ? (
            <>
              <textarea aria-label="JSON das receitas" className={`${inputCls} h-40 py-2 font-mono text-xs`} value={json} onChange={(e) => setJson(e.target.value)} placeholder={SAMPLE} spellCheck={false} />
              <p className="mt-1 text-xs text-zinc-500">Ingredientes existentes são reutilizados; parecidos e duplicidades voltam para você decidir.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="primary" disabled={!json.trim() || importing} onClick={() => doImport()}>{importing ? "Importando…" : "Importar"}</Button>
                <Button variant="ghost" onClick={() => setJson(SAMPLE)}>Usar exemplo</Button>
              </div>
            </>
          ) : <p className="text-zinc-500">Lote concluído: não aceita novas receitas.</p>}
          {results && (
            <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-3 text-sm">
              {results.map((r, i) => (
                <li key={i}>
                  <span className="font-medium">{r.name}</span>{" "}
                  {r.result === "created" && <span className="text-emerald-700">✓ criada — {r.reused_ingredients} reutilizados{r.created_ingredients?.length ? `, novos: ${r.created_ingredients.join(", ")}` : ""}</span>}
                  {r.result === "duplicate" && <span className="text-amber-800">! possível duplicidade com {r.duplicates?.map((d) => d.name).join(", ")} — revise ou <button className="underline" onClick={() => doImport(true)}>importar mesmo assim</button></span>}
                  {r.result === "needs_decision" && <span className="text-amber-800">? decidir ingredientes: {r.undecided?.map((u) => `${u.name} ≈ ${u.candidates[0]?.name}`).join("; ")} — crie a receita manualmente para escolher.</span>}
                  {r.result === "error" && <span className="text-red-700">✕ {r.message}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Receitas do lote</h2>
      {p.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500">Nenhuma receita neste lote ainda. Importe um JSON acima ou associe receitas existentes.</div>
      ) : (
        <ol className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {p.items.map((r) => (
            <li key={r.id}>
              <Link to={`/receitas/${r.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 hover:bg-zinc-50">
                <span className="tabular w-6 text-zinc-400">{String(r.position).padStart(2, "0")}</span>
                <span className="min-w-48 flex-1 font-medium">{r.name}</span>
                <span className={r.recipe_ok ? "text-emerald-700" : "text-amber-700"}>{r.recipe_ok ? "✓" : "!"} receita</span>
                <span className="flex items-center gap-1">{r.hero === "approved" ? <span className="text-emerald-700">✓ imagem</span> : <>{heroState(r.hero)}</>}</span>
                <span className={r.ingredients_missing ? "text-amber-700" : "text-emerald-700"}>{r.ingredients_missing ? `! ${r.ingredients_missing} ingredientes sem asset` : "✓ ingredientes"}</span>
                <span className={r.approved ? "text-emerald-700" : "text-zinc-500"}>{r.approved ? "✓ aprovada" : "○ revisão"}</span>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
