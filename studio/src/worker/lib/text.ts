/** minúsculas, sem acentos, só letras/números separados por espaço */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return normalize(s).replace(/\s+/g, "-");
}

/** Palavras que descrevem preparo/estado, não o ingrediente em si. */
const MODIFIERS = new Set(
  (
    "fresco fresca frescos frescas picado picada picados picadas ralado ralada ralados raladas maduro madura maduros maduras " +
    "cozido cozida cozidos cozidas cru crua crus cruas grande grandes medio media medios medias pequeno pequena pequenos pequenas " +
    "cubos cubo fatias fatia fatiado fatiada fatiados fatiadas triturado triturada amassado amassada congelado congelada " +
    "seco seca secos secas moido moida inteiro inteira desfiado desfiada em"
  ).split(" "),
);
const STOP = new Set(["de", "da", "do", "das", "dos", "a", "o", "e", "com", "ou", "para", "no", "na", "ao"]);

export function singularToken(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith("oes") || t.endsWith("aes")) return t.slice(0, -3) + "ao";
  if (t.endsWith("res") || t.endsWith("zes")) return t.slice(0, -2);
  if (t.endsWith("ss") || t.endsWith("us") || t.endsWith("is")) return t;
  if (t.endsWith("s")) return t.slice(0, -1);
  return t;
}

/** Chave canônica do ingrediente: "Tomates frescos (maduros)" → "tomate". */
export function ingredientKey(name: string): string {
  const base = name.replace(/\([^)]*\)/g, " ");
  return normalize(base)
    .split(" ")
    .filter((t) => t && !MODIFIERS.has(t) && !STOP.has(t))
    .map(singularToken)
    .join(" ");
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t && !STOP.has(t))
    .map(singularToken);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export const similarity = (a: string, b: string): number =>
  a.length === 0 && b.length === 0 ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length);

export function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
