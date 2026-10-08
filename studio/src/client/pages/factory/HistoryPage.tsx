import { useState } from "react";
import { useApi, type Batch } from "../../api";
import { ErrorState, FilterBar, Loading, PageHeader, Select, inputCls } from "../../components/ui";
import { JobTable, NoJobs } from "./JobTable";
import { FactoryTabs, TYPE_LABEL, type Job } from "./shared";

export function HistoryPage() {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [tv, setTv] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = new URLSearchParams(Object.entries({ type, status, batch, template_version: tv, from, to }).filter(([, v]) => v) as [string, string][]).toString();
  const { data, error, loading, reload } = useApi<{ items: Job[]; template_versions: string[] }>(`/factory/jobs${qs ? `?${qs}` : ""}`);
  const batches = useApi<{ items: Batch[] }>("/batches");

  return (
    <>
      <PageHeader title="Factory" subtitle="Histórico auditável: cada geração com template, provider, custo e eventos." />
      <FactoryTabs />
      <FilterBar>
        <Select label="Tipo" value={type} onChange={setType}><option value="">Todos os tipos</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select label="Status" value={status} onChange={setStatus}><option value="">Todos os status</option>{["queued", "processing", "completed", "failed", "cancelled", "disabled"].map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        <Select label="Lote" value={batch} onChange={setBatch}><option value="">Todos os lotes</option>{batches.data?.items.map((b) => <option key={b.id} value={b.id}>Lote #{String(b.number).padStart(3, "0")}</option>)}</Select>
        <Select label="Template version" value={tv} onChange={setTv}><option value="">Todas as versões</option>{data?.template_versions.map((v) => <option key={v} value={v}>{v}</option>)}</Select>
        <input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls.replace("w-full", "w-auto")} />
        <input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls.replace("w-full", "w-auto")} />
      </FilterBar>
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <JobTable jobs={data?.items ?? []} onChanged={reload} detailed empty={<NoJobs text="Nenhum job para esses filtros." />} />
      )}
    </>
  );
}
