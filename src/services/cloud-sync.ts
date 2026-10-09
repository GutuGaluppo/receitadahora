import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_EVENTS, type AppData } from "@/services/storage";
import type { RecommendationEvent, RecipeFeedback, SavedRecipe, UserTasteProfile } from "@/types";

/**
 * Sincronização local-first com o Supabase (plano §9.2). Tudo é idempotente:
 *  - saved_recipes: unique (user_id, recipe_id);  feedback/eventos: `id` gerado no cliente + on conflict do nothing.
 *  - nunca apaga o localStorage; quem decide substituir o estado local é o chamador, só após sucesso.
 */

export type Known = { saved: Set<string>; feedback: Set<string>; events: Set<string>; profileStamp: string | null };
export const emptyKnown = (): Known => ({ saved: new Set(), feedback: new Set(), events: new Set(), profileStamp: null });

type ProfileRow = {
  id: string; dietary_preferences: string[]; excluded_ingredients: string[]; allergies: string[]; goals: string[]; usual_prep_time: number | null;
  household_size: number; usual_meal_times: string[]; city: string | null; country: string | null; timezone: string | null;
  weather_enabled: boolean; onboarded: boolean; created_at: string; updated_at: string;
};

const CHUNK = 500;
const chunks = <T>(xs: T[]): T[][] => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK));

export const profileToRow = (p: UserTasteProfile, userId: string, onboarded: boolean) => ({
  id: userId, dietary_preferences: p.dietaryPreferences, excluded_ingredients: p.excludedIngredients, allergies: p.allergies, goals: p.goals,
  usual_prep_time: p.usualPrepTime, household_size: p.householdSize, usual_meal_times: p.usualMealTimes, city: p.city ?? null,
  country: p.country ?? null, timezone: p.timezone ?? null, weather_enabled: p.weatherEnabled, onboarded,
});

export const rowToProfile = (r: ProfileRow): UserTasteProfile => ({
  id: r.id, dietaryPreferences: r.dietary_preferences as UserTasteProfile["dietaryPreferences"], excludedIngredients: r.excluded_ingredients,
  allergies: r.allergies, goals: r.goals as UserTasteProfile["goals"], usualPrepTime: r.usual_prep_time, householdSize: r.household_size,
  usualMealTimes: r.usual_meal_times as UserTasteProfile["usualMealTimes"], ...(r.city ? { city: r.city } : {}), ...(r.country ? { country: r.country } : {}),
  ...(r.timezone ? { timezone: r.timezone } : {}), weatherEnabled: r.weather_enabled, createdAt: r.created_at, updatedAt: r.updated_at,
});

export type Remote = { profile: ProfileRow | null; saved: SavedRecipe[]; feedback: RecipeFeedback[]; events: RecommendationEvent[] };

export async function fetchRemote(sb: SupabaseClient, userId: string): Promise<Remote> {
  const [p, s, f, e] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
    sb.from("saved_recipes").select("id, recipe_id, saved_at").eq("user_id", userId),
    sb.from("recipe_feedback").select("id, recipe_id, type, reason, context_snapshot, created_at").eq("user_id", userId),
    sb.from("recommendation_events").select("id, recipe_id, event_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_EVENTS),
  ]);
  for (const r of [p, s, f, e]) if (r.error) throw new Error(r.error.message);
  return {
    profile: (p.data as ProfileRow | null) ?? null,
    saved: (s.data ?? []).map((r) => ({ id: r.id, userId, recipeId: r.recipe_id, savedAt: r.saved_at })),
    feedback: (f.data ?? []).map((r) => ({
      id: r.id, userId, recipeId: r.recipe_id, type: r.type, ...(r.reason ? { reason: r.reason } : {}), contextSnapshot: r.context_snapshot, createdAt: r.created_at,
    })),
    events: (e.data ?? []).map((r) => ({ id: r.id, userId, recipeId: r.recipe_id, eventType: r.event_type, createdAt: r.created_at })).reverse(),
  };
}

const byCreated = <T extends { createdAt: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt);

/**
 * Primeira migração (nunca migrou este usuário): UNIÃO local + remoto.
 *  - perfil: se o servidor já tem onboarded=true, o servidor vence; senão o local sobe;
 *  - salvos: o `saved_at` mais antigo vence; feedback e eventos: união por id.
 * Depois de migrado (`remoteIsTruth`), o servidor é a fonte da verdade (para remoções feitas em outro dispositivo valerem).
 */
export function mergeData(local: AppData, remote: Remote, userId: string, remoteIsTruth: boolean): AppData {
  const serverOnboarded = !!remote.profile?.onboarded;
  const profile = serverOnboarded && remote.profile ? rowToProfile(remote.profile) : local.profile ? { ...local.profile, id: userId } : null;

  const saved = new Map<string, SavedRecipe>();
  for (const s of remoteIsTruth ? remote.saved : [...remote.saved, ...local.saved.map((x) => ({ ...x, userId }))]) {
    const prev = saved.get(s.recipeId);
    if (!prev || s.savedAt < prev.savedAt) saved.set(s.recipeId, s);
  }
  const union = <T extends { id: string; createdAt: string }>(a: T[], b: T[]) => [...new Map([...a, ...b].map((x) => [x.id, x])).values()].sort(byCreated);
  const feedback = remoteIsTruth ? remote.feedback : union(remote.feedback, local.feedback.map((x) => ({ ...x, userId })));
  const events = (remoteIsTruth ? remote.events : union(remote.events, local.events.map((x) => ({ ...x, userId })))).slice(-MAX_EVENTS);

  return { version: 1, profile, onboarded: serverOnboarded || local.onboarded, saved: [...saved.values()], feedback, events };
}

