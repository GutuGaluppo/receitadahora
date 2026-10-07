/** Prompt oficial do Recipe Photography System v0.1 (docs/RECIPE_PHOTOGRAPHY_SYSTEM_v0.1.md). */

export const NEGATIVE_PROMPT = [
  "people", "hands", "cutlery clutter", "restaurant scene", "busy kitchen", "table decorations", "flowers",
  "random garnish", "ingredients not present in recipe", "extreme saturation", "plastic-looking food", "unrealistic food",
  "perfect symmetry", "dark dramatic lighting", "hard shadows", "flash photography", "stock photography",
  "overhead flat lay", "text", "logos", "watermarks",
];

const PRESENTATION: [RegExp, string][] = [
  [/massa|pasta|macarr/i, "served in a shallow warm-white ceramic bowl"],
  [/sopa|caldo|creme/i, "served in a deep warm-white ceramic bowl, surface partly visible"],
  [/salada/i, "served in a wide ceramic bowl, greens clearly identifiable"],
  [/curry|moqueca|ensopado/i, "served in a deep ceramic bowl, generous sauce, ingredients partly emerging"],
  [/sandu|burger|wrap|torrada/i, "3/4 side view focusing on the layers, on a small ceramic plate"],
  [/sobremesa|doce|bolo/i, "on a small ceramic plate, slightly softer light"],
];

function seasonalMood(date = new Date()): string {
  const m = date.getMonth(); // hemisfério sul
  if (m === 11 || m <= 1) return "bright summer light, fresh colors";
  if (m <= 4) return "cozy autumn, terracotta and pumpkin tones, warm light";
  if (m <= 7) return "winter comfort, amber tones, dense and warm";
  return "spring freshness, light greens, slightly lighter background";
}

export type PromptInput = {
  name: string;
  description: string;
  category: string;
  visualIngredients: string[];
  presentation?: string;
  seasonalMood?: string;
};

export function buildImagePrompt(r: PromptInput): { prompt: string; negative: string } {
  const presentation = r.presentation ?? PRESENTATION.find(([re]) => re.test(`${r.category} ${r.name}`))?.[1] ?? "served in a warm-white ceramic bowl";
  const prompt = `Premium editorial food photography for the Receita da Hora recipe app.

Dish:
${r.name}

Description:
${r.description || r.name}

Main visible ingredients:
${r.visualIngredients.join(", ") || "(define visual ingredients first)"}

Presentation:
${presentation}

Seasonal mood:
${r.seasonalMood ?? seasonalMood()}

Create a realistic homemade dish presented beautifully but naturally.

Visual identity:
warm cream and beige background,
soft natural side lighting,
subtle shallow depth of field,
premium editorial food photography,
minimal composition,
natural ceramic tableware,
warm earthy color palette,
highly appetizing but believable,
clean background,
soft shadows.

The dish must be the visual protagonist.

Include only ingredients that are part of the recipe.

A few ingredients may appear naturally around the dish or subtly suspended in the scene (3–6 elements at most).

Avoid excessive styling.

The food should look achievable in a normal home kitchen.

No people.
No hands.
No text.
No kitchen environment.
No table clutter.
No cutlery unless necessary.
No ingredients not listed in the recipe.
No unrealistic garnishes.
No excessive CGI appearance.
No stock photography look.

Composition must support cropping to:
4:3,
16:10,
4:5,
1:1.`;
  return { prompt, negative: NEGATIVE_PROMPT.join(", ") };
}
