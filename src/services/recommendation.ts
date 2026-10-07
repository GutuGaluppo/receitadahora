import {
  DIVERSITY_WEIGHTS,
  FEEDBACK_WEIGHTS,
  GOAL_WEIGHTS,
  INTENT_WEIGHTS,
  MEAL_TIME_WEIGHTS,
  PREP_TIME_WEIGHTS,
  SCORE_THRESHOLD,
  WEATHER_WEIGHTS,
} from "@/config/recommendation-weights";
import { mealForHour } from "@/lib/context";
import { norm, stem } from "@/lib/text";
import type {
  Intent,
  MealType,
  Recipe,
  RecipeFeedback,
  RecommendationContext,
  RecommendationEvent,
  UserTasteProfile,
  WeatherContext,
} from "@/types";

const DAY = 86_400_000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ───────────── Restrições obrigatórias (hard stop) ───────────── */

function recipeHasTerm(recipe: Recipe, term: string): boolean {
  const t = stem(term);
  if (!t) return false;
  const haystack = [...recipe.ingredientsTags, ...recipe.ingredients.map((i) => i.item)].map(norm);
  return haystack.some((h) => h.includes(t));
}

export function isValidRecipe(
  recipe: Recipe,
  profile: Pick<UserTasteProfile, "allergies" | "excludedIngredients" | "dietaryPreferences">,
): boolean {
  if (!recipe.active) return false;
  if (profile.allergies.some((a) => recipeHasTerm(recipe, a))) return false;
  if (profile.excludedIngredients.some((e) => recipeHasTerm(recipe, e))) return false;
  for (const diet of profile.dietaryPreferences) {
    // vegano também é vegetariano
    const ok =
      diet === "vegetarian"
        ? recipe.dietaryTags.includes("vegetarian") || recipe.dietaryTags.includes("vegan")
        : recipe.dietaryTags.includes(diet);
    if (!ok) return false;
  }
  return true;
}

/* ───────────── Componentes de score (pontos brutos) ───────────── */

const ADJACENT: Record<MealType, MealType[]> = {
  breakfast: ["snack"],
  lunch: ["dinner", "snack"],
  snack: ["breakfast", "lunch"],
  dinner: ["lunch"],
};

export function mealTimeScore(hour: number, mealType: MealType | MealType[]): number {
  const types = Array.isArray(mealType) ? mealType : [mealType];
  const expected = mealForHour(hour);
  if (types.includes(expected)) return MEAL_TIME_WEIGHTS.match;
  if (types.some((t) => ADJACENT[expected].includes(t))) return MEAL_TIME_WEIGHTS.adjacent;
  return MEAL_TIME_WEIGHTS.mismatch;
}

export function weatherScore(recipe: Recipe, weather: WeatherContext | null): number {
  if (!weather) return 0;
  const { hotAbove, coldBelow, scale } = WEATHER_WEIGHTS;
  const feel = weather.feelsLike ?? weather.temperature;
  const bucket = feel >= hotAbove ? "hot" : feel < coldBelow ? "cold" : "mild";
  let affinity = recipe.weatherAffinity[bucket];
  if (weather.condition === "rain" || weather.condition === "storm" || weather.condition === "snow") {
    affinity = Math.max(affinity, recipe.weatherAffinity.rainy);
  }
  return ((affinity - 50) / 50) * scale;
}

export function prepTimeScore(userPrefTime: number | null, recipeTime: number, hour: number): number {
  const w = PREP_TIME_WEIGHTS;
  let score = 0;
  if (userPrefTime) {
    if (recipeTime <= userPrefTime) score += w.within;
    else {
      const over = clamp((recipeTime - userPrefTime) / userPrefTime, 0, 1);
      score += w.overBase + (w.overMax - w.overBase) * over;
    }
  }
  if ((w.peakHours as readonly number[]).includes(hour) && recipeTime <= w.peakQuickMinutes) {
    score += w.peakQuickBonus;
  }
  return score;
}

