"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";

function Form() {
  const { enabled, user, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return null;
  if (!enabled || !user) {
    return <p className="text-muted">Este link expirou ou já foi usado. <Link className="underline underline-offset-4" href="/">Voltar ao início</Link> e peça um novo em “Esqueci a senha”.</p>;
  }
  if (done) return <p>Senha atualizada. <Link className="underline underline-offset-4" href="/">Continuar</Link></p>;

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await updatePassword(password);
        if (res.ok) setDone(true);
        else setError(res.message);
      }}
    >
      <input
        className="h-12 rounded-2xl border border-black/15 bg-white/70 px-4 text-[16px]" type="password" required minLength={10} autoComplete="new-password"
        placeholder="Nova senha (mín. 10 caracteres)" aria-label="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)}
      />
      <button className="h-12 rounded-full bg-[#B5412A] px-6 text-[16px] font-medium text-white" type="submit">Salvar nova senha</button>
      {error && <p role="alert" className="text-red-800">{error}</p>}
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
      <h1 className="text-[28px] font-medium">Redefinir senha</h1>
      <AuthProvider>
        <Form />
      </AuthProvider>
    </main>
  );
}
