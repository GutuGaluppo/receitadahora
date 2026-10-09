"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DIET_OPTIONS, GOAL_OPTIONS, MAX_GOALS, TIME_OPTIONS } from "@/lib/options";
import { splitTerms } from "@/lib/text";
import { paletteBackground, paletteVars } from "@/lib/theme";
import { defaultProfile } from "@/services/storage";
import { searchCities, type CityResult } from "@/services/weather";
import type { DietaryPreference, Goal } from "@/types";
import { FloatingLeaves, Skyline } from "./FloatingLeaves";
import {
  ArrowRight, Bolt, Bottle, Check, Clock, Coins, Dumbbell, Heart, Leaf, Pencil, Pin, Plus, Sparkle, Wheat,
} from "./icons";
import { useApp } from "./providers/AppProvider";
import { useCatalog } from "./providers/CatalogProvider";
import { RecipeImage } from "./RecipeImage";

const EASE = [0.22, 1, 0.36, 1] as const;
const QUESTIONS = 4;

const DIET_ICON: Record<DietaryPreference, typeof Leaf> = {
  vegetarian: Leaf,
  vegan: Leaf,
  "lactose-free": Bottle,
  "gluten-free": Wheat,
};
const GOAL_ICON: Record<Goal, typeof Leaf> = {
  "eat-better": Heart,
  protein: Dumbbell,
  save: Coins,
  quick: Bolt,
  explore: Sparkle,
};

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function OptionRow({
  icon: Icon,
  label,
  selected,
  onClick,
  disabled,
  role = "checkbox",
}: {
  icon: typeof Leaf;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  role?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[58px] w-full items-center gap-4 rounded-[22px] border px-5 text-left text-[17px] transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-45 ${
        selected ? "border-strong/45 bg-accent/15 text-strong" : "border-fg/10 bg-white/30 text-fg hover:border-strong/30"
      }`}
    >
      <Icon size={24} className="shrink-0 text-strong" />
      <span className="flex-1">{label}</span>
      <span
        aria-hidden
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-300 ${
          selected ? "border-strong bg-strong text-white" : "border-fg/20"
        }`}
      >
        {selected && <Check size={16} />}
      </span>
    </button>
  );
}

const primary =
  "themed inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-strong px-8 text-[17px] font-medium text-white shadow-[0_8px_20px_-8px_var(--strong)] disabled:opacity-40";
const outline =
  "themed inline-flex h-14 w-full items-center justify-center rounded-full border border-strong/35 px-8 text-[17px] font-medium text-strong hover:bg-strong/5";

