"use client";

import { useState } from "react";
import type { Recipe } from "@/types";

export function RecipeMeta({ recipe }: { recipe: Recipe }) {
  const parts = [`${recipe.prepTimeMinutes} min`, `Serve ${recipe.servings}`];
  if (recipe.nutrition?.calories) parts.push(`${recipe.nutrition.calories} kcal`);
  return <p className="text-sm tracking-wide text-muted">{parts.join(" · ")}</p>;
}

function formatQty(q: number): string {
  if (Number.isInteger(q)) return String(q);
  if (q === 0.5) return "½";
  if (q === 0.75) return "¾";
  if (q === 0.25) return "¼";
  return String(q).replace(".", ",");
}

export function Ingredients({ recipe }: { recipe: Recipe }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (item: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  return (
    <section aria-labelledby="ingredientes">
      <h2 id="ingredientes" className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        Ingredientes
      </h2>
      <ul className="space-y-1">
        {recipe.ingredients.map((ing) => {
          const done = checked.has(ing.item);
          return (
            <li key={ing.item}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(ing.item)}
                  className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-strong bg-transparent checked:bg-strong focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <span className={`themed ${done ? "text-muted line-through decoration-1" : ""}`}>
                  {ing.item}
                  <span className="text-muted">
                    {" "}
                    ({formatQty(ing.quantity)} {ing.unit})
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Steps({ recipe }: { recipe: Recipe }) {
  return (
    <section aria-labelledby="preparo">
      <h2 id="preparo" className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-muted">
        Modo de preparo
      </h2>
      <ol className="space-y-6">
        {recipe.steps.map((s) => (
          <li key={s.number} className="flex gap-5">
            <span className="font-serif text-lg tabular-nums text-accent">{String(s.number).padStart(2, "0")}</span>
            <p className="max-w-[56ch] leading-relaxed">{s.instruction}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
