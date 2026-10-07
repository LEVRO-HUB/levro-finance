import { Link } from 'react-router-dom'

const accents = { neutral: 'text-slate-900', positive: 'text-emerald-600', attention: 'text-amber-600', negative: 'text-red-600' }
const iconBg = { neutral: 'bg-slate-100 text-slate-500', positive: 'bg-emerald-50 text-emerald-600', attention: 'bg-amber-50 text-amber-600', negative: 'bg-red-50 text-red-500' }

export function StatCard({ label, value, sub, accent = 'neutral', icon: Icon, to, compact = false }) {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {Icon && <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${iconBg[accent]}`}><Icon size={15} /></span>}
      </div>
      <div className={`font-semibold tabular-nums ${compact ? 'text-lg' : 'text-xl sm:text-2xl'} ${accents[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </>
  )
  const cls = 'block min-w-0 rounded-xl border border-slate-200 bg-white p-4'
  return to ? <Link to={to} className={`${cls} transition-shadow hover:shadow-sm`}>{body}</Link> : <div className={cls}>{body}</div>
}
