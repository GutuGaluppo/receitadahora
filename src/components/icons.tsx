import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowRight = (p: P) => (
  <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}><path d="M9 5l7 7-7 7" /></Svg>
);
export const ChevronLeft = (p: P) => (
  <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>
);
export const Close = (p: P) => (
  <Svg {...p}><path d="M5 5l14 14M19 5L5 19" /></Svg>
);
export const Check = (p: P) => (
  <Svg {...p} strokeWidth="2.2"><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
);
export const Plus = (p: P) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);
export const Pencil = (p: P) => (
  <Svg {...p}><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1zM14 7l3 3" /></Svg>
);
export const Leaf = (p: P) => (
  <Svg {...p}><path d="M5 19c0-8 5-14 15-14 0 9-5 15-13 15M5 19c3-5 6-8 11-10" /></Svg>
);
export const Heart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Svg {...p} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" />
  </Svg>
);
export const Dumbbell = (p: P) => (
  <Svg {...p} fill="currentColor"><path d="M3 9h2v6H3zM6 7h3v10H6zM15 7h3v10h-3zM19 9h2v6h-2zM9 11h6v2H9z" stroke="none" /></Svg>
);
export const Coins = (p: P) => (
  <Svg {...p}><ellipse cx="12" cy="6.5" rx="7" ry="3" /><path d="M5 6.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5M5 11.5v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></Svg>
);
export const Bolt = (p: P) => (
  <Svg {...p} fill="currentColor"><path d="M13 2L5 13.5h5.5L9.5 22 19 9.5h-6L13 2z" /></Svg>
);
export const Sparkle = (p: P) => (
  <Svg {...p}><path d="M12 3c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7z" /></Svg>
);
export const Shuffle = (p: P) => (
  <Svg {...p}><path d="M3 7h3c4 0 5 10 9 10h5M3 17h3c1.5 0 2.600-1.600 3.600-3.400M20 7h-5c-1.400 0-2.400.900-3.300 2.200M17 4l3 3-3 3M17 14l3 3-3 3" /></Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
);
export const Calendar = (p: P) => (
  <Svg {...p}><rect x="4" y="5.5" width="16" height="14.5" rx="2.200" /><path d="M4 10h16M8.500 3.500v4M15.500 3.500v4" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth="2.200" /></Svg>
);
export const People = (p: P) => (
  <Svg {...p}><circle cx="9" cy="8.500" r="3" /><path d="M3.500 19c.4-3.200 2.700-5 5.500-5s5.100 1.800 5.500 5M16 5.800a3 3 0 010 5.600M17.500 14.300c1.800.5 3 2.100 3.200 4.700" /></Svg>
);
export const Pin = (p: P) => (
  <Svg {...p}><path d="M12 21s-6.500-5.700-6.500-11a6.500 6.500 0 0113 0c0 5.300-6.500 11-6.500 11z" /><circle cx="12" cy="10" r="2.300" /></Svg>
);
export const Target = (p: P) => (
  <Svg {...p}><circle cx="11" cy="13" r="7.500" /><circle cx="11" cy="13" r="4" /><circle cx="11" cy="13" r="0.800" fill="currentColor" /><path d="M11 13l8-8M16 5h3.500V8.500" /></Svg>
);
export const Sliders = (p: P) => (
  <Svg {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Svg>
);
export const Bottle = (p: P) => (
  <Svg {...p}><path d="M9.500 3h5v3l1.500 2.500V20a1 1 0 01-1 1H9a1 1 0 01-1-1V8.500L9.500 6V3zM8 12h8" /></Svg>
);
export const Wheat = (p: P) => (
  <Svg {...p}><path d="M12 21V8M12 8c0-2 1-3.500 2.500-4.500M12 8c0-2-1-3.500-2.500-4.500M12 13c-2.500 0-4-1.500-4.500-3.500 2.500 0 4 1 4.500 3.500zM12 13c2.500 0 4-1.500 4.500-3.500-2.500 0-4 1-4.500 3.500zM12 18c-2.500 0-4-1.500-4.500-3.500 2.500 0 4 1 4.500 3.500zM12 18c2.500 0 4-1.500 4.500-3.500-2.500 0-4 1-4.500 3.500z" /></Svg>
);

/** Duas marcações empilhadas: o ícone da Biblioteca (contorno, sem círculo). */
export function LibraryStack({ size = 30, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      <path d="M11 6.500V6a2 2 0 012-2h11a2 2 0 012 2v17" />
      <path d="M6 10.500a2 2 0 012-2h10a2 2 0 012 2V27l-7-4.700L6 27V10.500z" />
    </svg>
  );
}

export const Bookmark = (p: P) => (
  <Svg {...p}><path d="M6.500 5a1.500 1.500 0 011.500-1.500h8A1.500 1.500 0 0117.500 5v15.500L12 16.500l-5.500 4V5z" /></Svg>
);
