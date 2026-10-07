import type { WeatherCondition, WeatherContext } from "@/types";

/**
 * Serviço de clima desacoplado dos componentes. Usa Open-Meteo (sem chave de API).
 * Só a cidade é guardada pelo app; coordenadas existem apenas durante a chamada.
 */

const CACHE_KEY = "receita-da-hora:weather";
const TTL_MS = 30 * 60 * 1000;

export type CityResult = { city: string; country: string; timezone?: string; admin?: string };

type GeoResponse = {
  results?: { name: string; country?: string; admin1?: string; timezone?: string; latitude: number; longitude: number }[];
};

export async function searchCities(query: string, signal?: AbortSignal): Promise<CityResult[]> {
  if (query.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=pt&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const json = (await res.json()) as GeoResponse;
  const seen = new Set<string>();
  return (json.results ?? [])
    .map((r) => ({ city: r.name, country: r.country ?? "", timezone: r.timezone, admin: r.admin1 }))
    .filter((c) => {
      const key = `${c.city}|${c.admin}|${c.country}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** WMO weather codes → condição simplificada. */
export function conditionFromCode(code: number): WeatherCondition {
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  return "clear";
}

type Cached = { city: string; at: number; weather: WeatherContext };

function readCache(city: string): WeatherContext | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return c.city === city && Date.now() - c.at < TTL_MS ? c.weather : null;
  } catch {
    return null;
  }
}

export async function getWeather(city: string, signal?: AbortSignal): Promise<WeatherContext> {
  const cached = readCache(city);
  if (cached) return cached;

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`,
    { signal },
  );
  const geo = (await geoRes.json()) as GeoResponse;
  const place = geo.results?.[0];
  if (!place) throw new Error("city-not-found");

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,weather_code&timezone=auto`,
    { signal },
  );
  if (!res.ok) throw new Error("weather-unavailable");
  const json = (await res.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number };
  };

  const weather: WeatherContext = {
    temperature: json.current.temperature_2m,
    feelsLike: json.current.apparent_temperature,
    condition: conditionFromCode(json.current.weather_code),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ city, at: Date.now(), weather } satisfies Cached));
  } catch {
    /* noop */
  }
  return weather;
}
