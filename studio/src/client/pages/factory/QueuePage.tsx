import { useEffect } from "react";
import { useApi } from "../../api";
import { ErrorState, Loading, PageHeader } from "../../components/ui";
import { JobTable, NoJobs } from "./JobTable";
import { FactoryTabs, type Job } from "./shared";

export function QueuePage() {
  const { data, error, loading, reload } = useApi<{ items: Job[] }>("/factory/jobs?scope=queue");
  const processing = data?.items.some((j) => j.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(reload, 2000);
    return () => clearInterval(t);
  }, [processing, reload]);

  return (
    <>
      <PageHeader title="Factory" subtitle="Fila: o que está rodando, falhou ou aguarda uma decisão. Nada é repetido automaticamente." />
      <FactoryTabs />
      {error ? <ErrorState message={error.message} onRetry={reload} /> : loading && !data ? <Loading /> : (
        <JobTable jobs={data?.items ?? []} onChanged={reload} empty={<NoJobs text="A fila está vazia." />} />
      )}
    </>
  );
}
