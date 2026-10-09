import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Links dos e-mails de Auth (confirmação de cadastro e redefinição de senha), no formato token_hash.
 * Diferente do PKCE, funciona mesmo que a pessoa abra o e-mail em OUTRO navegador/dispositivo.
 * Template no Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup (ou recovery)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), type === "recovery" ? "/auth/reset" : "/");

  const supabase = await createServerSupabase();
  if (supabase && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/?auth=link_invalido", origin));
}
