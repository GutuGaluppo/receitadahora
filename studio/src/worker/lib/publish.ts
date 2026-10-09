import type { RecipeFull } from "./repo";

export type Blocker = { code: string; message: string; items?: string[] };

/** Uma receita só publica com: dados válidos, imagem aprovada, ingredientes com asset aprovado e revisão aprovada. */
export function publishBlockers(r: RecipeFull): Blocker[] {
  const b: Blocker[] = [];
  const dataIssues: string[] = [];
  if (!r.name.trim()) dataIssues.push("nome");
  if (!r.slug.trim()) dataIssues.push("slug");
  if (!r.ingredients.length) dataIssues.push("ao menos 1 ingrediente");
  if (!r.instructions.length) dataIssues.push("modo de preparo");
  if (!r.category.trim()) dataIssues.push("categoria");
  if (r.prep_time + r.cook_time <= 0) dataIssues.push("tempo de preparo");
  if (dataIssues.length) b.push({ code: "invalid_data", message: "Dados incompletos.", items: dataIssues });

  // Receitas importadas do catálogo antigo (legacy_import) podem publicar sem foto: o app desenha a ilustração (decisão D-1).
  const needsImages = !r.metadata.legacy_import;
  if (needsImages) {
    if (!r.hero) b.push({ code: "no_hero", message: "A receita ainda não tem imagem principal." });
    else if (r.hero.status !== "approved") b.push({ code: "hero_not_approved", message: "A imagem principal ainda não foi aprovada." });
  }

  const missing = needsImages ? r.ingredients.filter((i) => i.asset?.status !== "approved").map((i) => i.name) : [];
  if (missing.length) {
    b.push({
      code: "ingredient_assets",
      message: `${missing.length} ${missing.length === 1 ? "ingrediente ainda não possui imagem aprovada" : "ingredientes ainda não possuem imagens aprovadas"}:`,
      items: missing,
    });
  }

  // Dado crítico de segurança alimentar: ausência é bloqueio, nunca padrão.
  const m = r.metadata;
  if (m.allergens === null) b.push({ code: "allergens_not_reviewed", message: "Revise os alérgenos antes de publicar." });
  const metaIssues: string[] = [];
  if (!m.meal_types?.length) metaIssues.push("refeições");
  if (!m.dietary_tags) metaIssues.push("dietas");
  if (!m.ingredients_tags?.length && !r.ingredients.length) metaIssues.push("ingredientes");
  if (!m.cuisine.trim()) metaIssues.push("culinária");
  if (!m.traits) metaIssues.push("perfil da receita (traits)");
  if (!m.weather_affinity) metaIssues.push("afinidade climática");
  if (!m.palette_key) metaIssues.push("paleta");
  if (metaIssues.length) b.push({ code: "metadata_incomplete", message: "Metadados de recomendação incompletos.", items: metaIssues });
  if (m.allergens !== null && !m.reviewed_at) b.push({ code: "metadata_not_confirmed", message: "Os metadados precisam de confirmação humana registrada." });

  if (r.status !== "approved") b.push({ code: "not_approved", message: "A receita precisa estar aprovada na revisão." });
  return b;
}
