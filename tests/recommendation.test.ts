import { describe, expect, it } from "vitest";
import { RECIPES } from "@/data/recipes";
import { defaultProfile } from "@/services/storage";
import {
  goalScore,
  isValidRecipe,
  mealTimeScore,
  noveltyScore,
  prepTimeScore,
  rankRecipes,
  recommend,
  tasteScore,
  weatherScore,
} from "@/services/recommendation";
import type { Recipe, RecipeFeedback, RecommendationEvent, UserTasteProfile } from "@/types";

const at = (h: number, day = 15) => new Date(2026, 5, day, h, 0, 0);
const noJitter = () => 0;
const profile = (p: Partial<UserTasteProfile> = {}): UserTasteProfile => ({ ...defaultProfile("u"), ...p });
const recipe = (id: string) => RECIPES.find((r) => r.id === id)!;

const fb = (recipeId: string, type: "liked" | "disliked", reason?: RecipeFeedback["reason"]): RecipeFeedback => ({
  id: `${recipeId}-${type}`, userId: "u", recipeId, type, reason,
  contextSnapshot: { hour: 12, dayOfWeek: 1 }, createdAt: new Date().toISOString(),
});
const shown = (recipeId: string, when: Date): RecommendationEvent => ({
  id: `${recipeId}-${when.getTime()}`, userId: "u", recipeId, eventType: "recipe_shown", createdAt: when.toISOString(),
});

describe("seed", () => {
  it("tem ao menos 30 receitas completas", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(30);
    for (const r of RECIPES) {
      expect(r.ingredients.length, r.id).toBeGreaterThan(0);
      expect(r.steps.length, r.id).toBeGreaterThan(0);
      expect(new Set(RECIPES.map((x) => x.id)).size).toBe(RECIPES.length);
    }
  });
  it("cobre todas as refeições", () => {
    for (const m of ["breakfast", "lunch", "snack", "dinner"] as const) {
      expect(RECIPES.some((r) => r.mealTypes.includes(m)), m).toBe(true);
    }
  });
});

describe("hard stops", () => {
  it("exclui receitas com a alergia do usuário (inclui plural e acento)", () => {
    const p = profile({ allergies: ["camarões"] });
    expect(isValidRecipe(recipe("espaguete-camarao-alho"), p)).toBe(false);
    expect(isValidRecipe(recipe("macarrao-alho-oleo"), p)).toBe(true);
    expect(isValidRecipe(recipe("smoothie-bowl-cacau"), profile({ allergies: ["Amendoim"] }))).toBe(false);
  });
  it("exclui ingrediente proibido", () => {
    expect(isValidRecipe(recipe("caldo-verde"), profile({ excludedIngredients: ["linguica"] }))).toBe(false);
  });
  it("respeita dieta (vegano ⊂ vegetariano)", () => {
    const veg = profile({ dietaryPreferences: ["vegetarian"] });
    expect(isValidRecipe(recipe("frango-grelhado-legumes"), veg)).toBe(false);
    expect(isValidRecipe(recipe("sopa-lentilha"), veg)).toBe(true); // vegana
    expect(isValidRecipe(recipe("omelete-ervas"), profile({ dietaryPreferences: ["vegan"] }))).toBe(false);
    expect(isValidRecipe(recipe("pasta-cremosa-abobora"), profile({ dietaryPreferences: ["lactose-free"] }))).toBe(false);
  });
  it("nunca recomenda algo que viole restrições, em nenhuma hora", () => {
    const p = profile({ dietaryPreferences: ["vegan"], allergies: ["amendoim", "soja"] });
    for (let h = 0; h < 24; h++) {
      for (const { recipe: r } of rankRecipes({ recipes: RECIPES, profile: p, context: { now: at(h), weather: null }, random: noJitter })) {
        expect(r.dietaryTags).toContain("vegan");
        expect(r.ingredientsTags).not.toContain("amendoim");
        expect(r.ingredientsTags).not.toContain("soja");
      }
    }
  });
});

describe("scores", () => {
  it("meio-dia: almoço vence café da manhã", () => {
    expect(mealTimeScore(12, "lunch")).toBeGreaterThan(mealTimeScore(12, "breakfast"));
  });
  it("sugere café da manhã de manhã e jantar à noite", () => {
    const base = { recipes: RECIPES, profile: profile(), random: noJitter };
    expect(recommend({ ...base, context: { now: at(8), weather: null } })!.mealTypes).toContain("breakfast");
    expect(recommend({ ...base, context: { now: at(20), weather: null } })!.mealTypes).toContain("dinner");
  });
  it("frio/chuva favorece comfort; calor favorece leve", () => {
    const sopa = recipe("sopa-lentilha");
    const salada = recipe("salada-grao-de-bico");
    const cold = { temperature: 8, condition: "rain" as const };
    const hot = { temperature: 34, condition: "clear" as const };
    expect(weatherScore(sopa, cold)).toBeGreaterThan(weatherScore(salada, cold));
    expect(weatherScore(salada, hot)).toBeGreaterThan(weatherScore(sopa, hot));
    expect(weatherScore(sopa, null)).toBe(0);
  });
  it("tempo: dentro do preferido pontua, estourar penaliza mais quanto maior", () => {
    expect(prepTimeScore(20, 15, 10)).toBeGreaterThan(prepTimeScore(20, 30, 10));
    expect(prepTimeScore(20, 30, 10)).toBeGreaterThan(prepTimeScore(20, 60, 10));
    expect(prepTimeScore(20, 15, 12)).toBeGreaterThan(prepTimeScore(20, 15, 10)); // pico de almoço
  });
  it("objetivos: proteína favorece receitas proteicas", () => {
    expect(goalScore(["protein"], recipe("omelete-ervas"))).toBeGreaterThan(goalScore(["protein"], recipe("macarrao-alho-oleo")));
    expect(goalScore([], recipe("omelete-ervas"))).toBe(0);
  });
});

