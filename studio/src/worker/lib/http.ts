import type { Context } from "hono";
import type { ZodType } from "zod";

export const fail = (c: Context, status: 400 | 401 | 404 | 409 | 413 | 415 | 422 | 500, error: string, message: string, extra: Record<string, unknown> = {}) =>
  c.json({ error, message, ...extra }, status);

export async function parseBody<T>(c: Context, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, res: fail(c, 400, "invalid_json", "O corpo da requisição não é um JSON válido.") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      res: fail(c, 422, "validation", "Dados inválidos.", { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }),
    };
  }
  return { ok: true, data: parsed.data };
}

export const ALLOWED_MIME: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const MAX_UPLOAD = 8 * 1024 * 1024;
