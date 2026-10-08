import { Link, useNavigate } from "react-router-dom";
import { api, useApi, type Batch, type Coverage } from "../api";
import { BatchProgress } from "../components/batch";
import { useToast } from "../components/toast";
import { FactoryStateBadge, type FactoryState, type Summary, type Job } from "./factory/shared";
import { Button, Card, EmptyState, ErrorState, Loading, PageHeader, ProgressBar } from "../components/ui";

type Dash = {
  batch: Batch | null;
  recipes: { total: number; published: number; in_production: number };
  ingredients: Coverage;
  review: { recipes: number; images: number; ingredients_without_asset: number };
};

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dash>("/dashboard");
  const nav = useNavigate();
  const toast = useToast();
  const fac = useApi<{ state: FactoryState; current: { job: Job; batch: { id: string; number: number } | null; summary: Summary } | null }>("/factory/overview");

  async function newBatch() {
    try {
      const b = await api<{ id: string }>("/batches", { method: "POST" });
      nav(`/lotes/${b.id}`);
    } catch (e) {
      toast.error("Não foi possível criar o lote.", (e as Error).message);
    }
  }

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return null;
  const { batch, recipes, ingredients, review } = data;

  const reviewLinks = [
    { to: "/revisao?tab=recipes", n: review.recipes, text: pl(review.recipes, "receita aguardando revisão", "receitas aguardando revisão") },
    { to: "/revisao?tab=images", n: review.images, text: pl(review.images, "imagem aguardando aprovação", "imagens aguardando aprovação") },
    { to: "/revisao?tab=ingredients", n: review.ingredients_without_asset, text: pl(review.ingredients_without_asset, "ingrediente sem asset", "ingredientes sem asset") },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="O que precisa de você agora." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={batch ? `Lote #${String(batch.number).padStart(3, "0")}` : "Lote atual"} actions={batch && <Link className="text-sm text-zinc-600 underline underline-offset-4" to={`/lotes/${batch.id}`}>Abrir</Link>}>
          {batch ? (
            <>
              <p className="mb-3 text-zinc-500">
                {pl(batch.progress.recipes_total, "receita", "receitas")} · {batch.progress.counts.approved} aprovadas · {batch.progress.counts.review} em revisão · {batch.progress.counts.pending} pendentes
              </p>
              <BatchProgress progress={batch.progress} />
            </>
          ) : (
            <EmptyState title="Nenhum lote ainda." hint="Um lote agrupa as receitas de uma rodada de produção." action={<Button variant="primary" onClick={newBatch}>Criar lote #001</Button>} />
          )}
        </Card>

        <Card title="Factory" actions={<span className="flex items-center gap-3">{fac.data && <FactoryStateBadge state={fac.data.state} />}<Link className="text-sm text-zinc-600 underline underline-offset-4" to="/factory">Abrir</Link></span>}>
          {fac.data?.current?.batch ? (
            <>
              <p className="text-zinc-500">Lote atual <Link className="font-medium text-zinc-900 underline underline-offset-4" to={`/lotes/${fac.data.current.batch.id}`}>#{String(fac.data.current.batch.number).padStart(3, "0")}</Link></p>
              <p className="mt-2"><span className="tabular text-3xl font-semibold">{fac.data.current.summary.generated}</span> <span className="text-zinc-500">geradas</span></p>
              <p className="mt-1 text-zinc-500">{fac.data.current.summary.ready_for_review} em revisão · {fac.data.current.summary.duplicates} duplicidades · {fac.data.current.summary.ingredient_assets_missing} assets ausentes</p>
            </>
          ) : (
            <EmptyState title="Nenhuma geração ainda." hint="Gere um lote de receitas a partir de um brief." action={<Link to="/factory/generate"><Button variant="primary">Generate</Button></Link>} />
          )}
        </Card>

        <Card title="Receitas" actions={<Link className="text-sm text-zinc-600 underline underline-offset-4" to="/receitas">Ver todas</Link>}>
          <p className="tabular text-3xl font-semibold">{recipes.total}</p>
          <p className="mt-1 text-zinc-500">{recipes.published} publicadas · {recipes.in_production} em produção</p>
        </Card>

        <Card title="Ingredientes" actions={<Link className="text-sm text-zinc-600 underline underline-offset-4" to="/ingredientes">Ver biblioteca</Link>}>
          <p className="tabular text-3xl font-semibold">{ingredients.total} <span className="text-base font-normal text-zinc-500">únicos</span></p>
          <p className="mt-1 mb-3 text-zinc-500">
            {ingredients.with_image} com imagem · <Link className={ingredients.pending ? "font-medium text-amber-700 underline underline-offset-4" : ""} to="/ingredientes?state=pending">{ingredients.pending} sem imagem aprovada</Link>
          </p>
          <ProgressBar percent={ingredients.percent} label="Cobertura de ingredientes" />
        </Card>

        <Card title="Revisão">
          {review.recipes + review.images + review.ingredients_without_asset === 0 ? (
            <EmptyState title="Nada aguardando você." hint="Receitas, imagens e ingredientes estão em dia." />
          ) : (
            <ul className="space-y-1">
              {reviewLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={`flex items-center justify-between rounded-md px-2 py-2 hover:bg-zinc-50 ${l.n ? "" : "text-zinc-400"}`}>
                    <span><span className="tabular font-semibold">{l.n}</span> {l.text.replace(/^\d+ /, "")}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
