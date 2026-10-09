import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** Cliente do navegador (singleton). null = Supabase não configurado → modo local. */
export function getBrowserClient(): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env) return null;
  client ??= createBrowserClient(env.url, env.key);
  return client;
}
