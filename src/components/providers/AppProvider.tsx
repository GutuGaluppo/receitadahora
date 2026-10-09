"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  clearData,
  defaultProfile,
  emptyData,
  FALLBACK_PROFILE,
  loadData,
  saveData,
  uid,
  type AppData,
} from "@/services/storage";
import { translateLegacyIds } from "@/lib/legacy-ids";
import { eraseRemote } from "@/services/cloud-sync";
import { useAuth } from "./AuthProvider";
import { useCatalog } from "./CatalogProvider";
import { useCloudSync } from "./useCloudSync";
import type {
  FeedbackReason,
  RecommendationEventType,
  UserTasteProfile,
} from "@/types";

type AppContextValue = {
  ready: boolean;
  data: AppData;
  /** Leitura síncrona do estado mais recente (útil logo após uma escrita). */
  getData: () => AppData;
  profile: UserTasteProfile;
  completeOnboarding: (profile: UserTasteProfile) => void;
  updateProfile: (patch: Partial<UserTasteProfile>) => void;
  isSaved: (recipeId: string) => boolean;
  toggleSaved: (recipeId: string) => boolean;
  logEvent: (recipeId: string, type: RecommendationEventType) => void;
  giveFeedback: (
    recipeId: string,
    type: "liked" | "disliked",
    opts?: { reason?: FeedbackReason; weather?: string },
  ) => void;
  exportData: () => string;
  eraseAll: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp precisa estar dentro de <AppProvider>");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const dataRef = useRef(data);

  // Hidratação: localStorage só existe no cliente.
  useEffect(() => {
    const loaded = loadData();
    dataRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação: localStorage só existe no cliente
    setData(loaded);
    setReady(true);
  }, []);

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    saveData(next);
  }, []);

  // Ids do catálogo antigo → ids do Studio (salvos, feedback, eventos). Idempotente; ids sem tradução são preservados.
  const { legacyMap } = useCatalog();
  useEffect(() => {
    if (!ready) return;
    const { data: translated, changed } = translateLegacyIds(dataRef.current, legacyMap);
    if (changed) commit(translated);
  }, [ready, legacyMap, commit]);

  const profile = useMemo(() => data.profile ?? FALLBACK_PROFILE, [data.profile]);

  const completeOnboarding = useCallback(
    (p: UserTasteProfile) => commit({ ...dataRef.current, profile: p, onboarded: true }),
    [commit],
  );

  const updateProfile = useCallback(
    (patch: Partial<UserTasteProfile>) => {
      const current = dataRef.current.profile ?? defaultProfile();
      commit({
        ...dataRef.current,
        profile: { ...current, ...patch, updatedAt: new Date().toISOString() },
      });
    },
    [commit],
  );

  const logEvent = useCallback(
    (recipeId: string, eventType: RecommendationEventType) => {
      const d = dataRef.current;
      commit({
        ...d,
        events: [
          ...d.events,
          { id: uid(), userId: d.profile?.id ?? "anon", recipeId, eventType, createdAt: new Date().toISOString() },
        ],
      });
    },
    [commit],
  );

  const isSaved = useCallback((id: string) => data.saved.some((s) => s.recipeId === id), [data.saved]);

  const toggleSaved = useCallback(
    (recipeId: string) => {
      const d = dataRef.current;
      const exists = d.saved.some((s) => s.recipeId === recipeId);
      const userId = d.profile?.id ?? "anon";
      const now = new Date().toISOString();
      commit({
        ...d,
        saved: exists
          ? d.saved.filter((s) => s.recipeId !== recipeId)
          : [...d.saved, { id: uid(), userId, recipeId, savedAt: now }],
        events: exists
          ? d.events
          : [...d.events, { id: uid(), userId, recipeId, eventType: "recipe_saved", createdAt: now }],
      });
      return !exists;
    },
    [commit],
  );

  const giveFeedback = useCallback<AppContextValue["giveFeedback"]>(
    (recipeId, type, opts) => {
      const d = dataRef.current;
      const userId = d.profile?.id ?? "anon";
      const now = new Date();
      commit({
        ...d,
        feedback: [
          ...d.feedback,
          {
            id: uid(),
            userId,
            recipeId,
            type,
            reason: opts?.reason,
            contextSnapshot: { hour: now.getHours(), dayOfWeek: now.getDay(), weather: opts?.weather },
            createdAt: now.toISOString(),
          },
        ],
        events: [
          ...d.events,
          {
            id: uid(),
            userId,
            recipeId,
            eventType: type === "liked" ? "recipe_liked" : "recipe_disliked",
            createdAt: now.toISOString(),
          },
        ],
      });
    },
    [commit],
  );

  const getData = useCallback(() => dataRef.current, []);

  // Sincronização com a conta (no-op sem sessão).
  const { user, supabase } = useAuth();
  const { resetKnown } = useCloudSync({ ready, user, supabase, data, getData, replace: commit });

  const exportData = useCallback(() => JSON.stringify(dataRef.current, null, 2), []);

  const eraseAll = useCallback(() => {
    clearData();
    dataRef.current = emptyData();
    setData(dataRef.current);
    // Com sessão ativa, "apagar tudo" apaga também o que está no servidor.
    if (user && supabase) {
      eraseRemote(supabase, user.id).then(resetKnown).catch((e) => console.warn("não foi possível limpar o servidor", e instanceof Error ? e.message : e));
    }
  }, [user, supabase, resetKnown]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready, data, getData, profile, completeOnboarding, updateProfile, isSaved, toggleSaved,
      logEvent, giveFeedback, exportData, eraseAll,
    }),
    [ready, data, getData, profile, completeOnboarding, updateProfile, isSaved, toggleSaved, logEvent, giveFeedback, exportData, eraseAll],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
