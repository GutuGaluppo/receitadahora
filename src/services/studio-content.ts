import { cacheLife, cacheTag } from "next/cache";
import snapshotJson from "@/data/catalog.snapshot.json";
import { ContractError, parseBlocklist, parseCatalog, selectFallback, toRecipe, type Snapshot } from "@/lib/catalog-adapter";
import type { StudioCatalog } from "@contracts/catalog";
import type { Recipe } from "@/types";

/**
 * ÚNICO ponto do app que conhece a API do Studio (plano §8.1). Roda só no servidor.
 *   live     catálogo publicado agora, vindo do Studio
 *   snapshot Studio fora do ar: último catálogo do Studio gravado no build, dentro da idade máxima e sem itens bloqueados
 *   local    STUDIO_PUBLIC_API_URL não configurada (desenvolvimento): usa o catálogo de exemplo do repositório
 *   degraded nada confiável disponível: o app mostra estado degradado e NÃO recomenda
 */
export type CatalogStatus = "live" | "snapshot" | "local" | "degraded";
export type CatalogResult = { recipes: Recipe[]; status: CatalogStatus; generatedAt: string };

const snapshot = snapshotJson as unknown as Snapshot;
const DEFAULT_MAX_AGE_HOURS = 72;

// Otimização: guarda o último catálogo/ETag desta instância para requisição condicional (304).
let last: { etag: string; catalog: StudioCatalog } | null = null;

function apiBase(): string | null {
  return process.env.STUDIO_PUBLIC_API_URL?.trim().replace(/\/+$/, "") || null;
}

async function fetchLive(base: string): Promise<StudioCatalog> {
  const res = await fetch(`${base}/api/public/v1/catalog`, {
    headers: last ? { "If-None-Match": last.etag } : undefined,
    cache: "no-store", // a camada de cache é o 'use cache' abaixo (revalidateTag respeita expire: 0)
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 304 && last) return last.catalog;
  if (!res.ok) throw new Error(`Studio respondeu ${res.status}`);
  const catalog = parseCatalog(await res.json());
  const etag = res.headers.get("etag");
  if (etag) last = { etag, catalog };
  return catalog;
}

function logFailure(kind: string, error: unknown) {
  // Estruturado para alertas (Vercel Logs / log drain). Nunca inclui segredos.
  console.error(JSON.stringify({ event: "catalog_unavailable", kind, error: error instanceof Error ? error.message : String(error), contract: error instanceof ContractError }));
}

export async function getCatalog(): Promise<CatalogResult> {
  "use cache";
  cacheTag("catalog");

  const base = apiBase();
  if (!base) {
    cacheLife({ stale: 300, revalidate: 3600, expire: 86400 });
    return { recipes: snapshot.recipes.map((r) => toRecipe(r, null)), status: "local", generatedAt: snapshot.generatedAt };
  }

  try {
    const catalog = await fetchLive(base);
    // TTL é rede de segurança; a invalidação ativa (webhook) é o mecanismo principal.
    cacheLife({ stale: 60, revalidate: 300, expire: 86400 });
    return { recipes: catalog.recipes.map((r) => toRecipe(r, base)), status: "live", generatedAt: catalog.generatedAt };
  } catch (error) {
    logFailure("live_fetch", error);
    // Falha: cache curto, para tentar o Studio de novo logo.
    cacheLife({ stale: 15, revalidate: 30, expire: 60 });
    const maxAgeHours = Number(process.env.SNAPSHOT_MAX_AGE_HOURS) || DEFAULT_MAX_AGE_HOURS;
    const fb = selectFallback(snapshot, { now: Date.now(), maxAgeHours, blocklist: parseBlocklist(process.env.CATALOG_BLOCKLIST) });
    if (fb.ok) {
      console.error(JSON.stringify({ event: "catalog_snapshot_used", generatedAt: snapshot.generatedAt, recipes: fb.recipes.length }));
      return { recipes: fb.recipes.map((r) => toRecipe(r, base)), status: "snapshot", generatedAt: snapshot.generatedAt };
    }
    logFailure(`snapshot_${fb.reason}`, "sem fallback seguro");
    return { recipes: [], status: "degraded", generatedAt: new Date(0).toISOString() };
  }
}
