"use client";

import type { CatalogStatus } from "@/services/studio-content";
import type { Recipe } from "@/types";
import { Home } from "./Home";
import { Onboarding } from "./Onboarding";
import { AppProvider, useApp } from "./providers/AppProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { CatalogProvider, useCatalog } from "./providers/CatalogProvider";
import { WeatherProvider } from "./providers/WeatherProvider";

function CatalogUnavailable() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="display text-[28px]">Estamos preparando as receitas</h1>
      <p className="max-w-sm text-muted">
        Não conseguimos carregar as sugestões agora. Seus dados continuam salvos; tente novamente em instantes.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="themed mt-2 inline-flex h-12 items-center rounded-full bg-strong px-8 text-[16px] font-medium text-white"
      >
        Tentar de novo
      </button>
    </main>
  );
}

function Gate() {
  const { ready, data } = useApp();
  const { recipes } = useCatalog();
  if (!ready) return <div className="min-h-dvh" aria-hidden />;
  // Sem catálogo confiável (Studio fora do ar e sem fallback seguro) o app NÃO recomenda nada.
  if (recipes.length === 0) return <CatalogUnavailable />;
  if (!data.onboarded) return <Onboarding />;
  // Terminou o onboarding → entra direto na Home, que gera a primeira sugestão.
  return <Home />;
}

export function App({ recipes, catalogStatus }: { recipes: Recipe[]; catalogStatus: CatalogStatus }) {
  return (
    <CatalogProvider recipes={recipes} status={catalogStatus}>
      <AuthProvider>
        <AppProvider>
          <WeatherProvider>
            <Gate />
          </WeatherProvider>
        </AppProvider>
      </AuthProvider>
    </CatalogProvider>
  );
}
