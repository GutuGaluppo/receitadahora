"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTENT_WEIGHTS } from "@/config/recommendation-weights";
import { RECIPES, RECIPES_BY_ID } from "@/data/recipes";
import { paletteVars } from "@/lib/theme";
import { useIsDesktop } from "@/lib/useIsDesktop";
import { recommend } from "@/services/recommendation";
import type { FeedbackReason, HomeState, Intent, IntentState, Recipe } from "@/types";
import { AlternativePrompt } from "./AlternativePrompt";
import { AtmosphereBackground } from "./AtmosphereBackground";
import { FeedbackButtons } from "./FeedbackButtons";
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
  const desktop = useIsDesktop();

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

  const image = (cls: string) => (
    <motion.div layoutId="hero-image" transition={{ duration: 0.55, ease: EASE }} className={cls}>
      <RecipeImage recipe={recipe} className="h-full w-full" />
    </motion.div>
  );

  const saveButton = (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleSaved(recipe.id)}
      className={`themed min-h-12 rounded-full border-[1.5px] border-strong px-7 text-[15px] font-medium transition-colors duration-300 ${
        saved ? "bg-strong text-paper" : "text-strong hover:bg-strong/10"
      }`}
    >
      {saved ? "✓ Salva" : "Salvar receita"}
    </button>
  );

  const otherLink = (
    <button
      type="button"
      onClick={() => setHomeState("alternativePrompt")}
      className="themed min-h-11 px-4 text-[15px] text-muted underline-offset-4 hover:text-fg hover:underline"
    >
      Outra sugestão
    </button>
  );

  const back = (
    <button
      type="button"
      onClick={() => setHomeState("suggestion")}
      className="themed -ml-3 min-h-11 px-3 text-sm text-muted hover:text-fg"
    >
      ← Voltar
    </button>
  );

  const detailsFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.5, delay: 0.3, ease: EASE },
  };

  return (
    <div className="themed relative min-h-dvh text-fg" style={paletteVars(recipe.palette)}>
      <AtmosphereBackground palette={recipe.palette} mood={mood} />

      <div className="fixed right-2 top-2 z-30 sm:right-5 sm:top-4">
        <LibraryButton onClick={() => setLibraryOpen(true)} />
      </div>

      <main className="mx-auto w-full max-w-[1200px] px-6 sm:px-10" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <LayoutGroup>
              {!open ? (
                /* ───────── Sugestão (fechada) ───────── */
                <section className="flex min-h-dvh flex-col items-center justify-center gap-5 py-16 text-center">
                  {image("aspect-square w-[min(70vw,36dvh,400px)]")}
                  <h1 className="max-w-xl text-balance font-serif text-3xl leading-tight sm:text-4xl">
                    {recipe.title}
                  </h1>
                  <AnimatePresence mode="wait" initial={false}>
                    {asking ? (
                      <AlternativePrompt
                        key="prompt"
                        onChoose={chooseIntent}
                        onCancel={() => setHomeState("suggestion")}
                      />
                    ) : (
                      <motion.div
                        key="actions"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center gap-5"
                      >
                        <p className="max-w-md text-balance text-lg text-muted">{recipe.description}</p>
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={openRecipe}
                            className="themed h-14 min-w-[200px] rounded-full bg-strong px-9 text-base font-medium text-paper transition-transform duration-300 hover:scale-[1.02]"
                          >
                            Ver receita
                          </button>
                          {otherLink}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              ) : desktop ? (
                /* ───────── Receita aberta — desktop 40/60 ───────── */
                <article className="grid min-h-dvh grid-cols-[2fr_3fr] gap-16 py-24">
                  <div className="flex flex-col items-start gap-5 self-start lg:sticky lg:top-24">
                    {back}
                    {image("aspect-square w-[min(100%,300px)]")}
                    <h1 className="text-balance font-serif text-3xl leading-tight">{recipe.title}</h1>
                    <motion.div {...detailsFade} className="flex flex-col items-start gap-5">
                      <RecipeMeta recipe={recipe} />
                      <FeedbackButtons key={recipe.id} onLike={like} onDislike={dislike} />
                      <div className="flex items-center gap-2">
                        {saveButton}
                        {otherLink}
                      </div>
                    </motion.div>
                  </div>
                  <motion.div {...detailsFade} className="max-w-2xl space-y-14 pt-14">
                    <Ingredients recipe={recipe} />
                    <Steps recipe={recipe} />
                  </motion.div>
                </article>
              ) : (
                /* ───────── Receita aberta — mobile / tablet (scroll natural) ───────── */
                <article className="flex flex-col items-start gap-6 py-16">
                  {back}
                  {image("aspect-square w-[min(64vw,300px)] self-center")}
                  <h1 className="text-balance font-serif text-3xl leading-tight">{recipe.title}</h1>
                  <motion.div {...detailsFade} className="flex w-full flex-col items-start gap-8">
                    <RecipeMeta recipe={recipe} />
                    <FeedbackButtons key={recipe.id} onLike={like} onDislike={dislike} />
                    <Ingredients recipe={recipe} />
                    <Steps recipe={recipe} />
                    <div className="flex w-full flex-col items-start gap-1 pb-10">
                      {saveButton}
                      {otherLink}
                    </div>
                  </motion.div>
                </article>
              )}
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>
      </main>

      <LibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} onOpenRecipe={openSaved} />
    </div>
  );
}
