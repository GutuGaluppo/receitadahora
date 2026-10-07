"use client";

import { motion } from "framer-motion";
import { Bolt, Heart, Leaf, Shuffle } from "./icons";
import type { Intent } from "@/types";

const OPTIONS: { id: Intent; label: string; Icon: typeof Bolt }[] = [
  { id: "faster", label: "Mais rápido", Icon: Bolt },
  { id: "lighter", label: "Mais leve", Icon: Leaf },
  { id: "comfort", label: "Algo reconfortante", Icon: Heart },
  { id: "surprise", label: "Surpreenda-me", Icon: Shuffle },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Bottom sheet (mobile) / cartão flutuante (desktop). A foto continua visível
 * atrás, levemente escurecida — não é um modal pesado.
 */
export function AlternativePrompt({
  onChoose,
  onCancel,
  isDesktop,
}: {
  onChoose: (intent: Intent) => void;
  onCancel: () => void;
  isDesktop: boolean;
}) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onCancel}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alt-title"
        className={`themed fixed z-50 bg-card px-6 pb-8 pt-4 shadow-[0_-12px_40px_-12px_rgba(60,30,10,0.3)] backdrop-blur-md ${
          isDesktop
            ? "left-1/2 top-1/2 w-[440px] rounded-3xl pt-8"
            : "inset-x-0 bottom-0 rounded-t-[28px]"
        }`}
        initial={isDesktop ? { opacity: 0, x: "-50%", y: "-46%" } : { y: "100%" }}
        animate={isDesktop ? { opacity: 1, x: "-50%", y: "-50%" } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, x: "-50%", y: "-46%" } : { y: "100%" }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        {!isDesktop && <div aria-hidden className="mx-auto mb-5 h-1 w-10 rounded-full bg-fg/15" />}
        <h2 id="alt-title" className="mb-4 text-[19px] font-medium">
          O que você prefere agora?
        </h2>
        <ul className="space-y-2.5">
          {OPTIONS.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChoose(id)}
                className="themed flex min-h-14 w-full items-center gap-4 rounded-2xl bg-accent/10 px-5 text-left text-[16px] transition-colors hover:bg-accent/20"
              >
                <Icon size={20} className="text-strong" />
                {label}
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onCancel}
          className="mx-auto mt-3 block min-h-11 px-4 text-[15px] text-muted hover:text-fg"
        >
          Voltar
        </button>
      </motion.div>
    </>
  );
}
