"use client";

import { Home } from "./Home";
import { Onboarding } from "./Onboarding";
import { AppProvider, useApp } from "./providers/AppProvider";
import { WeatherProvider } from "./providers/WeatherProvider";

function Gate() {
  const { ready, data } = useApp();
  if (!ready) return <div className="min-h-dvh" aria-hidden />;
  if (!data.onboarded) return <Onboarding />;
  // Terminou o onboarding → entra direto na Home, que gera a primeira sugestão.
  return <Home />;
}

export function App() {
  return (
    <AppProvider>
      <WeatherProvider>
        <Gate />
      </WeatherProvider>
    </AppProvider>
  );
}
