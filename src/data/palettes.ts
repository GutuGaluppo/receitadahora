import type { RecipePalette } from "@/types";

/** Paletas nomeadas. Cada receita escolhe uma; o layout nunca muda. */
export const PALETTES = {
  warm: { background: "#F4E8D6", backgroundSecondary: "#EBD2B0", accent: "#C8663D", accentStrong: "#9E4325", text: "#3B2417", mutedText: "#6E5342" },
  fresh: { background: "#E4EDD6", backgroundSecondary: "#D3E3BC", accent: "#C9B53C", accentStrong: "#3F6B2F", text: "#1F3318", mutedText: "#4D6144" },
  saffron: { background: "#F1C95A", backgroundSecondary: "#E5B03C", accent: "#8E2B3F", accentStrong: "#6E1B2E", text: "#2E1015", mutedText: "#5E4220" },
  cozy: { background: "#3A2F2A", backgroundSecondary: "#2B221E", accent: "#D98A4A", accentStrong: "#E9A66A", text: "#F4E7DA", mutedText: "#C2AE9C" },
  morning: { background: "#F7EBC9", backgroundSecondary: "#F0DBA0", accent: "#E0A030", accentStrong: "#8F530A", text: "#35260F", mutedText: "#6E5A2B" },
  berry: { background: "#F0DDE0", backgroundSecondary: "#E6C4CB", accent: "#C14B6A", accentStrong: "#8F2646", text: "#3A1620", mutedText: "#6F4452" },
  sea: { background: "#DCE9EC", backgroundSecondary: "#C3DCE2", accent: "#3E8FA3", accentStrong: "#1F5F72", text: "#12303A", mutedText: "#43626C" },
  tomato: { background: "#F5DDD0", backgroundSecondary: "#EBBFA8", accent: "#D2452B", accentStrong: "#A12B16", text: "#3D170E", mutedText: "#74443A" },
  earth: { background: "#E9DFD0", backgroundSecondary: "#D6C6AE", accent: "#8A6A3F", accentStrong: "#5E4524", text: "#2E2316", mutedText: "#625240" },
  night: { background: "#2A3340", backgroundSecondary: "#1E2630", accent: "#E0B070", accentStrong: "#EBC48C", text: "#EEF0F2", mutedText: "#AEB8C4" },
} satisfies Record<string, RecipePalette>;

export type PaletteName = keyof typeof PALETTES;
