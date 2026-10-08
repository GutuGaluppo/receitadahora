import { Hono } from "hono";
import type { AppEnv } from "./env";
import { requireAuth } from "./auth";
import { batches } from "./routes/batches";
import { dashboard } from "./routes/dashboard";
import { factory } from "./routes/factory";
import { ingredients } from "./routes/ingredients";
import { publicApi } from "./routes/public";
import { recipes } from "./routes/recipes";
import { review } from "./routes/review";

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.json({ error: "internal", message: "Algo deu errado no servidor. Nada foi perdido; tente novamente." }, 500);
});

// camada pública (somente leitura, somente publicado)
app.route("/api/public", publicApi);

// tudo o mais em /api é administrativo e exige autenticação
app.use("/api/*", requireAuth);
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

export default app;
