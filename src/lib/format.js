const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const currencyFormatterPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return currencyFormatter.format(0)
  // Show paise only when they're non-zero, e.g. ₹10,000.50 but ₹10,000 (not ₹10,000.00).
  return Number.isInteger(n) ? currencyFormatter.format(n) : currencyFormatterPaise.format(n)
}

export function formatDate(value) {
  if (!value) return ''
  // Parse YYYY-MM-DD as a plain calendar date, never via `new Date(string)`
  // (which treats it as UTC midnight and can roll to the previous/next day
  // depending on the viewer's timezone offset).
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return value
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// "Today" in IST, independent of the viewer's own timezone/system clock offset.
export function todayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function formatSize(bytes) {
  if (!bytes) return '—'
  const kb = bytes / 1024
  return kb < 1024 ? `${Math.max(kb, 1).toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

export function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  })
}

export function slugify(text) {
  return String(text ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
}

export function initials(name) {
  return String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}
