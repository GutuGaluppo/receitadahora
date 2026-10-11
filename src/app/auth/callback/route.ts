import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** Retorno do OAuth (Google): troca o `code` por sessão e volta para um caminho INTERNO seguro. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createServerSupabase();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/?auth=falha", origin));
}
