import { beforeEach, describe, expect, it } from 'vitest'
import { createApi, ValidationError } from '../src/services/api'
import { createLocalAdapter, createMemoryFileStore, createMemoryStorage } from '../src/services/localAdapter'
import { blankState } from '../src/services/schema'
import { demoState } from '../src/data/seed/demo'
import * as F from '../src/calculations/finance'
import { resolveRange, inRange } from '../src/lib/dates'
import { todayISO } from '../src/lib/format'

const today = todayISO()
let api, data
const refresh = async () => (data = await api.load())
const fresh = (seed = blankState) => {
  api = createApi(createLocalAdapter({ storage: createMemoryStorage(), files: createMemoryFileStore(), seed }))
}
const file = (name = 'a.pdf', size = 10) => ({ name, size, type: 'application/pdf' })

describe('Phase 1 scenarios (brief §Testing)', () => {
  let project, hari
  beforeEach(async () => {
    fresh()
    project = await api.saveProject({ name: 'Chippy ERP', contract_value: '200000', status: 'Active', client_name: 'Chippy' })
    hari = await api.saveMember({ name: 'Hari', designation: 'Founder' })
    await refresh()
  })
  const pf = () => F.projectFinancials(data.projects[0], data)

  it('1. new project', () => {
    expect(project.slug).toBe('chippy-erp')
    expect(pf()).toMatchObject({ contractValue: 200000, received: 0, outstanding: 200000, operatingResult: 0 })
  })

  it('2. client payment → received 1L, outstanding 1L', async () => {
    await api.saveIncome({ type: 'client_payment', amount: 100000, date: today, project_id: project.id, payment_method: 'UPI' })
    await refresh()
    expect(pf()).toMatchObject({ received: 100000, outstanding: 100000 })
    expect(F.companySummary(data).totalIncome).toBe(100000)
  })

  it('3. project expense updates the project result', async () => {
    await api.saveIncome({ type: 'client_payment', amount: 100000, date: today, project_id: project.id, payment_method: 'UPI' })
    await api.saveExpense({ title: 'Server', amount: 20000, date: today, category: 'Hosting', project_id: project.id, payment_method: 'UPI' })
    await refresh()
    expect(pf()).toMatchObject({ projectCosts: 20000, pendingReimbursement: 0, operatingResult: 80000 })
    expect(data.expenses[0].expense_type).toBe('project_expense')
  })

  it('4 + 5. personal spending then reimbursement', async () => {
    const e = await api.saveExpense({ title: 'AWS', amount: 5000, date: today, category: 'Hosting', project_id: project.id, paid_by_member_id: hari.id, payment_method: 'Credit Card' })
    await refresh()
    expect(pf().pendingReimbursement).toBe(5000)
    expect(F.memberBalance(hari.id, data).companyOwes).toBe(5000)
    expect(F.companyPosition(data).pendingReimbursements).toBe(5000)
    expect(F.companyReserve(data).moneyOut).toBe(0) // no company cash moved yet
    expect(F.reimbursementState(data.expenses[0], data.reimbursements).status).toBe('Pending')

    await expect(api.recordReimbursement({ expense_id: e.id, amount: 6000, paid_date: today, payment_method: 'UPI' })).rejects.toThrow(ValidationError)
    await api.recordReimbursement({ expense_id: e.id, amount: 2000, paid_date: today, payment_method: 'UPI' })
    await refresh()
    expect(F.reimbursementState(data.expenses[0], data.reimbursements).status).toBe('Partially Reimbursed')
    await api.recordReimbursement({ member_id: hari.id, amount: 3000, paid_date: today, payment_method: 'UPI' })
    await refresh()
    expect(pf().pendingReimbursement).toBe(0)
    expect(F.memberBalance(hari.id, data)).toMatchObject({ companyOwes: 0, reimbursed: 5000 })
    expect(F.reimbursementState(data.expenses[0], data.reimbursements).status).toBe('Reimbursed')
    expect(pf().projectCosts).toBe(5000) // cost counted once, never doubled by the repayment
    expect(F.companySummary(data).totalExpenses).toBe(5000)
    expect(F.companyReserve(data).moneyOut).toBe(5000)
  })

  it('6. partial invoice payment keeps real payment records', async () => {
    const inv = await api.saveInvoice({ project_id: project.id, invoice_number: 'INV-001', amount: 200000, invoice_date: today, status: 'Sent' })
    await api.saveIncome({ type: 'client_payment', amount: 100000, date: today, invoice_id: inv.id, payment_method: 'Bank Transfer' })
    await refresh()
    const st = F.invoiceState(data.invoices[0], data.income)
    expect(st).toMatchObject({ total: 200000, paid: 100000, outstanding: 100000, status: 'Partially Paid' })
    expect(data.invoices[0].amount).toBe(200000)
    expect(data.income).toHaveLength(1)
    expect(data.income[0].project_id).toBe(project.id)
    await expect(api.saveIncome({ type: 'client_payment', amount: 100001, date: today, invoice_id: inv.id, payment_method: 'UPI' })).rejects.toThrow(/outstanding/)
    await api.saveIncome({ type: 'client_payment', amount: 100000, date: today, invoice_id: inv.id, payment_method: 'UPI' })
    await refresh()
    expect(F.invoiceState(data.invoices[0], data.income).status).toBe('Paid')
    expect(pf().outstanding).toBe(0)
    await expect(api.deleteInvoice(inv.id)).rejects.toThrow(/payments/)
  })

  it('7. company purchase increases company expenses', async () => {
    const before = F.companySummary(data)
    await api.saveExpense({ title: 'Office Chair', amount: 15000, date: today, category: 'Furniture', expense_type: 'company_purchase', payment_method: 'UPI', recipient: 'OfficeMart' })
    await refresh()
    const after = F.companySummary(data)
    expect(after.companyExpenses - before.companyExpenses).toBe(15000)
    expect(after.purchases).toBe(15000)
    expect(data.expenses[0]).toMatchObject({ is_asset: true, project_id: null })
    expect(F.companyReserve(data).moneyOut).toBe(15000)
  })

  it('8. filters: date presets and ledger dimensions change results', async () => {
    fresh(() => demoState(today))
    await refresh()
    const ledger = F.buildLedger(data)
    const count = (fn) => ledger.filter(fn).length
    expect(ledger.length).toBe(data.income.length + data.expenses.length + data.reimbursements.length + data.advances.length)
    for (const preset of ['today', 'this_week', 'this_month', 'last_month', 'this_quarter', 'this_year']) {
      const r = resolveRange(preset, {}, today)
      expect(r.from <= r.to).toBe(true)
      expect(count((x) => inRange(x.date, r))).toBeLessThanOrEqual(ledger.length)
    }
    const n = (preset) => count((x) => inRange(x.date, resolveRange(preset, {}, today)))
    expect(n('today')).toBeLessThan(n('this_month'))
    expect(n('this_month')).toBeLessThan(n('all'))
    expect(n('last_month')).toBeGreaterThan(0)
    expect(count((x) => inRange(x.date, resolveRange('custom', { from: today, to: today })))).toBe(n('today'))
    expect(count((x) => x.project_id === 'p-chippy')).toBeGreaterThan(0)
    expect(count((x) => x.project_id === 'p-chippy')).toBeLessThan(ledger.length)
    expect(count((x) => x.member_id === 'm-hari')).toBe(1)
    expect(count((x) => x.payment_source === 'Personal')).toBe(data.expenses.filter((e) => e.paid_by_member_id).length)
    expect(count((x) => x.reimbursement_status === 'Pending')).toBe(3)
    expect(count((x) => x.type === 'Team Reimbursement')).toBe(2)
  })
})