export function goalScore(goals: UserTasteProfile["goals"], recipe: Recipe): number {
  if (!goals.length) return 0;
  const signal = (g: string): number => {
    switch (g) {
      case "protein":
        return recipe.traits.protein / 100;
      case "quick":
        return recipe.prepTimeMinutes <= GOAL_WEIGHTS.quickMinutes ? 1 : 0;
      case "save":
        return 1 - recipe.traits.cost / 100;
      case "eat-better":
        return recipe.traits.lightness / 100;
      case "explore":
        return recipe.traits.novelty / 100;
      default:
        return 0.5;
    }
  };
  const avg = goals.reduce((s, g) => s + signal(g), 0) / goals.length;
  return (avg - 0.5) * 2 * GOAL_WEIGHTS.scale;
}

type History = {
  feedback: RecipeFeedback[];
  events: RecommendationEvent[];
};

export function tasteScore(recipe: Recipe, recipes: Recipe[], feedback: RecipeFeedback[]): number {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const latest = new Map<string, RecipeFeedback>();
  for (const f of feedback) latest.set(f.recipeId, f); // último feedback vence
  let score = 0;
  const own = latest.get(recipe.id);
  if (own?.type === "liked") score += FEEDBACK_WEIGHTS.liked;
  if (own?.type === "disliked") score += FEEDBACK_WEIGHTS.disliked;

  const tags = new Set(recipe.ingredientsTags);
  let likedOverlap = 0;
  let dislikedOverlap = 0;
  for (const [id, f] of latest) {
    if (id === recipe.id) continue;
    const other = byId.get(id);
    if (!other) continue;
    const shared = other.ingredientsTags.filter((t) => tags.has(t)).length;
    if (f.type === "liked") likedOverlap += shared;
    else dislikedOverlap += shared;
  }
  const { similarityPerTag: per, similarityCap: cap } = FEEDBACK_WEIGHTS;
  score += Math.min(cap, likedOverlap * per) - Math.min(cap, dislikedOverlap * per);
  return score;
}

/** Penalidades vindas dos motivos e dos ingredientes recusados em feedbacks. */
export function feedbackScore(recipe: Recipe, recipes: Recipe[], feedback: RecipeFeedback[]): number {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const latest = new Map<string, RecipeFeedback>();
  for (const f of feedback) latest.set(f.recipeId, f);
  let score = 0;
  let heavyHits = 0;
  let slowHits = 0;
  for (const f of latest.values()) {
    if (f.type !== "disliked" || f.recipeId === recipe.id) continue;
    const other = byId.get(f.recipeId);
    if (!other) continue;
    if (f.reason === "ingredients") {
      const main = other.ingredientsTags[0];
      if (main && recipe.ingredientsTags.includes(main)) score += FEEDBACK_WEIGHTS.ingredientDislike;
    }
    if (f.reason === "too-heavy" && recipe.traits.lightness < other.traits.lightness) heavyHits++;
    if (f.reason === "too-slow" && recipe.prepTimeMinutes >= other.prepTimeMinutes) slowHits++;
  }
  score += Math.min(2, heavyHits) * FEEDBACK_WEIGHTS.tooHeavy;
  score += Math.min(2, slowHits) * FEEDBACK_WEIGHTS.tooSlow;
  return score;
}