export const knownFrom = (d: AppData, serverStamp: string | null): Known => ({
  saved: new Set(d.saved.map((s) => s.recipeId)),
  feedback: new Set(d.feedback.map((f) => f.id)),
  events: new Set(d.events.map((e) => e.id)),
  profileStamp: serverStamp,
});

const stampOf = (d: AppData) => (d.profile ? `${d.profile.updatedAt}|${d.onboarded}` : null);

/** Envia só o que o servidor ainda não conhece. Devolve o novo `Known` (ou lança, mantendo o anterior para nova tentativa). */
export async function pushDiff(sb: SupabaseClient, userId: string, known: Known, d: AppData): Promise<Known> {
  const upsert = async (table: string, rows: object[], onConflict: string) => {
    for (const part of chunks(rows)) {
      const { error } = await sb.from(table).upsert(part, { onConflict, ignoreDuplicates: true });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  const newSaved = d.saved.filter((s) => !known.saved.has(s.recipeId));
  const currentSaved = new Set(d.saved.map((s) => s.recipeId));
  const removed = [...known.saved].filter((id) => !currentSaved.has(id));
  const newFeedback = d.feedback.filter((f) => !known.feedback.has(f.id));
  const newEvents = d.events.filter((e) => !known.events.has(e.id));

  const stamp = stampOf(d);
  if (d.profile && stamp !== known.profileStamp) {
    const { error } = await sb.from("profiles").upsert(profileToRow(d.profile, userId, d.onboarded), { onConflict: "id" });
    if (error) throw new Error(`profiles: ${error.message}`);
  }
  await upsert("saved_recipes", newSaved.map((s) => ({ id: s.id, user_id: userId, recipe_id: s.recipeId, saved_at: s.savedAt })), "user_id,recipe_id");
  for (const part of chunks(removed)) {
    const { error } = await sb.from("saved_recipes").delete().eq("user_id", userId).in("recipe_id", part);
    if (error) throw new Error(`saved_recipes: ${error.message}`);
  }
  await upsert("recipe_feedback", newFeedback.map((f) => ({ id: f.id, user_id: userId, recipe_id: f.recipeId, type: f.type, reason: f.reason ?? null, context_snapshot: f.contextSnapshot, created_at: f.createdAt })), "id");
  await upsert("recommendation_events", newEvents.map((e) => ({ id: e.id, user_id: userId, recipe_id: e.recipeId, event_type: e.eventType, created_at: e.createdAt })), "id");

  return knownFrom(d, stamp);
}

/** Apaga o histórico de eventos da própria pessoa (política RLS de delete). */
export async function deleteMyEvents(sb: SupabaseClient, userId: string) {
  const { error } = await sb.from("recommendation_events").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Exportação LGPD: tudo que o servidor guarda sobre a pessoa. */
export async function exportMyData(sb: SupabaseClient, userId: string) {
  const [profile, saved, feedback, events] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).maybeSingle(),
    sb.from("saved_recipes").select("*").eq("user_id", userId),
    sb.from("recipe_feedback").select("*").eq("user_id", userId),
    sb.from("recommendation_events").select("*").eq("user_id", userId),
  ]);
  for (const r of [profile, saved, feedback, events]) if (r.error) throw new Error(r.error.message);
  return { exportedAt: new Date().toISOString(), profile: profile.data, saved: saved.data, feedback: feedback.data, events: events.data };
}


/** "Apagar meus dados" com sessão ativa: limpa também o servidor (salvos, feedback, eventos) e zera o perfil. */
export async function eraseRemote(sb: SupabaseClient, userId: string) {
  for (const table of ["saved_recipes", "recipe_feedback", "recommendation_events"]) {
    const { error } = await sb.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const { error } = await sb.from("profiles").upsert(profileToRow(emptyProfile(userId), userId, false), { onConflict: "id" });
  if (error) throw new Error(`profiles: ${error.message}`);
}

const emptyProfile = (userId: string): UserTasteProfile => {
  const now = new Date().toISOString();
  return { id: userId, dietaryPreferences: [], excludedIngredients: [], allergies: [], goals: [], usualPrepTime: null, householdSize: 2, usualMealTimes: ["lunch", "dinner"], weatherEnabled: true, createdAt: now, updatedAt: now };
};

/** `Known` do que o servidor já tem (antes de enviar a união). */
export function knownFromRemote(r: Remote): Known {
  return {
    saved: new Set(r.saved.map((s) => s.recipeId)),
    feedback: new Set(r.feedback.map((f) => f.id)),
    events: new Set(r.events.map((e) => e.id)),
    // se o servidor já tem um perfil onboarded, o merge o adota e não há o que enviar
    profileStamp: r.profile?.onboarded ? `${r.profile.updated_at}|true` : null,
  };
}
