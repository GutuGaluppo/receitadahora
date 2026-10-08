import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, fmtDate, useApi, type RecipeStatus } from "../../api";
import { useToast } from "../../components/toast";
import { AssetStatus, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from "../../components/ui";
import { fmtDuration, JobStatusBadge, money, Pipeline, TYPE_LABEL, FactoryTabs, type Job, type Summary } from "./shared";

type Ing = { id: string; name: string; quantity: number | null; unit: string; asset: "missing" | "review" | "approved" | "rejected" };
type RecipeCard = {
  id: string; name: string; description: string; category: string; prep_time: number; cook_time: number; servings: number; difficulty: string; status: string;
  instructions: string[]; ingredients: Ing[]; hero: string; asset_coverage: { approved: number; total: number }; nearest: { name: string; score: number } | null; warnings: string[]; new_ingredients: string[];
};
type Dup = { id: string; name: string; score: number; level: string; reasons: string[] };
type Item = {
  id: string; name: string; outcome: "created" | "duplicate" | "needs_decision" | "invalid" | "discarded" | "error"; recipe_id: string | null;
  details: { duplicates?: Dup[]; undecided?: { name: string; candidates: { id: string; name: string; score: number }[] }[]; issues?: string[]; error?: string; warnings?: string[] };
  payload: Record<string, any>; recipe: RecipeCard | null;
};
type Detail = { job: Job; batch: { id: string; number: number } | null; target: { id: string; name: string; kind: string } | null; events: { id: string; event_type: string; message: string; created_at: string }[]; summary: Summary | null; items: Item[] };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const REGEN: [string, string][] = [["recipe", "Entire recipe"], ["description", "Description"], ["instructions", "Instructions"], ["image", "Image"]];

export function JobPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Detail>(`/factory/jobs/${id}`);
  const toast = useToast();
  const [raw, setRaw] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ item: Item; dup: Dup } | null>(null);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;
  const { job, summary, items } = data;
  const isBatch = job.type === "recipe" && !job.target_id;

  async function call(path: string, ok: string, body?: unknown) {
    try {
      const r = await api<any>(path, { method: "POST", body });
      toast.ok(ok, r?.message ?? undefined);
      reload();
      return r;
    } catch (e) {
      toast.error("Não foi possível concluir.", e instanceof ApiError ? e.message : "Tente novamente.");
      reload();
    }
  }

  const pending = items.filter((i) => ["duplicate", "needs_decision", "invalid", "error"].includes(i.outcome));
  const created = items.filter((i) => i.outcome === "created" && i.recipe);

  async function showRaw() {
    const r = await api<{ raw: string | null }>(`/factory/jobs/${job.id}/raw`);
    setRaw(r.raw ?? "(sem resultado bruto)");
  }

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">#{job.code} <span className="text-base font-normal text-zinc-500">{TYPE_LABEL[job.type]}</span> <JobStatusBadge status={job.status} /></span>}
        subtitle={<>{data.batch && <>Lote <Link className="underline underline-offset-4" to={`/lotes/${data.batch.id}`}>#{String(data.batch.number).padStart(3, "0")}</Link> · </>}{data.target && <>{data.target.name} · </>}criado {fmtDate(job.created_at)} por {job.created_by} · {fmtDuration(job.duration_ms)}</>}
        actions={<>
          {["failed", "queued", "disabled"].includes(job.status) && job.attempts < job.max_attempts && <Button onClick={() => call(`/factory/jobs/${job.id}/retry`, "Executado de novo")}>{job.status === "failed" ? "Retry" : "Run"}</Button>}
          {["queued", "disabled", "failed"].includes(job.status) && <Button variant="ghost" onClick={() => call(`/factory/jobs/${job.id}/cancel`, "Job cancelado")}>Cancel</Button>}
          <Link to="/factory/queue"><Button variant="ghost">Queue</Button></Link>
        </>}
      />
      <FactoryTabs />
      {isBatch && <Pipeline active={job.status === "completed" ? (pending.length ? 3 : 2) : 1} />}

      {job.status === "failed" && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="font-medium">{job.type === "recipe" ? "Recipe generation failed" : "Image generation failed"}</p>
          <p className="mt-1">{job.error_message}</p>
          <p className="mt-1 text-xs">{job.error_kind === "external" ? "Falha externa: vale tentar de novo." : job.error_kind === "blocked" ? "Bloqueado por configuração ou orçamento. Nenhuma chamada paga foi feita." : "Falha estrutural: a resposta não pôde ser validada. Tente de novo ou ajuste o brief."} Tentativa {job.attempts}/{job.max_attempts}.</p>
          <div className="mt-3 flex gap-2">
            {job.has_raw_output && <Button onClick={showRaw}>View details</Button>}
            {job.attempts < job.max_attempts && <Button variant="primary" onClick={() => call(`/factory/jobs/${job.id}/retry`, "Executado de novo")}>Retry</Button>}
          </div>
        </div>
      )}
      {job.status === "disabled" && (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-medium">Image generation unavailable</p>
          <p className="mt-1">The image provider is currently disabled. No API request was made.</p>
          <p className="mt-1 text-xs">Enable IMAGE_GENERATION_ENABLED to use this feature. Até lá, envie as imagens manualmente em Receitas / Ingredientes.</p>
        </div>
      )}

      {summary && (
        <Card title="Resumo da geração" className="mb-4">
          <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {([
              [summary.generated, "receitas geradas"], [summary.created, "salvas como rascunho"], [summary.ready_for_review, "prontas para revisão"],
              [summary.awaiting_assets, "aguardando imagens"], [summary.approved, "aprovadas / publicadas"], [summary.duplicates, "possíveis duplicidades"],
              [summary.needs_decision, "com ingredientes a decidir"], [summary.invalid, "inválidas"], [summary.ingredient_assets_reused, "assets de ingredientes reutilizados"],
              [summary.ingredient_assets_missing, "assets de ingredientes ausentes"], [summary.recipe_images_pending, "imagens de receita pendentes"], [summary.discarded, "descartadas"],
            ] as [number, string][]).map(([n, l]) => (
              <p key={l} className={n ? "" : "text-zinc-400"}><span className="tabular font-semibold">{n}</span> {l}</p>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#review"><Button>Review Recipes</Button></a>
            <a href="#decisions"><Button disabled={!pending.length}>Resolve {summary.duplicates ? "Duplicates" : "Ingredients"}</Button></a>
            <Button disabled={!summary.ingredient_assets_missing && !summary.recipe_images_pending} onClick={() => call(`/factory/jobs/${job.id}/prepare-assets`, "Jobs de imagem preparados")}>Prepare Assets</Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Prepare Assets cria os jobs de imagem que faltam. Com IMAGE_GENERATION_ENABLED=false eles ficam em “Disabled”; envie as imagens manualmente em Ingredientes.</p>
        </Card>
      )}

      {isBatch && pending.length > 0 && (
        <section id="decisions" className="mb-6 scroll-mt-4">
          <h2 className="mb-2 text-sm font-semibold">Precisa da sua decisão ({pending.length})</h2>
          <div className="space-y-3">{pending.map((it) => <PendingCard key={it.id} item={it} onAct={call} onCompare={(dup) => setCompare({ item: it, dup })} />)}</div>
        </section>
      )}

      {isBatch && (
        <section id="review" className="mb-6 scroll-mt-4">
          <h2 className="mb-2 text-sm font-semibold">Revisão das receitas ({created.length})</h2>
          {created.length === 0 ? <div className="rounded-lg border border-zinc-200 bg-white"><EmptyState title="Nenhuma receita salva ainda." hint="Resolva as decisões acima ou gere outro lote." /></div> : (
            <div className="space-y-3">{created.map((it) => <ReviewCard key={it.id} item={it} onAct={call} />)}</div>
          )}
        </section>
      )}

      {!isBatch && job.input.prompt && (
        <Card title="Prompt composto" className="mb-4">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 font-mono text-xs">{job.input.prompt as string}</pre>
          <p className="mt-2 text-xs text-zinc-500">Montado pelo template {job.template_version} a partir dos dados do item — nunca digitado à mão. Provider: {job.provider ?? "—"} / {job.model ?? "—"}.</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Eventos">
          <ol className="space-y-2 text-sm">
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3"><span className="tabular w-16 shrink-0 text-xs text-zinc-400">{new Date(e.created_at).toLocaleTimeString("pt-BR")}</span><span><code className="text-xs text-zinc-500">{e.event_type}</code> {e.message}</span></li>
            ))}
          </ol>
        </Card>
        <Card title="Auditoria">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Template</dt><dd>{job.template_version ?? "—"}</dd>
            <dt className="text-zinc-500">Provider</dt><dd>{job.provider ?? "—"} / {job.model ?? "—"}</dd>
            <dt className="text-zinc-500">Tentativas</dt><dd>{job.attempts}/{job.max_attempts}</dd>
            <dt className="text-zinc-500">Custo estimado</dt><dd className="tabular">{money(job.estimated_cost, job.currency)}</dd>
            <dt className="text-zinc-500">Custo real</dt><dd className="tabular">{money(job.actual_cost, job.currency)}</dd>
            {isBatch && <><dt className="text-zinc-500">Brief</dt><dd className="text-xs break-words">{JSON.stringify((job.input as any).params ?? {})}</dd></>}
          </dl>
          {job.has_raw_output && <Button className="mt-3" variant="ghost" onClick={showRaw}>Ver resultado bruto</Button>}
        </Card>
      </div>

      <ConfirmDialog open={raw !== null} title="Resultado bruto do provider" confirmLabel="Fechar" cancelLabel="Copiar" onCancel={() => { navigator.clipboard?.writeText(raw ?? ""); toast.ok("Copiado"); }} onConfirm={() => setRaw(null)}>
        <textarea readOnly className="h-72 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2 font-mono text-xs" value={raw ?? ""} />
      </ConfirmDialog>
      <CompareDialog state={compare} onClose={() => setCompare(null)} />
    </>
  );
}

/* ───────── decisões ───────── */

function PendingCard({ item, onAct, onCompare }: { item: Item; onAct: (path: string, ok: string, body?: unknown) => Promise<any>; onCompare: (d: Dup) => void }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const d = item.details;
  return (
    <Card title={<span className="flex items-center gap-2">{item.name} {item.outcome === "duplicate" ? <Badge tone="yellow" icon="!">Possible duplicate</Badge> : item.outcome === "needs_decision" ? <Badge tone="yellow" icon="?">Ingredients to decide</Badge> : <Badge tone="red" icon="✕">{item.outcome === "invalid" ? "Invalid" : "Error"}</Badge>}</span>}>
      {item.outcome === "duplicate" && d.duplicates && (
        <>
          <p className="text-sm font-medium">High similarity detected</p>
          <ul className="mt-2 space-y-1 text-sm">
            {d.duplicates.map((x) => (
              <li key={x.id}>Existing: <strong>{x.name}</strong> — <span className="tabular">{pct(x.score)}</span> <span className="text-zinc-500">({x.reasons.join(", ") || "semelhança geral"})</span> <button className="text-xs underline underline-offset-4" onClick={() => onCompare(x)}>Compare</button></li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={() => onAct(`/factory/items/${item.id}/discard`, "Descartada (registrado no histórico)")}>Discard</Button>
            <Button variant="primary" onClick={() => onAct(`/factory/items/${item.id}/keep`, "Mantida como rascunho")}>Keep as draft</Button>
          </div>
        </>
      )}
      {item.outcome === "needs_decision" && d.undecided && (
        <>
          <p className="text-sm text-zinc-600">Correspondência ambígua com a biblioteca. Nada foi criado até você decidir.</p>
          <div className="mt-2 space-y-3">
            {d.undecided.map((u) => (
              <fieldset key={u.name} className="text-sm">
                <legend className="font-medium">{u.name}</legend>
                {u.candidates.map((c) => (
                  <label key={c.id} className="mr-4 inline-flex items-center gap-1.5"><input type="radio" name={`${item.id}-${u.name}`} checked={choice[u.name] === c.id} onChange={() => setChoice((x) => ({ ...x, [u.name]: c.id }))} /> Usar “{c.name}” <span className="tabular text-zinc-400">{pct(c.score)}</span></label>
                ))}
                <label className="inline-flex items-center gap-1.5"><input type="radio" name={`${item.id}-${u.name}`} checked={choice[u.name] === "new"} onChange={() => setChoice((x) => ({ ...x, [u.name]: "new" }))} /> Criar novo ingrediente</label>
              </fieldset>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={() => onAct(`/factory/items/${item.id}/discard`, "Descartada (registrado no histórico)")}>Discard</Button>
            <Button variant="primary" disabled={d.undecided.some((u) => !choice[u.name])}
              onClick={() => onAct(`/factory/items/${item.id}/resolve`, "Ingredientes resolvidos", { decisions: d.undecided!.map((u) => (choice[u.name] === "new" ? { name: u.name, create: true } : { name: u.name, ingredient_id: choice[u.name] })) })}>
              Apply decisions
            </Button>
          </div>
        </>
      )}
      {(item.outcome === "invalid" || item.outcome === "error") && (
        <>
          <ul className="list-disc pl-5 text-sm text-red-800">{(d.issues ?? [d.error ?? "Erro"]).map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-xs text-zinc-500">O conteúdo bruto foi preservado no job. Receitas inválidas só podem ser descartadas; gere outro lote para substituí-las.</p>
          <div className="mt-3"><Button variant="danger" onClick={() => onAct(`/factory/items/${item.id}/discard`, "Descartada (registrado no histórico)")}>Discard</Button></div>
        </>
      )}
    </Card>
  );
}

function CompareDialog({ state, onClose }: { state: { item: Item; dup: Dup } | null; onClose: () => void }) {
  const existing = useApi<{ name: string; description: string; category: string; prep_time: number; cook_time: number; ingredients: { name: string }[]; instructions: string[] }>(state ? `/recipes/${state.dup.id}` : null);
  const gen = state?.item.payload as { description?: string; category?: string; prep_time?: number; cook_time?: number; ingredients?: { name: string }[]; instructions?: string[] } | undefined;
  const Col = ({ title, name, r }: { title: string; name: string; r?: { description?: string; category?: string; prep_time?: number; cook_time?: number; ingredients?: { name: string }[]; instructions?: string[] } | null }) => (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="font-medium">{name}</p>
      {r && <>
        <p className="text-xs text-zinc-500">{r.category} · {(r.prep_time ?? 0) + (r.cook_time ?? 0)} min</p>
        <p className="mt-1 text-sm">{r.description}</p>
        <p className="mt-2 text-xs font-medium">Ingredientes</p>
        <p className="text-sm">{r.ingredients?.map((i) => i.name).join(", ")}</p>
        <p className="mt-2 text-xs font-medium">Preparo</p>
        <ol className="list-decimal pl-4 text-sm">{r.instructions?.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </>}
    </div>
  );
  return (
    <ConfirmDialog open={!!state} title="Comparar receitas" confirmLabel="Fechar" cancelLabel="Voltar" onCancel={onClose} onConfirm={onClose}>
      {state && <div className="grid max-h-[60vh] gap-4 overflow-auto sm:grid-cols-2"><Col title="Generated" name={state.item.name} r={gen} /><Col title="Existing" name={state.dup.name} r={existing.data} /></div>}
    </ConfirmDialog>
  );
}

/* ───────── revisão rápida (§24) ───────── */

function ReviewCard({ item, onAct }: { item: Item; onAct: (path: string, ok: string, body?: unknown) => Promise<any> }) {
  const r = item.recipe!;
  const [open, setOpen] = useState(false);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [regen, setRegen] = useState("description");
  const decided = ["approved", "published", "rejected"].includes(r.status);
  const key = () => crypto.randomUUID();
  return (
    <Card
      title={<span className="flex items-center gap-2"><Link className="underline-offset-4 hover:underline" to={`/receitas/${r.id}`}>{r.name}</Link> <StatusPill status={r.status} /></span>}
      actions={<span className="text-xs text-zinc-500">{r.category} · {r.prep_time + r.cook_time} min · {r.servings} {r.servings === 1 ? "porção" : "porções"} · {r.difficulty}</span>}
    >
      <p className="text-sm">{r.description}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-600">
        <span>Assets: <strong className="tabular">{r.asset_coverage.approved}/{r.asset_coverage.total}</strong> aprovados</span>
        <span>Imagem principal: <strong>{r.hero === "missing" ? "ausente" : r.hero}</strong></span>
        <span>Duplicate score: <strong className="tabular">{r.nearest ? `${pct(r.nearest.score)} (${r.nearest.name})` : "—"}</strong></span>
        {r.new_ingredients.length > 0 && <span>Novos: {r.new_ingredients.join(", ")}</span>}
      </div>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {r.ingredients.map((i) => <li key={i.id} className="flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-1 text-xs ring-1 ring-inset ring-zinc-200">{i.quantity ?? ""} {i.unit} {i.name} <AssetStatus state={i.asset} /></li>)}
      </ul>
      <button className="mt-3 text-xs text-zinc-500 underline underline-offset-4" onClick={() => setOpen(!open)}>{open ? "Ocultar preparo" : "Ver preparo"}</button>
      {open && <ol className="mt-2 list-decimal pl-5 text-sm">{r.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>}
      {r.warnings.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-amber-800">{r.warnings.map((w) => <li key={w}><span aria-hidden>! </span>{w}</li>)}</ul>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={r.status !== "review"} title={r.status === "review" ? "" : "Disponível quando a receita estiver em revisão (imagens aprovadas)"} onClick={() => onAct(`/recipes/${r.id}/approve`, "Receita aprovada")}>Approve</Button>
        <Link to={`/receitas/${r.id}`}><Button>Edit</Button></Link>
        <Button variant="danger" disabled={!["draft", "image_pending", "review", "approved"].includes(r.status)} onClick={() => setReject(true)}>Reject</Button>
        <span className="ml-auto flex items-center gap-1">
          <select aria-label="Parte a regenerar" className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm" value={regen} onChange={(e) => setRegen(e.target.value)}>
            {REGEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Button onClick={() => onAct(`/factory/recipes/${r.id}/regenerate`, regen === "image" ? "Job de imagem criado" : "Regenerado", { part: regen, idempotency_key: key() })}>Regenerate</Button>
        </span>
      </div>
      {r.status === "image_pending" && !decided && <p className="mt-2 text-xs text-zinc-500">Aguardando imagens: envie a imagem principal e os assets dos ingredientes (ou habilite a geração de imagens). Depois a receita entra em revisão e pode ser aprovada.</p>}

      <ConfirmDialog open={reject} title="Rejeitar receita" confirmLabel="Reject" tone="danger" onCancel={() => setReject(false)} onConfirm={() => { setReject(false); onAct(`/recipes/${r.id}/reject`, "Receita rejeitada", { reason }); setReason(""); }}>
        <label className="block text-xs font-medium text-zinc-600">Motivo (opcional)<input className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      </ConfirmDialog>
    </Card>
  );
}

const StatusPill = ({ status }: { status: string }) => <StatusBadge status={status as RecipeStatus} />;
