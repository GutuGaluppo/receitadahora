import type { RecipePalette } from "@/types";

/**
 * Identidade aprovada: fundos claros e quentes em degradê, texto quase preto,
 * acento ferrugem. Cada receita desloca o matiz; o layout nunca muda.
 */
export const PALETTES = {
  /** Abóbora / pêssego — referência principal. */
  warm: { background: "#F8DFC2", backgroundSecondary: "#EFC49A", accent: "#C0502F", accentStrong: "#B5412A", text: "#1B1411", mutedText: "#5F5249" },
  fresh: { background: "#E7EED6", backgroundSecondary: "#CDE0B4", accent: "#6E9A3F", accentStrong: "#2F5A2A", text: "#16200F", mutedText: "#4D5E44" },
  saffron: { background: "#F8E0A0", backgroundSecondary: "#EBBF5C", accent: "#B8651B", accentStrong: "#8F3E14", text: "#241708", mutedText: "#66512A" },
  cozy: { background: "#F6D7C4", backgroundSecondary: "#E8A98C", accent: "#B84A2B", accentStrong: "#9A2F1B", text: "#201210", mutedText: "#6A4A40" },
  morning: { background: "#FAEBC6", backgroundSecondary: "#F2D58F", accent: "#C98A1E", accentStrong: "#94560E", text: "#231A0B", mutedText: "#6B5A33" },
  berry: { background: "#F4DDE2", backgroundSecondary: "#E7B9C5", accent: "#C0476A", accentStrong: "#962446", text: "#2A1119", mutedText: "#6E4753" },
  sea: { background: "#DDEBEE", backgroundSecondary: "#BCD8DF", accent: "#3E8FA3", accentStrong: "#1F5F72", text: "#0F2830", mutedText: "#43626C" },
  tomato: { background: "#F7D8C6", backgroundSecondary: "#EBA487", accent: "#D2452B", accentStrong: "#A12B16", text: "#2A120B", mutedText: "#74443A" },
  earth: { background: "#EDE0CC", backgroundSecondary: "#D9C3A1", accent: "#8A6A3F", accentStrong: "#6B4A22", text: "#21190F", mutedText: "#625240" },
  night: { background: "#E6E1F3", backgroundSecondary: "#C8BFE6", accent: "#5B52B0", accentStrong: "#2E2A6B", text: "#17142B", mutedText: "#524D78" },
} satisfies Record<string, RecipePalette>;

export type PaletteName = keyof typeof PALETTES;
