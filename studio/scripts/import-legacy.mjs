#!/usr/bin/env node
/**
 * Marco 0 — importa o catálogo escrito à mão do app (src/data/recipes.ts) para o D1 do Studio.
 *
 *   node scripts/import-legacy.mjs            → gera seed/legacy-import.sql
 *   npm run import:legacy                      (mesmo efeito)
 *
 * Regras (plano consolidado §6.3):
 *  - cada receita guarda o id antigo em legacy_ids (favoritos/feedback antigos continuam resolvendo);
 *  - ids determinísticos + INSERT OR IGNORE → rodar duas vezes não duplica nada;
 *  - metadados editoriais que já existiam (refeições, dietas, traits, clima, paleta) entram preenchidos;
 *  - ALÉRGENOS NÃO são inferidos: allergens = NULL e metadata_reviewed_at = NULL. A receita só publica
 *    depois que uma pessoa revisa os alérgenos no Studio;
 *  - status "approved" + legacy_import = 1: publica sem foto (o app desenha a ilustração) — decisão D-1.
 */
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const studio = fileURLToPath(new URL("..", import.meta.url));

async function load(entry) {
  const out = await build({
    entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent",
    alias: { "@": `${root}/src` },
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
}

const { RECIPES } = await load(`${root}/src/data/recipes.ts`);
const { ingredientKey, slugify } = await load(`${studio}/src/worker/lib/text.ts`);

const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => q(JSON.stringify(v));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clean = (s) => cap(s.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
const CATEGORY = { breakfast: "Café da manhã", lunch: "Almoço", snack: "Café da tarde", dinner: "Jantar" };

const { PALETTES } = await load(`${root}/src/data/palettes.ts`);
const paletteKey = (p) => Object.entries(PALETTES).find(([, v]) => v.accent === p.accent && v.background === p.background)?.[0] ?? "warm";

const t = new Date().toISOString();
const lines = ["-- GERADO por scripts/import-legacy.mjs — não edite à mão. Idempotente (INSERT OR IGNORE).", ""];
const seenIng = new Set();
const seenSlug = new Map(); // slug → id, para não perder ingredientes em silêncio (INSERT OR IGNORE)
let featuredDone = false;

for (const r of RECIPES) {
  const rid = `recipe_legacy_${slugify(r.id).replace(/-/g, "_")}`;
  for (const ing of r.ingredients) {
    const key = ingredientKey(ing.item);
    if (!key) continue;
    const iid = `ingredient_legacy_${slugify(key).replace(/-/g, "_")}`;
    if (seenIng.has(iid)) continue;
    seenIng.add(iid);
    const islug = slugify(clean(ing.item));
    if (seenSlug.has(islug)) throw new Error(`slug de ingrediente duplicado: "${islug}" (${seenSlug.get(islug)} × ${iid})`);
    seenSlug.set(islug, iid);
    lines.push(`INSERT OR IGNORE INTO ingredients (id, name, slug, normalized_name, created_at, updated_at) VALUES (${q(iid)}, ${q(clean(ing.item))}, ${q(slugify(clean(ing.item)))}, ${q(key)}, ${q(t)}, ${q(t)});`);
  }
  const featured = !featuredDone && r.id === "pasta-cremosa-abobora" ? ((featuredDone = true), 1) : 0;
  lines.push(
    `INSERT OR IGNORE INTO recipes (id, name, slug, description, category, prep_time, cook_time, servings, difficulty, instructions, tags, visual_ingredients, status, created_at, updated_at,
       source_type, approved_by, approved_at, legacy_ids, meal_types, dietary_tags, allergens, ingredients_tags, cuisine, traits, weather_affinity, palette_key, nutrition, featured, legacy_import)
     VALUES (${q(rid)}, ${q(r.title)}, ${q(r.slug)}, ${q(r.description)}, ${q(CATEGORY[r.mealTypes[0]] ?? "Almoço")}, ${r.prepTimeMinutes}, 0, ${r.servings}, 'easy',
       ${j(r.steps.map((s) => s.instruction))}, '[]', ${j(r.ingredients.slice(0, 6).map((i) => clean(i.item).toLowerCase()))}, 'approved', ${q(t)}, ${q(t)},
       'imported', 'import-legacy', ${q(t)}, ${j([r.id])}, ${j(r.mealTypes)}, ${j(r.dietaryTags)}, NULL, ${j(r.ingredientsTags)}, ${q(r.cuisine)},
       ${j(r.traits)}, ${j(r.weatherAffinity)}, ${q(paletteKey(r.palette))}, ${r.nutrition ? j(r.nutrition) : "NULL"}, ${featured}, 1);`,
  );
  r.ingredients.forEach((ing, idx) => {
    const key = ingredientKey(ing.item);
    if (!key) return;
    const iid = `ingredient_legacy_${slugify(key).replace(/-/g, "_")}`;
    const note = ing.optional ? "opcional" : "";
    lines.push(
      `INSERT OR IGNORE INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, note, raw_name, sort_order) VALUES (${q(`ri_legacy_${slugify(r.id).replace(/-/g, "_")}_${idx}`)}, ${q(rid)}, ${q(iid)}, ${ing.quantity > 0 ? ing.quantity : "NULL"}, ${q(ing.unit)}, ${q(note)}, ${q(ing.item)}, ${idx});`,
    );
  });
  lines.push("");
}

const out = `${studio}/seed/legacy-import.sql`;
writeFileSync(out, lines.join("\n"));
console.log(`✔ ${RECIPES.length} receitas, ${seenIng.size} ingredientes → seed/legacy-import.sql`);
console.log("Aplicar:");
console.log("  local:    npx wrangler d1 execute DB --local --file=seed/legacy-import.sql");
console.log("  staging:  npx wrangler d1 execute DB --env staging --remote --file=seed/legacy-import.sql");
console.log("Depois, no Studio: revise os alérgenos de cada receita (Metadados) e publique.");
