import type { CSSProperties } from "react";
import type { RecipePalette } from "@/types";

export function paletteVars(p: RecipePalette): CSSProperties {
  return {
    "--bg": p.background,
    "--bg2": p.backgroundSecondary ?? p.background,
    "--accent": p.accent,
    "--strong": p.accentStrong,
    "--fg": p.text,
    "--muted": p.mutedText,
  } as CSSProperties;
}

export function paletteBackground(p: RecipePalette): string {
  return p.backgroundSecondary
    ? `linear-gradient(170deg, ${p.background} 0%, ${p.backgroundSecondary} 100%)`
    : p.background;
}
