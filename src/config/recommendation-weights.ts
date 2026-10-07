/**
 * Todos os pesos do motor de recomendação vivem aqui (nada hardcoded no serviço).
 * Os valores são pontos brutos; o score final é 50 + soma, limitado a 0–100.
 */
export const FEEDBACK_WEIGHTS = {
  liked: 10,
  disliked: -4,
  /** Ingrediente marcado como "não curto" em algum feedback. */
  ingredientDislike: -10,
  /** Cada ingrediente em comum com receitas curtidas / rejeitadas (limitado). */
  similarityPerTag: 2,
  similarityCap: 6,
  tooHeavy: -3,
  tooSlow: -5,
} as const;

export const MEAL_TIME_WEIGHTS = { match: 25, adjacent: 5, mismatch: -25 } as const;

export const WEATHER_WEIGHTS = {
  /** Escala máxima (±) aplicada à afinidade climática da receita. */
  scale: 12,
  hotAbove: 27,
  coldBelow: 16,
} as const;

export const PREP_TIME_WEIGHTS = {
  within: 8,
  /** Até este valor de estouro proporcional, a penalidade é linear. */
  overBase: -5,
  overMax: -12,
  peakQuickBonus: 4,
  peakQuickMinutes: 20,
  peakHours: [12, 13, 19, 20],
} as const;

export const GOAL_WEIGHTS = { scale: 10, quickMinutes: 20 } as const;

export const DIVERSITY_WEIGHTS = {
  sameRecipeRecent: -8,
  sameRecipeDays: 7,
  sameMainIngredient: -5,
  sameMainIngredientDays: 3,
  sameCuisineInARow: -3,
  neverSeenBonus: 3,
  jitter: 4,
} as const;

export const INTENT_WEIGHTS = {
  faster: { quick15: 20, quick20: 12, over30: -10 },
  lighter: { lightness: 0.3, protein: 0.1 },
  comfort: { comfort: 0.4 },
  surprise: { novelty: 0.25, neverSeen: 8 },
  /** Minutos até a intenção temporária expirar. */
  expiresMinutes: 30,
} as const;

/** Receitas abaixo disso só são sugeridas se não houver nada melhor. */
export const SCORE_THRESHOLD = 45;
