// How each app collection maps to a Postgres table, in parent → child order.
// `cols` are the only columns the app ever writes; everything else (codes,
// timestamps, created_by, audit actor) is filled in by the database.
export const TABLES = [
  { c: 'categories', t: 'categories', cols: ['id', 'name'] },
  { c: 'payment_methods', t: 'payment_methods', cols: ['id', 'name'] },
  { c: 'members', t: 'members', cols: ['id', 'name', 'designation', 'email', 'phone', 'joining_date', 'is_active', 'notes'] },
  { c: 'projects', t: 'projects', cols: ['id', 'slug', 'name', 'project_number', 'client_name', 'description', 'status', 'start_date', 'end_date', 'contract_value', 'payment_terms', 'notes', 'kind', 'stage', 'progress', 'stage_note', 'stage_updated_at'] },
  { c: 'recurring', t: 'recurring_items', cols: ['id', 'kind', 'name', 'project_id', 'amount', 'due_day', 'start_month', 'end_month', 'category', 'recipient', 'notes'] },
  { c: 'invoices', t: 'invoices', cols: ['id', 'project_id', 'invoice_number', 'invoice_date', 'due_date', 'amount', 'tax_amount', 'tds_amount', 'status', 'notes', 'details'] },
  { c: 'expenses', t: 'expenses', cols: ['id', 'date', 'title', 'category', 'amount', 'expense_type', 'project_id', 'paid_by_member_id', 'purchased_by_member_id', 'is_asset', 'payment_method', 'recipient', 'reference', 'description', 'recurring_id', 'recurring_month'] },
  { c: 'income', t: 'income', cols: ['id', 'date', 'type', 'amount', 'project_id', 'invoice_id', 'payment_method', 'reference', 'description', 'notes', 'recurring_id', 'recurring_month'] },
  { c: 'reimbursements', t: 'reimbursements', cols: ['id', 'expense_id', 'amount', 'paid_date', 'payment_method', 'reference', 'notes'] },
  { c: 'advances', t: 'member_advances', cols: ['id', 'member_id', 'date', 'direction', 'amount', 'payment_method', 'reference', 'notes'] },
  { c: 'documents', t: 'documents', cols: ['id', 'name', 'category', 'project_id', 'invoice_id', 'expense_id', 'description'] },
  { c: 'document_versions', t: 'document_versions', cols: ['id', 'document_id', 'version', 'file_name', 'file_size', 'mime_type', 'storage_path'], order: 'uploaded_at', immutable: true },
  { c: 'activity_logs', t: 'activity_logs', cols: ['id', 'action', 'entity', 'entity_id', 'summary', 'project_id'], order: 'at', appendOnly: true, latest: 1000 },
]

export const PAGE_SIZE = 1000
export const BUCKET = 'documents'
