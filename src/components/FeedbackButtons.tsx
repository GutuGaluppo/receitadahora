"use client";

import { useState } from "react";
import type { FeedbackReason } from "@/types";

const REASONS: { id: FeedbackReason | undefined; label: string }[] = [
  { id: "too-slow", label: "Demora demais" },
  { id: "too-heavy", label: "Muito pesada" },
  { id: "ingredients", label: "Não curto os ingredientes" },
  { id: "not-now", label: "Agora não" },
  { id: undefined, label: "Só não é pra mim" },
];

/** Linha discreta de feedback; "Outra sugestão" entra como último item. */
export function FeedbackButtons({
  onLike,
  onDislike,
  onOther,
}: {
  onLike: () => void;
  onDislike: (reason?: FeedbackReason) => void;
  onOther: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div role="group" aria-label="Por que não é pra você?" className="flex flex-wrap justify-center gap-2">
        {REASONS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onDislike(r.id)}
            className="themed min-h-11 rounded-full border border-strong/30 px-4 text-sm hover:border-strong hover:bg-strong/5"
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  const link = "themed min-h-11 px-3 text-[15px] text-muted hover:text-fg";
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1">
      <button
        type="button"
        aria-pressed={liked}
        onClick={() => {
          if (liked) return;
          setLiked(true);
          onLike();
        }}
        className={`${link} ${liked ? "!text-strong font-medium" : ""}`}
      >
        {liked ? "Gostei ✓" : "Gostei"}
      </button>
      <span aria-hidden className="text-muted/60">·</span>
      <button type="button" onClick={() => setAsking(true)} className={link}>
        Não é pra mim
      </button>
      <span aria-hidden className="text-muted/60">·</span>
      <button type="button" onClick={onOther} className={link}>
        Outra sugestão
      </button>
    </div>
  );
}
