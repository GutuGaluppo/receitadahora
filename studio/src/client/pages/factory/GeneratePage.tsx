import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, useApi } from "../../api";
import { useToast } from "../../components/toast";
import { Button, Card, Field, Loading, PageHeader, Select, inputCls } from "../../components/ui";
import { DisabledNotice, FactoryTabs, Pipeline, type FactoryConfig } from "./shared";

export function GeneratePage() {
  const cfg = useApi<FactoryConfig>("/factory/config");
  const cats = useApi<{ items: string[] }>("/recipes/categories");
  const nav = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // chave de idempotência por "formulário aberto": clique duplicado ou reenvio devolve o mesmo job
  const key = useRef(crypto.randomUUID());
  const [f, setF] = useState({ count: "10", category: "", meal_time: "", max_time: "", difficulty: "", restrictions: "", wanted: "", avoid: "", notes: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!cfg.data) return <><PageHeader title="Factory" /><Loading /></>;
  const enabled = cfg.data.flags.content_generation;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await api<{ job: { id: string; status: string; code: string }; deduped: boolean }>("/factory/jobs", {
        method: "POST",
        body: {
          idempotency_key: key.current, count: Number(f.count), category: f.category || undefined, meal_time: f.meal_time || undefined,
          max_time: f.max_time ? Number(f.max_time) : undefined, difficulty: f.difficulty || undefined, restrictions: f.restrictions || undefined,
          wanted_ingredients: f.wanted || undefined, avoid_ingredients: f.avoid || undefined, notes: f.notes || undefined,
        },
      });
      if (r.job.status === "failed") toast.error(`${r.job.code} falhou`, "O resultado bruto foi preservado. Abra o job para ver os detalhes e tentar de novo.");
      else toast.ok(`${r.job.code} concluído`, r.deduped ? "Este envio já tinha sido processado." : undefined);
      nav(`/factory/jobs/${r.job.id}`);
    } catch (err) {
      toast.error("Não foi possível iniciar a geração.", err instanceof ApiError ? err.message : "Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Factory" subtitle="Linha de produção editorial assistida: nada é publicado sem revisão humana." />
      <FactoryTabs />
      <Pipeline active={0} />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Brief">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantidade de receitas"><input className={inputCls} type="number" min={1} max={30} required value={f.count} onChange={set("count")} /></Field>
            <Field label="Categoria">
              <input className={inputCls} list="cats" value={f.category} onChange={set("category")} placeholder="Ex.: Jantar, Massas" />
              <datalist id="cats">{cats.data?.items.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Momento do dia">
              <Select label="Momento do dia" value={f.meal_time} onChange={(v) => setF((x) => ({ ...x, meal_time: v }))}>
                <option value="">Qualquer</option><option>Café da manhã</option><option>Almoço</option><option>Jantar</option><option>Lanche</option>
              </Select>
            </Field>
            <Field label="Tempo máximo (min)"><input className={inputCls} type="number" min={1} value={f.max_time} onChange={set("max_time")} placeholder="Ex.: 30" /></Field>
            <Field label="Dificuldade">
              <Select label="Dificuldade" value={f.difficulty} onChange={(v) => setF((x) => ({ ...x, difficulty: v }))}>
                <option value="">Qualquer</option><option value="easy">Fácil</option><option value="medium">Média (ou mais fácil)</option><option value="hard">Difícil (ou mais fácil)</option>
              </Select>
            </Field>
            <Field label="Restrições" hint="Separe por vírgula"><input className={inputCls} value={f.restrictions} onChange={set("restrictions")} placeholder="vegetariano, sem glúten" /></Field>
            <Field label="Ingredientes desejados" hint="Sobem na fila"><input className={inputCls} value={f.wanted} onChange={set("wanted")} placeholder="abóbora, grão-de-bico" /></Field>
            <Field label="Ingredientes a evitar"><input className={inputCls} value={f.avoid} onChange={set("avoid")} placeholder="camarão, amendoim" /></Field>
          </div>
          <div className="mt-3">
            <Field label="Observações" hint="Curto e objetivo, ex.: receitas rápidas para dias de semana."><input className={inputCls} value={f.notes} onChange={set("notes")} maxLength={500} /></Field>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={!enabled || busy}>{enabled ? (busy ? "Generating…" : "Generate Batch") : "Generation disabled"}</Button>
            <span className="text-xs text-zinc-500">Provider: {cfg.data.providers.recipe}</span>
          </div>
          {!enabled && cfg.data.messages.content && <div className="mt-4"><DisabledNotice message={cfg.data.messages.content} /></div>}
        </Card>

        <div className="space-y-4">
          <Card title="Regra da fábrica">
            <p className="text-zinc-600"><strong>Gerar somente o que ainda não existe.</strong> Ingredientes e imagens existentes são reutilizados; receitas parecidas pedem sua decisão.</p>
          </Card>
          <Card title="Custos">
            <p className="text-zinc-600">Hoje <strong className="tabular">${cfg.data.spend.today.toFixed(2)}</strong> · Mês <strong className="tabular">${cfg.data.spend.month.toFixed(2)}</strong></p>
            <p className="mt-2 text-xs text-zinc-500">Imagens: {cfg.data.flags.image_generation ? "ativas" : "desativadas (jobs ficam em Disabled, sem custo)"}.</p>
          </Card>
        </div>
      </form>
    </>
  );
}
