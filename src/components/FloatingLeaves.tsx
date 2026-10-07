import { hash, seeded } from "@/lib/color";

type Corner = "tr" | "bl" | "br" | "tl";

/** Folhas de sálvia e migalhas de abóbora nos cantos — atmosfera, nunca ilustração. */
export function FloatingLeaves({ corners = ["tr", "bl"], seed = "onboarding" }: { corners?: Corner[]; seed?: string }) {
  const rnd = seeded(hash(seed));
  const pos: Record<Corner, string> = {
    tr: "right-[-78px] top-[96px]",
    tl: "left-[-24px] top-[-10px]",
    bl: "bottom-[-10px] left-[-26px]",
    br: "bottom-[-10px] right-[-26px]",
  };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {corners.map((c) => {
        const leaves = Array.from({ length: 3 }, () => ({ x: rnd() * 140 + 20, y: rnd() * 140 + 20, r: rnd() * 360, s: 0.8 + rnd() * 0.7 }));
        const crumbs = Array.from({ length: 12 }, () => ({ x: rnd() * 190 + 5, y: rnd() * 190 + 5, r: 1.6 + rnd() * 3.2 }));
        return (
          <svg key={c} width="210" height="210" viewBox="0 0 210 210" className={`absolute ${pos[c]}`}>
            {crumbs.map((m, i) => (
              <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={i % 3 ? "#E8923B" : "#F3B24F"} opacity="0.75" />
            ))}
            {leaves.map((l, i) => (
              <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}>
                <path d="M0 -26C16 -14 16 14 0 26C-16 14 -16 -14 0 -26Z" fill="#4A6A35" />
                <path d="M0 -24V24" stroke="#DCE8C9" strokeOpacity="0.4" strokeWidth="1.2" />
              </g>
            ))}
          </svg>
        );
      })}
    </div>
  );
}

/** Silhueta de skyline genérica (nunca turística), bem discreta. */
export function Skyline() {
  return (
    <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] w-full opacity-[0.16]">
      <path d="M0 120V84h18V70h14v14h12V58h16v26h10V76h20v8h14V50h12v34h16V64h18v20h12V72h22v12h16V40h4V28h2v12h4v44h14V74h20v10h18V62h16v22h14V80h20v40z" fill="#8A4B2A" />
    </svg>
  );
}
