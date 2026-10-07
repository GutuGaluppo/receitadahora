import type { DietaryPreference, Goal } from "@/types";

export const DIET_OPTIONS: { id: DietaryPreference; label: string }[] = [
  { id: "vegetarian", label: "Vegetariano" },
  { id: "vegan", label: "Vegano" },
  { id: "lactose-free", label: "Sem lactose" },
  { id: "gluten-free", label: "Sem glúten" },
];

export const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: "eat-better", label: "Comer melhor" },
  { id: "protein", label: "Mais proteína" },
  { id: "save", label: "Economizar" },
  { id: "quick", label: "Cozinhar rápido" },
  { id: "explore", label: "Experimentar coisas novas" },
];

export const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10 minutos" },
  { value: 20, label: "20 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 45, label: "45+ minutos" },
];

export const MEAL_OPTIONS = [
  { id: "breakfast", label: "Café da manhã" },
  { id: "lunch", label: "Almoço" },
  { id: "snack", label: "Café da tarde" },
  { id: "dinner", label: "Jantar" },
] as const;

export const MAX_GOALS = 3;
