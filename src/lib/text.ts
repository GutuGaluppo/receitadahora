/** Minúsculas, sem acentos e sem espaços extras — base para comparar termos de alergia. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/** Radical bruto pt-BR: "ovos"→"ovo", "camaroes"→"camarao". */
export function stem(s: string): string {
  const n = norm(s);
  if (n.endsWith("oes")) return n.slice(0, -3) + "ao";
  if (n.endsWith("aes")) return n.slice(0, -3) + "ao";
  if (n.endsWith("s") && n.length > 3) return n.slice(0, -1);
  return n;
}

export function splitTerms(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
