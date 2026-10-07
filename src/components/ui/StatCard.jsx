import { Link } from 'react-router-dom'

// Each accent has its own colour family so a row of cards reads at a glance.
const tone = {
  neutral: { value: 'text-slate-900', bar: 'from-blue-600 to-sky-400', icon: 'from-[#2563eb] to-[#0ea5e9] shadow-[#2563eb]/40', wash: 'from-blue-50' },
  positive: { value: 'text-emerald-600', bar: 'from-emerald-500 to-teal-400', icon: 'from-emerald-500 to-teal-500 shadow-emerald-500/30', wash: 'from-emerald-50' },
  attention: { value: 'text-amber-600', bar: 'from-amber-500 to-orange-400', icon: 'from-amber-500 to-orange-500 shadow-amber-500/30', wash: 'from-amber-50' },
  negative: { value: 'text-red-600', bar: 'from-rose-500 to-red-400', icon: 'from-rose-500 to-red-500 shadow-rose-500/30', wash: 'from-rose-50' },
}

export function StatCard({ label, value, sub, accent = 'neutral', icon: Icon, to, compact = false }) {
  const t = tone[accent] ?? tone.neutral
  const body = (
    <>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${t.bar}`} />
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        {Icon && <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-pure shadow-md ${t.icon}`}><Icon size={16} /></span>}
      </div>
      <div className={`font-bold tracking-tight tabular-nums ${compact ? 'text-lg' : 'text-xl sm:text-2xl'} ${t.value}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </>
  )
  const cls = `surface relative block min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br ${t.wash} via-white to-white p-4 pt-5`
  return to ? <Link to={to} className={`${cls} surface-hover`}>{body}</Link> : <div className={cls}>{body}</div>
}
