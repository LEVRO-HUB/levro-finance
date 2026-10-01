// Single source of truth for every calculated financial number. No page
// should recompute these independently — read them from here so the
// dashboard, a project page, and a report can never show different numbers
// for the same thing.

export function sum(rows, pick = (r) => Number(r.amount) || 0) {
  return rows.reduce((acc, r) => acc + pick(r), 0)
}

// Per-project: Contract Value vs Invoiced vs Received vs Outstanding vs Costs.
// Clearly separate concepts — never mixed. "Received" here is actual cash
// against invoices; it does NOT include unbilled contract value.
export function projectFinancials(project, { expenses = [], invoices = [], invoicePayments = [] } = {}) {
  const contractValue = Number(project?.contract_value) || 0
  const projectInvoices = invoices.filter((i) => i.project_id === project?.id)
  const invoiceIds = new Set(projectInvoices.map((i) => i.id))
  const payments = invoicePayments.filter((p) => invoiceIds.has(p.invoice_id))

  const invoicedTotal = sum(projectInvoices)
  const received = sum(payments)
  const outstanding = Math.max(invoicedTotal - received, 0)

  const projectExpenses = expenses.filter((e) => e.project_id === project?.id)
  const projectCosts = sum(projectExpenses)

  return {
    contractValue,
    invoiced: invoicedTotal,
    received,
    outstanding,
    projectCosts,
    profit: received - projectCosts,
    projectExpenses,
    projectInvoices,
  }
}

// A personally-paid expense ("contribution"): what's owed to the member, and
// its reimbursement status. Reimbursement is never a new expense/cost.
export function reimbursementState(expense, reimbursementPayments = []) {
  const paid = reimbursementPayments.filter((r) => r.expense_id === expense.id)
  const reimbursed = sum(paid)
  const owed = Math.max((Number(expense.amount) || 0) - reimbursed, 0)
  let status = 'Pending'
  if (reimbursed > 0 && owed > 0) status = 'Partially Reimbursed'
  else if (owed <= 0 && reimbursed > 0) status = 'Fully Reimbursed'
  return { reimbursed, owed, status, payments: paid }
}

// Company cash effect of an expense, for Money In/Out and the Pay Out page.
// A personally-paid expense is NOT company cash out at the moment it's
// recorded — only the reimbursement later is.
export function expenseCashOut(expense) {
  if (expense.paid_by_member_id) return 0
  return expense.status === 'Paid' ? Number(expense.amount) || 0 : 0
}

export function invoiceStatus(invoice, payments = []) {
  const total = Number(invoice.amount) || 0
  const tds = Number(invoice.tds_amount) || 0
  const settled = sum(payments.filter((p) => p.invoice_id === invoice.id)) + tds
  const outstanding = Math.max(total - settled, 0)
  const today = new Date().toISOString().slice(0, 10)
  let status = 'Pending'
  if (settled <= 0) status = 'Pending'
  else if (outstanding <= 0.01) status = 'Paid'
  else status = 'Partially Paid'
  const overdue = status !== 'Paid' && invoice.due_date && invoice.due_date < today
  return { settled, outstanding, status: overdue ? 'Overdue' : status }
}
