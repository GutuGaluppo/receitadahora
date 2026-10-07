"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getWeather } from "@/services/weather";
import type { WeatherContext } from "@/types";
import { useApp } from "./AppProvider";

type WeatherState = { status: "idle" | "loading" | "ready" | "error"; weather: WeatherContext | null };
type Keyed = WeatherState & { city?: string };

const WeatherCtx = createContext<WeatherState>({ status: "idle", weather: null });

export const useWeather = () => useContext(WeatherCtx);

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const { ready, profile } = useApp();
  const city = profile.weatherEnabled ? profile.city : undefined;
  const [state, setState] = useState<Keyed>({ status: "idle", weather: null });

  useEffect(() => {
    if (!ready) return;
    if (!city) return;
    const ctrl = new AbortController();
    getWeather(city, ctrl.signal)
      .then((weather) => setState({ status: "ready", weather, city }))
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: "error", weather: null, city });
      });
    return () => ctrl.abort();
  }, [ready, city]);

  // Derivado: no render em que a cidade muda (ou o app acaba de hidratar) o efeito
  // ainda não rodou — já reportamos "loading" para a Home esperar o clima.
  const effective: WeatherState = !city
    ? { status: "idle", weather: null }
    : state.city !== city
      ? { status: "loading", weather: null }
      : { status: state.status, weather: state.weather };

  return <WeatherCtx.Provider value={effective}>{children}</WeatherCtx.Provider>;
}
