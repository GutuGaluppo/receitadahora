import { useEffect, useState } from "react";
import { ALLERGENS, DIETARY_TAGS, MEAL_TYPES, PALETTE_KEYS } from "@contracts/catalog";
import { ApiError, api, fmtDate } from "../api";
import { useToast } from "./toast";
import { Button, Card, Field, inputCls } from "./ui";

export type Metadata = {
  meal_types: string[] | null; dietary_tags: string[] | null; allergens: string[] | null; ingredients_tags: string[] | null;
  cuisine: string; traits: Record<string, number> | null; weather_affinity: Record<string, number> | null; palette_key: string | null;
  nutrition: { calories?: number; protein?: number; carbs?: number; fat?: number } | null; featured: boolean; legacy_ids: string[];
  legacy_import: boolean; reviewed_by: string | null; reviewed_at: string | null;
};

const MEAL_LABEL: Record<string, string> = { breakfast: "Café da manhã", lunch: "Almoço", snack: "Café da tarde", dinner: "Jantar" };
const DIET_LABEL: Record<string, string> = { vegetarian: "Vegetariana", vegan: "Vegana", "lactose-free": "Sem lactose", "gluten-free": "Sem glúten" };
/** Rubrica de âncoras (D-4): 0 e 100 de cada atributo. */
const TRAITS: [string, string, string, string][] = [
  ["comfort", "Conforto", "Prato frio e leve", "Prato quente e denso"],
  ["lightness", "Leveza", "Pesado, muito calórico", "Leve, fresco"],
  ["protein", "Proteína", "Quase sem proteína", "Proteína é a estrela"],
  ["cost", "Custo", "Barata (despensa)", "Cara (ingredientes especiais)"],
  ["novelty", "Novidade", "Clássico do dia a dia", "Técnica/combinação inusitada"],
];
const WEATHER: [string, string][] = [["hot", "Calor"], ["mild", "Ameno"], ["cold", "Frio"], ["rainy", "Chuva"]];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function MetadataCard({ recipeId, metadata, onSaved }: { recipeId: string; metadata: Metadata; onSaved: () => void }) {
  const toast = useToast();
  const [m, setM] = useState({
    meal_types: metadata.meal_types ?? [], dietary_tags: metadata.dietary_tags ?? [], allergens: metadata.allergens ?? [],
    tags: (metadata.ingredients_tags ?? []).join(", "), cuisine: metadata.cuisine,
    traits: metadata.traits ?? { comfort: 50, lightness: 50, protein: 50, cost: 50, novelty: 50 },
    weather: metadata.weather_affinity ?? { hot: 50, mild: 50, cold: 50, rainy: 50 },
    palette: metadata.palette_key ?? "warm", featured: metadata.featured, legacy: metadata.legacy_ids.join(", "),
    calories: metadata.nutrition?.calories != null ? String(metadata.nutrition.calories) : "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setConfirmed(false), [recipeId, metadata.reviewed_at]);

  const notReviewed = metadata.allergens === null;

  async function save() {
    setSaving(true);
    try {
      await api(`/recipes/${recipeId}/metadata`, {
        method: "PUT",
        body: {
          meal_types: m.meal_types, dietary_tags: m.dietary_tags, allergens: m.allergens,
          ingredients_tags: m.tags.split(",").map((s) => s.trim()).filter(Boolean), cuisine: m.cuisine.trim(),
          traits: m.traits, weather_affinity: m.weather, palette_key: m.palette, featured: m.featured,
          legacy_ids: m.legacy.split(",").map((s) => s.trim()).filter(Boolean),
          nutrition: m.calories.trim() ? { calories: Number(m.calories) } : null,
        },
      });
      toast.ok("Metadados confirmados");
      onSaved();
    } catch (e) {
      const issues = e instanceof ApiError ? (e.body?.issues as { message?: string }[] | undefined) : undefined;
      toast.error("Não foi possível salvar os metadados.", issues?.[0]?.message ?? (e as Error).message);
    } finally { setSaving(false); }
  }

  const check = (label: string, on: boolean, change: () => void) => (
    <label key={label} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={on} onChange={change} />{label}</label>
  );

  return (
    <Card title="Metadados de recomendação">
      <p className={`mb-3 rounded-md p-2 text-xs ${notReviewed ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
        {notReviewed
          ? "Alérgenos ainda não revisados — a receita não pode ser publicada."
          : `Revisado por ${metadata.reviewed_by ?? "—"}${metadata.reviewed_at ? ` em ${fmtDate(metadata.reviewed_at)}` : ""}.`}
        {metadata.legacy_import && " Importada do catálogo antigo (pode publicar sem foto)."}
      </p>

      <div className="space-y-4 text-sm">
        <Field label="Refeições"><div className="flex flex-wrap gap-3">{MEAL_TYPES.map((t) => check(MEAL_LABEL[t], m.meal_types.includes(t), () => setM({ ...m, meal_types: toggle(m.meal_types, t) })))}</div></Field>
        <Field label="Dietas"><div className="flex flex-wrap gap-3">{DIETARY_TAGS.map((t) => check(DIET_LABEL[t], m.dietary_tags.includes(t), () => setM({ ...m, dietary_tags: toggle(m.dietary_tags, t) })))}</div></Field>
        <Field label="Alérgenos presentes" hint="Lista fechada. Nenhum marcado + confirmação = “revisado, sem alérgenos”.">
          <div className="flex flex-wrap gap-3">{ALLERGENS.map((a) => check(a, m.allergens.includes(a), () => setM({ ...m, allergens: toggle(m.allergens, a) })))}</div>
        </Field>
        <Field label="Termos extras de ingredientes" hint="Separados por vírgula. O primeiro é o ingrediente principal. Os ingredientes e alérgenos entram automaticamente.">
          <input className={inputCls} value={m.tags} onChange={(e) => setM({ ...m, tags: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Culinária"><input className={inputCls} value={m.cuisine} onChange={(e) => setM({ ...m, cuisine: e.target.value })} /></Field>
          <Field label="Paleta">
            <select className={inputCls} value={m.palette} onChange={(e) => setM({ ...m, palette: e.target.value })}>{PALETTE_KEYS.map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-zinc-600">Perfil da receita (0–100)</p>
          {TRAITS.map(([k, label, lo, hi]) => (
            <div key={k} className="mb-2">
              <div className="flex justify-between text-xs"><span>{label}: <strong>{m.traits[k]}</strong></span><span className="text-zinc-500">0 = {lo} · 100 = {hi}</span></div>
              <input type="range" min={0} max={100} step={5} className="w-full" value={m.traits[k]} onChange={(e) => setM({ ...m, traits: { ...m.traits, [k]: Number(e.target.value) } })} />
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-600">Afinidade climática (0–100)</p>
          <div className="grid grid-cols-4 gap-2">
            {WEATHER.map(([k, label]) => (
              <Field key={k} label={label}><input type="number" min={0} max={100} className={inputCls} value={m.weather[k]} onChange={(e) => setM({ ...m, weather: { ...m.weather, [k]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })} /></Field>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Calorias (opcional)"><input className={inputCls} inputMode="numeric" value={m.calories} onChange={(e) => setM({ ...m, calories: e.target.value })} /></Field>
          <Field label="Ids antigos do app" hint="Separados por vírgula"><input className={inputCls} value={m.legacy} onChange={(e) => setM({ ...m, legacy: e.target.value })} /></Field>
        </div>
        {check("Receita em destaque (herói do onboarding)", m.featured, () => setM({ ...m, featured: !m.featured }))}

        <label className="flex items-start gap-2 rounded-md border border-zinc-200 p-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>Confirmo que revisei <strong>alérgenos, dietas e demais metadados</strong>. Esta confirmação fica registrada com meu usuário e a data.</span>
        </label>
        <Button variant="primary" disabled={!confirmed || saving || !m.meal_types.length || !m.cuisine.trim()} onClick={save}>{saving ? "Salvando…" : "Confirmar metadados"}</Button>
      </div>
    </Card>
  );
}
