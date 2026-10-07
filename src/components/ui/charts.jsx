import { formatCurrency } from '../../lib/format'

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#94a3b8']

export function DonutChart({ segments, size = 'h-32 w-32' }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  let acc = 0
  const r = 15.9155
  return (
    <svg viewBox="0 0 36 36" className={`${size} flex-shrink-0 -rotate-90`} role="img" aria-label="Breakdown chart">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      {segments.map((s) => {
        const pct = (s.value / total) * 100
        const offset = -acc
        acc += pct
        return <circle key={s.label} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} pathLength="100"><title>{`${s.label}: ${formatCurrency(s.value)}`}</title></circle>
      })}
    </svg>
  )
}

export function DonutWithLegend({ groups, max = 7 }) {
  const top = groups.slice(0, max)
  const rest = groups.slice(max)
  const rows = rest.length ? [...top, { key: 'Others', amount: rest.reduce((a, g) => a + g.amount, 0), pct: rest.reduce((a, g) => a + g.pct, 0) }] : top
  const segments = rows.map((g, i) => ({ label: g.key, value: g.amount, color: CHART_COLORS[i % CHART_COLORS.length] }))
  return (
    <div className="flex flex-wrap items-center gap-5">
      <DonutChart segments={segments} />
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {rows.map((g, i) => (
          <li key={g.key} className="flex items-center gap-2">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{g.key}</span>
            <span className="tabular-nums text-slate-900">{formatCurrency(g.amount)}</span>
            <span className="w-9 text-right tabular-nums text-slate-400">{g.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// rows: [{ key, short, income, expenses }]
export function IncomeExpenseBars({ rows, height = 'h-36' }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expenses]))
  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Income</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Expenses</span>
      </div>
      <div className={`flex items-end justify-between gap-2 ${height}`}>
        {rows.map((r) => (
          <div key={r.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center gap-1">
              <div className="w-3 max-w-[40%] rounded-t bg-emerald-500" style={{ height: `${(r.income / max) * 100}%`, minHeight: r.income > 0 ? 2 : 0 }} title={`${r.label} income: ${formatCurrency(r.income)}`} />
              <div className="w-3 max-w-[40%] rounded-t bg-red-400" style={{ height: `${(r.expenses / max) * 100}%`, minHeight: r.expenses > 0 ? 2 : 0 }} title={`${r.label} expenses: ${formatCurrency(r.expenses)}`} />
            </div>
            <span className="text-[10px] text-slate-400">{r.short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProgressBar({ pct, color = 'bg-blue-600' }) {
  const p = Math.max(0, Math.min(pct || 0, 100))
  return <div className="h-1.5 w-full rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${color}`} style={{ width: `${p > 0 ? Math.max(p, 3) : 0}%` }} /></div>
}
