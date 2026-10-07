export type Env = {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  STATIC: Fetcher;
  ENVIRONMENT: "development" | "production" | string;
  /** "true" só em desenvolvimento. Em produção a autenticação é Cloudflare Access. */
  ACCESS_BYPASS: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

export type Vars = { user: string };
export type AppEnv = { Bindings: Env; Variables: Vars };
