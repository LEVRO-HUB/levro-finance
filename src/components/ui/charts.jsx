import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/format'

export const CHART_COLORS = ['#4f93ff', '#34d399', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#f472b6', '#a3e635', '#94a3b8']

export function DonutChart({ segments, size = 'h-36 w-36' }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  let acc = 0
  const r = 15.9155
  const gap = segments.length > 1 ? 0.8 : 0
  return (
    <div className={`relative ${size} flex-shrink-0`}>
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90 drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]" role="img" aria-label="Breakdown chart">
        <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" className="text-slate-100" strokeWidth="4.2" />
        {segments.map((s) => {
          const pct = (s.value / total) * 100
          const offset = -acc
          acc += pct
          const len = Math.max(pct - gap, 0.4)
          return <circle key={s.label} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4.2" strokeLinecap="butt" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={offset} pathLength="100"><title>{`${s.label}: ${formatCurrency(s.value)}`}</title></circle>
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total</span>
        <span className="text-sm font-bold tabular-nums text-slate-900">{compact(total)}</span>
      </div>
    </div>
  )
}

// ₹12,50,000 → ₹12.5L for tight spaces (the full figure is always in the legend)
function compact(n) {
  const v = Math.abs(n)
  if (v >= 1e7) return `₹${(n / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`
  if (v >= 1e5) return `₹${(n / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`
  if (v >= 1e3) return `₹${(n / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`
  return `₹${Math.round(n)}`
}

export function DonutWithLegend({ groups, max = 7, linkTo }) {
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
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length], boxShadow: `0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]}99` }} />
            {linkTo && g.key !== 'Others'
              ? <Link to={linkTo(g.key)} className="min-w-0 flex-1 truncate text-slate-600 hover:text-blue-600 hover:underline">{g.key}</Link>
              : <span className="min-w-0 flex-1 truncate text-slate-600">{g.key}</span>}
            <span className="tabular-nums text-slate-900">{formatCurrency(g.amount)}</span>
            <span className="w-9 text-right tabular-nums text-slate-400">{g.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// rows: [{ key, short, income, expenses }]
export function IncomeExpenseBars({ rows, height = 'h-40' }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expenses]))
  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-linear-to-t from-emerald-500 to-emerald-300" /> Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-linear-to-t from-rose-500 to-rose-300" /> Expenses</span>
      </div>
      <div className={`relative ${height}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="block border-t border-dashed border-slate-200" />)}
        </div>
        <div className="relative flex h-full items-end justify-between gap-2">
          {rows.map((r, i) => (
            <div key={r.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center gap-1.5">
                <div className="bar-grow w-4 max-w-[42%] rounded-t-md bg-linear-to-t from-emerald-600/90 to-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.35)]" style={{ height: `${(r.income / max) * 100}%`, minHeight: r.income > 0 ? 3 : 0, animationDelay: `${i * 50}ms` }} title={`${r.label} income: ${formatCurrency(r.income)}`} />
                <div className="bar-grow w-4 max-w-[42%] rounded-t-md bg-linear-to-t from-rose-600/90 to-rose-300 shadow-[0_0_14px_rgba(251,113,133,0.30)]" style={{ height: `${(r.expenses / max) * 100}%`, minHeight: r.expenses > 0 ? 3 : 0, animationDelay: `${i * 50 + 25}ms` }} title={`${r.label} expenses: ${formatCurrency(r.expenses)}`} />
              </div>
              <span className="text-[10px] font-medium text-slate-400">{r.short}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ProgressBar({ pct, color = 'bg-linear-to-r from-[#2563eb] to-[#22d3ee]' }) {
  const p = Math.max(0, Math.min(pct || 0, 100))
  return <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className={`bar-grow-x h-2 rounded-full ${color}`} style={{ width: `${p > 0 ? Math.max(p, 3) : 0}%` }} /></div>
}
