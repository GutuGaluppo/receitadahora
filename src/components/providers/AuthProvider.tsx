"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

type Result = { ok: true } | { ok: false; message: string };

type AuthContextValue = {
  /** false = Supabase não configurado: o app segue 100% local, sem UI de conta. */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  supabase: SupabaseClient | null;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<Result>;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<Result>;
  signInWithGoogle: () => Promise<Result>;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || window.location.origin;

/** Mensagens neutras: nunca revelam se um e-mail já tem conta. */
const generic = (e: { message: string; code?: string } | null): Result =>
  e ? { ok: false, message: e.code === "invalid_credentials" ? "E-mail ou senha incorretos." : e.code === "weak_password" ? "Senha fraca. Use ao menos 10 caracteres, misturando letras e números." : "Não foi possível concluir. Tente novamente." } : { ok: true };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => (typeof window === "undefined" ? null : getBrowserClient()), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sem Supabase não há sessão para carregar
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signUp = useCallback<AuthContextValue["signUp"]>(
    async (email, password, captchaToken) => {
      if (!supabase) return { ok: false, message: "Contas indisponíveis." };
      const { error } = await supabase.auth.signUp({ email, password, options: { captchaToken, emailRedirectTo: `${site()}/auth/confirm` } });
      return generic(error);
    },
    [supabase],
  );

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password, captchaToken) => {
      if (!supabase) return { ok: false, message: "Contas indisponíveis." };
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
      return generic(error);
    },
    [supabase],
  );

  const signInWithGoogle = useCallback<AuthContextValue["signInWithGoogle"]>(async () => {
    if (!supabase) return { ok: false, message: "Contas indisponíveis." };
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${site()}/auth/callback` } });
    return generic(error);
  }, [supabase]);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email, captchaToken) => {
      if (!supabase) return { ok: false, message: "Contas indisponíveis." };
      await supabase.auth.resetPasswordForEmail(email, { captchaToken, redirectTo: `${site()}/auth/confirm?next=/auth/reset` });
      return { ok: true }; // resposta idêntica exista o e-mail ou não
    },
    [supabase],
  );

  const updatePassword = useCallback<AuthContextValue["updatePassword"]>(
    async (password) => {
      if (!supabase) return { ok: false, message: "Contas indisponíveis." };
      const { error } = await supabase.auth.updateUser({ password });
      return generic(error);
    },
    [supabase],
  );

  // Logout limpa a sessão; os dados remotos permanecem. O localStorage também fica (modo local continua funcionando).
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({ enabled: !!supabase, loading, user, supabase, signUp, signIn, signInWithGoogle, requestPasswordReset, updatePassword, signOut }),
    [supabase, loading, user, signUp, signIn, signInWithGoogle, requestPasswordReset, updatePassword, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
