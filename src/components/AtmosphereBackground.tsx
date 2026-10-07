"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { paletteBackground } from "@/lib/theme";
import type { RecipePalette } from "@/types";

type Layer = { id: number; palette: RecipePalette };

/**
 * Fundo da receita. Trocar de paleta faz um crossfade (gradiente não é animável via CSS):
 * a camada nova entra por cima e, ao terminar, a antiga é descartada.
 */
export function AtmosphereBackground({
  palette,
  mood,
}: {
  palette: RecipePalette;
  mood?: "rain" | "night" | null;
}) {
  const counter = useRef(0);
  const [layers, setLayers] = useState<Layer[]>([{ id: 0, palette }]);
  const key = palette.background + (palette.backgroundSecondary ?? "");

  useEffect(() => {
    setLayers((current) => {
      const last = current[current.length - 1];
      if (last.palette.background + (last.palette.backgroundSecondary ?? "") === key) return current;
      counter.current += 1;
      return [...current.slice(-1), { id: counter.current, palette }];
    });
  }, [key, palette]);

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
      {layers.map((layer, i) => (
        <motion.div
          key={layer.id}
          className="absolute inset-0"
          style={{ background: paletteBackground(layer.palette) }}
          initial={i === 0 && layers.length === 1 ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setLayers((cur) => (cur.length > 1 && cur[cur.length - 1].id === layer.id ? [layer] : cur))}
        />
      ))}
      {/* Atmosfera extremamente sutil: chuva esfria, noite escurece um pouco. */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms]"
        style={{
          opacity: mood ? 1 : 0,
          background:
            mood === "rain"
              ? "linear-gradient(180deg, rgba(70,95,125,0.07), rgba(70,95,125,0.02))"
              : "linear-gradient(180deg, rgba(20,20,40,0.07), rgba(20,20,40,0.02))",
        }}
      />
    </div>
  );
}
