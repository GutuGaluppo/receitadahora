"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { CatalogStatus } from "@/services/studio-content";
import type { Recipe } from "@/types";

type CatalogContextValue = {
  recipes: readonly Recipe[];
  byId: ReadonlyMap<string, Recipe>;
  status: CatalogStatus;
  /** legacyId → id novo (catálogo antigo → Studio). */
  legacyMap: ReadonlyMap<string, string>;
  /** Herói do onboarding: a receita `featured` ou, na falta dela, a primeira. */
  hero: Recipe | null;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog precisa estar dentro de <CatalogProvider>");
  return ctx;
}

/** Quanto tempo uma aba pode ficar em segundo plano antes de pedir o catálogo de novo ao servidor. */
const REFRESH_AFTER_MS = 5 * 60_000;

export function CatalogProvider({
  recipes,
  status,
  children,
}: {
  recipes: Recipe[];
  status: CatalogStatus;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hiddenAt = useRef<number | null>(null);

  // O app é client-first: quem já está com a aba aberta mantém o catálogo antigo em memória.
  // Ao voltar o foco depois de alguns minutos, pede o catálogo atual (limita — mas não elimina — a janela de uma despublicação).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > REFRESH_AFTER_MS) {
        hiddenAt.current = null;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  const value = useMemo<CatalogContextValue>(() => {
    const byId = new Map(recipes.map((r) => [r.id, r]));
    const legacyMap = new Map<string, string>();
    for (const r of recipes) for (const l of r.legacyIds ?? []) legacyMap.set(l, r.id);
    return { recipes, byId, status, legacyMap, hero: recipes.find((r) => r.featured) ?? recipes[0] ?? null };
  }, [recipes, status]);

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
