import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "./env";

type Jwk = JsonWebKey & { kid: string };
let jwksCache: { at: number; team: string; keys: Jwk[] } | null = null;

const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

async function getKeys(team: string): Promise<Jwk[]> {
  if (jwksCache && jwksCache.team === team && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("jwks_unavailable");
  const { keys } = (await res.json()) as { keys: Jwk[] };
  jwksCache = { at: Date.now(), team, keys };
  return keys;
}

/** Valida o JWT que o Cloudflare Access injeta em `Cf-Access-Jwt-Assertion` (RS256, aud, iss, exp). */
async function verifyAccessJwt(token: string, team: string, aud: string): Promise<string> {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new Error("malformed");
  const header = b64urlJson(h) as { alg: string; kid: string };
  const payload = b64urlJson(p) as { aud: string[] | string; iss: string; exp: number; email?: string; sub?: string };
  if (header.alg !== "RS256") throw new Error("alg");
  const jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error("signature");
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error("aud");
  if (payload.iss !== `https://${team}`) throw new Error("iss");
  if (payload.exp * 1000 < Date.now()) throw new Error("expired");
  return payload.email ?? payload.sub ?? "access-user";
}

/**
 * Nenhuma rota administrativa fica pública:
 *  - produção: exige JWT válido do Cloudflare Access;
 *  - desenvolvimento: ACCESS_BYPASS=true libera, mas NUNCA em produção.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const env = c.env;
  // ACCESS_BYPASS só vale em desenvolvimento local; staging e produção sempre exigem o Access.
  const production = env.ENVIRONMENT !== "development";

  if (env.ACCESS_BYPASS === "true") {
    if (production) return c.json({ error: "config", message: "ACCESS_BYPASS só é permitido em desenvolvimento local." }, 500);
    c.set("user", "dev@local");
    return next();
  }

  const team = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  if (!team || !aud || team.startsWith("REPLACE") || aud.startsWith("REPLACE")) {
    return c.json({ error: "config", message: "Cloudflare Access não está configurado (CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD)." }, 503);
  }
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token) return c.json({ error: "unauthorized", message: "Acesso restrito." }, 401);
  try {
    c.set("user", await verifyAccessJwt(token, team, aud));
  } catch {
    return c.json({ error: "unauthorized", message: "Credencial inválida ou expirada." }, 401);
  }
  return next();
};
