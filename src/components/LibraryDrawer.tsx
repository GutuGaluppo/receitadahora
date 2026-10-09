"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AccountPanel } from "./AccountPanel";
import { ChevronLeft, Close, Sliders } from "./icons";
import { SavedRecipes } from "./SavedRecipes";
import { TasteProfile } from "./TasteProfile";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Desktop: cartão flutuante à direita, a Home continua visível atrás.
 * Mobile: tela cheia. A Home nunca desmonta, então scroll e estado dela são preservados.
 */
export function LibraryDrawer({
  open,
  onClose,
  onOpenRecipe,
}: {
  open: boolean;
  onClose: () => void;
  onOpenRecipe: (id: string) => void;
}) {
  const [view, setView] = useState<"library" | "taste">("library");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    if (window.matchMedia("(max-width: 1023px)").matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  const close = (
    <button
      ref={closeRef}
      type="button"
      onClick={onClose}
      aria-label="Fechar biblioteca"
      className="themed flex h-11 w-11 items-center justify-center rounded-full text-strong hover:bg-strong/10"
    >
      <Close size={24} />
    </button>
  );

  return (
    <AnimatePresence onExitComplete={() => setView("library")}>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-black/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={view === "taste" ? "Meu gosto" : "Biblioteca"}
            className="themed fixed inset-0 z-50 flex flex-col bg-card backdrop-blur-xl lg:inset-y-6 lg:left-auto lg:right-6 lg:w-[min(44vw,600px)] lg:rounded-[28px] lg:shadow-[0_30px_80px_-20px_rgba(70,35,10,0.45)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-12 pt-6 sm:px-9">
              {view === "library" ? (
                <>
                  <header className="mb-6 flex items-center justify-between gap-3">
                    <h2 className="display text-[40px]">Biblioteca</h2>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setView("taste")}
                        className="themed flex h-11 items-center gap-2 rounded-2xl bg-accent/12 px-4 text-[15px] font-medium text-strong hover:bg-accent/20"
                      >
                        <Sliders size={20} />
                        Meu gosto
                      </button>
                      {close}
                    </div>
                  </header>
                  <SavedRecipes onOpen={onOpenRecipe} />
                  <AccountPanel />
                </>
              ) : (
                <>
                  <header className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setView("library")}
                        className="themed -ml-2 mb-2 flex min-h-11 items-center gap-1 px-2 text-[15px] text-muted hover:text-fg"
                      >
                        <ChevronLeft size={18} /> Biblioteca
                      </button>
                      <h2 className="display text-[40px]">Meu gosto</h2>
                    </div>
                    {close}
                  </header>
                  <TasteProfile />
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
