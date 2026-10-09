import type { Context } from "hono";
import type { AppEnv, Env } from "../env";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256(timestamp + "." + corpo) em hex. O app valida o mesmo formato (src/app/api/revalidate). */
export async function signPayload(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
}

/** Avisa o app que o catálogo mudou. Falhas são logadas e nunca derrubam a operação editorial (o TTL do app recupera). */
export async function sendRevalidation(env: Env, reason: string): Promise<void> {
  if (!env.APP_REVALIDATE_URL || !env.APP_REVALIDATE_SECRET) return;
  const body = JSON.stringify({ event: "catalog.changed", reason, at: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    const res = await fetch(env.APP_REVALIDATE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-studio-timestamp": timestamp,
        "x-studio-signature": await signPayload(env.APP_REVALIDATE_SECRET, timestamp, body),
        ...(env.APP_REVALIDATE_BYPASS ? { "x-vercel-protection-bypass": env.APP_REVALIDATE_BYPASS } : {}),
      },
      body,
    });
    if (!res.ok) console.error("revalidate_failed", { status: res.status, reason });
  } catch (e) {
    console.error("revalidate_error", { reason, error: e instanceof Error ? e.message : String(e) });
  }
}

export function notifyCatalogChanged(c: Context<AppEnv>, reason: string) {
  try {
    c.executionCtx.waitUntil(sendRevalidation(c.env, reason));
  } catch {
    // sem executionCtx (testes): dispara sem aguardar
    void sendRevalidation(c.env, reason);
  }
}
