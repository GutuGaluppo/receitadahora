import { createContext, useCallback, useContext, useState } from "react";

type Toast = { id: number; kind: "ok" | "error"; title: string; detail?: string };
const Ctx = createContext<{ ok: (t: string, d?: string) => void; error: (t: string, d?: string) => void }>({ ok() {}, error() {} });
export const useToast = () => useContext(Ctx);

/** Erros dizem o que aconteceu, o que não foi salvo e o que fazer. Ficam até serem dispensados. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], title: string, detail?: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, title, detail }]);
    if (kind === "ok") setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3500);
  }, []);
  const api = { ok: (t: string, d?: string) => push("ok", t, d), error: (t: string, d?: string) => push("error", t, d) };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`rounded-lg border bg-white p-3 shadow-lg ${t.kind === "error" ? "border-red-300" : "border-zinc-200"}`}>
            <div className="flex items-start gap-2">
              <span aria-hidden className={t.kind === "error" ? "text-red-600" : "text-emerald-600"}>{t.kind === "error" ? "✕" : "✓"}</span>
              <div className="flex-1">
                <p className="font-medium">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-zinc-600">{t.detail}</p>}
              </div>
              <button className="text-zinc-400 hover:text-zinc-700" onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="Dispensar">✕</button>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
