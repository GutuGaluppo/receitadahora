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

  if (!r.hero) b.push({ code: "no_hero", message: "A receita ainda não tem imagem principal." });
  else if (r.hero.status !== "approved") b.push({ code: "hero_not_approved", message: "A imagem principal ainda não foi aprovada." });

  const missing = r.ingredients.filter((i) => i.asset?.status !== "approved").map((i) => i.name);
  if (missing.length) {
    b.push({
      code: "ingredient_assets",
      message: `${missing.length} ${missing.length === 1 ? "ingrediente ainda não possui imagem aprovada" : "ingredientes ainda não possuem imagens aprovadas"}:`,
      items: missing,
    });
  }

  if (r.status !== "approved") b.push({ code: "not_approved", message: "A receita precisa estar aprovada na revisão." });
  return b;
}
