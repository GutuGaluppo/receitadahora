"use client";

import { RECIPES_BY_ID } from "@/data/recipes";
import { useApp } from "./providers/AppProvider";
import { RecipeImage } from "./RecipeImage";

const TAG_LABEL: Record<string, string> = {
  vegan: "vegano",
  vegetarian: "vegetariano",
  "lactose-free": "sem lactose",
  "gluten-free": "sem glúten",
};

function oneTag(tags: string[]): string | null {
  const key = ["vegan", "vegetarian", "lactose-free", "gluten-free"].find((t) => tags.includes(t));
  return key ? TAG_LABEL[key] : null;
}

export function SavedRecipes({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, toggleSaved } = useApp();
  const items = [...data.saved]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .flatMap((s) => {
      const recipe = RECIPES_BY_ID.get(s.recipeId);
      return recipe ? [recipe] : [];
    });

  return (
    <section aria-labelledby="salvas">
      <h3 id="salvas" className="mb-5 font-serif text-xl">
        Receitas salvas <span className="text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="max-w-xs text-muted">Nada salvo ainda. Quando salvar uma receita, ela aparece aqui.</p>
      ) : (
        <ul className="divide-y divide-strong/15">
          {items.map((r) => {
            const tag = oneTag(r.dietaryTags);
            return (
              <li key={r.id} className="flex items-center gap-2 py-2">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="themed flex min-h-16 flex-1 items-center gap-4 text-left"
                >
                  <RecipeImage recipe={r} className="h-16 w-16 shrink-0" />
                  <span className="flex flex-col">
                    <span className="font-serif text-lg leading-snug">{r.title}</span>
                    <span className="text-sm text-muted">
                      {r.prepTimeMinutes} min{tag ? ` · ${tag}` : ""}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSaved(r.id)}
                  aria-label={`Remover ${r.title} das salvas`}
                  className="themed min-h-11 min-w-11 px-2 text-sm text-muted hover:text-fg"
                >
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
