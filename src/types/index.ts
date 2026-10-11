export type MealType = "breakfast" | "lunch" | "snack" | "dinner";

export type RecipePalette = {
  background: string;
  backgroundSecondary?: string;
  accent: string;
  /** Cor do ícone da biblioteca e dos botões primários. */
  accentStrong: string;
  text: string;
  mutedText: string;
};

export type Recipe = {
  id: string;
  slug: string;
  /** Ids do catálogo antigo (escrito à mão) que apontam para esta receita. */
  legacyIds?: string[];
  /** Receita herói do onboarding. */
  featured?: boolean;
  title: string;
  description: string;
  /** Vazio = usa a ilustração de prato gerada a partir da paleta. */
  imageUrl: string;
  prepTimeMinutes: number;
  servings: number;
  cuisine: string;
  /** quantity null = "a gosto" (nunca 0). */
  ingredients: { item: string; quantity: number | null; unit: string; note?: string; optional?: boolean }[];
  steps: { number: number; instruction: string }[];
  mealTypes: MealType[];
  dietaryTags: string[];
  /** Primeiro item = ingrediente principal. Inclui alérgenos (pt-BR). */
  ingredientsTags: string[];
  nutrition?: { calories?: number; protein?: number; carbs?: number; fat?: number };
  traits: {
    comfort: number;
    lightness: number;
    protein: number;
    /** 0 = barata, 100 = cara. */
    cost: number;
    novelty: number;
  };
  weatherAffinity: { hot: number; mild: number; cold: number; rainy: number };
  palette: RecipePalette;
  active: boolean;
  createdAt: string;
};

export type DietaryPreference = "vegetarian" | "vegan" | "lactose-free" | "gluten-free";
export type Goal = "eat-better" | "protein" | "save" | "quick" | "explore";

export type UserTasteProfile = {
  id: string;
  dietaryPreferences: DietaryPreference[];
  excludedIngredients: string[];
  allergies: string[];
  goals: Goal[];
  usualPrepTime: number | null;
  householdSize: number;
  usualMealTimes: MealType[];
  city?: string;
  country?: string;
  timezone?: string;
  weatherEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackReason = "too-slow" | "too-heavy" | "ingredients" | "not-now";

export type RecipeFeedback = {
  id: string;
  userId: string;
  recipeId: string;
  type: "liked" | "disliked";
  reason?: FeedbackReason;
  contextSnapshot: { hour: number; dayOfWeek: number; weather?: string };
  createdAt: string;
};

export type RecommendationEventType =
  | "recipe_shown"
  | "recipe_opened"
  | "recipe_skipped"
  | "recipe_saved"
  | "recipe_liked"
  | "recipe_disliked"
  | "recipe_cooked";

export type RecommendationEvent = {
  id: string;
  userId: string;
  recipeId: string;
  eventType: RecommendationEventType;
  createdAt: string;
};

export type SavedRecipe = { id: string; userId: string; recipeId: string; savedAt: string };

export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow" | "storm";
export type WeatherContext = {
  temperature: number;
  condition: WeatherCondition;
  feelsLike?: number;
};

export type Intent = "faster" | "lighter" | "comfort" | "surprise";
export type IntentState = { preference: Intent | null; sessionStart: number; expires: number };

export type RecommendationContext = {
  now: Date;
  weather: WeatherContext | null;
};

export type HomeState = "suggestion" | "recipeOpen" | "alternativePrompt" | "switchingRecipe";
