import { useState } from 'react'

// Keeps long histories fast: shows `size` rows and a "show more" control.
// Totals and summaries are always calculated from ALL rows, not just the visible ones.
export function usePaged(rows, size = 100) {
  const [limit, setLimit] = useState(size)
  const hidden = Math.max(rows.length - limit, 0)
  return {
    visible: hidden ? rows.slice(0, limit) : rows,
    more: hidden ? (
      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500">
        <span>Showing {limit} of {rows.length}</span>
        <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50" onClick={() => setLimit(limit + size)}>Show {Math.min(size, hidden)} more</button>
        <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => setLimit(rows.length)}>Show all</button>
      </div>
    ) : null,
  }
}

// Responsive table shell: a real <table> on desktop, horizontal scroll on narrow screens.
// columns: string | { label, align?: 'right' }
export function Table({ columns, children, footer, more }) {
  return (
    <>
    <div className="surface overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-linear-to-r from-blue-50 via-slate-50 to-slate-50">
              {columns.map((c) => {
                const col = typeof c === 'string' ? { label: c } : c
                return (
                  <th key={col.label} className={`whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-blue-800 ${col.align === 'right' ? 'text-right' : ''}`}>
                    {col.label}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 [&>tr]:transition-colors [&>tr:hover]:bg-blue-50/60">{children}</tbody>
          {footer && <tfoot className="border-t border-slate-200 bg-slate-50/60 text-sm font-semibold">{footer}</tfoot>}
        </table>
      </div>
    </div>
    {more}
    </>
  )
}

export function Td({ children, className = '', right = false, ...props }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-slate-700 ${right ? 'text-right tabular-nums' : ''} ${className}`} {...props}>{children}</td>
}

export function RowActions({ children }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>
}

export function IconButton({ icon: Icon, label, danger = false, ...props }) {
  return (
    <button type="button" aria-label={label} title={label} className={`flex h-8 w-8 min-h-0 items-center justify-center rounded-full text-slate-400 ${danger ? 'hover:bg-red-50 hover:text-red-500' : 'hover:bg-slate-100 hover:text-slate-700'}`} {...props}>
      <Icon size={15} />
    </button>
  )
}
