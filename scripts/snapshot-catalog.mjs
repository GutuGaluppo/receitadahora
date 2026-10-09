#!/usr/bin/env node
/**
 * Gera src/data/catalog.snapshot.json (contingência — plano §8.6).
 *
 *   node scripts/snapshot-catalog.mjs          → (prebuild) busca o catálogo no Studio; sem URL ou com falha, mantém o arquivo atual
 *   node scripts/snapshot-catalog.mjs --seed   → gera o catálogo de exemplo a partir de src/data/recipes.ts (source: "seed")
 *
 * O snapshot do Studio (source: "studio") é o único aceito como fallback em produção.
 * Esta etapa nunca derruba o build: o app valida o arquivo ao carregá-lo.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = `${root}/src/data/catalog.snapshot.json`;

async function fromSeed() {
  // esbuild só é necessário neste modo (vem do Studio, que já o tem via wrangler)
  const { build } = await import(existsSync(`${root}/node_modules/esbuild`) ? "esbuild" : pathToFileURL(`${root}/studio/node_modules/esbuild/lib/main.js`).href);
  const bundle = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent", alias: { "@": `${root}/src` } });
    return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString("base64")}`);
  };
  const { RECIPES } = await bundle(`${root}/src/data/recipes.ts`);
  const { PALETTES } = await bundle(`${root}/src/data/palettes.ts`);
  const key = (p) => Object.entries(PALETTES).find(([, v]) => v.accent === p.accent && v.background === p.background)?.[0] ?? "warm";
  const recipes = RECIPES.map((r) => ({
    id: r.id, slug: r.slug, legacyIds: [], title: r.title, description: r.description, imageUrl: r.imageUrl || null,
    prepTimeMinutes: r.prepTimeMinutes, servings: r.servings, cuisine: r.cuisine, ...(r.id === "pasta-cremosa-abobora" ? { featured: true } : {}),
    mealTypes: r.mealTypes, dietaryTags: r.dietaryTags, ingredientsTags: r.ingredientsTags,
    allergens: [], // seed: NÃO revisado. Por isso source = "seed" nunca serve de fallback com o Studio configurado.
    ...(r.nutrition ? { nutrition: r.nutrition } : {}), traits: r.traits, weatherAffinity: r.weatherAffinity, paletteKey: key(r.palette),
    ingredients: r.ingredients.map((i) => ({ item: i.item, quantity: i.quantity > 0 ? i.quantity : null, unit: i.unit, ...(i.optional ? { note: "opcional" } : {}) })),
    steps: r.steps, publishedAt: r.createdAt,
  }));
  return { source: "seed", schemaVersion: 1, generatedAt: "2026-01-01T00:00:00.000Z", recipes };
}

async function fromStudio(base) {
  const res = await fetch(`${base.replace(/\/+$/, "")}/api/public/v1/catalog`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Studio respondeu ${res.status}`);
  const json = await res.json();
  if (json?.schemaVersion !== 1 || !Array.isArray(json.recipes)) throw new Error("contrato inesperado");
  if (!json.recipes.length) throw new Error("catálogo vazio — mantendo o snapshot anterior");
  return { source: "studio", ...json };
}

try {
  if (process.argv.includes("--seed")) {
    const snap = await fromSeed();
    writeFileSync(OUT, JSON.stringify(snap, null, 2) + "\n");
    console.log(`✔ snapshot de exemplo (seed): ${snap.recipes.length} receitas`);
  } else if (process.env.STUDIO_PUBLIC_API_URL) {
    const snap = await fromStudio(process.env.STUDIO_PUBLIC_API_URL);
    writeFileSync(OUT, JSON.stringify(snap, null, 2) + "\n");
    console.log(`✔ snapshot do Studio: ${snap.recipes.length} receitas (${snap.generatedAt})`);
  } else {
    console.log("• STUDIO_PUBLIC_API_URL ausente: mantendo o snapshot atual.");
  }
} catch (e) {
  console.warn(`⚠ snapshot não atualizado (${e instanceof Error ? e.message : e}). Mantendo ${readFileSync(OUT, "utf8").length} bytes anteriores.`);
}
