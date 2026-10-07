// Company details printed on invoices. The values below are only the starting
// point taken from Levrotec's own earlier invoice; everything is edited in
// Settings → Invoice & company details and stored with the workspace settings.
// Anything left empty is simply not printed — nothing here is ever made up.
export const COMPANY = {
  name: 'LEVROTEC TECHNOLOGIES',
  tagline: 'Enterprise Software Engineering  •  ERP Systems  •  Digital Infrastructure Solutions',
  address: 'Chennai, Tamil Nadu, India',
  email: 'connect@levrotec.com',
  phone: '', website: '', gstin: '', pan: '',
  account_name: '', bank: '', account_no: '', ifsc: '', upi: '',
  payment_terms: 'Due on receipt',
  signatory: 'Tharun Devakumar',
  signatory_role: 'Founder & Chief Executive Officer',
  invoicePrefix: 'LEV',
}
export const PROFILE_FIELDS = ['name', 'tagline', 'address', 'email', 'phone', 'website', 'gstin', 'pan', 'account_name', 'bank', 'account_no', 'ifsc', 'upi', 'payment_terms', 'signatory', 'signatory_role']

// What is configured wins, including a deliberately emptied field.
export function companyProfile(settings) {
  const saved = settings?.invoice_profile ?? {}
  return Object.fromEntries(PROFILE_FIELDS.map((k) => [k, typeof saved[k] === 'string' ? saved[k] : COMPANY[k] ?? '']))
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
export const TAX_LINES = [['cgst', 'CGST'], ['sgst', 'SGST'], ['igst', 'IGST'], ['other', 'Other tax']]

// Every figure on an invoice, from what was typed: items, an optional discount
// and optional tax percentages. No tax is ever added unless a rate is entered.
export function invoiceBreakdown(details) {
  const d = details ?? {}
  const subtotal = r2((d.items ?? []).reduce((a, it) => a + r2((Number(it.qty) || 0) * (Number(it.rate) || 0)), 0))
  const discount = Math.min(Math.max(r2(d.discount), 0), subtotal)
  const taxable = r2(subtotal - discount)
  const taxes = TAX_LINES.map(([key, label]) => {
    const rate = Number(d.tax?.[`${key}_rate`]) || 0
    const name = key === 'other' ? String(d.tax?.other_label ?? '').trim() || label : label
    return { key, label: name, rate, amount: r2((taxable * rate) / 100) }
  }).filter((t) => t.rate > 0)
  const tax = r2(taxes.reduce((a, t) => a + t.amount, 0))
  return { subtotal, discount, taxable, taxes, tax, total: r2(taxable + tax) }
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const below100 = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`)
const below1000 = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? below100(n % 100) : ''].filter(Boolean).join(' ')

// 125000.5 → "Rupees One Lakh Twenty Five Thousand and Fifty Paise Only" (Indian numbering)
export function rupeesInWords(amount) {
  const total = Math.round(Number(amount || 0) * 100)
  if (!Number.isFinite(total) || total <= 0) return 'Rupees Zero Only'
  let n = Math.floor(total / 100)
  const paise = total % 100
  const parts = []
  for (const [size, label] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']]) {
    const q = Math.floor(n / size)
    if (q) { parts.push(`${q >= 1000 ? rupeesInWords(q).replace(/^Rupees | Only$/g, '') : below1000(q)} ${label}`); n %= size }
  }
  if (n) parts.push(below1000(n))
  const rupees = parts.length ? `Rupees ${parts.join(' ')}` : ''
  const p = paise ? `${below100(paise)} Paise` : ''
  return `${[rupees, p].filter(Boolean).join(' and ')} Only`
}

// LEV-CHP-2026-003: prefix, a short client code, the year, and a running number for that client and year.
export function clientCode(name) {
  const words = String(name ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (!words.length) return 'GEN'
  if (words.length >= 3) return words.slice(0, 3).map((w) => w[0]).join('')
  const w = words[0]
  const consonants = w[0] + w.slice(1).replace(/[AEIOU]/g, '')
  return (consonants.length >= 3 ? consonants : w).slice(0, 3)
}
export function nextInvoiceNumber(invoices, clientName, dateISO) {
  const year = String(dateISO || '').slice(0, 4) || String(new Date().getFullYear())
  const stem = `${COMPANY.invoicePrefix}-${clientCode(clientName)}-${year}-`
  const used = invoices.map((i) => String(i.invoice_number ?? '')).filter((n) => n.toUpperCase().startsWith(stem)).map((n) => Number(n.slice(stem.length))).filter(Number.isFinite)
  return `${stem}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`
}
