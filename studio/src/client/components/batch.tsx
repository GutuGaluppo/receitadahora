import type { Progress } from "../api";
import { ProgressBar } from "./ui";

/** Bloco de progresso do lote (docs §19). */
export function BatchProgress({ progress }: { progress: Progress }) {
  const p = progress;
  const rows: [string, string][] = [
    ["Receitas", String(p.recipes_total)],
    ["Imagens principais", `${p.heroes}/${p.recipes_total}`],
    ["Ingredientes novos", String(p.new_ingredients)],
    ["Assets gerados", `${p.new_ingredients_with_asset}/${p.new_ingredients}`],
    ["Receitas aprovadas", `${p.approved}/${p.recipes_total}`],
  ];
  return (
    <div>
      <ProgressBar percent={p.percent} label="Progresso do lote" />
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-8 gap-y-1.5 sm:max-w-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd className="tabular text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