export function Onboarding() {
  // O Gate só renderiza o onboarding com catálogo não vazio; o herói vem do Studio (featured ou a 1ª receita).
  const HERO = useCatalog().hero!;
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(0); // 0 = boas-vindas; 1..4 = perguntas
  const [diet, setDiet] = useState<DietaryPreference[]>([]);
  const [allergyText, setAllergyText] = useState("");
  const [showAllergy, setShowAllergy] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [time, setTime] = useState<number | null>(null);
  const [cityText, setCityText] = useState("");
  const [picked, setPicked] = useState<CityResult | null>(null);
  const [suggestions, setSuggestions] = useState<CityResult[]>([]);

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

  const finish = (useWeather: boolean) => {
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

  const next = () => setStep((s) => s + 1);
  const canNext = step !== 3 || time !== null;
  const weatherStep = step === QUESTIONS;
  const bg = paletteBackground(HERO.palette);

  const nextButton = (
    <button type="button" onClick={next} disabled={!canNext} className={primary}>
      {step === 0 ? "Começar" : "Continuar"} <ArrowRight size={20} />
    </button>
  );

  const screens: Record<number, React.ReactNode> = {
    0: (
      <div className="flex min-h-[calc(100dvh-2rem)] flex-col">
        <div className="-mx-8 mt-2">
          <RecipeImage recipe={HERO} />
        </div>
        <div className="mt-auto flex flex-col gap-4 pb-2">
          <h1 className="display text-[clamp(44px,12vw,60px)]">
            Vamos
            <br />
            nos conhecer
          </h1>
          <p className="max-w-[30ch] text-[18px] leading-snug text-muted">
            Em algumas perguntas rápidas, podemos sugerir receitas que combinam com o seu dia a dia.
          </p>
          <div className="mt-3">{nextButton}</div>
        </div>
      </div>
    ),
    1: (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="display text-[clamp(38px,10vw,48px)]">Como você costuma comer?</h1>
          <p className="mt-3 max-w-[32ch] text-[17px] leading-snug text-muted">
            Escolha o que faz mais sentido para você. Você pode selecionar mais de uma opção.
          </p>
        </div>
        <div className="flex flex-col gap-3" role="group" aria-label="Alimentação">
          <OptionRow icon={Leaf} label="Sem restrições" selected={diet.length === 0} onClick={() => setDiet([])} />
          {DIET_OPTIONS.map((d) => (
            <OptionRow
              key={d.id}
              icon={DIET_ICON[d.id]}
              label={d.label}
              selected={diet.includes(d.id)}
              onClick={() => setDiet(toggle(diet, d.id))}
            />
          ))}
          {showAllergy ? (
            <div className="rounded-[22px] border border-dashed border-fg/25 px-5 py-3">
              <label htmlFor="ob-allergies" className="block text-sm text-muted">
                Alergias ou ingredientes a evitar (separe por vírgula)
              </label>
              <input
                id="ob-allergies"
                autoFocus
                value={allergyText}
                onChange={(e) => setAllergyText(e.target.value)}
                placeholder="amendoim, camarão…"
                className="mt-1 min-h-11 w-full bg-transparent text-[17px] placeholder:text-muted/60 focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAllergy(true)}
              className="flex min-h-[58px] w-full items-center gap-4 rounded-[22px] border border-dashed border-fg/25 px-5 text-left text-[17px] text-muted hover:border-strong/40"
            >
              <Plus size={22} /> Adicionar alergia ou restrição
            </button>
          )}
        </div>
      </div>
    ),
    2: (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="display text-[clamp(38px,10vw,48px)]">O que importa mais para você?</h1>
          <p className="mt-3 text-[17px] text-muted">Escolha até {MAX_GOALS} prioridades.</p>
        </div>
        <div className="flex flex-col gap-3" role="group" aria-label="Objetivos">
          {GOAL_OPTIONS.map((g) => {
            const selected = goals.includes(g.id);
            return (
              <OptionRow
                key={g.id}
                icon={GOAL_ICON[g.id]}
                label={g.id === "quick" ? "Cozinhar rápido" : g.label}
                selected={selected}
                disabled={!selected && goals.length >= MAX_GOALS}
                onClick={() => setGoals(toggle(goals, g.id))}
              />
            );
          })}
        </div>
      </div>
    ),
    3: (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="display text-[clamp(38px,10vw,48px)]">Quanto tempo você costuma ter?</h1>
          <p className="mt-3 max-w-[30ch] text-[17px] leading-snug text-muted">
            Selecione o tempo que melhor representa a sua rotina.
          </p>
        </div>
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Tempo de preparo">
          {TIME_OPTIONS.map((t) => (
            <OptionRow
              key={t.value}
              role="radio"
              icon={Clock}
              label={t.label}
              selected={time === t.value}
              onClick={() => setTime(t.value)}
            />
          ))}
        </div>
      </div>
    ),
    4: (
      <div className="flex flex-1 flex-col">
        <h1 className="display text-[clamp(38px,10vw,48px)]">Posso considerar o clima da sua cidade?</h1>
        <p className="mt-3 max-w-[32ch] text-[17px] leading-snug text-muted">
          Usamos apenas sua cidade para sugerir receitas que combinam com o clima da sua região.
        </p>
        <div className="relative z-10 mt-6">
          <div className="flex min-h-[64px] items-center gap-4 rounded-[22px] bg-card px-5 shadow-sm backdrop-blur-sm">
            <Pin size={24} className="shrink-0 text-strong" />
            <label htmlFor="ob-city" className="sr-only">
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
              placeholder="Sua cidade"
              className="min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-muted/70 focus:outline-none"
            />
            <Pencil size={20} className="shrink-0 text-strong" />
          </div>
          {suggestions.length > 0 && !picked && (
            <ul className="mt-2 divide-y divide-fg/10 overflow-hidden rounded-[18px] bg-card shadow-sm backdrop-blur-sm">
              {suggestions.map((c) => (
                <li key={`${c.city}-${c.admin}-${c.country}`}>
                  <button
                    type="button"
                    className="min-h-12 w-full px-5 text-left hover:bg-strong/5"
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
        <div className="relative z-10 mt-auto flex flex-col gap-3 pt-10">
          <button type="button" onClick={() => finish(true)} disabled={!cityText.trim()} className={primary}>
            Sim, usar minha cidade
          </button>
          <button type="button" onClick={() => finish(false)} className={outline}>
            Agora não
          </button>
        </div>
      </div>
    ),
  };

  return (
    <div
      className="themed relative min-h-dvh overflow-hidden text-fg"
      style={{ ...paletteVars(HERO.palette), background: bg }}
    >
      {step > 0 && step < QUESTIONS && <FloatingLeaves corners={["tr"]} seed={`s${step}`} />}
      {weatherStep && (
        <>
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(255,196,120,0.55),transparent_60%)]" />
          <Skyline />
        </>
      )}

      <main className="relative mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-8 pb-8 pt-8">
        {step > 0 && (
          <div className="mb-8" aria-live="polite">
            <div className="flex items-center justify-between text-[13px] uppercase tracking-[0.2em] text-muted">
              <span>Onboarding</span>
              <span>
                {step}/{QUESTIONS}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={QUESTIONS}
              aria-valuenow={step}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-strong/20"
            >
              <motion.div
                className="h-full rounded-full bg-strong"
                initial={false}
                animate={{ width: `${(step / QUESTIONS) * 100}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              {screens[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {step > 0 && step < QUESTIONS && (
          <div className="relative z-10 mt-8 flex flex-col gap-2">
            {nextButton}
            <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-11 text-[15px] text-muted hover:text-fg">
              Voltar
            </button>
          </div>
        )}
        {weatherStep && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="relative z-10 mt-2 min-h-11 text-[15px] text-muted hover:text-fg">
            Voltar
          </button>
        )}
      </main>
    </div>
  );
}
