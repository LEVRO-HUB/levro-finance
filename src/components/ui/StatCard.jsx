const accents = {
  neutral: 'text-slate-900',
  positive: 'text-emerald-600',
  attention: 'text-amber-600',
  negative: 'text-red-600',
}

export function StatCard({ label, value, sub, accent = 'neutral', icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={16} className="text-slate-300" />}
      </div>
      <div className={`text-xl font-semibold tabular-nums sm:text-2xl ${accents[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}