describe('consistency', () => {
  beforeEach(async () => { fresh(() => demoState(today)); await refresh() })

  it('reserve identity: opening + net + pending reimbursements − outstanding advances', () => {
    const r = F.companyReserve(data), s = F.companySummary(data), p = F.companyPosition(data)
    expect(r.current).toBeCloseTo(r.opening + s.netPosition + p.pendingReimbursements - p.membersOweCompany, 2)
    expect(r.current).toBe(F.round2(r.opening + r.moneyIn - r.moneyOut))
  })

  it('per-project figures add up to company figures', () => {
    const s = F.companySummary(data)
    const per = data.projects.map((p) => F.projectFinancials(p, data))
    expect(F.sum(per, (x) => x.received)).toBe(s.projectRevenue)
    expect(F.sum(per, (x) => x.totalCosts)).toBe(s.projectCosts)
    expect(F.sum(per, (x) => x.pendingReimbursement) ).toBeLessThanOrEqual(F.companyPosition(data).pendingReimbursements)
    expect(F.sum(F.monthlySummary(data, { range: {} }), (m) => m.income)).toBe(s.totalIncome)
    expect(F.sum(F.groupTotals(s.expenses, (e) => e.category))).toBe(s.totalExpenses)
  })

  it('demo Chippy ERP matches hand calculation', () => {
    const f = F.projectFinancials(data.projects.find((p) => p.id === 'p-chippy'), data)
    expect(f).toMatchObject({ contractValue: 200000, received: 150000, outstanding: 50000, projectCosts: 35500, pendingReimbursement: 2500, operatingResult: 112000 })
  })

  it('member balances: company owes / member owes', () => {
    expect(F.memberBalance('m-prem', data)).toMatchObject({ contributed: 3200, reimbursed: 2000, companyOwes: 1200 })
    expect(F.memberBalance('m-sepal', data)).toMatchObject({ memberOwes: 5000, net: -5000 })
  })

  it('overdue / draft invoice statuses are calculated', () => {
    const st = Object.fromEntries(data.invoices.map((i) => [i.invoice_number, F.invoiceState(i, data.income, today).status]))
    expect(st).toEqual({ 'INV-001': 'Paid', 'INV-002': 'Partially Paid', 'INV-003': 'Paid', 'INV-004': 'Overdue', 'INV-005': 'Paid', 'INV-006': 'Draft' })
  })
})

