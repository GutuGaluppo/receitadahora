import type { MealType } from "@/types";

export type Season = "spring" | "summer" | "fall" | "winter";

/** Refeição esperada para a hora local. */
export function mealForHour(hour: number): MealType {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "snack";
  if (hour >= 18 && hour <= 23) return "dinner";
  return "snack";
}

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Café da manhã",
  lunch: "Almoço",
  snack: "Lanche",
  dinner: "Jantar",
};

/** Estação no hemisfério sul (público-alvo: Brasil). */
export function seasonFor(date: Date): Season {
  const m = date.getMonth();
  if (m === 11 || m <= 1) return "summer";
  if (m <= 4) return "fall";
  if (m <= 7) return "winter";
  return "spring";
}
