import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, fmtDate, fmtKb, useApi, type AssetDetail, type AssetState, type Batch, type RecipeStatus } from "../api";
import { AssetPreview, UploadButton } from "../components/assets";
import { useToast } from "../components/toast";
import { AssetStatus, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader, StatusBadge, inputCls } from "../components/ui";

type Match =
  | { kind: "exact"; via: string; ingredient: { id: string; name: string } }
  | { kind: "possible"; candidates: { id: string; name: string; score: number }[] }
  | { kind: "none" };

type Row = {
  key: string; name: string; quantity: string; unit: string; note: string;
  ingredient_id?: string; create?: boolean;
  slug?: string; asset?: { status: Exclude<AssetState, "missing">; url: string } | null;
  match?: Match;
};

type Blocker = { code: string; message: string; items?: string[] };
type Detail = {
  id: string; name: string; slug: string; description: string; category: string; prep_time: number; cook_time: number; servings: number;
  difficulty: "easy" | "medium" | "hard"; instructions: string[]; tags: string[]; visual_ingredients: string[];
  status: RecipeStatus; reject_reason: string | null; batch: { id: string; number: number } | null; updated_at: string; published_at: string | null;
  provenance?: { source_type: "manual" | "generated" | "imported"; source_job_id: string | null; template_version: string | null; provider: string | null; model: string | null; generated_at: string | null; approved_by: string | null; approved_at: string | null };
  hero: AssetDetail | null; hero_versions: AssetDetail[];
  ingredients: { id: string; ingredient_id: string; name: string; slug: string; quantity: number | null; unit: string; note: string; asset: { status: Exclude<AssetState, "missing">; url: string } | null }[];
  publish_blockers: Blocker[]; image_prompt: { prompt: string; negative: string };
};
type Dup = { id: string; name: string; slug: string; score: number; level: "high" | "medium"; reasons: string[] };

let rowSeq = 0;
const newRow = (p: Partial<Row> = {}): Row => ({ key: `r${++rowSeq}`, name: "", quantity: "", unit: "", note: "", ...p });

