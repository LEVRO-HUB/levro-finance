import { useMemo, useState } from 'react'
import { resolveRange } from '../lib/dates'

// Filter state for list pages. `defaults` is an object of filter values;
// 'All' / '' mean "not filtering". A `range` key holds { preset, from, to }.
export function useFilters(defaults) {
  const [filters, setFilters] = useState(defaults)
  const set = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }))
  const reset = () => setFilters(defaults)
  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'range') return v?.preset && v.preset !== (defaults.range?.preset ?? 'all')
    return v !== defaults[k]
  }).length
  const range = useMemo(
    () => (filters.range ? resolveRange(filters.range.preset, filters.range) : null),
    [filters.range],
  )
  return { filters, set, reset, activeCount, range }
}

export const DEFAULT_RANGE = { preset: 'all', from: '', to: '' }
export const is = (filter, value) => filter === 'All' || filter === value
export function matches(query, ...fields) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q))
}
