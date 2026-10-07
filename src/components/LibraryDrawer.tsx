"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { SavedRecipes } from "./SavedRecipes";
import { TasteProfile } from "./TasteProfile";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Desktop: painel à direita (~42vw), Home continua visível atrás.
 * Mobile: tela cheia. A Home nunca desmonta, então o scroll/estado dela é preservado.
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

  return (
    <AnimatePresence>
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
            aria-label="Biblioteca"
            className="themed fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-strong/15 bg-paper shadow-[-12px_0_40px_-20px_rgba(0,0,0,0.25)] lg:w-[42vw] lg:min-w-[440px] lg:max-w-[640px]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <header className="flex items-center justify-between px-6 pb-2 pt-4 sm:px-10">
              <h2 className="font-serif text-2xl">Biblioteca</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Fechar biblioteca"
                className="themed flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-fg"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="flex-1 space-y-12 overflow-y-auto overscroll-contain px-6 pb-16 pt-6 sm:px-10">
              <SavedRecipes onOpen={onOpenRecipe} />
              <TasteProfile />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
