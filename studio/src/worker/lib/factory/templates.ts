import { now } from "../ids";
import { NEGATIVE_PROMPT, presentationFor, seasonalMood } from "../prompt";

/* Prompts críticos vivem aqui e no D1, versionados — nunca em componentes de UI (§5). */

export type TemplateType = "recipe" | "recipe_image" | "ingredient_image" | "description" | "metadata";
export type TemplateRow = { id: string; name: string; type: TemplateType; version: string; prompt: string; is_active: number; created_at: string; updated_at: string };

type Default = { id: string; name: string; type: TemplateType; version: string; prompt: string };

const RECIPE_PROMPT = `You are the recipe editor of "Receita da Hora", a Brazilian home-cooking app.
Write practical, believable home recipes in Brazilian Portuguese (pt-BR).

Constraints (JSON):
{{context}}

Rules:
- Return EXCLUSIVELY valid JSON. No prose, no markdown fences.
- Never repeat or closely imitate any name in "existing_recipe_names".
- Prefer ingredients from "existing_ingredients" and use their exact names. Introduce new ingredients only when the recipe needs them.
- Respect max_time (prep_time + cook_time), difficulty, restrictions and avoid_ingredients.
- difficulty is one of: easy, medium, hard.
- quantity is a string ("200", "1/2", "a gosto"); unit may be empty.

Output format:
{"recipes":[{"name":"","description":"","category":"","prep_time":0,"cook_time":0,"servings":0,"difficulty":"easy","ingredients":[{"name":"","quantity":"","unit":"","note":""}],"instructions":[],"tags":[]}]}`;

const DESCRIPTION_PROMPT = `Rewrite only the description of this recipe in pt-BR: one or two warm, concrete sentences, no marketing clichés, max 200 characters.
Recipe: {{name}} ({{category}})
Ingredients: {{ingredients}}
Return JSON: {"description":""}`;

const METADATA_PROMPT = `Rewrite only the preparation steps of this recipe in pt-BR: short imperative steps, in order, no numbering.
Recipe: {{name}} ({{category}})
Ingredients: {{ingredients}}
Current steps: {{instructions}}
Return JSON: {"instructions":[]}`;

// Recipe Photography System (docs/RECIPE_PHOTOGRAPHY_SYSTEM_v0.1.md): base visual + dish + composição + restrições
const RECIPE_IMAGE_PROMPT = `Premium editorial food photography for the Receita da Hora recipe app.

Dish:
{{name}}

Description:
{{description}}

Main visible ingredients:
{{ingredients}}

Presentation:
{{presentation}}

Seasonal mood:
{{mood}}

Create a realistic homemade dish presented beautifully but naturally.

Visual identity:
warm cream and beige background, soft natural side lighting, subtle shallow depth of field, premium editorial food photography, minimal composition, natural ceramic tableware, warm earthy color palette, highly appetizing but believable, clean background, soft shadows.

The dish must be the visual protagonist.
Include only ingredients that are part of the recipe.
A few ingredients may appear naturally around the dish or subtly suspended in the scene (3–6 elements at most).
The food should look achievable in a normal home kitchen.

Composition must support cropping to: 4:3, 16:10, 4:5, 1:1.

Negative constraints:
{{negative}}`;

const INGREDIENT_IMAGE_PROMPT = `Premium editorial food photography of a single ingredient: {{name}}.

Isolated on a warm cream/beige background, soft natural side lighting, subtle shallow depth of field, natural and realistic, centered with generous margin, soft shadows, minimal composition.
Fresh and believable, the way it looks in a Brazilian home kitchen.

Negative constraints:
{{negative}}`;

export const DEFAULT_TEMPLATES: Default[] = [
  { id: "template_recipe_v1", name: "recipe-generation", type: "recipe", version: "v1", prompt: RECIPE_PROMPT },
  { id: "template_description_v1", name: "recipe-description", type: "description", version: "v1", prompt: DESCRIPTION_PROMPT },
  { id: "template_metadata_v1", name: "recipe-instructions", type: "metadata", version: "v1", prompt: METADATA_PROMPT },
  { id: "template_recipe_image_v01", name: "recipe-photography", type: "recipe_image", version: "v0.1", prompt: RECIPE_IMAGE_PROMPT },
  { id: "template_ingredient_image_v01", name: "ingredient-photography", type: "ingredient_image", version: "v0.1", prompt: INGREDIENT_IMAGE_PROMPT },
];

/** Garante os templates padrão no D1 (idempotente). Não mexe em templates que o usuário versionou. */
export async function ensureTemplates(db: D1Database) {
  const t = now();
  await db.batch(
    DEFAULT_TEMPLATES.map((d) =>
      db
        .prepare("INSERT OR IGNORE INTO generation_templates (id, name, type, version, prompt, is_active, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)")
        .bind(d.id, d.name, d.type, d.version, d.prompt, t, t),
    ),
  );
}

export async function activeTemplate(db: D1Database, type: TemplateType): Promise<TemplateRow> {
  await ensureTemplates(db);
  const row = await db.prepare("SELECT * FROM generation_templates WHERE type = ? AND is_active = 1 ORDER BY created_at DESC, version DESC LIMIT 1").bind(type).first<TemplateRow>();
  if (!row) throw new Error(`Nenhum template ativo do tipo ${type}.`);
  return row;
}

export function render(prompt: string, vars: Record<string, string>): string {
  return prompt.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
}

/** Prompt de imagem da receita montado por template + dados da receita (§20). Nunca escrito à mão. */
export function composeRecipeImagePrompt(t: Pick<TemplateRow, "prompt">, r: { name: string; description: string; category: string; visual_ingredients: string[] }) {
  return render(t.prompt, {
    name: r.name,
    description: r.description || r.name,
    ingredients: r.visual_ingredients.join(", ") || "(define visual ingredients first)",
    presentation: presentationFor(r.category, r.name),
    mood: seasonalMood(),
    negative: NEGATIVE_PROMPT.join(", "),
  });
}

export function composeIngredientImagePrompt(t: Pick<TemplateRow, "prompt">, ing: { name: string }) {
  return render(t.prompt, { name: ing.name, negative: NEGATIVE_PROMPT.join(", ") });
}
