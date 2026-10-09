"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { deleteMyEvents, exportMyData } from "@/services/cloud-sync";
import { useApp } from "./providers/AppProvider";
import { useAuth } from "./providers/AuthProvider";
import { Turnstile, turnstileEnabled } from "./Turnstile";

type Mode = "idle" | "signin" | "signup" | "forgot";

const field = "themed h-12 w-full rounded-2xl border border-fg/15 bg-white/60 px-4 text-[16px] outline-none focus:border-strong";
const primary = "themed inline-flex h-12 w-full items-center justify-center rounded-full bg-strong px-6 text-[16px] font-medium text-white disabled:opacity-50";
const outline = "themed inline-flex h-12 w-full items-center justify-center rounded-full border border-strong/35 px-6 text-[16px] font-medium text-strong hover:bg-strong/5";

/** Conta: entrar, criar, recuperar senha, Google; com sessão: sair, exportar, apagar histórico/conta. Some quando o Supabase não está configurado. */
export function AccountPanel() {
  const { enabled, loading, user, supabase, signIn, signUp, signInWithGoogle, requestPasswordReset, signOut } = useAuth();
  const { eraseAll } = useApp();
  const [mode, setMode] = useState<Mode>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [captcha, setCaptcha] = useState<string | undefined>();
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const onToken = useCallback((t: string | undefined) => setCaptcha(t), []);

  if (!enabled || loading) return null;

  const needsCaptcha = turnstileEnabled();
  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setBusy(false);
    setCaptcha(undefined);
    setCaptchaKey((k) => k + 1);
    if (res.ok) {
      setMessage({ tone: "ok", text: okText });
      if (mode === "signin") setMode("idle");
    } else setMessage({ tone: "error", text: res.message ?? "Não foi possível concluir." });
  };

  const download = async () => {
    if (!supabase || !user) return;
    try {
      const data = await exportMyData(supabase, user.id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "receita-da-hora-meus-dados.json" });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ tone: "error", text: "Não foi possível exportar agora." });
    }
  };

  const clearHistory = async () => {
    if (!supabase || !user || !window.confirm("Apagar todo o histórico de sugestões vistas e abertas? Salvos e feedback são mantidos.")) return;
    try {
      await deleteMyEvents(supabase, user.id);
      setMessage({ tone: "ok", text: "Histórico apagado." });
    } catch {
      setMessage({ tone: "error", text: "Não foi possível apagar agora." });
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Excluir sua conta e TODOS os dados dela (perfil, salvos, feedback e histórico)? Isso não pode ser desfeito.")) return;
    setBusy(true);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      eraseAll();
      await signOut();
      setMessage({ tone: "ok", text: "Conta excluída." });
    } else setMessage({ tone: "error", text: "Não foi possível excluir agora. Tente novamente." });
  };

  const note = message && (
    <p role="status" className={`mt-3 text-[15px] ${message.tone === "error" ? "text-red-800" : "text-strong"}`}>{message.text}</p>
  );

  if (user) {
    return (
      <section aria-labelledby="conta" className="mt-10">
        <h3 id="conta" className="mb-1 inline-block border-b-2 border-strong pb-2 text-[18px] font-medium">Conta</h3>
        <div className="mb-3 border-t border-fg/10" />
        <p className="mb-4 text-muted">Você está conectado como <strong className="text-fg">{user.email}</strong>. Seus salvos e gostos acompanham você em qualquer dispositivo.</p>
        <div className="flex flex-col gap-2.5">
          <button type="button" className={outline} onClick={download}>Exportar meus dados</button>
          <button type="button" className={outline} onClick={clearHistory}>Apagar meu histórico de sugestões</button>
          <button type="button" className={outline} onClick={() => signOut()}>Sair</button>
          <button type="button" className="themed min-h-11 text-[15px] text-muted underline underline-offset-4" disabled={busy} onClick={deleteAccount}>Excluir minha conta</button>
        </div>
        {note}
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") run(() => signIn(email, password, captcha), "");
    else if (mode === "signup") run(() => signUp(email, password, captcha), "Se o e-mail for válido, enviamos um link de confirmação. Confira sua caixa de entrada.");
    else run(() => requestPasswordReset(email, captcha), "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.");
  };

  return (
    <section aria-labelledby="conta" className="mt-10">
      <h3 id="conta" className="mb-1 inline-block border-b-2 border-strong pb-2 text-[18px] font-medium">Conta</h3>
      <div className="mb-3 border-t border-fg/10" />
      {mode === "idle" ? (
        <>
          <p className="mb-4 max-w-sm text-muted">Crie uma conta para guardar salvos e gostos e continuar de onde parou em outro dispositivo. Sem conta, tudo segue neste aparelho.</p>
          <div className="flex flex-col gap-2.5">
            <button type="button" className={primary} onClick={() => { setMode("signin"); setMessage(null); }}>Entrar</button>
            <button type="button" className={outline} onClick={() => { setMode("signup"); setMessage(null); }}>Criar conta</button>
          </div>
          {note}
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate={false}>
          <input className={field} type="email" autoComplete="email" required placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode !== "forgot" && (
            <input
              className={field} type="password" required minLength={10} placeholder="Senha (mín. 10 caracteres)" aria-label="Senha"
              autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-[15px] text-muted">
              <input type="checkbox" className="mt-1" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>Li e concordo com a <Link href="/privacidade" target="_blank" className="underline underline-offset-4">Política de Privacidade</Link>.</span>
            </label>
          )}
          <Turnstile onToken={onToken} resetKey={captchaKey} />
          <button type="submit" className={primary} disabled={busy || (needsCaptcha && !captcha) || (mode === "signup" && !accepted)}>
            {busy ? "Aguarde…" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </button>
          {mode !== "forgot" && <button type="button" className={outline} onClick={() => run(() => signInWithGoogle(), "")}>Continuar com Google</button>}
          <div className="flex flex-wrap justify-between gap-2 text-[15px] text-muted">
            {mode === "signin" && <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => { setMode("forgot"); setMessage(null); }}>Esqueci a senha</button>}
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => { setMode("idle"); setMessage(null); }}>Voltar</button>
          </div>
          {note}
        </form>
      )}
    </section>
  );
}