function parseQty(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
const fmtQty = (q: number | null) => (q == null ? "" : q === 0.5 ? "1/2" : String(q));

export function RecipePage() {
  const { id } = useParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<Detail>(id ? `/recipes/${id}` : null);
  const batches = useApi<{ items: Batch[] }>("/batches");

  const [f, setF] = useState({ name: "", slug: "", description: "", category: "", prep_time: "0", cook_time: "0", servings: "1", difficulty: "easy", batch_id: "" });
  const [instructions, setInstructions] = useState("");
  const [tags, setTags] = useState("");
  const [visual, setVisual] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [dups, setDups] = useState<Dup[]>([]);
  const [dupDialog, setDupDialog] = useState<Dup[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState<null | "recipe" | "hero">(null);
  const [reason, setReason] = useState("");
  const [blockers, setBlockers] = useState<Blocker[] | null>(null);
  const [prompt, setPrompt] = useState<{ prompt: string; negative: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dirty, setDirty] = useState(false);

  // popula o formulário a partir da receita carregada
  useEffect(() => {
    if (!data) return;
    setF({ name: data.name, slug: data.slug, description: data.description, category: data.category, prep_time: String(data.prep_time), cook_time: String(data.cook_time), servings: String(data.servings), difficulty: data.difficulty, batch_id: data.batch?.id ?? "" });
    setInstructions(data.instructions.join("\n"));
    setTags(data.tags.join(", "));
    setVisual(data.visual_ingredients.join(", "));
    setRows(data.ingredients.map((i) => newRow({ name: i.name, quantity: fmtQty(i.quantity), unit: i.unit, note: i.note, ingredient_id: i.ingredient_id, slug: i.slug, asset: i.asset })));
    setDirty(false);
  }, [data]);

  const touch = () => setDirty(true);
  const setField = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); touch(); };
  const patchRow = (key: string, p: Partial<Row>) => { setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r))); touch(); };

  const lines = (s: string, sep: RegExp) => s.split(sep).map((x) => x.trim()).filter(Boolean);
  const body = useMemo(() => ({
    name: f.name.trim(), slug: f.slug.trim() || undefined, description: f.description.trim(), category: f.category.trim(),
    prep_time: Number(f.prep_time) || 0, cook_time: Number(f.cook_time) || 0, servings: Math.max(1, Number(f.servings) || 1),
    difficulty: f.difficulty, instructions: lines(instructions, /\n+/), tags: lines(tags, /,/), visual_ingredients: visual.trim() ? lines(visual, /,/) : undefined,
    batch_id: f.batch_id || undefined,
    ingredients: rows.filter((r) => r.name.trim()).map((r) => ({
      name: r.name.trim(), quantity: parseQty(r.quantity), unit: r.unit.trim(), note: r.note.trim(), ingredient_id: r.ingredient_id, create: r.create,
    })),
  }), [f, instructions, tags, visual, rows]);

  // detecção de ingredientes existentes e duplicidade (debounce) — nada é gravado
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkKey = JSON.stringify([body.name, body.category, body.instructions, rows.map((r) => [r.name, r.ingredient_id, r.quantity, r.unit])]);
  useEffect(() => {
    if (!dirty || !body.name || !body.ingredients.length) return;
    if (checkTimer.current) clearTimeout(checkTimer.current);
    checkTimer.current = setTimeout(async () => {
      try {
        const sent = rows.filter((r) => r.name.trim());
        const res = await api<{ ingredients: ({ name: string } & Match)[]; duplicates: Dup[] }>("/recipes/check", { method: "POST", body: { ...body, ingredients: sent.map((r) => ({ name: r.name.trim(), quantity: parseQty(r.quantity), unit: r.unit.trim(), note: r.note.trim() })) } });
        setRows((rs) => rs.map((r) => {
          const idx = sent.findIndex((s) => s.key === r.key);
          if (idx < 0 || r.ingredient_id || r.create) return { ...r, match: undefined };
          const m = res.ingredients[idx];
          return { ...r, match: m as Match };
        }));
        setDups(isNew ? res.duplicates : []);
      } catch { /* a verificação é um auxílio; salvar valida de novo no servidor */ }
    }, 450);
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkKey, dirty]);

  const undecided = rows.filter((r) => r.name.trim() && !r.ingredient_id && !r.create && r.match?.kind === "possible");

  async function save(force = false) {
    if (!body.name) return toast.error("Falta o nome da receita.", "Nada foi salvo.");
    if (undecided.length) return toast.error("Há ingredientes com possível correspondência.", `Decida: ${undecided.map((r) => r.name).join(", ")}.`);
    setSaving(true);
    try {
      if (isNew) {
        const r = await api<{ id: string; created_ingredients: string[]; reused_ingredients: number }>("/recipes", { method: "POST", body: { ...body, force_duplicate: force } });
        toast.ok("Receita criada", `${r.reused_ingredients} ingredientes reutilizados${r.created_ingredients.length ? ` · novos sem imagem: ${r.created_ingredients.join(", ")}` : ""}.`);
        nav(`/receitas/${r.id}`);
      } else {
        await api(`/recipes/${id}`, { method: "PUT", body });
        toast.ok("Receita salva");
        setDirty(false);
        reload();
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.body.error === "duplicate") setDupDialog(err.body.duplicates);
      else if (err.body.error === "needs_decision") toast.error(err.message, "Escolha “usar existente” ou “criar novo” em cada ingrediente marcado.");
      else toast.error("Não foi possível salvar a receita.", `${err.message} As alterações continuam no formulário.`);
    } finally {
      setSaving(false);
    }
  }

  async function act(path: string, ok: string, payload: unknown = {}) {
    try { await api(path, { method: "POST", body: payload }); toast.ok(ok); reload(); }
    catch (e) {
      const err = e as ApiError;
      if (err.body.error === "cannot_publish") setBlockers(err.body.blockers);
      else toast.error("A ação não foi concluída.", err.message);
    }
  }

  async function regenerate() {
    try { const p = await api<{ prompt: string; negative: string }>(`/recipes/${id}/hero/regenerate`, { method: "POST", body: {} }); setPrompt(p); reload(); }
    catch (e) { toast.error("Não foi possível regenerar.", (e as Error).message); }
  }

  if (!isNew && loading && !data) return <Loading />;
  if (!isNew && error) return <ErrorState message={error.message} onRetry={reload} />;
  const d = data;
  const hero = d?.hero ?? null;
  const missingRows = rows.filter((r) => r.asset !== undefined && r.asset?.status !== "approved").length;

  return (
    <>
      <PageHeader
        title={isNew ? "Nova receita" : f.name || "Receita"}
        subtitle={<><Link to="/receitas" className="underline underline-offset-4">Receitas</Link>{d?.batch && <> · Lote #{String(d.batch.number).padStart(3, "0")}</>}{d && <> · atualizada {fmtDate(d.updated_at)}</>}</>}
        actions={<>{d && <StatusBadge status={d.status} />}<Button variant="primary" disabled={saving || (!isNew && !dirty)} onClick={() => save()}>{saving ? "Salvando…" : isNew ? "Criar receita" : "Salvar"}</Button></>}
      />

      {dups.length > 0 && isNew && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <p className="font-medium">Possível duplicidade</p>
          <ul className="mt-1 list-inside list-disc">
            {dups.map((x) => <li key={x.id}><Link className="underline" to={`/receitas/${x.id}`} target="_blank">{x.name}</Link> — similaridade {x.level === "high" ? "alta" : "média"} ({x.reasons.join(", ") || "parecida"})</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title="Informações">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><input className={inputCls} value={f.name} onChange={(e) => setField("name", e.target.value)} /></Field>
              <Field label="Slug" hint={isNew ? "Gerado do nome se vazio." : "Editável: relacionamentos usam o ID."}><input className={inputCls} value={f.slug} onChange={(e) => setField("slug", e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Descrição"><input className={inputCls} value={f.description} onChange={(e) => setField("description", e.target.value)} /></Field></div>
              <Field label="Categoria"><input className={inputCls} value={f.category} onChange={(e) => setField("category", e.target.value)} placeholder="Massas, Saladas, Café da manhã…" /></Field>
              <Field label="Dificuldade">
                <select className={inputCls} value={f.difficulty} onChange={(e) => setField("difficulty", e.target.value)}>
                  <option value="easy">Fácil</option><option value="medium">Média</option><option value="hard">Difícil</option>
                </select>
              </Field>
              <Field label="Preparo (min)"><input className={inputCls} type="number" min={0} value={f.prep_time} onChange={(e) => setField("prep_time", e.target.value)} /></Field>
              <Field label="Cozimento (min)"><input className={inputCls} type="number" min={0} value={f.cook_time} onChange={(e) => setField("cook_time", e.target.value)} /></Field>
              <Field label="Porções"><input className={inputCls} type="number" min={1} value={f.servings} onChange={(e) => setField("servings", e.target.value)} /></Field>
              <Field label="Lote">
                <select className={inputCls} value={f.batch_id} onChange={(e) => setField("batch_id", e.target.value)}>
                  <option value="">Sem lote</option>
                  {batches.data?.items.filter((b) => b.status === "open" || b.id === f.batch_id).map((b) => <option key={b.id} value={b.id}>Lote #{String(b.number).padStart(3, "0")}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Modo de preparo" hint="Um passo por linha."><textarea className={`${inputCls} h-32 py-2`} value={instructions} onChange={(e) => { setInstructions(e.target.value); touch(); }} /></Field></div>
              <Field label="Tags" hint="Separe por vírgula."><input className={inputCls} value={tags} onChange={(e) => { setTags(e.target.value); touch(); }} /></Field>
              <Field label="Ingredientes visuais" hint="Só o que aparece na foto (em inglês, para o prompt)."><input className={inputCls} value={visual} onChange={(e) => { setVisual(e.target.value); touch(); }} placeholder="roasted pumpkin, sage, parmesan" /></Field>
            </div>
          </Card>

          <Card title="Ingredientes" actions={<Button onClick={() => { setRows((r) => [...r, newRow()]); touch(); }}>Adicionar</Button>}>
            {missingRows > 0 && <p className="mb-3 rounded-md bg-amber-50 p-2 text-amber-900">! {missingRows} {missingRows === 1 ? "ingrediente sem imagem aprovada" : "ingredientes sem imagem aprovada"} — a receita não pode ser publicada.</p>}
            <div className="space-y-2">
              <div className="hidden grid-cols-[1.6fr_70px_110px_1fr_150px_32px] gap-2 px-1 text-xs text-zinc-500 md:grid">
                <span>Nome</span><span>Qtd.</span><span>Unidade</span><span>Nota</span><span>Asset</span><span />
              </div>
              {rows.map((r) => (
                <div key={r.key} className="rounded-md border border-zinc-100 p-2 md:border-0 md:p-0">
                  <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-[1.6fr_70px_110px_1fr_150px_32px]">
                    <input aria-label="Nome do ingrediente" className={`${inputCls} col-span-2 md:col-span-1`} value={r.name} placeholder="Ingrediente" readOnly={!!r.ingredient_id && !isNew && !!r.slug} onChange={(e) => patchRow(r.key, { name: e.target.value, ingredient_id: undefined, create: undefined, match: undefined, asset: undefined })} />
                    <input aria-label="Quantidade" className={inputCls} value={r.quantity} placeholder="1/2" onChange={(e) => patchRow(r.key, { quantity: e.target.value })} />
                    <input aria-label="Unidade" className={inputCls} value={r.unit} placeholder="un, g, a gosto" onChange={(e) => patchRow(r.key, { unit: e.target.value })} />
                    <input aria-label="Nota" className={inputCls} value={r.note} onChange={(e) => patchRow(r.key, { note: e.target.value })} />
                    <div className="text-xs">
                      {r.asset !== undefined && r.slug ? (
                        <span className="flex items-center gap-2">
                          <AssetPreview url={r.asset?.url} alt={r.name} size="sm" />
                          <AssetStatus state={r.asset ? r.asset.status : "missing"} />
                        </span>
                      ) : r.match?.kind === "exact" || r.ingredient_id ? <span className="text-emerald-700">✓ usa “{r.match?.kind === "exact" ? r.match.ingredient.name : r.name}”</span>
                        : r.match?.kind === "none" || r.create ? <span className="text-amber-700">+ novo · sem asset</span>
                        : r.match?.kind === "possible" ? <span className="font-medium text-amber-800">? decida abaixo</span> : null}
                    </div>
                    <button type="button" aria-label={`Remover ${r.name || "ingrediente"}`} className="h-8 w-8 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" onClick={() => { setRows((x) => x.filter((y) => y.key !== r.key)); touch(); }}>✕</button>
                  </div>
                  {r.match?.kind === "possible" && !r.ingredient_id && !r.create && (
                    <div role="group" aria-label={`Possível correspondência para ${r.name}`} className="mt-2 rounded-md bg-amber-50 p-2 text-amber-900">
                      <p className="text-sm">Possível correspondência encontrada: <strong>{r.name}</strong> → <strong>{r.match.candidates[0].name}</strong></p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {r.match.candidates.map((c) => <Button key={c.id} onClick={() => patchRow(r.key, { ingredient_id: c.id, name: r.name })}>Usar existente: {c.name}</Button>)}
                        <Button onClick={() => patchRow(r.key, { create: true })}>Criar ingrediente</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {rows.length === 0 && <EmptyState title="Nenhum ingrediente." hint="Adicione ao menos um para a receita ficar completa." />}
            </div>
          </Card>
        </div>

        {!isNew && d && (
          <div className="space-y-4">
            <Card title="Imagem principal">
              {hero ? (
                <>
                  <AssetPreview url={hero.url} alt={d.name} size="lg" />
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-zinc-500">Arquivo</dt><dd>{hero.filename} · {fmtKb(hero.size_bytes)}</dd>
                    <dt className="text-zinc-500">Object key</dt><dd className="break-all font-mono">{hero.key}</dd>
                    <dt className="text-zinc-500">Versão</dt><dd>v{hero.version}</dd>
                    <dt className="text-zinc-500">Status</dt><dd><AssetStatus state={hero.status} /></dd>
                    <dt className="text-zinc-500">Data</dt><dd>{fmtDate(hero.created_at)}</dd>
                    {hero.reject_reason && (<><dt className="text-zinc-500">Motivo</dt><dd className="text-red-700">{hero.reject_reason}</dd></>)}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {hero.status !== "approved" && <Button variant="primary" onClick={() => act(`/recipes/${id}/hero/approve`, "Imagem aprovada")}>Aprovar</Button>}
                    {hero.status !== "rejected" && <Button variant="danger" onClick={() => setRejecting("hero")}>Rejeitar</Button>}
                    <Button onClick={regenerate}>Regenerar</Button>
                    <UploadButton path={`/recipes/${id}/hero`} label="Substituir" onDone={reload} />
                  </div>
                  {d.hero_versions.length > 1 && (
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      <p className="mb-2 text-xs font-medium text-zinc-600">Versões</p>
                      <ul className="space-y-2">
                        {d.hero_versions.map((v) => (
                          <li key={v.id} className="flex items-center gap-3">
                            <AssetPreview url={v.url} alt={`v${v.version}`} size="sm" />
                            <span className="flex-1 text-xs">v{v.version} · <AssetStatus state={v.status} />{v.id === hero.id && <span className="ml-1 text-zinc-500">· ativa</span>}</span>
                            {v.id !== hero.id && <Button variant="ghost" onClick={() => act(`/recipes/${id}/hero/activate/${v.id}`, "Versão ativada")}>Usar esta</Button>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState title="Sem imagem principal." hint="Envie a imagem gerada seguindo o Recipe Photography System." action={<UploadButton path={`/recipes/${id}/hero`} label="Enviar imagem" variant="primary" onDone={reload} />} />
              )}
              <button className="mt-3 text-xs text-zinc-500 underline underline-offset-4" onClick={() => setPrompt(d.image_prompt)}>Ver prompt oficial de imagem</button>
            </Card>

            {d.provenance && d.provenance.source_type !== "manual" && (
              <Card title="Origem">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                  <dt className="text-zinc-500">Tipo</dt><dd>{d.provenance.source_type === "generated" ? "Gerada pela Factory" : "Importada"}</dd>
                  {d.provenance.source_job_id && <><dt className="text-zinc-500">Job</dt><dd><Link className="underline underline-offset-4" to={`/factory/jobs/${d.provenance.source_job_id}`}>ver geração</Link></dd></>}
                  {d.provenance.template_version && <><dt className="text-zinc-500">Template</dt><dd>{d.provenance.template_version}</dd></>}
                  {d.provenance.provider && <><dt className="text-zinc-500">Provider</dt><dd>{d.provenance.provider} / {d.provenance.model}</dd></>}
                  {d.provenance.generated_at && <><dt className="text-zinc-500">Gerada em</dt><dd>{fmtDate(d.provenance.generated_at)}</dd></>}
                  {d.provenance.approved_by && <><dt className="text-zinc-500">Aprovada por</dt><dd>{d.provenance.approved_by}{d.provenance.approved_at ? ` · ${fmtDate(d.provenance.approved_at)}` : ""}</dd></>}
                </dl>
              </Card>
            )}

            <Card title="Status">
              <div className="flex items-center gap-2"><StatusBadge status={d.status} />{d.published_at && <span className="text-xs text-zinc-500">desde {fmtDate(d.published_at)}</span>}</div>
              {d.reject_reason && <p className="mt-2 text-red-700">Motivo da rejeição: {d.reject_reason}</p>}
              {d.status !== "published" && d.publish_blockers.filter((b) => !(b.code === "not_approved" && d.status === "review")).length > 0 && (
                <div className="mt-3 rounded-md bg-zinc-50 p-3">
                  <p className="mb-1 text-xs font-medium text-zinc-600">Antes de publicar</p>
                  <ul className="space-y-1 text-sm">
                    {d.publish_blockers.map((b) => (
                      <li key={b.code}><span className="text-amber-700">!</span> {b.message}{b.items && <span className="text-zinc-500"> {b.items.join(", ")}</span>}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {d.status === "review" && <Button variant="primary" onClick={() => act(`/recipes/${id}/approve`, "Receita aprovada")}>Aprovar</Button>}
                {(d.status === "review" || d.status === "approved") && <Button variant="danger" onClick={() => setRejecting("recipe")}>Rejeitar</Button>}
                {d.status === "approved" && <Button variant="primary" onClick={() => act(`/recipes/${id}/publish`, "Receita publicada")}>Publicar</Button>}
                {d.status === "published" && <Button onClick={() => act(`/recipes/${id}/unpublish`, "Receita despublicada")}>Despublicar</Button>}
                {d.status === "rejected" && <Button onClick={() => act(`/recipes/${id}/reopen`, "Receita voltou para rascunho")}>Voltar para rascunho</Button>}
                <Button variant="ghost" onClick={() => setConfirmDelete(true)}>Excluir</Button>
              </div>
              {d.status === "published" && <p className="mt-3 text-xs text-zinc-500">Editar dados ou trocar a imagem tira a receita da publicação até nova aprovação.</p>}
            </Card>
          </div>
        )}
      </div>

      {/* duplicidade */}
      <ConfirmDialog
        open={!!dupDialog} title="Possível duplicidade" confirmLabel="Continuar mesmo assim" onCancel={() => setDupDialog(null)}
        onConfirm={() => { setDupDialog(null); save(true); }}
        extra={dupDialog?.[0] && <Link to={`/receitas/${dupDialog[0].id}`} target="_blank"><Button>Ver existente</Button></Link>}
      >
        <p>Nova: <strong>{body.name}</strong></p>
        <ul className="mt-2 space-y-1">{dupDialog?.map((x) => <li key={x.id}>Existente: <strong>{x.name}</strong> — similaridade {x.level === "high" ? "alta" : "média"}</li>)}</ul>
      </ConfirmDialog>

      {/* não pode publicar */}
      <ConfirmDialog open={!!blockers} title="Não pode publicar" confirmLabel="Entendi" cancelLabel="Fechar" onCancel={() => setBlockers(null)} onConfirm={() => setBlockers(null)}>
        <ul className="space-y-2">{blockers?.map((b) => <li key={b.code}><p>{b.message}</p>{b.items && <ul className="ml-4 list-disc">{b.items.map((i) => <li key={i}>{i}</li>)}</ul>}</li>)}</ul>
      </ConfirmDialog>

      {/* rejeitar */}
      <ConfirmDialog
        open={!!rejecting} title={rejecting === "hero" ? "Rejeitar imagem" : "Rejeitar receita"} confirmLabel="Rejeitar" tone="danger" onCancel={() => setRejecting(null)}
        onConfirm={() => { const w = rejecting; setRejecting(null); act(w === "hero" ? `/recipes/${id}/hero/reject` : `/recipes/${id}/reject`, w === "hero" ? "Imagem rejeitada" : "Receita rejeitada", { reason }); setReason(""); }}
      >
        <Field label="Motivo (opcional)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>

      {/* excluir */}
      <ConfirmDialog open={confirmDelete} title="Excluir receita" confirmLabel="Excluir" tone="danger" onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => { setConfirmDelete(false); try { await api(`/recipes/${id}`, { method: "DELETE" }); toast.ok("Receita excluída"); nav("/receitas"); } catch (e) { toast.error("Não foi possível excluir.", (e as Error).message); } }}>
        A receita sai das listas e do app público. A exclusão é reversível no banco.
      </ConfirmDialog>

      {/* prompt */}
      <ConfirmDialog open={!!prompt} title="Prompt oficial de imagem" confirmLabel="Copiar prompt" cancelLabel="Fechar" onCancel={() => setPrompt(null)}
        onConfirm={() => { navigator.clipboard?.writeText(`${prompt?.prompt}\n\nNegative prompt: ${prompt?.negative}`); toast.ok("Prompt copiado"); }}>
        <textarea readOnly className="h-64 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2 font-mono text-xs" value={`${prompt?.prompt ?? ""}\n\nNegative prompt:\n${prompt?.negative ?? ""}`} />
        <p className="mt-2 text-xs">Gere a imagem com este prompt e use “Substituir” para enviá-la. O Studio não publica nada automaticamente.</p>
      </ConfirmDialog>
    </>
  );
}
