import { RotateCcw } from 'lucide-react'
import { RANGE_PRESETS } from '../../lib/dates'
import { Select, TextInput } from './FormField'

export function FilterBar({ children, onReset, activeCount = 0, summary }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {onReset && (
          <button type="button" onClick={onReset} disabled={!activeCount} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <RotateCcw size={13} /> Reset{activeCount ? ` (${activeCount})` : ''}
          </button>
        )}
      </div>
      {summary && <p className="text-xs text-slate-400">{summary}</p>}
    </div>
  )
}

// options: string[] | [{ value, label }]
export function FilterSelect({ label, value, onChange, options, allLabel, width = 'w-40' }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={width} aria-label={label}>
      <option value="All">{allLabel ?? `All ${label.toLowerCase()}`}</option>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o
        return <option key={opt.value} value={opt.value}>{opt.label}</option>
      })}
    </Select>
  )
}

export function DateRangeFilter({ value, onChange }) {
  return (
    <>
      <Select value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value })} className="w-36" aria-label="Date range">
        {RANGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </Select>
      {value.preset === 'custom' && (
        <>
          <TextInput type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} className="w-40" aria-label="From date" />
          <TextInput type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} className="w-40" aria-label="To date" />
        </>
      )}
    </>
  )
}
