"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PALETTES } from "@/data/palettes";
import { DIET_OPTIONS, GOAL_OPTIONS, MAX_GOALS, TIME_OPTIONS } from "@/lib/options";
import { splitTerms } from "@/lib/text";
import { paletteVars } from "@/lib/theme";
import { defaultProfile } from "@/services/storage";
import { searchCities, type CityResult } from "@/services/weather";
import type { DietaryPreference, Goal } from "@/types";
import { Chip } from "./Chip";
import { useApp } from "./providers/AppProvider";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = 4;

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState<DietaryPreference[]>([]);
  const [allergyText, setAllergyText] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [time, setTime] = useState<number | null>(null);
  const [cityText, setCityText] = useState("");
  const [picked, setPicked] = useState<CityResult | null>(null);
  const [suggestions, setSuggestions] = useState<CityResult[]>([]);
  const [useWeather, setUseWeather] = useState(true);

  useEffect(() => {
    if (picked && picked.city === cityText) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchCities(cityText, ctrl.signal).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cityText, picked]);

  const canNext = step === 2 ? time !== null : true;

  const finish = () => {
    const base = defaultProfile();
    const manualCity = cityText.trim();
    completeOnboarding({
      ...base,
      dietaryPreferences: diet,
      allergies: splitTerms(allergyText),
      goals,
      usualPrepTime: time,
      city: picked?.city ?? (manualCity || undefined),
      country: picked?.country,
      timezone: picked?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      weatherEnabled: useWeather && !!(picked?.city ?? manualCity),
    });
  };

  const next = () => (step === STEPS - 1 ? finish() : setStep((s) => s + 1));

  const screens = [
    <div key="0" className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl sm:text-4xl">Como você costuma comer?</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Alimentação">
        <Chip selected={diet.length === 0} onClick={() => setDiet([])}>
          Sem restrições
        </Chip>
        {DIET_OPTIONS.map((d) => (
          <Chip key={d.id} selected={diet.includes(d.id)} onClick={() => setDiet(toggle(diet, d.id))}>
            {d.label}
          </Chip>
        ))}
      </div>
      <div>
        <label htmlFor="ob-allergies" className="block text-muted">
          Tenho alergias ou ingredientes a evitar
        </label>
        <input
          id="ob-allergies"
          value={allergyText}
          onChange={(e) => setAllergyText(e.target.value)}
          placeholder="amendoim, camarão… (opcional)"
          className="mt-2 min-h-12 w-full rounded-lg border border-strong/35 bg-transparent px-4 text-fg placeholder:text-muted/70"
        />
      </div>
    </div>,

    <div key="1" className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl">O que importa mais para você?</h1>
        <p className="mt-2 text-muted">Selecione até {MAX_GOALS}.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Objetivos">
        {GOAL_OPTIONS.map((g) => {
          const selected = goals.includes(g.id);
          return (
            <Chip
              key={g.id}
              selected={selected}
              disabled={!selected && goals.length >= MAX_GOALS}
              onClick={() => setGoals(toggle(goals, g.id))}
            >
              {g.label}
            </Chip>
          );
        })}
      </div>
    </div>,

    <div key="2" className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl sm:text-4xl">Quanto tempo você costuma ter para preparar?</h1>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tempo de preparo">
        {TIME_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={time === t.value}
            onClick={() => setTime(t.value)}
            className={`min-h-11 rounded-full border-[1.5px] px-4 text-[15px] transition-colors duration-300 ${
              time === t.value ? "border-strong bg-strong text-paper" : "border-strong/35 hover:border-strong"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>,

    <div key="3" className="flex flex-col gap-8">
      <h1 className="font-serif text-3xl sm:text-4xl">Posso usar o clima da sua região para melhorar as sugestões?</h1>
      <div>
        <label htmlFor="ob-city" className="block text-muted">
          Sua cidade
        </label>
        <input
          id="ob-city"
          value={cityText}
          autoComplete="off"
          onChange={(e) => {
            setCityText(e.target.value);
            setPicked(null);
          }}
          placeholder="Ex.: São Paulo"
          className="mt-2 min-h-12 w-full rounded-lg border border-strong/35 bg-transparent px-4 text-fg placeholder:text-muted/70"
        />
        {suggestions.length > 0 && !picked && (
          <ul className="mt-1 divide-y divide-strong/10 rounded-lg border border-strong/25">
            {suggestions.map((c) => (
              <li key={`${c.city}-${c.admin}-${c.country}`}>
                <button
                  type="button"
                  className="min-h-11 w-full px-4 text-left hover:bg-strong/10"
                  onClick={() => {
                    setPicked(c);
                    setCityText(c.city);
                    setSuggestions([]);
                  }}
                >
                  {c.city}
                  <span className="text-muted">
                    {c.admin ? `, ${c.admin}` : ""} · {c.country}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={useWeather}
          onChange={(e) => setUseWeather(e.target.checked)}
          className="h-5 w-5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-strong checked:bg-strong"
        />
        <span>Usar clima nas recomendações</span>
      </label>
      <p className="-mt-4 text-sm text-muted">Guardamos apenas o nome da cidade, nunca sua localização exata.</p>
    </div>,
  ];

  return (
    <div className="relative flex min-h-dvh flex-col" style={paletteVars(PALETTES.warm)}>
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: `linear-gradient(170deg, ${PALETTES.warm.background}, ${PALETTES.warm.backgroundSecondary})` }} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16 text-fg">
        <p className="mb-8 text-xs uppercase tracking-[0.18em] text-muted" aria-live="polite">
          {step + 1} de {STEPS}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            {screens[step]}
          </motion.div>
        </AnimatePresence>

        <div className="mt-12 flex items-center gap-4">
          <button
            type="button"
            onClick={next}
            disabled={!canNext}
            className="h-14 min-w-[160px] rounded-full bg-strong px-9 font-medium text-paper transition-opacity disabled:opacity-40"
          >
            {step === STEPS - 1 ? "Começar" : "Próximo"}
          </button>
          {step > 0 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-11 px-3 text-muted hover:text-fg">
              Voltar
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