describe('validation & integrity', () => {
  beforeEach(async () => { fresh(() => demoState(today)); await refresh() })

  it('rejects bad amounts, dates and relationships', async () => {
    const base = { title: 'x', date: today, category: 'Hosting', payment_method: 'UPI' }
    await expect(api.saveExpense({ ...base, amount: 0 })).rejects.toMatchObject({ fields: { amount: expect.any(String) } })
    await expect(api.saveExpense({ ...base, amount: -5 })).rejects.toThrow(ValidationError)
    await expect(api.saveExpense({ ...base, amount: 'abc' })).rejects.toThrow(ValidationError)
    await expect(api.saveExpense({ ...base, amount: 10.123 })).rejects.toThrow(/decimal/)
    await expect(api.saveExpense({ ...base, amount: 10, date: '2026-02-31' })).rejects.toThrow(/valid date/)
    await expect(api.saveExpense({ ...base, amount: 10, date: '2099-01-01' })).rejects.toThrow(/future/)
    await expect(api.saveExpense({ ...base, amount: 10, project_id: 'nope' })).rejects.toThrow(/project/)
    await expect(api.saveExpense({ ...base, amount: 10, category: 'Nope' })).rejects.toThrow(/category/)
    await expect(api.saveIncome({ type: 'client_payment', amount: 10, date: today, payment_method: 'UPI' })).rejects.toThrow(/project/)
    await expect(api.saveProject({ name: 'Chippy ERP', contract_value: 1, status: 'Active' })).rejects.toThrow(/already exists/)
    await expect(api.saveProject({ name: 'New', contract_value: 1, status: 'Active', start_date: '2026-05-02', end_date: '2026-05-01' })).rejects.toThrow(/before/)
    await expect(api.saveInvoice({ project_id: 'p-web', invoice_number: 'inv-001', amount: 5, invoice_date: today })).rejects.toThrow(/already used/)
  })

  it('protects history on delete / edit', async () => {
    await expect(api.deleteProject('p-chippy')).rejects.toThrow(/financial records/)
    await expect(api.deleteExpense('e-3')).rejects.toThrow(/reimbursements/)
    await expect(api.saveExpense({ ...data.expenses.find((e) => e.id === 'e-6'), amount: 1000 }, 'e-6')).rejects.toThrow(/already been reimbursed/)
    await expect(api.deleteMember('m-abi')).rejects.toThrow(/history/)
    await expect(api.saveAdvance({ member_id: 'm-sepal', direction: 'returned', amount: 6000, date: today, payment_method: 'UPI' })).rejects.toThrow(/only owes/)
    await expect(api.deleteListItem('categories', data.categories.find((c) => c.name === 'Hosting').id)).rejects.toThrow(/used/)
  })

  it('renaming a category keeps existing expenses consistent', async () => {
    await api.saveListItem('categories', 'Cloud', data.categories.find((c) => c.name === 'Hosting').id)
    await refresh()
    expect(data.expenses.filter((e) => e.category === 'Hosting')).toHaveLength(0)
    expect(data.expenses.filter((e) => e.category === 'Cloud').length).toBeGreaterThan(0)
  })

  it('documents: upload, replace keeps version history, size limit, delete', async () => {
    const doc = await api.uploadDocument({ file: file('agreement.pdf'), category: 'master_agreement', project_id: 'p-chippy' })
    await api.replaceDocument(doc.id, file('agreement-v2.pdf', 20))
    await refresh()
    const versions = data.document_versions.filter((v) => v.document_id === doc.id)
    expect(versions.map((v) => v.version)).toEqual([1, 2])
    expect((await api.getFile(versions[1].id)).file_name).toBe('agreement-v2.pdf')
    await expect(api.uploadDocument({ file: file('big.pdf', 6 * 1024 * 1024), category: 'other', project_id: 'p-chippy' })).rejects.toThrow(/5 MB/)
    const e = await api.saveExpense({ title: 'With receipt', amount: 10, date: today, category: 'Office', payment_method: 'Cash', receipt: file('r.png') })
    await refresh()
    expect(data.documents.find((d) => d.id === e.receipt_document_id)).toMatchObject({ category: 'receipt', expense_id: e.id })
    await api.deleteDocument(doc.id)
    await refresh()
    expect(data.document_versions.filter((v) => v.document_id === doc.id)).toHaveLength(0)
  })

  it('writes an activity log entry per operation and sequential codes', async () => {
    const n = data.activity_logs.length
    const row = await api.saveIncome({ type: 'other_income', amount: 10, date: today, payment_method: 'UPI' })
    await refresh()
    expect(data.activity_logs.length).toBe(n + 1)
    expect(row.code).toBe('INC-0007')
  })
})

