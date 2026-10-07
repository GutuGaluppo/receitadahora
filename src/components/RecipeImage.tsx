/* eslint-disable @next/next/no-img-element */
import { hash, mix, seeded } from "@/lib/color";
import type { Recipe } from "@/types";

/**
 * Prato como objeto editorial: tigela isolada, sombra suave, folhas e migalhas flutuando.
 * Com `imageUrl` usa a foto (borda dissolvida no fundo); sem ela, desenha a tigela
 * a partir do acento da paleta. Ocupa 100% da largura do contêiner.
 */
export function RecipeImage({ recipe, className = "" }: { recipe: Recipe; className?: string }) {
  if (recipe.imageUrl) {
    return (
      <img
        src={recipe.imageUrl}
        alt={recipe.title}
        width={980}
        height={890}
        decoding="async"
        className={`feather mx-auto block h-auto max-h-[52dvh] w-auto max-w-full lg:max-h-[78dvh] select-none ${className}`}
        draggable={false}
      />
    );
  }

  const rnd = seeded(hash(recipe.slug));
  const { accent } = recipe.palette;
  const food = [mix(accent, "#000000", 0.2), accent, mix(accent, "#ffffff", 0.3), mix(accent, "#000000", 0.38), mix(accent, "#f5c26b", 0.35)];
  const leafTones = ["#4F6F36", "#3F5E2E", "#617F3F"];

  // monte de comida: muitos pedaços irregulares, mais altos no centro
  const pieces = Array.from({ length: 46 }, () => {
    const t = rnd();
    const ang = rnd() * Math.PI * 2;
    const dist = Math.sqrt(t) * 118;
    const cx = 200 + Math.cos(ang) * dist;
    const mound = 1 - Math.min(1, dist / 130);
    return {
      cx,
      cy: 178 + Math.sin(ang) * dist * 0.34 - mound * 34,
      rx: 9 + rnd() * 17,
      ry: 6 + rnd() * 11,
      rot: rnd() * 180 - 90,
      fill: food[Math.floor(rnd() * food.length)],
    };
  }).sort((a, b) => a.cy - b.cy);

  const leaves = Array.from({ length: 7 }, () => ({
    x: rnd() * 380 + 10,
    y: rnd() * 300 + 10,
    rot: rnd() * 360,
    s: 0.55 + rnd() * 0.6,
    fill: leafTones[Math.floor(rnd() * leafTones.length)],
  })).filter((l) => !(l.x > 70 && l.x < 330 && l.y > 90 && l.y < 250));

  const crumbs = Array.from({ length: 16 }, () => ({
    x: rnd() * 390 + 5,
    y: rnd() * 330 + 20,
    r: 1.4 + rnd() * 2.6,
    fill: food[Math.floor(rnd() * food.length)],
  }));

  const id = recipe.slug;
  return (
    <svg
      viewBox="0 0 400 360"
      role="img"
      aria-label={recipe.title}
      className={`mx-auto block h-auto max-h-[46dvh] w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={`blur-${id}`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <linearGradient id={`bowl-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFEFB" />
          <stop offset="100%" stopColor="#E9DFCF" />
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <path d="M60 188C60 120 120 60 200 60s140 60 140 128c0 22-60 42-140 42S60 210 60 188z" />
        </clipPath>
        <radialGradient id={`inner-${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#F4EBDD" />
          <stop offset="100%" stopColor="#D9CCB8" />
        </radialGradient>
      </defs>

      {crumbs.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r} fill={c.fill} opacity="0.75" />
      ))}

      <ellipse cx="200" cy="318" rx="140" ry="16" fill="#3A2412" opacity="0.28" filter={`url(#blur-${id})`} />

      {/* corpo da tigela */}
      <path d="M52 188c4 70 62 124 148 124s144-54 148-124H52z" fill={`url(#bowl-${id})`} />
      <path d="M52 188c10 18 28 36 52 50" stroke="#fff" strokeOpacity="0.5" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* boca da tigela */}
      <ellipse cx="200" cy="188" rx="148" ry="46" fill="#FBF6EC" />
      <ellipse cx="200" cy="188" rx="136" ry="40" fill={`url(#inner-${id})`} />

      {/* comida */}
      <g clipPath={`url(#clip-${id})`}>
        {pieces.map((p, i) => (
          <g key={i} transform={`translate(${p.cx} ${p.cy}) rotate(${p.rot})`}>
            <ellipse rx={p.rx} ry={p.ry} fill={p.fill} />
            <ellipse cx={-p.rx * 0.25} cy={-p.ry * 0.3} rx={p.rx * 0.5} ry={p.ry * 0.28} fill="#fff" opacity="0.2" />
            <ellipse rx={p.rx} ry={p.ry} fill="none" stroke="#000" strokeOpacity="0.1" />
          </g>
        ))}
      </g>

      {/* folhas flutuando */}
      {leaves.map((l, i) => (
        <g key={`l${i}`} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s})`}>
          <path d="M0 -22C14 -12 14 12 0 22C-14 12 -14 -12 0 -22Z" fill={l.fill} />
          <path d="M0 -20V20" stroke="#E7F0D8" strokeOpacity="0.45" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}
