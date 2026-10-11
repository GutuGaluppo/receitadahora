import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "../env";
import { fail } from "../lib/http";
import { publicAssetUrl } from "../lib/repo";
import { buildCatalog, etagOf } from "../lib/catalog";

/**
 * Camada pública, separada da administração. Só conteúdo PUBLICADO; nada de drafts,
 * rejeitados, metadata interna, ids de lote ou status.
 */
export const publicApi = new Hono<AppEnv>();
// O app consome no servidor e imagens (<img>) não usam CORS: sem origem configurada, nenhum origin é liberado.
publicApi.use("*", cors({ origin: (origin, c) => (c.env.APP_ORIGIN && origin === c.env.APP_ORIGIN ? origin : ""), allowMethods: ["GET", "HEAD", "OPTIONS"] }));

/**
 * Catálogo v1 — contrato único consumido pelo app (contracts/catalog.ts).
 * ETag estável (não muda se nada mudou) para requisição condicional.
 */
publicApi.get("/v1/catalog", async (c) => {
  const { catalog, skipped } = await buildCatalog(c.env);
  if (skipped.length) console.warn("catalog_skipped", JSON.stringify(skipped));
  const etag = await etagOf(JSON.stringify(catalog.recipes));
  c.header("ETag", etag);
  c.header("Cache-Control", "public, max-age=30, must-revalidate");
  c.header("X-Catalog-Skipped", String(skipped.length));
  if (c.req.header("if-none-match") === etag) return c.body(null, 304);
  return c.json(catalog);
});

const NOT_FOUND = (c: import("hono").Context<AppEnv>) => fail(c, 404, "not_found", "Não encontrado.");

publicApi.get("/recipes", async (c) => {
  const rows = (
    await c.env.DB.prepare(
      `SELECT r.id, r.name, r.slug, r.description, r.category, r.prep_time, r.cook_time, r.servings, r.difficulty, r.tags, r.published_at, ha.r2_key AS hero_key
         FROM recipes r JOIN assets ha ON ha.id = r.hero_asset_id AND ha.status = 'approved' AND ha.deleted_at IS NULL
        WHERE r.deleted_at IS NULL AND r.status = 'published' ORDER BY r.published_at DESC`,
    ).all<Record<string, string | number | null>>()
  ).results;
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    items: rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, description: r.description, category: r.category,
      prep_time: r.prep_time, cook_time: r.cook_time, servings: r.servings, difficulty: r.difficulty,
      tags: JSON.parse(String(r.tags)), published_at: r.published_at, image: publicAssetUrl(String(r.hero_key)),
    })),
  });
});

publicApi.get("/categories", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT category, COUNT(*) AS recipes FROM recipes WHERE deleted_at IS NULL AND status = 'published' AND category != '' GROUP BY category ORDER BY category").all<{ category: string; recipes: number }>()).results;
  c.header("Cache-Control", "public, max-age=60");
  return c.json({ items: rows });
});

publicApi.get("/recipes/:slug", async (c) => {
  const r = await c.env.DB.prepare(
    `SELECT r.id, r.name, r.slug, r.description, r.category, r.prep_time, r.cook_time, r.servings, r.difficulty, r.instructions, r.tags, r.published_at, ha.r2_key AS hero_key
       FROM recipes r JOIN assets ha ON ha.id = r.hero_asset_id AND ha.status = 'approved' AND ha.deleted_at IS NULL
      WHERE r.slug = ? AND r.deleted_at IS NULL AND r.status = 'published'`,
  ).bind(c.req.param("slug")).first<Record<string, string | number | null>>();
  if (!r) return NOT_FOUND(c);

  const ings = (
    await c.env.DB.prepare(
      `SELECT i.name, i.slug, ri.quantity, ri.unit, ri.note, a.r2_key
         FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
         LEFT JOIN assets a ON a.id = i.asset_id AND a.status = 'approved' AND a.deleted_at IS NULL
        WHERE ri.recipe_id = ? ORDER BY ri.sort_order`,
    ).bind(r.id).all<{ name: string; slug: string; quantity: number | null; unit: string; note: string; r2_key: string | null }>()
  ).results;

  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    id: r.id, slug: r.slug, name: r.name, description: r.description, category: r.category,
    prep_time: r.prep_time, cook_time: r.cook_time, servings: r.servings, difficulty: r.difficulty,
    tags: JSON.parse(String(r.tags)), instructions: JSON.parse(String(r.instructions)), published_at: r.published_at,
    image: publicAssetUrl(String(r.hero_key)),
    ingredients: ings.map((i) => ({ name: i.name, slug: i.slug, quantity: i.quantity, unit: i.unit, note: i.note, image: i.r2_key ? publicAssetUrl(i.r2_key) : null })),
  });
});

/** Só serve arquivos aprovados que pertencem a receitas publicadas. */
publicApi.get("/assets/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/public\/assets\//, ""));
  const ok = await c.env.DB.prepare(
    `SELECT a.id FROM assets a
      WHERE a.r2_key = ? AND a.status = 'approved' AND a.deleted_at IS NULL AND (
        EXISTS (SELECT 1 FROM recipes r WHERE r.hero_asset_id = a.id AND r.status = 'published' AND r.deleted_at IS NULL)
        OR EXISTS (SELECT 1 FROM ingredients i JOIN recipe_ingredients ri ON ri.ingredient_id = i.id JOIN recipes r ON r.id = ri.recipe_id
                    WHERE i.asset_id = a.id AND r.status = 'published' AND r.deleted_at IS NULL)
      )`,
  ).bind(key).first();
  if (!ok) return NOT_FOUND(c);
  const obj = await c.env.ASSETS_BUCKET.get(key);
  if (!obj) return NOT_FOUND(c);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable", ETag: obj.httpEtag } });
});
