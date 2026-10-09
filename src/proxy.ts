import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Proxy (Next 16; substitui middleware.ts) — SOMENTE renova a sessão do Supabase nos cookies.
 * Autorização fica perto dos dados (RLS), não aqui. Visitantes sem cookie de sessão passam direto (sem chamada de rede).
 */
export async function proxy(request: NextRequest) {
  const env = supabaseEnv();
  if (!env || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims(); // valida/renova o token e dispara setAll se necessário
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|recipes/|api/revalidate|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
