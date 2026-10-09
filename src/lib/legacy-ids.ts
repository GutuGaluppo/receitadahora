import type { AppData } from "@/services/storage";

/**
 * Traduz ids antigos (catálogo escrito à mão) para os ids do Studio em salvos, feedback e eventos.
 * Regras:
 *  - id que já existe no catálogo, ou que não tem tradução, fica como está (pode ser uma receita temporariamente
 *    despublicada: nada do usuário é apagado — §8.4);
 *  - idempotente: aplicar de novo não muda nada;
 *  - salvos duplicados após a tradução são colapsados (mantém o `savedAt` mais antigo).
 */
export function translateLegacyIds(data: AppData, map: ReadonlyMap<string, string>): { data: AppData; changed: boolean } {
  if (map.size === 0) return { data, changed: false };
  let changed = false;
  const tr = (id: string) => {
    const next = map.get(id);
    if (next && next !== id) { changed = true; return next; }
    return id;
  };
  const saved = new Map<string, AppData["saved"][number]>();
  for (const s of data.saved) {
    const recipeId = tr(s.recipeId);
    const prev = saved.get(recipeId);
    if (prev) { changed = true; if (s.savedAt < prev.savedAt) saved.set(recipeId, { ...prev, savedAt: s.savedAt }); continue; }
    saved.set(recipeId, { ...s, recipeId });
  }
  const next: AppData = {
    ...data,
    saved: [...saved.values()],
    feedback: data.feedback.map((f) => ({ ...f, recipeId: tr(f.recipeId) })),
    events: data.events.map((e) => ({ ...e, recipeId: tr(e.recipeId) })),
  };
  return { data: changed ? next : data, changed };
}
