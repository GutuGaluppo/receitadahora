import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_SKEW_SECONDS = 5 * 60;

export function sign(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type Verdict = "ok" | "missing_headers" | "stale_timestamp" | "bad_signature";

/** HMAC-SHA256(timestamp + "." + corpo) + janela de 5 minutos. Revalidação é idempotente: sem nonce (plano §8.3). */
export function verify(opts: { secret: string; timestamp: string | null; signature: string | null; body: string; nowSeconds: number }): Verdict {
  const { secret, timestamp, signature, body, nowSeconds } = opts;
  if (!timestamp || !signature) return "missing_headers";
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) return "stale_timestamp";
  const expected = Buffer.from(sign(secret, timestamp, body), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "bad_signature";
  return "ok";
}
