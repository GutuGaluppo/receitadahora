import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, useApi, type RecipeStatus } from "../api";
import { AssetPreview, UploadButton } from "../components/assets";
import { useToast } from "../components/toast";
import { Badge, Button, ConfirmDialog, EmptyState, ErrorState, Field, Loading, PageHeader, StatusBadge, inputCls } from "../components/ui";

type Item =
  | { kind: "recipe"; id: string; name: string; status: RecipeStatus; preview_url: string | null; issue: string }
  | { kind: "recipe_image" | "ingredient_image"; id: string; owner_id: string; name: string; version: number; preview_url: string; issue: string }
  | { kind: "ingredient"; id: string; name: string; recipe_count: number; issue: string };
type Review = { recipes: Item[]; images: Item[]; ingredients: Item[]; counts: { recipes: number; images: number; ingredients: number } };

const TABS = [["recipes", "Receitas"], ["images", "Imagens"], ["ingredients", "Ingredientes"]] as const;
const EMPTY: Record<string, [string, string]> = {
  recipes: ["Nenhuma receita aguardando revisão.", "Quando uma receita ficar completa, ela aparece aqui."],
  images: ["Nenhuma imagem aguardando aprovação.", "Imagens enviadas entram aqui para aprovação."],
  ingredients: ["Nenhum ingrediente sem imagem.", "A biblioteca está 100% coberta."],
};

export function ReviewPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as "recipes" | "images" | "ingredients") ?? "recipes";
  const { data, error, loading, reload } = useApi<Review>("/review");
  const toast = useToast();
  const [reject, setReject] = useState<Item | null>(null);
  const [reason, setReason] = useState("");

  async function post(path: string, ok: string, body: unknown = {}) {
    try { await api(path, { method: "POST", body }); toast.ok(ok); reload(); }
    catch (e) { toast.error("A ação não foi concluída.", (e as Error).message); }
  }

  const approve = (i: Item) =>
    i.kind === "recipe" ? post(`/recipes/${i.id}/approve`, "Receita aprovada")
    : i.kind === "recipe_image" ? post(`/recipes/${i.owner_id}/hero/approve`, "Imagem aprovada")
    : i.kind === "ingredient_image" ? post(`/ingredients/${i.owner_id}/asset/approve`, "Imagem aprovada") : undefined;

  const doReject = () => {
    const i = reject!; setReject(null);
    const body = { reason };
    setReason("");
    if (i.kind === "recipe") post(`/recipes/${i.id}/reject`, "Receita rejeitada", body);
    else if (i.kind === "recipe_image") post(`/recipes/${i.owner_id}/hero/reject`, "Imagem rejeitada", body);
    else if (i.kind === "ingredient_image") post(`/ingredients/${i.owner_id}/asset/reject`, "Imagem rejeitada", body);
  };

  const editLink = (i: Item) => (i.kind === "recipe" ? `/receitas/${i.id}` : i.kind === "recipe_image" ? `/receitas/${i.owner_id}` : i.kind === "ingredient_image" ? `/ingredientes/${i.owner_id}` : `/ingredientes/${i.id}`);

  return (
    <>
      <PageHeader title="Revisão" subtitle="Tudo o que está esperando uma decisão sua." />
      <div role="tablist" aria-label="Categorias" className="mb-4 flex gap-1 border-b border-zinc-200">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setSp({ tab: k })} className={`-mb-px h-10 border-b-2 px-4 text-sm ${tab === k ? "border-zinc-900 font-medium" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
            {label} <span className="tabular ml-1 text-zinc-400">{data?.counts[k] ?? ""}</span>
          </button>
        ))}
      </div>

      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        (data?.[tab] ?? []).length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white"><EmptyState title={EMPTY[tab][0]} hint={EMPTY[tab][1]} /></div>
        ) : (
          <ul className="space-y-2">
            {(data?.[tab] ?? []).map((i) => (
              <li key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white p-3">
                <AssetPreview url={"preview_url" in i ? i.preview_url : null} alt={i.name} size="md" />
                <div className="min-w-48 flex-1">
                  <p className="font-medium">{i.name}</p>
                  <p className="mt-0.5 text-zinc-500">{i.issue}</p>
                  <div className="mt-1">
                    {i.kind === "recipe" ? <StatusBadge status={i.status} /> : i.kind === "ingredient" ? <Badge tone="yellow" icon="!">Usado em {i.recipe_count} {i.recipe_count === 1 ? "receita" : "receitas"}</Badge> : <Badge tone="blue" icon="◐">Em revisão · v{i.version}</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {i.kind === "ingredient" ? (
                    <UploadButton path={`/ingredients/${i.id}/asset`} label="Enviar imagem" variant="primary" onDone={reload} />
                  ) : (
                    <>
                      <Button variant="primary" onClick={() => approve(i)}>Aprovar</Button>
                      <Button variant="danger" onClick={() => setReject(i)}>Rejeitar</Button>
                    </>
                  )}
                  <Link to={editLink(i)}><Button>Editar</Button></Link>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      <ConfirmDialog open={!!reject} title={`Rejeitar “${reject?.name ?? ""}”`} confirmLabel="Rejeitar" tone="danger" onCancel={() => setReject(null)} onConfirm={doReject}>
        <Field label="Motivo (opcional)"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
      </ConfirmDialog>
    </>
  );
}
