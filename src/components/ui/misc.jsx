import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { initials } from '../../lib/format'
import { TextInput } from './FormField'

export function PageHeader({ title, subtitle, children, breadcrumb }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {breadcrumb}
        <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900"><span aria-hidden="true" className="h-7 w-1.5 flex-shrink-0 rounded-full bg-linear-to-b from-blue-600 to-sky-400" />{title}</h1>
        {subtitle && <p className="mt-1 pl-[18px] text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" className="surface flex gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1">
      {tabs.map((t) => {
        const tab = typeof t === 'string' ? { id: t, label: t } : t
        const cls = (active) => `min-h-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-linear-to-r from-[#2563eb] to-[#0ea5e9] text-pure shadow-md shadow-[#2563eb]/40' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-700'}`
        return tab.to
          ? <NavLink key={tab.id} to={tab.to} end role="tab" className={({ isActive }) => cls(isActive)}>{tab.label}</NavLink>
          : <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)} className={cls(value === tab.id)}>{tab.label}{tab.count != null && <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${value === tab.id ? 'bg-pure/25 text-pure' : 'bg-slate-100 text-slate-500'}`}>{tab.count}</span>}</button>
      })}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = 'min-w-[180px] flex-1' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <TextInput type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange('')} className="absolute right-2 top-1/2 flex h-6 w-6 min-h-0 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={13} /></button>}
    </div>
  )
}

const AVATAR_COLORS = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-cyan-100 text-cyan-700']
export function Avatar({ name, size = 'h-8 w-8 text-xs' }) {
  const idx = [...String(name ?? '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length
  return <span className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${size} ${AVATAR_COLORS[idx]}`}>{initials(name)}</span>
}

// goodWhenUp=false flips the colour for metrics where a rise is bad (expenses).
export function ChangeBadge({ value, goodWhenUp = true, label = 'vs previous period' }) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const up = value >= 0
  const good = up === goodWhenUp
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${good ? 'text-emerald-600' : 'text-red-500'}`} title={label}>
      {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}{Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`surface min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-linear-to-br from-blue-600 to-sky-400" />{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />{label}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, action }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-1">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function Amount({ value, direction, className = '' }) {
  const color = direction === 'in' ? 'text-emerald-600' : direction === 'out' ? 'text-red-500' : 'text-slate-600'
  return <span className={`tabular-nums ${color} ${className}`}>{value}</span>
}
