import { z } from "zod";

/**
 * Contrato do catálogo público (v1) entre o Studio (Worker) e o app Next.js.
 * Importado pelos DOIS lados. Mudanças aditivas ficam em v1; incompatíveis criam v2.
 */
export const CATALOG_SCHEMA_VERSION = 1 as const;

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;
export const DIETARY_TAGS = ["vegetarian", "vegan", "lactose-free", "gluten-free"] as const;
/** Vocabulário fechado de alérgenos (pt-BR) — decisão D-2 do plano. */
export const ALLERGENS = [
  "leite", "ovo", "glúten", "trigo", "amendoim", "castanhas", "soja", "peixe", "camarão", "frutos do mar", "gergelim",
] as const;
/** Chaves de src/data/palettes.ts */
export const PALETTE_KEYS = ["warm", "fresh", "saffron", "cozy", "morning", "berry", "sea", "tomato", "earth", "night"] as const;

const score = z.number().min(0).max(100);

export const publicRecipeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  legacyIds: z.array(z.string()),
  title: z.string().min(1),
  description: z.string(),
  /** Caminho relativo à API pública (ou URL absoluta). null = o app desenha a ilustração. */
  imageUrl: z.string().nullable(),
  prepTimeMinutes: z.number().int().positive(),
  servings: z.number().int().positive(),
  cuisine: z.string(),
  featured: z.boolean().optional(),
  mealTypes: z.array(z.enum(MEAL_TYPES)).min(1),
  dietaryTags: z.array(z.enum(DIETARY_TAGS)),
  /** [0] = ingrediente principal; inclui alérgenos pt-BR. */
  ingredientsTags: z.array(z.string().min(1)).min(1),
  /** Sempre presente. [] = revisado, nenhum declarado. */
  allergens: z.array(z.string()),
  nutrition: z
    .object({ calories: z.number().optional(), protein: z.number().optional(), carbs: z.number().optional(), fat: z.number().optional() })
    .optional(),
  traits: z.object({ comfort: score, lightness: score, protein: score, cost: score, novelty: score }),
  weatherAffinity: z.object({ hot: score, mild: score, cold: score, rainy: score }),
  paletteKey: z.enum(PALETTE_KEYS),
  ingredients: z
    .array(
      z.object({
        item: z.string().min(1),
        quantity: z.number().nonnegative().nullable(),
        unit: z.string(),
        note: z.string().optional(),
        imageUrl: z.string().nullable().optional(),
      }),
    )
    .min(1),
  steps: z.array(z.object({ number: z.number().int().positive(), instruction: z.string().min(1) })).min(1),
  publishedAt: z.string(),
});

export const catalogSchema = z.object({
  schemaVersion: z.literal(CATALOG_SCHEMA_VERSION),
  generatedAt: z.string(),
  recipes: z.array(publicRecipeSchema),
});

export type StudioPublicRecipe = z.infer<typeof publicRecipeSchema>;
export type StudioCatalog = z.infer<typeof catalogSchema>;