describe('Monthly bills and project monthly charges', () => {
  const month = today.slice(0, 7)
  const prev = (() => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` })()
  beforeEach(() => fresh())

  it('a bill lists each month and ticking one records an expense', async () => {
    const bill = await api.saveRecurring({ kind: 'bill', name: 'Office rent', amount: 15000, due_day: 5, start_month: prev, category: 'Rent' })
    await refresh()
    let s = F.recurringSchedule(data.recurring[0], data, today)
    expect(s.months.map((m) => m.month)).toEqual([prev, month])
    expect(s.pending.length).toBe(2)
    expect(s.months[0].status).toBe('Overdue')
    await api.payRecurring(bill.id, prev, { date: today, payment_method: 'UPI' })
    await refresh()
    s = F.recurringSchedule(data.recurring[0], data, today)
    expect(s.pending.length).toBe(1)
    expect(data.expenses[0]).toMatchObject({ amount: 15000, category: 'Rent', expense_type: 'company_expense', recurring_id: bill.id })
    expect(F.companySummary(data).totalExpenses).toBe(15000)
    await expect(api.payRecurring(bill.id, prev, { date: today, payment_method: 'UPI' })).rejects.toThrow(/already/)
    await expect(api.payRecurring(bill.id, '2001-01', { date: today, payment_method: 'UPI' })).rejects.toThrow(/outside/)
    await api.deleteExpense(data.expenses[0].id)
    await refresh()
    expect(F.recurringSchedule(data.recurring[0], data, today).pending.length).toBe(2)
  })

  it('a project monthly charge is income but does not reduce the contract balance', async () => {
    const p = await api.saveProject({ name: 'ERP', contract_value: '100000', status: 'Active', monthly_enabled: true, monthly_amount: 5000, monthly_due_day: 10, monthly_start: month })
    await refresh()
    const charge = data.recurring[0]
    expect(charge).toMatchObject({ kind: 'maintenance', project_id: p.id, amount: 5000 })
    await api.saveIncome({ type: 'client_payment', amount: 40000, date: today, project_id: p.id, payment_method: 'UPI' })
    await api.payRecurring(charge.id, month, { date: today, payment_method: 'UPI' })
    await refresh()
    const f = F.projectFinancials(data.projects[0], data)
    expect(f).toMatchObject({ received: 40000, monthlyFees: 5000, outstanding: 60000, operatingResult: 45000 })
    expect(F.companySummary(data).totalIncome).toBe(45000)
    expect(F.recurringOverview(data, today).charges.pendingCount).toBe(0)
    // switching it off keeps what was collected
    await api.saveProject({ ...data.projects[0], monthly_enabled: false }, p.id)
    await refresh()
    expect(data.recurring[0].end_month).toBe(`${month}-01`)
    expect(data.income.length).toBe(2)
  })
})

describe('Invoices on the Levrotec template', () => {
  beforeEach(() => fresh())
  it('totals the line items, keeps what is printed, and is still not income', async () => {
    const p = await api.saveProject({ name: 'Chippy ERP', client_name: 'Chippy Properties', contract_value: '200000', status: 'Active' })
    const inv = await api.saveInvoice({ project_id: p.id, invoice_number: 'LEV-CHP-2026-001', invoice_date: today, status: 'Sent', notes: 'Monthly support',
      details: { billing_period: 'September 2026', payment_terms: 'Due on receipt', items: [{ title: 'Maintenance', qty: 2, rate: 8000 }, { title: 'Hosting', description: 'Server', qty: '1', rate: '1500.50' }, { title: '', rate: '' }], pay: { bank: 'Test Bank' } } })
    await refresh()
    expect(inv.amount).toBe(17500.5)
    expect(data.invoices[0].details).toMatchObject({ bill_to_name: 'Chippy Properties', billing_period: 'September 2026', pay: { bank: 'Test Bank', upi: '' } })
    expect(data.invoices[0].details.items).toHaveLength(2)
    expect(F.invoiceState(data.invoices[0], data.income)).toMatchObject({ total: 17500.5, paid: 0, outstanding: 17500.5 })
    expect(F.companySummary(data).totalIncome).toBe(0)
    await expect(api.saveInvoice({ project_id: p.id, invoice_number: 'X-2', invoice_date: today, details: { items: [{ title: 'A', qty: 1, rate: 0 }] } })).rejects.toThrow()
    await expect(api.saveInvoice({ project_id: p.id, invoice_number: 'X-3', invoice_date: today, details: { items: [] } })).rejects.toThrow()
    // editing through the simple form leaves the printed details untouched
    await api.saveInvoice({ ...data.invoices[0], notes: 'changed' }, inv.id)
    await refresh()
    expect(data.invoices[0].details.items).toHaveLength(2)
  })

  it('writes amounts in words the Indian way and numbers invoices per client and year', async () => {
    const { rupeesInWords, nextInvoiceNumber, clientCode } = await import('../src/lib/company')
    expect(rupeesInWords(8000)).toBe('Rupees Eight Thousand Only')
    expect(rupeesInWords(125000.5)).toBe('Rupees One Lakh Twenty Five Thousand and Fifty Paise Only')
    expect(rupeesInWords(10000000)).toBe('Rupees One Crore Only')
    expect(rupeesInWords(1999)).toBe('Rupees One Thousand Nine Hundred Ninety Nine Only')
    expect(clientCode('Chippy Properties')).toBe('CHP')
    expect(nextInvoiceNumber([{ invoice_number: 'LEV-CHP-2026-001' }, { invoice_number: 'LEV-CHP-2026-004' }, { invoice_number: 'LEV-ABC-2026-009' }], 'Chippy Properties', '2026-10-07')).toBe('LEV-CHP-2026-005')
  })
})

describe('Invoice finalisation: tax, discount, company details', () => {
  beforeEach(() => fresh())
  const base = (p, extra = {}) => ({ project_id: p.id, invoice_number: 'LEV-CHP-2026-001', invoice_date: today, status: 'Sent', details: { items: [{ title: 'Build', qty: 1, rate: 200000 }], ...extra } })

  it('an invoice is never income: received stays zero until a payment is recorded', async () => {
    const p = await api.saveProject({ name: 'Chippy ERP', client_name: 'Chippy Properties', contract_value: '200000', status: 'Active' })
    const inv = await api.saveInvoice(base(p))
    await refresh()
    expect(F.projectFinancials(data.projects[0], data)).toMatchObject({ received: 0, outstanding: 200000, invoiced: 200000 })
    expect(F.invoiceState(data.invoices[0], data.income)).toMatchObject({ total: 200000, paid: 0, outstanding: 200000 })
    expect(F.companySummary(data).totalIncome).toBe(0)
    await api.saveIncome({ type: 'client_payment', amount: 50000, date: today, project_id: p.id, invoice_id: inv.id, payment_method: 'UPI' })
    await refresh()
    expect(F.invoiceState(data.invoices[0], data.income)).toMatchObject({ paid: 50000, outstanding: 150000 })
    expect(F.projectFinancials(data.projects[0], data).received).toBe(50000)
  })

  it('adds no tax unless a rate is entered; discount and GST lines total correctly', async () => {
    const { invoiceBreakdown, rupeesInWords } = await import('../src/lib/company')
    const p = await api.saveProject({ name: 'Chippy ERP', client_name: 'Chippy Properties', contract_value: '0', status: 'Active' })
    const plain = await api.saveInvoice(base(p))
    expect(plain).toMatchObject({ amount: 200000, tax_amount: 0 })
    expect(invoiceBreakdown(plain.details)).toMatchObject({ subtotal: 200000, discount: 0, taxes: [], tax: 0, total: 200000 })
    const gst = await api.saveInvoice({ ...base(p, { discount: '20000', tax: { cgst_rate: '9', sgst_rate: 9 } }), invoice_number: 'LEV-CHP-2026-002' })
    expect(gst).toMatchObject({ amount: 180000, tax_amount: 32400 })
    const b = invoiceBreakdown(gst.details)
    expect(b).toMatchObject({ subtotal: 200000, discount: 20000, taxable: 180000, tax: 32400, total: 212400 })
    expect(b.taxes.map((t) => [t.label, t.rate, t.amount])).toEqual([['CGST', 9, 16200], ['SGST', 9, 16200]])
    expect(rupeesInWords(b.total)).toBe('Rupees Two Lakh Twelve Thousand Four Hundred Only')
    await refresh()
    expect(F.invoiceState(data.invoices.find((i) => i.id === gst.id), data.income).total).toBe(212400)
    await expect(api.saveInvoice({ ...base(p, { discount: 300000 }), invoice_number: 'X1' })).rejects.toThrow()
    await expect(api.saveInvoice({ ...base(p, { tax: { igst_rate: 140 } }), invoice_number: 'X2' })).rejects.toThrow()
  })

  it('company details are configurable, optional, and frozen onto each issued invoice', async () => {
    const { companyProfile } = await import('../src/lib/company')
    const p = await api.saveProject({ name: 'Chippy ERP', client_name: 'Chippy Properties', contract_value: '0', status: 'Active' })
    await refresh()
    expect(companyProfile(data.settings)).toMatchObject({ name: 'LEVROTEC TECHNOLOGIES', gstin: '', pan: '', phone: '', bank: '', account_no: '' })
    const first = await api.saveInvoice(base(p, { bill_to_address: '12 Test Street', bill_to_email: 'ap@client.test', bill_to_gstin: '' }))
    expect(first.details).toMatchObject({ bill_to_address: '12 Test Street', bill_to_email: 'ap@client.test', company: { gstin: '', signatory: 'Tharun Devakumar' } })
    await api.saveInvoiceProfile({ ...companyProfile(data.settings), phone: '00000 00000', gstin: 'TESTGSTIN', bank: 'Test Bank', tagline: '' })
    await refresh()
    expect(companyProfile(data.settings)).toMatchObject({ phone: '00000 00000', gstin: 'TESTGSTIN', tagline: '' })
    const second = await api.saveInvoice({ ...base(p), invoice_number: 'LEV-CHP-2026-002' })
    expect(second.details.company).toMatchObject({ gstin: 'TESTGSTIN', bank: 'Test Bank' })
    // editing the first invoice keeps the details it was issued with
    const edited = await api.saveInvoice({ ...base(p), notes: 'edited' }, first.id)
    expect(edited.details.company.gstin).toBe('')
    await expect(api.saveInvoiceProfile({ name: '' })).rejects.toThrow()
    await expect(api.saveInvoiceProfile({ name: 'X', email: 'not-an-email' })).rejects.toThrow()
  })
})

describe('Own products', () => {
  beforeEach(() => fresh())
  it('tracks stage and progress, stays out of client receivables, and can carry costs', async () => {
    const { productActivity, daysSince } = await import('../src/lib/products')
    const client = await api.saveProject({ name: 'Booking System', client_name: 'Chippy', contract_value: '0', status: 'Active' })
    const z = await api.saveProduct({ name: 'Zapptude', stage: 'In Development', progress: '40', stage_note: 'Question bank done' })
    await refresh()
    const product = data.projects.find((p) => p.id === z.id)
    expect(product).toMatchObject({ kind: 'product', stage: 'In Development', progress: 40, contract_value: 0, status: 'Active' })
    expect(data.projects.find((p) => p.id === client.id).kind).toBe('client')
    expect(productActivity(product, today)).toMatchObject({ tone: 'green' })
    expect(productActivity({ ...product, stage_updated_at: '2020-01-01T00:00:00Z' }, today).tone).toBe('red')
    expect(daysSince('2026-10-01', '2026-10-08')).toBe(7)
    await api.saveExpense({ title: 'Domain', amount: 900, date: today, category: 'Hosting', project_id: z.id, payment_method: 'UPI' })
    await refresh()
    expect(F.projectFinancials(data.projects.find((p) => p.id === z.id), data)).toMatchObject({ totalCosts: 900, outstanding: 0 })
    expect(F.companyPosition(data, today).pendingReceivables).toBe(0)
    const before = data.projects.find((p) => p.id === z.id).stage_updated_at
    await api.saveProduct({ description: 'Aptitude practice app' }, z.id) // details only: not a progress update
    await refresh()
    expect(data.projects.find((p) => p.id === z.id).stage_updated_at).toBe(before)
    await api.saveProduct({ stage: 'Launched', progress: 100 }, z.id)
    await refresh()
    expect(data.projects.find((p) => p.id === z.id)).toMatchObject({ stage: 'Launched', status: 'Completed', description: 'Aptitude practice app' })
    await expect(api.saveProduct({ name: 'Zapptude' })).rejects.toThrow(/already exists/)
    await expect(api.saveProduct({ name: 'X', progress: 140 })).rejects.toThrow()
    await expect(api.saveProduct({ stage: 'Testing' }, client.id)).rejects.toThrow()
  })
})
