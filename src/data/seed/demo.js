// Demo workspace used on first run (and by Settings → "Load demo data").
// It is DATA, not UI: every figure the app shows is still calculated from
// these records by src/calculations. Dates are relative to today so the
// "this month" views are never empty.
import { blankState } from '../../services/schema'
import { addDays } from '../../lib/dates'
import { todayISO } from '../../lib/format'

export function demoState(today = todayISO()) {
  const s = blankState()
  const d = (n) => addDays(today, -n)
  const at = (n) => `${d(n)}T09:00:00.000Z`
  const counters = {}
  const code = (k, p) => { counters[k] = (counters[k] ?? 0) + 1; return `${p}-${String(counters[k]).padStart(4, '0')}` }

  s.settings = { company_name: 'Levrotec', user_name: 'Hari', opening_reserve: 150000, reserve_as_of: '' }

  s.members = [
    ['m-hari', 'Hariharan', 'Founder', 'hari@levrotec.com', '+91 98765 43210', 600],
    ['m-tharun', 'Tharun Devakumar', 'Founder', 'tharun@levrotec.com', '+91 98765 43211', 600],
    ['m-prem', 'Prem Rajeevan', 'Project Manager', 'prem@levrotec.com', '+91 98765 43212', 420],
    ['m-mathi', 'Mathivannan', 'Developer', 'mathi@levrotec.com', '+91 98765 43213', 300],
    ['m-sepal', 'Sepal Dharsan', 'Developer', 'sepal@levrotec.com', '', 240],
    ['m-boobalan', 'Boobalan', 'Developer', '', '', 200],
    ['m-abi', 'Abi', 'Designer', 'abi@levrotec.com', '', 150],
  ].map(([id, name, designation, email, phone, joined]) => ({ id, name, designation, email, phone, joining_date: d(joined), is_active: true, notes: '', created_at: at(joined), updated_at: at(joined) }))

  s.projects = [
    { id: 'p-chippy', slug: 'chippy-erp', name: 'Chippy ERP', project_number: 'CP-001', client_name: 'Chippy Properties', contract_value: 200000, status: 'Active', start_date: d(120), end_date: addDays(today, 60), payment_terms: '50% advance, 50% on completion', description: 'ERP development for Chippy Properties with custom modules.', notes: '' },
    { id: 'p-web', slug: 'website-project', name: 'Website Project', project_number: 'WP-002', client_name: 'ABC Technologies', contract_value: 75000, status: 'Active', start_date: d(75), end_date: addDays(today, 20), payment_terms: 'Milestone based', description: 'Corporate website redesign and CMS setup.', notes: '' },
    { id: 'p-app', slug: 'mobile-app', name: 'Mobile App', project_number: 'MA-003', client_name: 'NextGen Solutions', contract_value: 100000, status: 'On Hold', start_date: d(50), end_date: addDays(today, 90), payment_terms: '30% advance', description: 'Cross-platform mobile app (on hold pending client content).', notes: '' },
  ].map((p, i) => ({ ...p, created_at: at(120 - i * 30), updated_at: at(120 - i * 30) }))

  s.invoices = [
    { id: 'i-1', project_id: 'p-chippy', invoice_number: 'INV-001', invoice_date: d(115), due_date: d(100), amount: 100000, tax_amount: 0, tds_amount: 0, status: 'Sent' },
    { id: 'i-2', project_id: 'p-chippy', invoice_number: 'INV-002', invoice_date: d(30), due_date: addDays(today, 5), amount: 100000, tax_amount: 0, tds_amount: 0, status: 'Sent' },
    { id: 'i-3', project_id: 'p-web', invoice_number: 'INV-003', invoice_date: d(60), due_date: d(40), amount: 50000, tax_amount: 0, tds_amount: 0, status: 'Sent' },
    { id: 'i-4', project_id: 'p-web', invoice_number: 'INV-004', invoice_date: d(25), due_date: d(4), amount: 25000, tax_amount: 0, tds_amount: 0, status: 'Sent' },
    { id: 'i-5', project_id: 'p-app', invoice_number: 'INV-005', invoice_date: d(45), due_date: d(30), amount: 30000, tax_amount: 0, tds_amount: 0, status: 'Sent' },
    { id: 'i-6', project_id: 'p-app', invoice_number: 'INV-006', invoice_date: d(2), due_date: addDays(today, 28), amount: 35000, tax_amount: 0, tds_amount: 0, status: 'Draft' },
  ].map((i) => ({ ...i, client_name: s.projects.find((p) => p.id === i.project_id).client_name, notes: '', attachment_document_id: null, created_at: `${i.invoice_date}T09:00:00.000Z`, updated_at: `${i.invoice_date}T09:00:00.000Z` }))

  const inc = (id, days, type, amount, project_id, invoice_id, method, description, reference = '') => ({ id, code: code('income', 'INC'), date: d(days), type, amount, project_id, invoice_id, payment_method: method, reference, description, notes: '', created_at: at(days), updated_at: at(days) })
  s.income = [
    inc('in-1', 108, 'client_payment', 100000, 'p-chippy', 'i-1', 'Bank Transfer', 'Chippy ERP — advance', 'NEFT-88213'),
    inc('in-2', 52, 'client_payment', 50000, 'p-web', 'i-3', 'Bank Transfer', 'Website — milestone 1', 'NEFT-90144'),
    inc('in-3', 38, 'client_payment', 30000, 'p-app', 'i-5', 'UPI', 'Mobile App — advance'),
    inc('in-4', 9, 'client_payment', 50000, 'p-chippy', 'i-2', 'Bank Transfer', 'Chippy ERP — part payment', 'NEFT-93320'),
    inc('in-5', 6, 'other_income', 4200, null, null, 'Bank Transfer', 'Interest on current account'),
    inc('in-6', 3, 'refund', 1800, null, null, 'UPI', 'Refund — cancelled SaaS plan'),
  ]

  const exp = (id, days, title, category, amount, project_id, paidBy, method, extra = {}) => ({
    id, code: code('expenses', 'EXP'), date: d(days), title, category, amount, project_id, paid_by_member_id: paidBy,
    expense_type: extra.expense_type ?? (project_id ? 'project_expense' : 'company_expense'), purchased_by_member_id: extra.purchased_by ?? null,
    is_asset: !!extra.is_asset, payment_method: method, recipient: extra.recipient ?? '', reference: '', description: extra.description ?? '',
    receipt_document_id: null, created_at: at(days), updated_at: at(days),
  })
  s.expenses = [
    exp('e-1', 100, 'Cloud server setup', 'Hosting', 12000, 'p-chippy', null, 'Credit Card', { recipient: 'AWS' }),
    exp('e-2', 88, 'Office rent', 'Rent', 18000, null, null, 'Bank Transfer', { recipient: 'Sri Lakshmi Properties' }),
    exp('e-3', 70, 'UI kit licence', 'Software', 6500, 'p-web', 'm-abi', 'UPI', { recipient: 'Envato' }),
    exp('e-4', 58, 'Office rent', 'Rent', 18000, null, null, 'Bank Transfer', { recipient: 'Sri Lakshmi Properties' }),
    exp('e-5', 46, 'Laptop — Dell Latitude', 'Equipment', 62000, null, null, 'Bank Transfer', { expense_type: 'company_purchase', is_asset: true, recipient: 'Dell Store', purchased_by: 'm-tharun' }),
    exp('e-6', 40, 'Client visit travel', 'Travel', 3200, 'p-app', 'm-prem', 'Cash'),
    exp('e-7', 28, 'Office rent', 'Rent', 18000, null, null, 'Bank Transfer', { recipient: 'Sri Lakshmi Properties' }),
    exp('e-8', 21, 'AWS hosting', 'Hosting', 8500, 'p-chippy', null, 'Credit Card', { recipient: 'AWS' }),
    exp('e-9', 14, 'Freelance QA', 'Vendor Payment', 15000, 'p-chippy', null, 'Bank Transfer', { recipient: 'Arun Kumar' }),
    exp('e-10', 11, 'Office chair', 'Furniture', 15000, null, null, 'UPI', { expense_type: 'company_purchase', is_asset: true, recipient: 'OfficeMart', purchased_by: 'm-prem' }),
    exp('e-11', 8, 'AWS hosting', 'Hosting', 2500, 'p-chippy', 'm-hari', 'Credit Card', { recipient: 'AWS', description: 'Paid on personal card' }),
    exp('e-12', 6, 'Domain & SSL', 'Hosting', 2400, 'p-web', null, 'Credit Card', { recipient: 'GoDaddy' }),
    exp('e-13', 5, 'Design tool subscription', 'Subscription', 1900, null, 'm-abi', 'Credit Card', { recipient: 'Figma' }),
    exp('e-14', 2, 'Office supplies', 'Office', 3200, null, 'm-mathi', 'Cash', { recipient: 'Stationery World' }),
    exp('e-15', 1, 'Internet bill', 'Utilities', 1499, null, null, 'UPI', { recipient: 'ACT Fibernet' }),
  ]

  const rmb = (id, days, expense_id, amount, method) => ({ id, code: code('reimbursements', 'RMB'), expense_id, member_id: s.expenses.find((e) => e.id === expense_id).paid_by_member_id, amount, paid_date: d(days), payment_method: method, reference: '', notes: '', created_at: at(days), updated_at: at(days) })
  s.reimbursements = [rmb('r-1', 60, 'e-3', 6500, 'UPI'), rmb('r-2', 30, 'e-6', 2000, 'UPI')]

  s.advances = [
    { id: 'a-1', code: code('advances', 'ADV'), member_id: 'm-sepal', direction: 'given', amount: 8000, date: d(20), payment_method: 'Bank Transfer', reference: '', notes: 'Advance for event travel', created_at: at(20), updated_at: at(20) },
    { id: 'a-2', code: code('advances', 'ADV'), member_id: 'm-sepal', direction: 'returned', amount: 3000, date: d(7), payment_method: 'UPI', reference: '', notes: 'Unused advance returned', created_at: at(7), updated_at: at(7) },
  ]

  s.activity_logs = [
    ...s.projects.map((p) => ({ id: `l-${p.id}`, at: p.created_at, action: 'created', entity: 'project', entity_id: p.id, project_id: p.id, actor: 'Hari', summary: `Created project “${p.name}”` })),
    ...s.income.map((i) => ({ id: `l-${i.id}`, at: i.created_at, action: 'created', entity: 'income', entity_id: i.id, project_id: i.project_id, actor: 'Hari', summary: `Recorded ${i.description}` })),
    ...s.expenses.map((e) => ({ id: `l-${e.id}`, at: e.created_at, action: 'created', entity: 'expense', entity_id: e.id, project_id: e.project_id, actor: 'Hari', summary: `Added expense “${e.title}”` })),
  ]
  s.meta.counters = counters
  return s
}
