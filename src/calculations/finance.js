// SINGLE SOURCE OF TRUTH for every financial number in the app.
//
// Every page, card, chart and report derives its figures from the functions
// here, fed with the raw records from the data layer. Nothing stores a total.
//
// Definitions (kept deliberately explicit):
//   Income            money received (income rows)
//   Expenses          costs incurred, whoever paid — company-paid AND personally-paid
//   Net position      Income − Expenses
//   Pending reimb.    personally-paid expense amount not yet repaid to the member
//   Member advance    company money a member holds (member owes Levrotec)
//   Cash movement     what actually entered/left the company's own money:
//                       in : income, advances returned
//                       out: company-paid expenses, reimbursements paid, advances given
//                     (a personally-paid expense moves no company cash until reimbursed)
//   Reserve           Opening reserve + cash in − cash out
//
// Identity that always holds (tested):
//   Reserve = Opening + Net position + Pending reimbursements − Outstanding advances
import { todayISO } from '../lib/format'
import { addMonths, inRange, monthKey, startOfMonth } from '../lib/dates'
import { INCOME_TYPES } from '../services/schema'

export const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
export function sum(rows, pick = (r) => num(r.amount)) {
  return round2(rows.reduce((acc, r) => acc + num(pick(r)), 0))
}
const EPS = 0.005

// ───────────────────────── Invoices ─────────────────────────

export const invoiceTotal = (inv) => round2(num(inv.amount) + num(inv.tax_amount))

export function invoiceState(invoice, income = [], today = todayISO()) {
  const total = invoiceTotal(invoice)
  const tds = num(invoice.tds_amount)
  const payments = income.filter((p) => p.invoice_id === invoice.id)
  const paid = sum(payments)
  const cancelled = invoice.status === 'Cancelled'
  const outstanding = cancelled ? 0 : round2(Math.max(total - tds - paid, 0))

  let paymentStatus = 'Unpaid'
  if (paid > EPS && outstanding > EPS) paymentStatus = 'Partially Paid'
  else if (outstanding <= EPS && total > 0 && !cancelled) paymentStatus = 'Paid'

  let status
  if (cancelled) status = 'Cancelled'
  else if (paymentStatus === 'Paid') status = 'Paid'
  else if (invoice.status === 'Draft' && paid <= EPS) status = 'Draft'
  else if (invoice.due_date && invoice.due_date < today) status = 'Overdue'
  else if (paymentStatus === 'Partially Paid') status = 'Partially Paid'
  else status = 'Sent'

  return { total, tds, paid, outstanding, status, paymentStatus, payments, overdue: status === 'Overdue' }
}

// ───────────────────── Reimbursements ─────────────────────

export function reimbursementState(expense, reimbursements = []) {
  if (!expense.paid_by_member_id) {
    return { applicable: false, reimbursed: 0, owed: 0, status: 'Not Applicable', payments: [] }
  }
  const payments = reimbursements.filter((r) => r.expense_id === expense.id)
  const reimbursed = sum(payments)
  const owed = round2(Math.max(num(expense.amount) - reimbursed, 0))
  let status = 'Pending'
  if (owed <= EPS) status = 'Reimbursed'
  else if (reimbursed > EPS) status = 'Partially Reimbursed'
  return { applicable: true, reimbursed, owed, status, payments }
}

export const paymentSource = (expense) => (expense.paid_by_member_id ? 'Personal' : 'Company')

// ───────────────────────── Projects ─────────────────────────

export function projectFinancials(project, data, today = todayISO()) {
  const contractValue = num(project?.contract_value)
  const income = data.income.filter((i) => i.project_id === project?.id)
  const invoices = data.invoices.filter((i) => i.project_id === project?.id)
  const expenses = data.expenses.filter((e) => e.project_id === project?.id)

  const received = sum(income)
  const invoiceStates = invoices.map((inv) => ({ invoice: inv, ...invoiceState(inv, data.income, today) }))
  const live = invoiceStates.filter((s) => s.status !== 'Cancelled')
  const invoiced = sum(live, (s) => s.total)
  const tdsDeducted = sum(live, (s) => s.tds)
  const invoiceOutstanding = sum(live, (s) => s.outstanding)
  // What the client still owes on the contract. TDS the client deducted counts
  // as settled — it will never arrive as cash.
  const outstanding = round2(Math.max(contractValue - received - tdsDeducted, 0))

  const totalCosts = sum(expenses)
  const pendingReimbursement = sum(expenses, (e) => reimbursementState(e, data.reimbursements).owed)
  // "Project Costs" = costs already settled in cash (company-paid + reimbursed).
  const projectCosts = round2(totalCosts - pendingReimbursement)
  const operatingResult = round2(received - projectCosts - pendingReimbursement)

  return {
    contractValue, received, outstanding, invoiced, invoiceOutstanding, tdsDeducted,
    unbilled: round2(Math.max(contractValue - invoiced, 0)),
    projectCosts, pendingReimbursement, totalCosts, operatingResult,
    margin: received > 0 ? (operatingResult / received) * 100 : null,
    receivedPct: contractValue > 0 ? Math.min((received / contractValue) * 100, 100) : 0,
    income, invoices, invoiceStates, expenses,
  }
}

