import type { ReactNode } from "react";

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };

export function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; empty: ReactNode }) {
  if (!rows.length) return <div className="rounded-lg border border-zinc-200 bg-white">{empty}</div>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            {columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-2.5 font-medium ${c.className ?? ""}`}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(r); } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={onRowClick ? "cursor-pointer hover:bg-zinc-50 focus-visible:bg-zinc-50" : ""}
            >
              {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
