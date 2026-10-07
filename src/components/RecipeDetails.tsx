"use client";

import { useState } from "react";
import type { Recipe } from "@/types";

export function RecipeMeta({ recipe, className = "" }: { recipe: Recipe; className?: string }) {
  return (
    <p className={`text-[17px] text-muted ${className}`}>
      {recipe.prepTimeMinutes} min <span aria-hidden>&nbsp;·&nbsp;</span>
      Serve {recipe.servings}
    </p>
  );
}

function qty(q: number): string {
  const whole = Math.trunc(q);
  const frac = q - whole;
  const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : "";
  if (f) return whole ? `${whole}${f}` : f;
  return Number.isInteger(q) ? String(q) : String(q).replace(".", ",");
}

/** "250 g de massa", "1 dente de alho", "Parmesão a gosto", "Folhas de sálvia (opcional)". */
function ingredientLine(i: Recipe["ingredients"][number]): string {
  const lower = `${i.item.charAt(0).toLowerCase()}${i.item.slice(1)}`;
  let line: string;
  if (i.unit === "a gosto") line = `${i.item} a gosto`;
  else if (i.unit === "un" || i.unit === "") line = `${qty(i.quantity)} ${lower}`;
  else line = `${qty(i.quantity)} ${i.unit} de ${lower}`;
  return i.optional ? `${line} (opcional)` : line;
}

export function Ingredients({ recipe }: { recipe: Recipe }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (item: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });

  return (
    <section aria-labelledby="ingredientes">
      <h2 id="ingredientes" className="display text-[28px]">
        Ingredientes
      </h2>
      <ul className="mt-3 space-y-0">
        {recipe.ingredients.map((ing) => {
          const checked = done.has(ing.item);
          return (
            <li key={ing.item}>
              {/* marcar enquanto prepara: toque risca o item */}
              <label className="flex min-h-8 cursor-pointer items-center gap-4 py-0.5 text-[17px]">
                <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(ing.item)} />
                <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70 peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-strong peer-focus-visible:ring-offset-2" />
                <span className={checked ? "text-muted line-through decoration-1" : ""}>{ingredientLine(ing)}</span>
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
      <h2 id="preparo" className="display text-[28px]">
        Modo de preparo
      </h2>
      <ol className="mt-4 space-y-3">
        {recipe.steps.map((s) => (
          <li key={s.number} className="flex items-start gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[15px] font-medium">
              {s.number}
            </span>
            <p className="max-w-[58ch] pt-[5px] text-[17px] leading-relaxed">{s.instruction}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
