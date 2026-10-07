"use client";

import { motion } from "framer-motion";
import type { Intent } from "@/types";

const OPTIONS: { id: Intent; label: string; hint: string }[] = [
  { id: "faster", label: "Mais rápido", hint: "prioriza o que sai em até 20 min" },
  { id: "lighter", label: "Mais leve", hint: "menos peso, mais proteína" },
  { id: "comfort", label: "Algo reconfortante", hint: "quentinho, de abraçar" },
  { id: "surprise", label: "Surpreenda-me", hint: "algo fora da sua rotina" },
];

/** Pergunta integrada ao layout — sem modal. */
export function AlternativePrompt({
  onChoose,
  onCancel,
}: {
  onChoose: (intent: Intent) => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-md text-left"
      role="group"
      aria-labelledby="alt-title"
    >
      <h2 id="alt-title" className="mb-3 text-center font-serif text-xl">
        O que combina melhor com você agora?
      </h2>
      <ul className="divide-y divide-strong/15 border-y border-strong/15">
        {OPTIONS.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onChoose(o.id)}
              className="themed group flex min-h-12 w-full items-baseline justify-between gap-4 px-1 py-3 text-left"
            >
              <span className="font-medium text-fg group-hover:text-strong">{o.label}</span>
              <span className="text-xs text-muted">{o.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="mx-auto mt-3 block min-h-11 px-4 text-sm text-muted hover:text-fg"
      >
        Voltar
      </button>
    </motion.div>
  );
}
