import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requireAuth } from "./auth";
import { batches } from "./routes/batches";
import { dashboard } from "./routes/dashboard";
import { factory } from "./routes/factory";
import { ingredients } from "./routes/ingredients";
import { notifyCatalogChanged } from "./lib/revalidate";
import { publicApi } from "./routes/public";
import { recipes } from "./routes/recipes";
import { review } from "./routes/review";

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.json({ error: "internal", message: "Algo deu errado no servidor. Nada foi perdido; tente novamente." }, 500);
});

// Host público de leitura: só /api/public/*. Qualquer outro caminho (SPA, rotas admin) responde 404.
app.use("*", async (c, next) => {
  const publicHost = c.env.PUBLIC_API_HOSTNAME;
  if (publicHost && new URL(c.req.url).hostname === publicHost && !c.req.path.startsWith("/api/public/")) {
    return c.json({ error: "not_found", message: "Não encontrado." }, 404);
  }
  await next();
});

// camada pública (somente leitura, somente publicado)
app.route("/api/public", publicApi);

// tudo o mais em /api é administrativo e exige autenticação
app.use("/api/*", requireAuth);

// Qualquer mudança editorial bem-sucedida avisa o app (webhook assinado). A revalidação é idempotente.
app.use("/api/*", async (c, next) => {
  await next();
  const mutating = c.req.method !== "GET" && c.req.method !== "HEAD" && c.req.method !== "OPTIONS";
  if (mutating && c.res.ok && /^\/api\/(recipes|ingredients|review)\b/.test(c.req.path)) {
    notifyCatalogChanged(c, `${c.req.method} ${c.req.path}`);
  }
});
app.get("/api/me", (c) => c.json({ user: c.get("user"), environment: c.env.ENVIRONMENT }));
app.route("/api/dashboard", dashboard);
app.route("/api/ingredients", ingredients);
app.route("/api/recipes", recipes);
app.route("/api/batches", batches);
app.route("/api/review", review);
app.route("/api/factory", factory);

/** Arquivos do R2 para o painel (qualquer status). */
app.get("/api/assets/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/api\/assets\//, ""));
  const obj = await c.env.ASSETS_BUCKET.get(key);
  if (!obj) return c.json({ error: "not_found", message: "Arquivo não encontrado no R2." }, 404);
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "private, max-age=3600", ETag: obj.httpEtag } });
});

app.all("/api/*", (c) => c.json({ error: "not_found", message: "Rota não encontrada." }, 404));

// run_worker_first = true: o Worker vê toda requisição (para poder fechar o host público) e entrega o SPA pelo binding STATIC.
app.all("*", (c) => c.env.STATIC.fetch(c.req.raw));

export default app;
