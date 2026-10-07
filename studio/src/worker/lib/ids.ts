const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32 (minúsculo)

/** ID ordenável por tempo: <prefixo>_<48 bits de timestamp><80 bits aleatórios>. */
export function newId(prefix: "recipe" | "ingredient" | "asset" | "batch" | "alias" | "ri"): string {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let rand = "";
  for (let i = 0; i < 16; i++) rand += ALPHABET[rnd[i] % 32];
  return `${prefix}_${time}${rand}`;
}

export const now = () => new Date().toISOString();
