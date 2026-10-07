// Pure calendar-date helpers working on 'YYYY-MM-DD' strings. All arithmetic
// goes through Date.UTC so the viewer's timezone can never shift a date.
import { todayISO } from './format'

const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parse = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  return toISO(parse(value)) === value
}

export function addDays(iso, days) {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toISO(d)
}

export function addMonths(iso, months) {
  const [y, m] = iso.split('-').map(Number)
  return toISO(new Date(Date.UTC(y, m - 1 + months, 1)))
}

export const monthKey = (iso) => (iso ? String(iso).slice(0, 7) : '')
export const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`
export const endOfMonth = (iso) => addDays(addMonths(iso, 1), -1)

export const RANGE_PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
  { id: 'custom', label: 'Custom range' },
]

// -> { from, to } (inclusive; either may be '' meaning unbounded)
export function resolveRange(preset, custom = {}, today = todayISO()) {
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'this_week': {
      const dow = (parse(today).getUTCDay() + 6) % 7 // Monday = 0
      const from = addDays(today, -dow)
      return { from, to: addDays(from, 6) }
    }
    case 'this_month':
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case 'last_month': {
      const from = addMonths(today, -1)
      return { from, to: endOfMonth(from) }
    }
    case 'this_quarter': {
      const [y, m] = today.split('-').map(Number)
      const qStart = `${y}-${pad(Math.floor((m - 1) / 3) * 3 + 1)}-01`
      return { from: qStart, to: endOfMonth(addMonths(qStart, 2)) }
    }
    case 'this_year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` }
    case 'custom':
      return { from: custom.from || '', to: custom.to || '' }
    default:
      return { from: '', to: '' }
  }
}

export function inRange(date, range) {
  if (!range) return true
  if (!date) return !range.from && !range.to
  const d = String(date).slice(0, 10)
  return (!range.from || d >= range.from) && (!range.to || d <= range.to)
}

// The range of equal length immediately before `range` (for % change badges).
export function previousRange(preset, range) {
  if (!range.from || !range.to) return null
  if (preset === 'this_month' || preset === 'last_month') {
    const from = addMonths(range.from, -1)
    return { from, to: endOfMonth(from) }
  }
  const len = Math.round((parse(range.to) - parse(range.from)) / 86400000) + 1
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) }
}

export function relativeDate(iso, today = todayISO()) {
  if (!iso) return ''
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  return parse(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}
