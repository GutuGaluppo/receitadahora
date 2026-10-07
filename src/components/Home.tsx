"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTENT_WEIGHTS } from "@/config/recommendation-weights";
import { RECIPES, RECIPES_BY_ID } from "@/data/recipes";
import { paletteVars } from "@/lib/theme";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { recommend } from "@/services/recommendation";
import type { FeedbackReason, HomeState, Intent, IntentState, Recipe } from "@/types";
import { AlternativePrompt } from "./AlternativePrompt";
import { AtmosphereBackground } from "./AtmosphereBackground";
import { FeedbackButtons } from "./FeedbackButtons";
import { ArrowRight, ChevronLeft, Heart } from "./icons";
import { LibraryButton } from "./LibraryButton";
import { LibraryDrawer } from "./LibraryDrawer";
import { useApp } from "./providers/AppProvider";
import { useWeather } from "./providers/WeatherProvider";
import { RecipeImage } from "./RecipeImage";
import { Ingredients, RecipeMeta, Steps } from "./RecipeDetails";

const EASE = [0.22, 1, 0.36, 1] as const;
const SWITCH_MS = 650;

export function Home() {
  const { getData, profile, logEvent, giveFeedback, isSaved, toggleSaved } = useApp();
  const { status, weather } = useWeather();
  const desktop = useMediaQuery("(min-width: 1024px)");

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [homeState, setHomeState] = useState<HomeState>("suggestion");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [waited, setWaited] = useState(false);

  const intentRef = useRef<IntentState>({ preference: null, sessionStart: 0, expires: 0 });
  const seenRef = useRef<string[]>([]);
  const startedRef = useRef(false);
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Não esperamos o clima para sempre: 1,5 s e seguimos sem ele.
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const pick = useCallback(
    (current: Recipe | null): Recipe | null => {
      const { preference, expires } = intentRef.current;
      const intent: Intent | null = preference && Date.now() < expires ? preference : null;
      const history = getData();
      const base = {
        recipes: RECIPES,
        profile,
        context: { now: new Date(), weather },
        intent,
        history: { feedback: history.feedback, events: history.events },
      };
      const avoid = [...seenRef.current.slice(-8), ...(current ? [current.id] : [])];
      return (
        recommend({ ...base, excludeIds: avoid }) ??
        recommend({ ...base, excludeIds: current ? [current.id] : [] })
      );
    },
    [getData, profile, weather],
  );

  const show = useCallback(
    (next: Recipe, state: HomeState = "suggestion") => {
      seenRef.current.push(next.id);
      logEvent(next.id, "recipe_shown");
      setRecipe(next);
      window.scrollTo({ top: 0 });
      if (switchTimer.current) clearTimeout(switchTimer.current);
      if (state === "suggestion") {
        setHomeState("switchingRecipe");
        switchTimer.current = setTimeout(
          () => setHomeState((cur) => (cur === "switchingRecipe" ? "suggestion" : cur)),
          SWITCH_MS,
        );
      } else setHomeState(state);
    },
    [logEvent],
  );

  // Primeira sugestão (depois do onboarding vai direto pra cá, sem tela intermediária).
  useEffect(() => {
    if (startedRef.current) return;
    if (status === "loading" && !waited) return;
    startedRef.current = true;
    const first = pick(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sugestão inicial depende do clima (assíncrono)
    if (first) show(first);
  }, [status, waited, pick, show]);

  useEffect(() => () => {
    if (switchTimer.current) clearTimeout(switchTimer.current);
  }, []);

  /* ───── ações ───── */

  const openRecipe = () => {
    if (!recipe) return;
    logEvent(recipe.id, "recipe_opened");
    setHomeState("recipeOpen");
    window.scrollTo({ top: 0 });
  };

  const chooseIntent = (preference: Intent) => {
    if (!recipe) return;
    const now = Date.now();
    const minutes = INTENT_WEIGHTS.expiresMinutes;
    intentRef.current = { preference, sessionStart: now, expires: now + minutes * 60_000 };
    logEvent(recipe.id, "recipe_skipped");
    const next = pick(recipe);
    if (next) show(next);
    else setHomeState("suggestion");
  };

  const dislike = (reason?: FeedbackReason) => {
    if (!recipe) return;
    giveFeedback(recipe.id, "disliked", { reason, weather: weather?.condition });
    const next = pick(recipe);
    if (next) show(next);
  };

  const like = () => {
    if (recipe) giveFeedback(recipe.id, "liked", { weather: weather?.condition });
  };

  const openSaved = (id: string) => {
    const r = RECIPES_BY_ID.get(id);
    if (!r) return;
    setLibraryOpen(false);
    show(r, "recipeOpen");
    logEvent(r.id, "recipe_opened");
  };

  // Escape: fecha a biblioteca; senão recolhe a receita aberta. Listener estável + refs
  // (re-registrar a cada estado fazia o mesmo Escape fechar biblioteca *e* receita).
  const uiRef = useRef({ libraryOpen, homeState });
  useEffect(() => {
    uiRef.current = { libraryOpen, homeState };
  }, [libraryOpen, homeState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const { libraryOpen: lib, homeState: state } = uiRef.current;
      if (lib) {
        e.preventDefault();
        setLibraryOpen(false);
      } else if (state === "recipeOpen" || state === "alternativePrompt") {
        setHomeState("suggestion");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!recipe) {
    return <div className="min-h-dvh" aria-busy="true" aria-label="Escolhendo sua sugestão" />;
  }

  const open = homeState === "recipeOpen";
  const asking = homeState === "alternativePrompt";
  const hour = new Date().getHours();
  const mood =
    weather && (weather.condition === "rain" || weather.condition === "storm")
      ? "rain"
      : hour >= 19 || hour < 5
        ? "night"
        : null;
  const saved = isSaved(recipe.id);
  const openAsk = () => setHomeState("alternativePrompt");

  const image = (cls: string) => (
    <motion.div layoutId="hero-image" transition={{ duration: 0.55, ease: EASE }} className={cls}>
      <RecipeImage recipe={recipe} />
    </motion.div>
  );

  const btnPrimary =
    "themed inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-strong px-8 text-[17px] font-medium text-white shadow-[0_8px_20px_-8px_var(--strong)] transition-transform duration-300 hover:scale-[1.015] active:scale-[0.99]";
  const btnOutline =
    "themed inline-flex h-14 w-full items-center justify-center rounded-full border border-strong/35 px-8 text-[17px] font-medium text-strong transition-colors hover:bg-strong/5";

  const suggestionActions = (
    <div className="flex w-full flex-col gap-3">
      <button type="button" onClick={openRecipe} className={btnPrimary}>
        Ver receita <ArrowRight size={20} />
      </button>
      <button type="button" onClick={openAsk} className={btnOutline}>
        Outra sugestão
      </button>
    </div>
  );

  const saveButton = (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleSaved(recipe.id)}
      className={`themed inline-flex h-14 w-full items-center justify-center gap-3 rounded-full text-[17px] font-medium transition-colors duration-300 ${
        saved ? "bg-accent/15 text-strong" : "bg-strong text-white shadow-[0_8px_20px_-8px_var(--strong)]"
      }`}
    >
      <Heart size={20} filled={saved} />
      {saved ? "Salva" : "Salvar receita"}
    </button>
  );

  const feedback = <FeedbackButtons key={recipe.id} onLike={like} onDislike={dislike} onOther={openAsk} />;

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.5, delay: 0.3, ease: EASE },
  };

  const back = (
    <button
      type="button"
      onClick={() => setHomeState("suggestion")}
      aria-label="Voltar para a sugestão"
      className="themed flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-strong shadow-sm"
    >
      <ChevronLeft size={22} />
    </button>
  );

  return (
    <div className="themed relative min-h-dvh overflow-x-hidden text-fg" style={paletteVars(recipe.palette)}>
      <AtmosphereBackground palette={recipe.palette} mood={mood} />

      {!(open && !desktop) && (
        <div className="fixed right-3 top-3 z-30 lg:right-8 lg:top-6">
          <LibraryButton onClick={() => setLibraryOpen(true)} />
        </div>
      )}

      <main className="mx-auto w-full max-w-[1560px]" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <LayoutGroup>
              {!open && desktop && (
                /* ───────── Desktop · sugestão ───────── */
                <section className="grid min-h-dvh grid-cols-[1.5fr_1fr] items-center gap-4 pr-[6vw]">
                  {image("-ml-[3vw] w-[calc(100%+3vw)] max-w-[980px] self-center")}
                  <div className="flex max-w-[440px] flex-col gap-6">
                    <h1 className="display text-[clamp(44px,4.6vw,68px)]">{recipe.title}</h1>
                    <p className="max-w-[26ch] text-[19px] leading-snug text-muted">{recipe.description}</p>
                    <div className="mt-2">{suggestionActions}</div>
                  </div>
                </section>
              )}

              {!open && !desktop && (
                /* ───────── Mobile · sugestão ───────── */
                <section className="flex min-h-dvh flex-col px-6 pb-8 pt-14">
                  {image("-mx-[10%] w-[120%] max-w-none")}
                  <div className="mt-auto flex flex-col gap-3">
                    <h1 className="display text-[clamp(38px,11vw,52px)]">{recipe.title}</h1>
                    <p className="max-w-[28ch] text-[18px] leading-snug text-muted">{recipe.description}</p>
                    <div className="mt-3">{suggestionActions}</div>
                  </div>
                </section>
              )}

              {open && desktop && (
                /* ───────── Desktop · receita aberta ───────── */
                <article className="grid min-h-dvh grid-cols-[1.05fr_1fr] gap-6 py-8 pl-0 pr-[4vw]">
                  <div className="flex flex-col justify-center">
                    {image("-ml-[2vw] w-[calc(100%+2vw)] max-w-[720px] [&_img]:lg:max-h-[56dvh]")}
                    <motion.div {...fade} className="relative z-10 -mt-10 pl-[4vw]">
                      <div className="mb-3">{back}</div>
                      <h1 className="display text-[clamp(40px,4vw,60px)]">{recipe.title}</h1>
                      <RecipeMeta recipe={recipe} className="mt-3" />
                    </motion.div>
                  </div>
                  <motion.div {...fade} className="flex items-center">
                    <div className="w-full rounded-[28px] bg-card px-10 py-7 shadow-[0_30px_60px_-30px_rgba(80,40,10,0.35)] backdrop-blur-sm">
                      <Ingredients recipe={recipe} />
                      <hr className="my-5 border-fg/10" />
                      <Steps recipe={recipe} />
                      <div className="mt-6">{saveButton}</div>
                      <div className="mt-2">{feedback}</div>
                    </div>
                  </motion.div>
                </article>
              )}

              {open && !desktop && (
                /* ───────── Mobile · receita aberta ───────── */
                <article className="pb-10">
                  <div className="relative px-4 pt-3">
                    <div className="absolute inset-x-4 top-3 z-10 flex justify-between">
                      {back}
                      <LibraryButton boxed onClick={() => setLibraryOpen(true)} />
                    </div>
                    {image("mx-auto mt-6 w-[104%] -translate-x-[2%]")}
                  </div>
                  <motion.div {...fade} className="px-6">
                    <h1 className="display -mt-6 text-[clamp(36px,10vw,48px)]">{recipe.title}</h1>
                    <RecipeMeta recipe={recipe} className="mt-2" />
                    <hr className="my-6 border-fg/10" />
                    <Ingredients recipe={recipe} />
                    <hr className="my-6 border-fg/10" />
                    <Steps recipe={recipe} />
                    <div className="mt-6">{feedback}</div>
                  </motion.div>
                  <div className="sticky bottom-0 z-20 mt-6 bg-gradient-to-t from-paper via-paper/90 to-transparent px-6 pb-5 pt-6">
                    {saveButton}
                  </div>
                </article>
              )}
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {asking && (
          <AlternativePrompt
            key="ask"
            isDesktop={desktop}
            onChoose={chooseIntent}
            onCancel={() => setHomeState("suggestion")}
          />
        )}
      </AnimatePresence>

      <LibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} onOpenRecipe={openSaved} />
    </div>
  );
}
