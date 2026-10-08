import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/receitas", label: "Receitas" },
  { to: "/ingredientes", label: "Ingredientes" },
  { to: "/lotes", label: "Lotes" },
  { to: "/revisao", label: "Revisão" },
  { to: "/factory", label: "Factory" },
];

export function Sidebar({ environment, user, reviewCount }: { environment?: string; user?: string; reviewCount?: number }) {
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h9a2 2 0 012 2v16l-6.500-4.500L4 21V5a2 2 0 012-2z" /></svg>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Receita da Hora</p>
            <p className="text-xs text-zinc-500">Studio</p>
          </div>
        </div>
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5 px-2">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `flex h-9 items-center justify-between rounded-md px-3 text-sm ${isActive ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}
          >
            {l.label}
            {l.to === "/revisao" && !!reviewCount && <span className="tabular rounded-full bg-zinc-900 px-1.5 text-xs text-white" aria-label={`${reviewCount} pendentes`}>{reviewCount}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500">
        {environment && environment !== "production" && <p className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">{environment}</p>}
        <p className="truncate">{user}</p>
      </div>
    </aside>
  );
}
