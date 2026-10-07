import { ingredientKey, similarity, slugify } from "./text";

export type IngredientRef = { id: string; name: string; slug: string; key: string; aliasKeys: string[] };

export type MatchResult =
  | { kind: "exact"; ingredient: IngredientRef; via: "name" | "alias" | "slug" }
  | { kind: "possible"; candidates: { ingredient: IngredientRef; score: number }[] }
  | { kind: "none" };

const POSSIBLE_THRESHOLD = 0.8;

export function toRef(row: { id: string; name: string; slug: string; normalized_name: string }, aliasKeys: string[]): IngredientRef {
  return { id: row.id, name: row.name, slug: row.slug, key: row.normalized_name, aliasKeys };
}

/**
 * 1. nome normalizado  2. alias  3. slug  4. parecido (pergunta ao humano).
 * "Tomates", "tomate fresco" → mesmo ingrediente; "Pimentão vermelho" vs "Pimentão" → dúvida.
 */
export function matchIngredient(rawName: string, library: IngredientRef[]): MatchResult {
  const key = ingredientKey(rawName);
  if (!key) return { kind: "none" };
  const slug = slugify(rawName);

  for (const ing of library) if (ing.key === key) return { kind: "exact", ingredient: ing, via: "name" };
  for (const ing of library) if (ing.aliasKeys.includes(key)) return { kind: "exact", ingredient: ing, via: "alias" };
  for (const ing of library) if (ing.slug === slug) return { kind: "exact", ingredient: ing, via: "slug" };

  const keyTokens = key.split(" ");
  const scored = library
    .map((ing) => {
      let best = 0;
      for (const k of [ing.key, ...ing.aliasKeys]) {
        let s = similarity(key, k);
        // um nome contém o outro ("azeite" ⊂ "azeite oliva"), compartilhando uma palavra significativa
        const kt = k.split(" ");
        const shared = keyTokens.filter((t) => kt.includes(t) && t.length >= 4);
        if (shared.length && (keyTokens.every((t) => kt.includes(t)) || kt.every((t) => keyTokens.includes(t)))) s = Math.max(s, 0.85);
        best = Math.max(best, s);
      }
      return { ingredient: ing, score: best };
    })
    .filter((c) => c.score >= POSSIBLE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.length ? { kind: "possible", candidates: scored } : { kind: "none" };
}
