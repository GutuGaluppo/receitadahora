import { z } from "zod";
import type { UserTasteProfile } from "@/types";

const mealType = z.enum(["breakfast", "lunch", "snack", "dinner"]);

const profileSchema = z.object({
  id: z.string(),
  dietaryPreferences: z.array(z.enum(["vegetarian", "vegan", "lactose-free", "gluten-free"])),
  excludedIngredients: z.array(z.string()),
  allergies: z.array(z.string()),
  goals: z.array(z.enum(["eat-better", "protein", "save", "quick", "explore"])).max(3),
  usualPrepTime: z.number().nullable(),
  householdSize: z.number().int().min(1),
  usualMealTimes: z.array(mealType),
  city: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  weatherEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const appDataSchema = z.object({
  version: z.literal(1),
  profile: profileSchema.nullable(),
  onboarded: z.boolean(),
  saved: z.array(z.object({ id: z.string(), userId: z.string(), recipeId: z.string(), savedAt: z.string() })),
  feedback: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      recipeId: z.string(),
      type: z.enum(["liked", "disliked"]),
      reason: z.enum(["too-slow", "too-heavy", "ingredients", "not-now"]).optional(),
      contextSnapshot: z.object({ hour: z.number(), dayOfWeek: z.number(), weather: z.string().optional() }),
      createdAt: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      recipeId: z.string(),
      eventType: z.enum([
        "recipe_shown",
        "recipe_opened",
        "recipe_skipped",
        "recipe_saved",
        "recipe_liked",
        "recipe_disliked",
        "recipe_cooked",
      ]),
      createdAt: z.string(),
    }),
  ),
});

export type AppData = z.infer<typeof appDataSchema>;

const KEY = "receita-da-hora:v1";
export const MAX_EVENTS = 500;

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function emptyData(): AppData {
  return { version: 1, profile: null, onboarded: false, saved: [], feedback: [], events: [] };
}

export function defaultProfile(id = uid()): UserTasteProfile {
  const now = new Date().toISOString();
  return {
    id,
    dietaryPreferences: [],
    excludedIngredients: [],
    allergies: [],
    goals: [],
    usualPrepTime: null,
    householdSize: 2,
    usualMealTimes: ["lunch", "dinner"],
    weatherEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
}

/** Perfil neutro e estático, usado antes da hidratação (sem Date/random no render). */
export const FALLBACK_PROFILE: UserTasteProfile = {
  id: "anon",
  dietaryPreferences: [],
  excludedIngredients: [],
  allergies: [],
  goals: [],
  usualPrepTime: null,
  householdSize: 2,
  usualMealTimes: ["lunch", "dinner"],
  weatherEnabled: true,
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/**
 * Repositório local-first. A interface (load/save/clear) é a fronteira para trocar
 * por Supabase depois (ver supabase/schema.sql) sem mexer nos componentes.
 */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = appDataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyData();
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, events: data.events.slice(-MAX_EVENTS) }));
  } catch {
    // armazenamento cheio/bloqueado: o app continua funcionando em memória
  }
}

export function clearData(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("receita-da-hora:weather");
  } catch {
    /* noop */
  }
}
