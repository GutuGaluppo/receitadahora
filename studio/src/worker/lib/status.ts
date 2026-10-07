export const RECIPE_STATUSES = ["draft", "image_pending", "review", "approved", "published", "rejected"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_STATUS_LABEL: Record<RecipeStatus, string> = {
  draft: "Rascunho",
  image_pending: "Imagem pendente",
  review: "Em revisão",
  approved: "Aprovada",
  published: "Publicada",
  rejected: "Rejeitada",
};

/** Estados que o sistema recalcula sozinho. approved/published/rejected só mudam por ação humana explícita. */
const AUTO: RecipeStatus[] = ["draft", "image_pending", "review"];

export type StatusInputs = {
  status: RecipeStatus;
  hasData: boolean; // nome + ao menos 1 ingrediente e 1 passo
  hasHero: boolean;
  missingIngredientAssets: number; // sem asset aprovado
};

/**
 * draft          → dados incompletos
 * image_pending  → dados ok, mas falta imagem principal ou asset de ingrediente
 * review         → tudo no lugar, aguardando decisão humana
 */
export function computeAutoStatus(i: StatusInputs): RecipeStatus {
  if (!AUTO.includes(i.status)) return i.status;
  if (!i.hasData) return "draft";
  if (!i.hasHero || i.missingIngredientAssets > 0) return "image_pending";
  return "review";
}

export const ALLOWED_TRANSITIONS: Record<string, RecipeStatus[]> = {
  approve: ["review"],
  reject: ["review", "approved"],
  reopen: ["rejected"], // rejected → draft
  publish: ["approved"],
  unpublish: ["published"],
};