describe("feedback", () => {
  it("curtida pontua positivo e rejeição negativo", () => {
    const r = recipe("risoto-cogumelos");
    expect(tasteScore(r, RECIPES, [fb(r.id, "liked")])).toBeGreaterThan(0);
    expect(tasteScore(r, RECIPES, [fb(r.id, "disliked")])).toBeLessThan(0);
  });
  it("o último feedback da mesma receita vence", () => {
    const r = recipe("risoto-cogumelos");
    expect(tasteScore(r, RECIPES, [fb(r.id, "disliked"), fb(r.id, "liked")])).toBeGreaterThan(0);
  });
  it("receitas parecidas com as curtidas sobem", () => {
    const liked = [fb("strogonoff-cogumelos", "liked")];
    expect(tasteScore(recipe("risoto-cogumelos"), RECIPES, liked)).toBeGreaterThan(
      tasteScore(recipe("macarrao-alho-oleo"), RECIPES, liked),
    );
  });
  it("rejeição por ingredientes afasta receitas com o mesmo ingrediente principal", () => {
    const ctx = { recipes: RECIPES, profile: profile(), context: { now: at(20), weather: null }, random: noJitter };
    const before = rankRecipes(ctx).find((x) => x.recipe.id === "risoto-cogumelos")!.score;
    const after = rankRecipes({ ...ctx, history: { feedback: [fb("strogonoff-cogumelos", "disliked", "ingredients")] } })
      .find((x) => x.recipe.id === "risoto-cogumelos")!.score;
    expect(after).toBeLessThan(before);
  });
});

describe("diversidade", () => {
  const now = at(12).getTime();
  const r = recipe("arroz-feijao-ovo");
  it("penaliza a mesma receita em < 7 dias", () => {
    const fresh = noveltyScore(r, RECIPES, [], now);
    const recent = noveltyScore(r, RECIPES, [shown(r.id, at(9, 12))], now);
    const old = noveltyScore(r, RECIPES, [shown(r.id, at(9, 1))], now);
    expect(recent).toBeLessThan(fresh);
    expect(old).toBeGreaterThan(recent);
  });
  it("penaliza o mesmo ingrediente principal em < 3 dias", () => {
    const sameMain = recipe("omelete-ervas"); // ovo...
    const a = noveltyScore(r, RECIPES, [], now);
    const b = noveltyScore(r, RECIPES, [shown(recipe("cuscuz-ovo").id, at(9, 14))], now);
    expect(sameMain.ingredientsTags[0]).toBe("ovo");
    expect(b).toBeLessThan(a);
  });
  it("evita a mesma culinária em sugestões seguidas", () => {
    const it1 = recipe("lasanha-berinjela");
    const it2 = recipe("macarrao-alho-oleo");
    const withItalian = noveltyScore(it1, RECIPES, [shown(it2.id, at(9, 14))], now);
    const withOther = noveltyScore(it1, RECIPES, [shown("cuscuz-ovo", at(9, 14))], now);
    expect(withItalian).toBeLessThan(withOther);
  });
});

describe("intenção temporária", () => {
  const base = { recipes: RECIPES, profile: profile(), context: { now: at(12), weather: null }, random: noJitter };
  it("mais rápido prioriza ≤ 20 min", () => {
    expect(recommend({ ...base, intent: "faster" })!.prepTimeMinutes).toBeLessThanOrEqual(20);
  });
  it("mais leve escolhe algo mais leve que o padrão", () => {
    const light = recommend({ ...base, intent: "lighter" })!;
    expect(light.traits.lightness).toBeGreaterThanOrEqual(70);
  });
  it("reconfortante escolhe comfort alto", () => {
    expect(recommend({ ...base, intent: "comfort" })!.traits.comfort).toBeGreaterThanOrEqual(75);
  });
  it("não altera o perfil", () => {
    const p = profile({ usualPrepTime: 45 });
    const copy = structuredClone(p);
    recommend({ ...base, profile: p, intent: "faster" });
    expect(p).toEqual(copy);
  });
  it("excludeIds evita repetir a receita atual", () => {
    const first = recommend(base)!;
    expect(recommend({ ...base, excludeIds: [first.id] })!.id).not.toBe(first.id);
  });
});

describe("limites", () => {
  it("devolve null quando as restrições eliminam tudo", () => {
    const p = profile({ allergies: ["ovo", "trigo", "frango", "carne", "peixe", "grão", "feijão", "lentilha", "abóbora", "banana", "queijo", "aveia", "batata", "coco", "tomate", "arroz", "milho", "cogumelo", "gengibre", "quinoa", "tapioca", "iogurte", "abacate", "chocolate", "espinafre", "berinjela", "repolho", "camarão", "maçã", "cenoura"] });
    expect(recommend({ recipes: RECIPES, profile: p, context: { now: at(12), weather: null } })).toBeNull();
  });
  it("scores ficam entre 0 e 100", () => {
    for (const { score } of rankRecipes({ recipes: RECIPES as Recipe[], profile: profile(), context: { now: at(12), weather: { temperature: 5, condition: "snow" } } })) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