export function noveltyScore(
  recipe: Recipe,
  recipes: Recipe[],
  events: RecommendationEvent[],
  now: number,
): number {
  const d = DIVERSITY_WEIGHTS;
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const shown = events
    .filter((e) => e.eventType === "recipe_shown")
    .map((e) => ({ recipe: byId.get(e.recipeId), at: new Date(e.createdAt).getTime() }))
    .filter((e): e is { recipe: Recipe; at: number } => !!e.recipe)
    .sort((a, b) => b.at - a.at);

  let score = 0;
  if (!shown.some((s) => s.recipe.id === recipe.id)) score += d.neverSeenBonus;
  if (shown.some((s) => s.recipe.id === recipe.id && now - s.at < d.sameRecipeDays * DAY)) {
    score += d.sameRecipeRecent;
  }
  const main = recipe.ingredientsTags[0];
  if (
    main &&
    shown.some(
      (s) =>
        s.recipe.id !== recipe.id &&
        s.recipe.ingredientsTags[0] === main &&
        now - s.at < d.sameMainIngredientDays * DAY,
    )
  ) {
    score += d.sameMainIngredient;
  }
  // evita a mesma culinária em sugestões seguidas
  const last = shown.find((s) => s.recipe.id !== recipe.id)?.recipe;
  if (last && last.cuisine === recipe.cuisine) score += d.sameCuisineInARow;
  return score;
}

export function intentionalPreferenceScore(
  recipe: Recipe,
  intent: Intent | null,
  neverSeen: boolean,
): number {
  const w = INTENT_WEIGHTS;
  switch (intent) {
    case "faster":
      if (recipe.prepTimeMinutes <= 15) return w.faster.quick15;
      if (recipe.prepTimeMinutes <= 20) return w.faster.quick20;
      return recipe.prepTimeMinutes > 30 ? w.faster.over30 : 0;
    case "lighter":
      return (
        (recipe.traits.lightness - 50) * w.lighter.lightness +
        (recipe.traits.protein - 50) * w.lighter.protein
      );
    case "comfort":
      return (recipe.traits.comfort - 50) * w.comfort.comfort;
    case "surprise":
      return recipe.traits.novelty * w.surprise.novelty + (neverSeen ? w.surprise.neverSeen : 0);
    default:
      return 0;
  }
}

/* ───────────── Ranking ───────────── */

export type RecommendInput = {
  recipes: Recipe[];
  profile: UserTasteProfile;
  context: RecommendationContext;
  intent?: Intent | null;
  history?: Partial<History>;
  /** Receitas a evitar nesta chamada (ex.: a que está na tela). */
  excludeIds?: string[];
  /** Injetável para testes. */
  random?: () => number;
};

export type ScoredRecipe = { recipe: Recipe; score: number };

export function rankRecipes(input: RecommendInput): ScoredRecipe[] {
  const { recipes, profile, context, intent = null } = input;
  const feedback = input.history?.feedback ?? [];
  const events = input.history?.events ?? [];
  const random = input.random ?? Math.random;
  const hour = context.now.getHours();
  const now = context.now.getTime();
  const seenIds = new Set(events.filter((e) => e.eventType === "recipe_shown").map((e) => e.recipeId));

  return recipes
    .filter((r) => !input.excludeIds?.includes(r.id) && isValidRecipe(r, profile))
    .map((recipe) => {
      const raw =
        mealTimeScore(hour, recipe.mealTypes) +
        weatherScore(recipe, context.weather) +
        prepTimeScore(profile.usualPrepTime, recipe.prepTimeMinutes, hour) +
        goalScore(profile.goals, recipe) +
        tasteScore(recipe, recipes, feedback) +
        feedbackScore(recipe, recipes, feedback) +
        noveltyScore(recipe, recipes, events, now) +
        intentionalPreferenceScore(recipe, intent, !seenIds.has(recipe.id)) +
        random() * DIVERSITY_WEIGHTS.jitter;
      return { recipe, score: clamp(50 + raw, 0, 100) };
    })
    .sort((a, b) => b.score - a.score);
}

/** TOP 1. Prefere quem passa do limiar; sem ninguém acima, devolve o melhor disponível. */
export function recommend(input: RecommendInput): Recipe | null {
  const ranked = rankRecipes(input);
  return (ranked.find((r) => r.score >= SCORE_THRESHOLD) ?? ranked[0])?.recipe ?? null;
}
