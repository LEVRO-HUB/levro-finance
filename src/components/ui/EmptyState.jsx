export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-linear-to-b from-white to-blue-50/50 py-14 text-center">
      {Icon && <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#2563eb] to-[#0ea5e9] text-pure shadow-lg shadow-blue-500/30"><Icon size={22} /></span>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>}
    </div>
  )
}
