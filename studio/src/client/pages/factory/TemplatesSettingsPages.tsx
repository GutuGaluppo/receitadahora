import { useApi } from "../../api";
import { Badge, Card, ErrorState, Loading, PageHeader } from "../../components/ui";
import { FactoryTabs, money, TYPE_LABEL, type FactoryConfig, type JobType } from "./shared";

type Tpl = { id: string; name: string; type: JobType; version: string; prompt: string; is_active: boolean; updated_at: string };

export function TemplatesPage() {
  const { data, error, loading, reload } = useApi<{ items: Tpl[] }>("/factory/templates");
  return (
    <>
      <PageHeader title="Factory" subtitle="Templates versionados. Prompts críticos nunca ficam em componentes de interface." />
      <FactoryTabs />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <div className="space-y-3">
          {data?.items.map((t) => (
            <Card key={t.id} title={<span className="flex items-center gap-2">{t.name} <span className="tabular text-zinc-500">{t.version}</span> {t.is_active && <Badge tone="green" icon="✓">Ativo</Badge>}</span>} actions={<span className="text-xs text-zinc-500">{TYPE_LABEL[t.type]}</span>}>
              <details>
                <summary className="cursor-pointer text-sm text-zinc-600">Ver prompt</summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-50 p-3 font-mono text-xs">{t.prompt}</pre>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

const Flag = ({ on, name }: { on: boolean; name: string }) => (
  <li className="flex items-center justify-between py-1.5">
    <code className="text-xs">{name}</code>
    {on ? <Badge tone="green" icon="●">true</Badge> : <Badge tone="neutral" icon="○">false</Badge>}
  </li>
);

export function SettingsPage() {
  const { data, error, loading, reload } = useApi<FactoryConfig>("/factory/config");
  return (
    <>
      <PageHeader title="Factory" subtitle="Somente leitura. As flags vivem nas variáveis do Worker e são aplicadas pelo backend." />
      <FactoryTabs />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : data && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Feature flags">
            <ul className="divide-y divide-zinc-100">
              <Flag on={data.flags.content_generation} name="CONTENT_GENERATION_ENABLED" />
              <Flag on={data.flags.image_generation} name="IMAGE_GENERATION_ENABLED" />
              <Flag on={data.flags.auto_batch_generation} name="AUTO_BATCH_GENERATION_ENABLED" />
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Geração diária automática não existe no MVP: toda geração começa por “Generate Batch”.</p>
          </Card>
          <Card title="Guardrails e custos">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
              <dt><code className="text-xs">DAILY_GENERATION_LIMIT</code></dt><dd className="tabular text-right">{data.guardrails.daily_generation_limit}</dd>
              <dt><code className="text-xs">MONTHLY_GENERATION_BUDGET</code></dt><dd className="tabular text-right">{money(data.guardrails.monthly_generation_budget)}</dd>
              <dt className="text-zinc-500">Gasto hoje</dt><dd className="tabular text-right">{money(data.spend.today)}</dd>
              <dt className="text-zinc-500">Gasto no mês</dt><dd className="tabular text-right">{money(data.spend.month)}</dd>
            </dl>
            <p className="mt-3 text-xs text-zinc-500">Providers pagos só rodam com limite configurado e dentro dele. Provider gratuito (mock) não consome orçamento.</p>
          </Card>
          <Card title="Providers">
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5">
              <dt className="text-zinc-500">Receitas</dt><dd>{data.providers.recipe}</dd>
              <dt className="text-zinc-500">Imagens</dt><dd>{data.providers.image}</dd>
            </dl>
            <p className="mt-3 text-xs text-zinc-500">Chaves de API ficam em secrets do Cloudflare e nunca chegam ao navegador.</p>
          </Card>
        </div>
      )}
    </>
  );
}
