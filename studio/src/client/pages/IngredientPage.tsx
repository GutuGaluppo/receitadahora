import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api, fmtDate, fmtKb, useApi, type AssetDetail, type AssetState, type IngredientItem } from "../api";
import { AssetPreview, UploadButton } from "../components/assets";
import { useToast } from "../components/toast";
import { AssetStatus, Button, Card, ConfirmDialog, ErrorState, Field, Loading, PageHeader, StatusBadge, inputCls } from "../components/ui";
import type { RecipeStatus } from "../api";

type Detail = IngredientItem & {
  aliases: { id: string; alias: string }[]; asset_detail: AssetDetail | null; versions: AssetDetail[];
  used_by: { id: string; name: string; slug: string; status: RecipeStatus }[];
};

export function IngredientPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<Detail>(`/ingredients/${id}`);
  const nav = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [aliases, setAliases] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ used_by?: { id: string; name: string }[] } | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (data) { setName(data.name); setSlug(data.slug); setAliases(data.aliases.map((a) => a.alias).join(", ")); }
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const d = data;

  async function save() {
    try {
      await api(`/ingredients/${id}`, { method: "PATCH", body: { name, slug, aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean) } });
      toast.ok("Ingrediente salvo");
      reload();
    } catch (e) { toast.error("Não foi possível salvar.", (e as Error).message); }
  }
  async function act(path: string, body?: unknown, ok?: string) {
    try { await api(path, { method: "POST", body: body ?? {} }); if (ok) toast.ok(ok); reload(); }
    catch (e) { toast.error("A ação não foi concluída.", (e as Error).message); }
  }
  async function remove() {
    try { await api(`/ingredients/${id}`, { method: "DELETE" }); toast.ok("Ingrediente excluído"); nav("/ingredientes"); }
    catch (e) { const err = e as ApiError; setConfirmDelete({ used_by: err.body.used_by }); toast.error(err.message, "Remova o ingrediente das receitas antes de excluir."); }
  }

  const cur = d.asset_detail;
  return (
    <>
      <PageHeader
        title={d.name}
        subtitle={<><Link to="/ingredientes" className="underline underline-offset-4">Ingredientes</Link> · usado em {d.recipe_count} {d.recipe_count === 1 ? "receita" : "receitas"}</>}
        actions={<><AssetStatus state={d.state as AssetState} /><Button variant="danger" onClick={() => (d.recipe_count ? setConfirmDelete({ used_by: d.used_by }) : setConfirmDelete({}))}>Excluir</Button></>}
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="Imagem">
          <AssetPreview url={cur?.url} alt={d.name} size="lg" />
          {cur ? (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-zinc-500">Object key</dt><dd className="break-all font-mono">{cur.key}</dd>
              <dt className="text-zinc-500">Arquivo</dt><dd>{cur.filename} · {fmtKb(cur.size_bytes)}</dd>
              <dt className="text-zinc-500">Versão</dt><dd>v{cur.version}</dd>
              <dt className="text-zinc-500">Enviado</dt><dd>{fmtDate(cur.created_at)}</dd>
              {cur.reject_reason && (<><dt className="text-zinc-500">Motivo</dt><dd className="text-red-700">{cur.reject_reason}</dd></>)}
            </dl>
          ) : (
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-amber-900">Este ingrediente ainda não tem imagem. Receitas que o usam não podem ser publicadas.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {cur && cur.status !== "approved" && <Button variant="primary" onClick={() => act(`/ingredients/${id}/asset/approve`, {}, "Imagem aprovada")}>Aprovar</Button>}
            {cur && cur.status !== "rejected" && <Button variant="danger" onClick={() => setRejecting(true)}>Rejeitar</Button>}
            <UploadButton path={`/ingredients/${id}/asset`} label={cur ? "Substituir" : "Enviar imagem"} variant={cur ? "secondary" : "primary"} onDone={reload} />
          </div>
          {d.versions.length > 1 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <p className="mb-2 text-xs font-medium text-zinc-600">Versões</p>
              <ul className="space-y-2">
                {d.versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-3">
                    <AssetPreview url={v.url} alt={`v${v.version}`} size="sm" />
                    <span className="flex-1 text-xs">v{v.version} · <AssetStatus state={v.status} />{v.id === cur?.id && <span className="ml-1 text-zinc-500">· ativa</span>}</span>
                    {v.id !== cur?.id && <Button variant="ghost" onClick={() => act(`/ingredients/${id}/asset/activate/${v.id}`, {}, "Versão ativada")}>Usar esta</Button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Informações" actions={<Button variant="primary" onClick={save}>Salvar</Button>}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Slug" hint="Editável: as receitas usam o ID, nada quebra."><input className={inputCls} value={slug} onChange={(e) => setSlug(e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Aliases" hint="Separe por vírgula. “Tomates” e “tomate fresco” já são reconhecidos sozinhos."><input className={inputCls} value={aliases} onChange={(e) => setAliases(e.target.value)} /></Field></div>
            </div>
          </Card>

          <Card title={`Usado em ${d.used_by.length} ${d.used_by.length === 1 ? "receita" : "receitas"}`}>
            {d.used_by.length === 0 ? <p className="text-zinc-500">Nenhuma receita usa este ingrediente ainda.</p> : (
              <ul className="divide-y divide-zinc-100">
                {d.used_by.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2">
                    <Link className="font-medium underline-offset-4 hover:underline" to={`/receitas/${r.id}`}>{r.name}</Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={rejecting} title="Rejeitar imagem" confirmLabel="Rejeitar" tone="danger" onCancel={() => setRejecting(false)}
        onConfirm={() => { setRejecting(false); act(`/ingredients/${id}/asset/reject`, { reason }, "Imagem rejeitada"); setReason(""); }}
      >
        <Field label="Motivo (opcional)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirmDelete} title="Excluir ingrediente" confirmLabel="Excluir" tone="danger" onCancel={() => setConfirmDelete(null)}
        onConfirm={() => { const used = confirmDelete?.used_by?.length; setConfirmDelete(null); if (!used) remove(); }}
      >
        {confirmDelete?.used_by?.length ? (
          <>
            <p className="font-medium text-red-700">Este ingrediente é usado por {confirmDelete.used_by.length} {confirmDelete.used_by.length === 1 ? "receita" : "receitas"}.</p>
            <ul className="mt-1 list-inside list-disc">{confirmDelete.used_by.map((r) => <li key={r.id}>{r.name}</li>)}</ul>
            <p className="mt-2">Remova-o dessas receitas antes de excluir.</p>
          </>
        ) : <p>O ingrediente sai da biblioteca (exclusão reversível no banco).</p>}
      </ConfirmDialog>
    </>
  );
}
