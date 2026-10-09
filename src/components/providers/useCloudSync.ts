"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef } from "react";
import { knownFromRemote, fetchRemote, mergeData, pushDiff, type Known } from "@/services/cloud-sync";
import type { AppData } from "@/services/storage";

const MIGRATED_KEY = "receita-da-hora:synced-user";
const DEBOUNCE_MS = 1500;

/**
 * Local-first: o app funciona igual sem conta. Com sessão:
 *  1. ao entrar, une local + servidor (migração idempotente) e SÓ ENTÃO substitui o estado local;
 *  2. depois, envia só as diferenças (debounce) e ao esconder/fechar a aba.
 * Falhas de rede são silenciosas e tentadas de novo na próxima mudança; nada local é apagado.
 */
export function useCloudSync(opts: {
  ready: boolean;
  user: User | null;
  supabase: SupabaseClient | null;
  data: AppData;
  getData: () => AppData;
  replace: (next: AppData) => void;
}) {
  const { ready, user, supabase, data, getData, replace } = opts;
  const known = useRef<Known | null>(null);
  const inflight = useRef<Promise<void>>(Promise.resolve());
  const userId = user?.id ?? null;

  useEffect(() => {
    known.current = null;
    if (!ready || !userId || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchRemote(supabase, userId);
        let migrated = false;
        try { migrated = localStorage.getItem(MIGRATED_KEY) === userId; } catch { /* storage bloqueado */ }
        const merged = mergeData(getData(), remote, userId, migrated);
        const synced = await pushDiff(supabase, userId, knownFromRemote(remote), merged);
        if (cancelled) return;
        known.current = synced;
        replace(merged);
        try { localStorage.setItem(MIGRATED_KEY, userId); } catch { /* idem */ }
      } catch (e) {
        console.warn("sync inicial falhou; os dados locais foram preservados", e instanceof Error ? e.message : e);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, userId, supabase, getData, replace]);

  const flush = useCallback(() => {
    if (!supabase || !userId || !known.current) return;
    inflight.current = inflight.current.then(async () => {
      if (!known.current) return;
      try {
        known.current = await pushDiff(supabase, userId, known.current, getData());
      } catch (e) {
        console.warn("sync adiado; tentará de novo na próxima mudança", e instanceof Error ? e.message : e);
      }
    });
  }, [supabase, userId, getData]);

  useEffect(() => {
    if (!known.current) return;
    const t = setTimeout(flush, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [data, flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); };
  }, [flush]);

  /** Depois de "apagar tudo": o servidor ficou vazio, então o diff recomeça do zero. */
  const resetKnown = useCallback(() => { known.current = { saved: new Set(), feedback: new Set(), events: new Set(), profileStamp: null }; }, []);
  return { resetKnown };
}