// ───────────────────────── Members ─────────────────────────

export function memberBalance(memberId, data) {
  const contributions = data.expenses.filter((e) => e.paid_by_member_id === memberId)
  const contributed = sum(contributions)
  const companyOwes = sum(contributions, (e) => reimbursementState(e, data.reimbursements).owed)
  const reimbursed = round2(contributed - companyOwes)
  const advances = data.advances.filter((a) => a.member_id === memberId)
  const advancesGiven = sum(advances.filter((a) => a.direction === 'given'))
  const advancesReturned = sum(advances.filter((a) => a.direction === 'returned'))
  const memberOwes = round2(Math.max(advancesGiven - advancesReturned, 0))
  return {
    contributed, reimbursed, companyOwes, advancesGiven, advancesReturned, memberOwes,
    // > 0: Levrotec owes the member; < 0: the member owes Levrotec.
    net: round2(companyOwes - memberOwes),
    contributions, advances,
  }
}

export function allMemberBalances(data) {
  return data.members.map((m) => ({ member: m, ...memberBalance(m.id, data) }))
}

// ───────────────────────── Ledger ─────────────────────────

const INCOME_LABEL = Object.fromEntries(INCOME_TYPES.map((t) => [t.id, t.label]))
const EXPENSE_LABEL = { project_expense: 'Project Expense', company_expense: 'Company Expense', company_purchase: 'Purchase' }

export const LEDGER_TYPES = [
  ...INCOME_TYPES.map((t) => t.label),
  'Project Expense', 'Company Expense', 'Purchase', 'Member Contribution',
  'Team Reimbursement', 'Member Advance', 'Advance Returned',
]

// One unified, read-only list of every financial event. `cash` is the signed
// effect on company money; `direction` is 'in' | 'out' | 'none'.
export function buildLedger(data) {
  const expenseById = new Map(data.expenses.map((e) => [e.id, e]))
  const invoiceById = new Map(data.invoices.map((i) => [i.id, i]))
  const rows = []

  for (const i of data.income) {
    const inv = i.invoice_id ? invoiceById.get(i.invoice_id) : null
    rows.push({
      id: `income:${i.id}`, kind: 'income', refId: i.id, code: i.code, date: i.date, type: INCOME_LABEL[i.type] ?? 'Income',
      flow: 'Money In', direction: 'in', category: INCOME_LABEL[i.type] ?? 'Income', amount: num(i.amount), cash: num(i.amount),
      project_id: i.project_id ?? null, member_id: null, payment_method: i.payment_method, payment_source: 'Company',
      description: i.description || (inv ? `Payment — ${inv.invoice_number}` : INCOME_LABEL[i.type]),
      reference: i.reference, notes: i.notes, created_at: i.created_at, invoice_id: i.invoice_id ?? null, reimbursement_status: null,
    })
  }
  for (const e of data.expenses) {
    const personal = !!e.paid_by_member_id
    rows.push({
      id: `expense:${e.id}`, kind: 'expense', refId: e.id, code: e.code, date: e.date,
      type: personal ? 'Member Contribution' : EXPENSE_LABEL[e.expense_type] ?? 'Expense',
      flow: 'Money Out', direction: personal ? 'none' : 'out', category: e.category, amount: num(e.amount), cash: personal ? 0 : -num(e.amount),
      project_id: e.project_id ?? null, member_id: e.paid_by_member_id ?? null, payment_method: e.payment_method,
      payment_source: paymentSource(e), description: e.title || e.description || e.category,
      reference: e.reference, notes: e.description, created_at: e.created_at, invoice_id: null,
      reimbursement_status: personal ? reimbursementState(e, data.reimbursements).status : null,
    })
  }
  for (const r of data.reimbursements) {
    const e = expenseById.get(r.expense_id)
    rows.push({
      id: `reimbursement:${r.id}`, kind: 'reimbursement', refId: r.id, code: r.code, date: r.paid_date, type: 'Team Reimbursement',
      flow: 'Money Out', direction: 'out', category: e?.category ?? 'Reimbursement', amount: num(r.amount), cash: -num(r.amount),
      project_id: e?.project_id ?? null, member_id: r.member_id ?? e?.paid_by_member_id ?? null, payment_method: r.payment_method,
      payment_source: 'Company', description: `Reimbursement — ${e?.title ?? 'expense'}`,
      reference: r.reference, notes: r.notes, created_at: r.created_at, invoice_id: null, reimbursement_status: null,
    })
  }
  for (const a of data.advances) {
    const given = a.direction === 'given'
    rows.push({
      id: `advance:${a.id}`, kind: 'advance', refId: a.id, code: a.code, date: a.date, type: given ? 'Member Advance' : 'Advance Returned',
      flow: given ? 'Money Out' : 'Money In', direction: given ? 'out' : 'in', category: 'Member Advance', amount: num(a.amount),
      cash: given ? -num(a.amount) : num(a.amount), project_id: null, member_id: a.member_id, payment_method: a.payment_method,
      payment_source: 'Company', description: a.notes || (given ? 'Advance given to member' : 'Advance returned by member'),
      reference: a.reference, notes: a.notes, created_at: a.created_at, invoice_id: null, reimbursement_status: null,
    })
  }
  return rows.sort((a, b) => (a.date === b.date ? String(b.created_at).localeCompare(String(a.created_at)) : a.date < b.date ? 1 : -1))
}

