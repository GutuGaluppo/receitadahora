import { useCallback, useEffect, useState } from "react";

export class ApiError extends Error {
  constructor(public status: number, public body: Record<string, any>) {
    super(body?.message ?? `Erro ${status}`);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text.slice(0, 200) }; }
  if (!res.ok) throw new ApiError(res.status, json ?? {});
  return json as T;
}

/** GET com estado de carregamento/erro e `reload`. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<T>(path)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e : new ApiError(0, { message: "Sem conexão com o servidor." })); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, tick]);

  return { data, error, loading, reload };
}

/* ───────── tipos ───────── */
export type AssetState = "missing" | "review" | "approved" | "rejected";
export type RecipeStatus = "draft" | "image_pending" | "review" | "approved" | "published" | "rejected";

export const RECIPE_STATUS_LABEL: Record<RecipeStatus, string> = {
  draft: "Rascunho", image_pending: "Imagem pendente", review: "Em revisão", approved: "Aprovada", published: "Publicada", rejected: "Rejeitada",
};
export const ASSET_STATE_LABEL: Record<AssetState, string> = { missing: "Sem imagem", review: "Em revisão", approved: "Aprovado", rejected: "Rejeitado" };

export interface Progress {
  recipes_total: number; heroes: number; approved: number; ingredients_total: number; ingredients_with_asset: number;
  new_ingredients: number; new_ingredients_with_asset: number; percent: number;
  counts: { approved: number; review: number; pending: number };
  items: { position: number; id: string; name: string; slug: string; status: RecipeStatus; recipe_ok: boolean; hero: AssetState; ingredients_missing: number; approved: boolean }[];
}
export interface Batch { id: string; number: number; status: "open" | "completed"; created_at: string; completed_at: string | null; progress: Progress }
export interface Coverage { total: number; with_image: number; pending: number; review: number; rejected: number; missing: number; percent: number }
export interface IngredientItem {
  id: string; name: string; slug: string; recipe_count: number; updated_at: string; state: AssetState;
  asset: { id: string; key: string; url: string; status: Exclude<AssetState, "missing">; version: number } | null;
}
export interface AssetDetail { id: string; key: string; url: string; filename: string; mime_type: string; size_bytes: number; version: number; status: Exclude<AssetState, "missing">; reject_reason: string | null; created_at: string; updated_at: string }

export const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
export const fmtKb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
