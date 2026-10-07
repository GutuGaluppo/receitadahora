import type { Env } from "../env";
import { newId, now } from "./ids";
import type { AssetRow } from "./repo";
import { ALLOWED_MIME, MAX_UPLOAD } from "./http";

export type UploadError = { status: 413 | 415 | 422 | 500; error: string; message: string };

/** Valida o arquivo recebido em multipart. */
export function validateImage(file: unknown): { file: File } | UploadError {
  if (!(file instanceof File)) return { status: 422, error: "no_file", message: "Nenhum arquivo foi enviado (campo \"file\")." };
  if (!ALLOWED_MIME[file.type]) return { status: 415, error: "unsupported_type", message: "Formato não suportado. Use PNG, JPEG ou WebP." };
  if (file.size > MAX_UPLOAD) return { status: 413, error: "too_large", message: `Arquivo maior que ${MAX_UPLOAD / 1024 / 1024} MB.` };
  if (file.size === 0) return { status: 422, error: "empty_file", message: "O arquivo está vazio." };
  return { file };
}

/**
 * Envia para o R2 e registra no D1 como nova versão. Nunca sobrescreve uma chave existente.
 * Se o D1 falhar depois do upload, o objeto é removido (sem órfãos).
 */
export async function storeAsset(
  env: Env,
  p: { type: "recipe_hero" | "ingredient"; ownerId: string; slug: string; file: File; status?: "review" | "approved" },
): Promise<AssetRow | UploadError> {
  const ext = ALLOWED_MIME[p.file.type];
  const last = await env.DB.prepare("SELECT MAX(version) AS v FROM assets WHERE owner_id = ? AND type = ?").bind(p.ownerId, p.type).first<{ v: number | null }>();
  const version = (last?.v ?? 0) + 1;

  const key =
    p.type === "ingredient"
      ? version === 1 ? `ingredients/${p.slug}.${ext}` : `ingredients/${p.slug}-v${version}.${ext}`
      : `recipes/${p.slug}/hero-v${version}.${ext}`;

  const taken = await env.DB.prepare("SELECT id FROM assets WHERE r2_key = ?").bind(key).first();
  if (taken) return { status: 500, error: "key_conflict", message: `Já existe um asset com a chave ${key}.` };

  try {
    await env.ASSETS_BUCKET.put(key, await p.file.arrayBuffer(), { httpMetadata: { contentType: p.file.type, cacheControl: "public, max-age=31536000, immutable" } });
  } catch {
    return { status: 500, error: "r2_failed", message: "Não foi possível enviar a imagem para o R2. Nada foi salvo; tente novamente." };
  }

  const row: AssetRow = {
    id: newId("asset"), type: p.type, owner_id: p.ownerId, r2_key: key, filename: p.file.name || key.split("/").pop()!, mime_type: p.file.type,
    size_bytes: p.file.size, version, status: p.status ?? "review", reject_reason: null, created_at: now(), updated_at: now(), deleted_at: null,
  };
  try {
    await env.DB.prepare(
      "INSERT INTO assets (id, type, owner_id, r2_key, filename, mime_type, size_bytes, version, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).bind(row.id, row.type, row.owner_id, row.r2_key, row.filename, row.mime_type, row.size_bytes, row.version, row.status, row.created_at, row.updated_at).run();
  } catch {
    await env.ASSETS_BUCKET.delete(key).catch(() => undefined);
    return { status: 500, error: "db_failed", message: "A imagem foi enviada, mas o registro falhou e o arquivo foi removido. Tente novamente." };
  }
  return row;
}

export const isUploadError = (x: AssetRow | UploadError | { file: File }): x is UploadError => "error" in x;
