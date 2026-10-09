/* eslint-disable @next/next/no-img-element */
"use client";

import { paletteBackground } from "@/lib/theme";
import type { Recipe } from "@/types";
import { Heart } from "./icons";
import { useApp } from "./providers/AppProvider";
import { useCatalog } from "./providers/CatalogProvider";
import { RecipeImage } from "./RecipeImage";

function Thumb({ recipe }: { recipe: Recipe }) {
  return (
    <span
      className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl shadow-sm"
      style={{ background: paletteBackground(recipe.palette) }}
    >
      {recipe.imageUrl ? (
        <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-x-[-10%] top-[14%] block w-[120%]">
          <RecipeImage recipe={recipe} />
        </span>
      )}
    </span>
  );
}

export function SavedRecipes({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, toggleSaved } = useApp();
  const { byId } = useCatalog();
  // Salvas cuja receita saiu do catálogo (despublicada) continuam visíveis como "indisponível": nada some em silêncio.
  const items = [...data.saved]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map((s) => ({ id: s.recipeId, recipe: byId.get(s.recipeId) ?? null }));

  return (
    <section aria-labelledby="salvas">
      <h3 id="salvas" className="mb-1 inline-block border-b-2 border-strong pb-2 text-[18px] font-medium">
        Receitas salvas <span className="text-muted">({items.length})</span>
      </h3>
      <div className="mb-3 border-t border-fg/10" />
      {items.length === 0 ? (
        <p className="max-w-xs py-4 text-muted">Nada salvo ainda. Quando salvar uma receita, ela aparece aqui.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map(({ id, recipe: r }) =>
            r ? (
              <li key={id} className="flex items-center gap-2 rounded-2xl border border-fg/8 bg-white/35 p-2.5 pr-3">
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className="themed flex min-h-[72px] flex-1 items-center gap-4 text-left"
                >
                  <Thumb recipe={r} />
                  <span className="flex flex-col">
                    <span className="display text-[21px] leading-tight">{r.title}</span>
                    <span className="mt-0.5 text-[15px] text-muted">{r.prepTimeMinutes} min</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSaved(r.id)}
                  aria-label={`Remover ${r.title} das salvas`}
                  className="themed flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-strong hover:bg-strong/10"
                >
                  <Heart size={26} filled />
                </button>
              </li>
            ) : (
              <li key={id} className="flex items-center gap-2 rounded-2xl border border-dashed border-fg/15 bg-white/20 p-2.5 pr-3">
                <span className="flex min-h-[72px] flex-1 flex-col justify-center pl-2">
                  <span className="display text-[19px] leading-tight text-muted">Receita indisponível</span>
                  <span className="mt-0.5 text-[15px] text-muted">Saiu do catálogo por enquanto. Seu registro está guardado.</span>
                </span>
                <button
                  type="button"
                  onClick={() => toggleSaved(id)}
                  aria-label="Remover receita indisponível das salvas"
                  className="themed flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-strong hover:bg-strong/10"
                >
                  <Heart size={26} filled />
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
