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

export function FeedbackButtons({
  onLike,
  onDislike,
}: {
  onLike: () => void;
  onDislike: (reason?: FeedbackReason) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div role="group" aria-label="Por que não é pra você?" className="flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onDislike(r.id)}
            className="themed min-h-11 rounded-full border border-strong/40 px-4 text-sm text-fg hover:border-strong"
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        aria-pressed={liked}
        onClick={() => {
          if (liked) return;
          setLiked(true);
          onLike();
        }}
        className={`themed min-h-11 px-3 ${liked ? "font-medium text-strong" : "text-fg hover:text-strong"}`}
      >
        {liked ? "Gostei ✓" : "Gostei"}
      </button>
      <span aria-hidden className="text-muted">
        ·
      </span>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="themed min-h-11 px-3 text-fg hover:text-strong"
      >
        Não é pra mim
      </button>
    </div>
  );
}
