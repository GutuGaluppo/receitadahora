/* eslint-disable @next/next/no-img-element */
import { hash, mix, seeded } from "@/lib/color";
import type { Recipe } from "@/types";

/**
 * Prato recortado, isolado e com sombra suave. Quando a receita tem `imageUrl`
 * (foto recortada em PNG/WebP), usa a foto; senão desenha um prato a partir da paleta.
 */
export function RecipeImage({ recipe, className }: { recipe: Recipe; className?: string }) {
  if (recipe.imageUrl) {
    return (
      <img
        src={recipe.imageUrl}
        alt={recipe.title}
        className={className}
        style={{ filter: "drop-shadow(0 18px 22px rgba(0,0,0,0.22))" }}
      />
    );
  }

  const rnd = seeded(hash(recipe.slug));
  const { accent } = recipe.palette;
  const tones = [mix(accent, "#000000", 0.18), accent, mix(accent, "#ffffff", 0.28), mix(accent, "#000000", 0.35)];
  const herbs = ["#6F9A45", "#8DB05B", "#4F7A35"];

  const blobs = Array.from({ length: 6 }, () => {
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() * 62;
    return {
      cx: 200 + Math.cos(ang) * dist,
      cy: 190 + Math.sin(ang) * dist,
      r: 30 + rnd() * 26,
      fill: tones[Math.floor(rnd() * tones.length)],
    };
  });
  const garnish = Array.from({ length: 12 }, () => {
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() * 78;
    return {
      cx: 200 + Math.cos(ang) * dist,
      cy: 190 + Math.sin(ang) * dist,
      r: 2.5 + rnd() * 4,
      fill: herbs[Math.floor(rnd() * herbs.length)],
    };
  });

  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={recipe.title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={`soft-${recipe.slug}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id={`plate-${recipe.slug}`} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#FFFDF8" />
          <stop offset="100%" stopColor="#EDE4D5" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="350" rx="150" ry="22" fill="#000" opacity="0.22" filter={`url(#soft-${recipe.slug})`} />
      <circle cx="200" cy="190" r="168" fill={`url(#plate-${recipe.slug})`} />
      <circle cx="200" cy="190" r="142" fill="none" stroke="#E2D7C4" strokeWidth="2" />
      <circle cx="200" cy="190" r="118" fill="#F7F1E6" />
      <g>
        {blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={b.fill} opacity="0.95" />
        ))}
        {blobs.slice(0, 3).map((b, i) => (
          <ellipse key={`h${i}`} cx={b.cx - b.r * 0.3} cy={b.cy - b.r * 0.35} rx={b.r * 0.35} ry={b.r * 0.2} fill="#fff" opacity="0.22" />
        ))}
        {garnish.map((g, i) => (
          <circle key={`g${i}`} cx={g.cx} cy={g.cy} r={g.r} fill={g.fill} />
        ))}
      </g>
    </svg>
  );
}
