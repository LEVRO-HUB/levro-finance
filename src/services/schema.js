export const SCHEMA_VERSION = 1

export const COLLECTIONS = [
  'members', 'projects', 'income', 'expenses', 'reimbursements', 'advances', 'invoices',
  'documents', 'document_versions', 'categories', 'payment_methods', 'activity_logs',
]

export const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed', 'Cancelled']

export const INCOME_TYPES = [
  { id: 'client_payment', label: 'Client Payment', needsProject: true },
  { id: 'project_payment', label: 'Project Payment', needsProject: true },
  { id: 'other_income', label: 'Other Income', needsProject: false },
  { id: 'refund', label: 'Refund Received', needsProject: false },
]

export const EXPENSE_TYPES = [
  { id: 'project_expense', label: 'Project Expense' },
  { id: 'company_expense', label: 'Company Expense' },
  { id: 'company_purchase', label: 'Company Purchase' },
]

export const INVOICE_STORED_STATUSES = ['Draft', 'Sent', 'Cancelled']
export const INVOICE_STATUSES = ['Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled']
export const REIMBURSEMENT_STATUSES = ['Pending', 'Partially Reimbursed', 'Reimbursed']

export const DOC_CATEGORIES = [
  { id: 'master_agreement', label: 'Master Agreement' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'design', label: 'Design' },
  { id: 'invoice', label: 'Invoice' },
  { id: 'receipt', label: 'Receipt' },
  { id: 'other', label: 'Other' },
]
export const docCategoryLabel = (id) => DOC_CATEGORIES.find((c) => c.id === id)?.label ?? id

export const DESIGNATIONS = ['Founder', 'Project Manager', 'Developer', 'Designer', 'Accountant', 'Intern', 'Other']

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Hosting', 'Software', 'Subscription', 'Office', 'Equipment', 'Furniture', 'Rent', 'Utilities',
  'Salary', 'Travel', 'Marketing', 'Vendor Payment', 'Others',
]
export const PURCHASE_CATEGORIES = ['Equipment', 'Furniture', 'Office', 'Software', 'Subscription', 'Others']
export const DEFAULT_PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cash', 'Credit Card', 'Debit Card', 'Cheque']

export const MAX_FILE_BYTES = 5 * 1024 * 1024

export function emptyState() {
  const state = { meta: { version: SCHEMA_VERSION, counters: {} }, settings: { company_name: 'Levrotec', opening_reserve: 0, reserve_as_of: '', user_name: '' } }
  for (const c of COLLECTIONS) state[c] = []
  return state
}

// A workspace with no transactions but the reference lists every form needs.
export function blankState() {
  const now = new Date().toISOString()
  const state = emptyState()
  state.categories = DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({ id: `cat-${i + 1}`, name, created_at: now }))
  state.payment_methods = DEFAULT_PAYMENT_METHODS.map((name, i) => ({ id: `pm-${i + 1}`, name, created_at: now }))
  return state
}
