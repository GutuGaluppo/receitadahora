import { z } from "zod";
import { ALLERGENS, DIETARY_TAGS, MEAL_TYPES, PALETTE_KEYS } from "@contracts/catalog";

const score = z.number().int().min(0).max(100);

/** Metadados de recomendação. Enviar este corpo é a confirmação humana (carimba revisor e data). */
export const metadataInput = z.object({
  meal_types: z.array(z.enum(MEAL_TYPES)).min(1, "Escolha ao menos uma refeição."),
  dietary_tags: z.array(z.enum(DIETARY_TAGS)),
  /** Lista fechada (D-2). [] = revisado, nenhum alérgeno. Não existe "null" no envio: ausência é bloqueio. */
  allergens: z.array(z.enum(ALLERGENS)),
  /** Termos extras (pt-BR) que complementam os ingredientes. [0] = ingrediente principal. */
  ingredients_tags: z.array(z.string().trim().min(1).max(60)).max(30),
  cuisine: z.string().trim().min(1).max(60),
  traits: z.object({ comfort: score, lightness: score, protein: score, cost: score, novelty: score }),
  weather_affinity: z.object({ hot: score, mild: score, cold: score, rainy: score }),
  palette_key: z.enum(PALETTE_KEYS),
  nutrition: z
    .object({ calories: z.number().nonnegative().optional(), protein: z.number().nonnegative().optional(), carbs: z.number().nonnegative().optional(), fat: z.number().nonnegative().optional() })
    .nullable()
    .default(null),
  featured: z.boolean().default(false),
  legacy_ids: z.array(z.string().trim().min(1).max(128)).max(10).default([]),
});
export type MetadataInput = z.infer<typeof metadataInput>;

export type RecipeMetadata = {
  meal_types: string[] | null;
  dietary_tags: string[] | null;
  /** null = NÃO revisado (bloqueia publicação); [] = revisado, nenhum. */
  allergens: string[] | null;
  ingredients_tags: string[] | null;
  cuisine: string;
  traits: MetadataInput["traits"] | null;
  weather_affinity: MetadataInput["weather_affinity"] | null;
  palette_key: string | null;
  nutrition: MetadataInput["nutrition"];
  featured: boolean;
  legacy_ids: string[];
  legacy_import: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export const parseJson = <T>(s: string | null | undefined, fallback: T): T => {
  if (s == null) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
};

/** Rubrica exibida no formulário: âncoras 0–100 (D-4). */
export const TRAIT_RUBRIC = {
  comfort: ["Prato frio e leve", "Prato quente e denso"],
  lightness: ["Pesado, muito calórico", "Leve, fresco"],
  protein: ["Quase sem proteína", "Proteína é a estrela"],
  cost: ["Barata (ingredientes de despensa)", "Cara (cortes/ingredientes especiais)"],
  novelty: ["Clássico do dia a dia", "Técnica ou combinação inusitada"],
} as const;
