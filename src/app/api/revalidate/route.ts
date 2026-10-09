import { revalidateTag } from "next/cache";
import { verify } from "@/lib/webhook-signature";

/**
 * Webhook do Studio: publicar / despublicar / editar publicada → invalida o catálogo.
 * `{ expire: 0 }` é deliberado: nunca servir o conteúdo antigo enquanto revalida
 * (despublicação por risco alimentar não pode ficar "stale-while-revalidate").
 */
export async function POST(request: Request) {
  const secret = process.env.STUDIO_REVALIDATE_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ event: "revalidate_misconfigured", error: "STUDIO_REVALIDATE_SECRET ausente" }));
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const body = await request.text(); // corpo bruto: é ele que foi assinado
  const verdict = verify({
    secret,
    timestamp: request.headers.get("x-studio-timestamp"),
    signature: request.headers.get("x-studio-signature"),
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  });

  if (verdict !== "ok") {
    console.warn(JSON.stringify({ event: "revalidate_rejected", verdict }));
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  revalidateTag("catalog", { expire: 0 });
  console.log(JSON.stringify({ event: "revalidate_ok" }));
  return Response.json({ ok: true });
}