// ───────────────────── Company-level totals ─────────────────────

export function companySummary(data, range = null) {
  const income = data.income.filter((i) => inRange(i.date, range))
  const expenses = data.expenses.filter((e) => inRange(e.date, range))
  const totalIncome = sum(income)
  const totalExpenses = sum(expenses)
  const projectRevenue = sum(income.filter((i) => i.project_id))
  const projectCosts = sum(expenses.filter((e) => e.project_id))
  return {
    totalIncome, totalExpenses, netPosition: round2(totalIncome - totalExpenses),
    projectRevenue, otherIncome: round2(totalIncome - projectRevenue),
    projectCosts, companyExpenses: round2(totalExpenses - projectCosts),
    purchases: sum(expenses.filter((e) => e.expense_type === 'company_purchase')),
    income, expenses,
  }
}

// Position figures are "as of now" — they are never period-filtered.
export function companyPosition(data, today = todayISO()) {
  const projects = data.projects.filter((p) => p.status !== 'Cancelled')
  const pendingReceivables = sum(projects, (p) => projectFinancials(p, data, today).outstanding)
  const invoiceStates = data.invoices.map((inv) => ({ invoice: inv, ...invoiceState(inv, data.income, today) }))
  const balances = allMemberBalances(data)
  return {
    pendingReceivables,
    invoiceOutstanding: sum(invoiceStates, (s) => s.outstanding),
    overdueInvoices: invoiceStates.filter((s) => s.overdue),
    pendingReimbursements: sum(balances, (b) => b.companyOwes),
    membersOweCompany: sum(balances, (b) => b.memberOwes),
    balances,
  }
}

export function companyReserve(data, upTo = null) {
  const s = data.settings ?? {}
  const opening = num(s.opening_reserve)
  const asOf = s.reserve_as_of || ''
  const rows = buildLedger(data).filter((r) => (!asOf || r.date >= asOf) && (!upTo || r.date <= upTo))
  const moneyIn = sum(rows.filter((r) => r.cash > 0), (r) => r.cash)
  const moneyOut = sum(rows.filter((r) => r.cash < 0), (r) => -r.cash)
  return { opening, asOf, moneyIn, moneyOut, current: round2(opening + moneyIn - moneyOut) }
}

// ───────────────────── Trends & breakdowns ─────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`

export function monthlySummary(data, { months = 6, today = todayISO(), range = null } = {}) {
  let keys = []
  if (range?.from && range?.to) {
    for (let k = startOfMonth(range.from); k <= range.to && keys.length < 60; k = addMonths(k, 1)) keys.push(monthKey(k))
  } else {
    const all = [...data.income.map((i) => i.date), ...data.expenses.map((e) => e.date)].filter(Boolean).sort()
    const first = range ? (all[0] ? startOfMonth(all[0]) : startOfMonth(today)) : addMonths(today, -(months - 1))
    for (let k = first; monthKey(k) <= monthKey(today) && keys.length < 60; k = addMonths(k, 1)) keys.push(monthKey(k))
  }
  return keys.map((key) => {
    const income = sum(data.income.filter((i) => monthKey(i.date) === key))
    const expenses = sum(data.expenses.filter((e) => monthKey(e.date) === key))
    return { key, label: monthLabel(key), short: MONTHS[Number(key.slice(5, 7)) - 1], income, expenses, net: round2(income - expenses) }
  })
}

export function groupTotals(rows, keyOf, amountOf = (r) => num(r.amount)) {
  const map = new Map()
  for (const r of rows) {
    const k = keyOf(r) ?? '—'
    const cur = map.get(k) ?? { key: k, amount: 0, count: 0 }
    cur.amount = round2(cur.amount + num(amountOf(r)))
    cur.count += 1
    map.set(k, cur)
  }
  const list = [...map.values()].sort((a, b) => b.amount - a.amount)
  const total = sum(list)
  return list.map((g) => ({ ...g, pct: total > 0 ? (g.amount / total) * 100 : 0 }))
}

export function pctChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
