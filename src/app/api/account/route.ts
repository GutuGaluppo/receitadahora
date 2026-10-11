import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * Exclusão de conta (LGPD). Único lugar que usa a service_role — só no servidor, depois de
 * confirmar a sessão. Apagar auth.users leva perfil, salvos, feedback e eventos (on delete cascade).
 */
export async function DELETE() {
  const env = supabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceKey) return Response.json({ error: "not_configured" }, { status: 503 });

  const supabase = await createServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!data.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const admin = createClient(env.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) {
    console.error(JSON.stringify({ event: "account_delete_failed", error: error.message }));
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
  await supabase?.auth.signOut();
  return Response.json({ ok: true });
}
