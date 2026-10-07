import { useRef, useState } from "react";
import { Button } from "./ui";
import { useToast } from "./toast";
import { ApiError, api } from "../api";

export function AssetPreview({ url, alt, size = "md" }: { url?: string | null; alt: string; size?: "sm" | "md" | "lg" }) {
  const dim = { sm: "h-10 w-10", md: "h-16 w-16", lg: "aspect-[4/3] w-full" }[size];
  if (!url) {
    return (
      <div className={`${dim} flex shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400`} aria-label={`${alt}: sem imagem`}>
        <span aria-hidden>—</span>
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={`${dim} shrink-0 rounded-md border border-zinc-200 bg-zinc-50 object-cover`} />;
}

/** Envia um arquivo (multipart) e avisa o resultado; em erro, explica o que não foi salvo. */
export function UploadButton({ path, label, extra, onDone, variant = "secondary" }: { path: string; label: string; extra?: Record<string, string>; onDone: () => void; variant?: "primary" | "secondary" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function send(file: File) {
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    for (const [k, v] of Object.entries(extra ?? {})) form.set(k, v);
    try {
      await api(path, { method: "POST", form });
      toast.ok("Imagem enviada", "Salva no R2 e aguardando aprovação.");
      onDone();
    } catch (e) {
      const err = e as ApiError;
      toast.error(err.message, "Nada foi alterado. Tente novamente com outro arquivo.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={label} tabIndex={-1} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <Button variant={variant} disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Enviando…" : label}</Button>
    </>
  );
}
