export type Env = {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  STATIC: Fetcher;
  ENVIRONMENT: "development" | "production" | string;
  /** "true" só em desenvolvimento. Em produção a autenticação é Cloudflare Access. */
  ACCESS_BYPASS: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;

  // ───────── Content Factory ─────────
  // Tudo que pode gerar custo externo nasce desligado. O backend bloqueia mesmo que o frontend seja manipulado.
  CONTENT_GENERATION_ENABLED?: string;
  IMAGE_GENERATION_ENABLED?: string;
  AUTO_BATCH_GENERATION_ENABLED?: string;
  /** Limite diário de jobs com provider pago. 0 = nenhum job pago permitido. */
  DAILY_GENERATION_LIMIT?: string;
  /** Orçamento mensal (USD) para providers pagos. 0 = nenhum gasto permitido. */
  MONTHLY_GENERATION_BUDGET?: string;
  /** "mock" (padrão) | futuros providers de texto */
  RECIPE_PROVIDER?: string;
  /** "disabled" (padrão) | "mock" (dev) | "openai" */
  IMAGE_PROVIDER?: string;
  OPENAI_IMAGE_MODEL?: string;
  /** Secret do Cloudflare (wrangler secret put OPENAI_API_KEY). Nunca vai para o frontend nem para logs. */
  OPENAI_API_KEY?: string;
};

export type Vars = { user: string };
export type AppEnv = { Bindings: Env; Variables: Vars };
