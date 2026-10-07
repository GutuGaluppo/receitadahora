"use client";

import { useEffect, useRef, useState } from "react";
import { DIET_OPTIONS, GOAL_OPTIONS, MAX_GOALS, MEAL_OPTIONS, TIME_OPTIONS } from "@/lib/options";
import { splitTerms } from "@/lib/text";
import { searchCities, type CityResult } from "@/services/weather";
import type { DietaryPreference, Goal, MealType } from "@/types";
import { Chip } from "./Chip";
import { Calendar, ChevronRight, Clock, Leaf, People, Pin, Target } from "./icons";
import { useApp } from "./providers/AppProvider";

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Row({
  id,
  title,
  summary,
  Icon,
  openId,
  setOpenId,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  Icon: typeof Leaf;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const open = openId === id;
  return (
    <div className="rounded-2xl border border-fg/10 bg-white/30">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`panel-${id}`}
        onClick={() => setOpenId(open ? null : id)}
        className="themed flex min-h-[76px] w-full items-center gap-5 px-5 py-3 text-left"
      >
        <Icon size={30} className="shrink-0 text-strong" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="display text-[21px] leading-tight">{title}</span>
          <span className="truncate text-[15px] text-muted">{summary}</span>
        </span>
        <ChevronRight size={20} className={`shrink-0 text-strong transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div id={`panel-${id}`} className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

/** "Meu Gosto": cada linha expande; toda mudança salva na hora. */
export function TasteProfile() {
  const { profile, updateProfile, exportData, eraseAll } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [allergyText, setAllergyText] = useState(profile.allergies.join(", "));
  const [cityText, setCityText] = useState(profile.city ?? "");
  const [suggestions, setSuggestions] = useState<CityResult[]>([]);
  const skipSearch = useRef(true);

  useEffect(() => {
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchCities(cityText, ctrl.signal).then(setSuggestions).catch(() => setSuggestions([]));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [cityText]);

  const timeLabel = TIME_OPTIONS.find((t) => t.value === profile.usualPrepTime)?.label ?? "—";
  const dietSummary = profile.dietaryPreferences.length
    ? DIET_OPTIONS.filter((d) => profile.dietaryPreferences.includes(d.id)).map((d) => d.label.toLowerCase()).join(", ")
    : "sem restrições";

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receita-da-hora-meus-dados.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="meu-gosto">
      <h3 id="meu-gosto" className="sr-only">
        Meu Gosto
      </h3>
      <p className="mb-6 max-w-[36ch] text-[16px] text-muted">
        Ajuste suas preferências para que as sugestões combinem ainda mais com a sua rotina. Salva sozinho.
      </p>

      <div className="space-y-3">
        <Row id="diet" title="Alimentação" Icon={Leaf} summary={dietSummary} openId={openId} setOpenId={setOpenId}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Alimentação">
            <Chip
              selected={profile.dietaryPreferences.length === 0}
              onClick={() => updateProfile({ dietaryPreferences: [] })}
            >
              Sem restrições
            </Chip>
            {DIET_OPTIONS.map((d) => (
              <Chip
                key={d.id}
                selected={profile.dietaryPreferences.includes(d.id)}
                onClick={() =>
                  updateProfile({ dietaryPreferences: toggle<DietaryPreference>(profile.dietaryPreferences, d.id) })
                }
              >
                {d.label}
              </Chip>
            ))}
          </div>
          <label className="mt-4 block text-sm text-muted" htmlFor="allergies">
            Alergias ou ingredientes a evitar (separe por vírgula)
          </label>
          <input
            id="allergies"
            value={allergyText}
            onChange={(e) => {
              setAllergyText(e.target.value);
              updateProfile({ allergies: splitTerms(e.target.value) });
            }}
            placeholder="amendoim, camarão…"
            className="themed mt-1 min-h-11 w-full rounded-lg border border-strong/35 bg-transparent px-3 text-fg placeholder:text-muted/70"
          />
        </Row>

        <Row
          id="goals"
          title="Objetivos"
          Icon={Target}
          summary={
            profile.goals.length
              ? GOAL_OPTIONS.filter((g) => profile.goals.includes(g.id)).map((g) => g.label.toLowerCase()).join(", ")
              : "nenhum"
          }
          openId={openId}
          setOpenId={setOpenId}
        >
          <p className="mb-3 text-sm text-muted">Até {MAX_GOALS}.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Objetivos">
            {GOAL_OPTIONS.map((g) => {
              const selected = profile.goals.includes(g.id);
              return (
                <Chip
                  key={g.id}
                  selected={selected}
                  disabled={!selected && profile.goals.length >= MAX_GOALS}
                  onClick={() => updateProfile({ goals: toggle<Goal>(profile.goals, g.id) })}
                >
                  {g.label}
                </Chip>
              );
            })}
          </div>
        </Row>

        <Row id="time" title="Tempo habitual" Icon={Clock} summary={timeLabel} openId={openId} setOpenId={setOpenId}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tempo disponível">
            {TIME_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={profile.usualPrepTime === t.value}
                onClick={() => updateProfile({ usualPrepTime: t.value })}
                className={`themed min-h-11 rounded-full border-[1.5px] px-4 text-[15px] transition-colors duration-300 ${
                  profile.usualPrepTime === t.value
                    ? "border-strong bg-strong text-white"
                    : "border-strong/35 hover:border-strong"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Row>

        <Row
          id="routine"
          title="Rotina"
          Icon={Calendar}
          summary={
            profile.usualMealTimes.length
              ? MEAL_OPTIONS.filter((m) => profile.usualMealTimes.includes(m.id)).map((m) => m.label.toLowerCase()).join(", ")
              : "nenhuma refeição"
          }
          openId={openId}
          setOpenId={setOpenId}
        >
          <p className="mb-2 text-sm text-muted">Costuma preparar</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Refeições que costuma preparar">
            {MEAL_OPTIONS.map((m) => (
              <Chip
                key={m.id}
                selected={profile.usualMealTimes.includes(m.id)}
                onClick={() => updateProfile({ usualMealTimes: toggle<MealType>(profile.usualMealTimes, m.id) })}
              >
                {m.label}
              </Chip>
            ))}
          </div>
        </Row>

        <Row
          id="people"
          title="Pessoas"
          Icon={People}
          summary={`${profile.householdSize >= 5 ? "5+" : profile.householdSize} ${profile.householdSize === 1 ? "pessoa" : "pessoas"} em casa`}
          openId={openId}
          setOpenId={setOpenId}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted" id="hh-label">
              Pessoas em casa
            </span>
            <button
              type="button"
              aria-label="Menos uma pessoa"
              onClick={() => updateProfile({ householdSize: Math.max(1, profile.householdSize - 1) })}
              className="themed h-11 w-11 rounded-full border border-strong/35 text-lg"
            >
              −
            </button>
            <output aria-labelledby="hh-label" className="w-6 text-center tabular-nums">
              {profile.householdSize >= 5 ? "5+" : profile.householdSize}
            </output>
            <button
              type="button"
              aria-label="Mais uma pessoa"
              onClick={() => updateProfile({ householdSize: Math.min(5, profile.householdSize + 1) })}
              className="themed h-11 w-11 rounded-full border border-strong/35 text-lg"
            >
              +
            </button>
          </div>
        </Row>

        <Row
          id="climate"
          title="Clima e região"
          Icon={Pin}
          summary={profile.city ? `${profile.city}${profile.weatherEnabled ? "" : " · clima desligado"}` : "Usamos sua cidade para sugestões sazonais"}
          openId={openId}
          setOpenId={setOpenId}
        >
          <label className="block text-sm text-muted" htmlFor="city">
            Sua cidade
          </label>
          <input
            id="city"
            value={cityText}
            autoComplete="off"
            onChange={(e) => setCityText(e.target.value)}
            placeholder="Ex.: São Paulo"
            className="themed mt-1 min-h-11 w-full rounded-lg border border-strong/35 bg-transparent px-3 text-fg placeholder:text-muted/70"
          />
          {suggestions.length > 0 && (
            <ul className="mt-1 divide-y divide-strong/10 rounded-lg border border-strong/25">
              {suggestions.map((c) => (
                <li key={`${c.city}-${c.admin}-${c.country}`}>
                  <button
                    type="button"
                    className="themed min-h-11 w-full px-3 text-left text-sm hover:bg-strong/10"
                    onClick={() => {
                      skipSearch.current = true;
                      setCityText(c.city);
                      setSuggestions([]);
                      updateProfile({ city: c.city, country: c.country, timezone: c.timezone ?? profile.timezone });
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
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={profile.weatherEnabled}
              onChange={(e) => updateProfile({ weatherEnabled: e.target.checked })}
              className="h-5 w-5 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-strong checked:bg-strong"
            />
            <span>Considerar o clima nas sugestões</span>
          </label>
        </Row>
      </div>

      <div className="mt-8 flex flex-wrap gap-x-6 text-[15px] text-muted">
        <button type="button" onClick={download} className="themed min-h-11 underline-offset-4 hover:text-fg hover:underline">
          Exportar meus dados
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Apagar todos os seus dados deste aparelho? Isso não pode ser desfeito.")) eraseAll();
          }}
          className="themed min-h-11 underline-offset-4 hover:text-fg hover:underline"
        >
          Apagar meus dados
        </button>
      </div>
    </section>
  );
}
