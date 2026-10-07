// Shared entity shapes (JSDoc). These mirror the tables the Supabase phase
// will create — keep them in sync with src/services/schema.js.

/** @typedef {'Active'|'Completed'|'On Hold'|'Cancelled'} ProjectStatus */
/**
 * @typedef {Object} Project
 * @property {string} id @property {string} slug @property {string} name
 * @property {string} project_number @property {string} client_name @property {string} description
 * @property {ProjectStatus} status @property {string|null} start_date @property {string|null} end_date
 * @property {number} contract_value @property {string} payment_terms @property {string} notes
 */
/**
 * @typedef {Object} Member
 * @property {string} id @property {string} name @property {string} designation @property {string} email
 * @property {string} phone @property {string|null} joining_date @property {boolean} is_active @property {string} notes
 */
/**
 * Money in. A payment against an invoice is simply an income row with invoice_id set.
 * @typedef {Object} Income
 * @property {string} id @property {string} code @property {string} date
 * @property {'client_payment'|'project_payment'|'other_income'|'refund'} type
 * @property {number} amount @property {string|null} project_id @property {string|null} invoice_id
 * @property {string} payment_method @property {string} reference @property {string} description @property {string} notes
 */
/**
 * Money out (incurred). paid_by_member_id set => paid personally => reimbursable.
 * expense_type 'company_purchase' rows are the Purchases / Assets register.
 * @typedef {Object} Expense
 * @property {string} id @property {string} code @property {string} date @property {string} title
 * @property {string} category @property {number} amount
 * @property {'project_expense'|'company_expense'|'company_purchase'} expense_type
 * @property {string|null} project_id @property {string|null} paid_by_member_id
 * @property {string|null} purchased_by_member_id @property {boolean} is_asset
 * @property {string} payment_method @property {string} recipient @property {string} reference
 * @property {string} description @property {string|null} receipt_document_id
 */
/**
 * @typedef {Object} Reimbursement
 * @property {string} id @property {string} code @property {string} expense_id @property {string} member_id
 * @property {number} amount @property {string} paid_date @property {string} payment_method
 * @property {string} reference @property {string} notes
 */
/**
 * Money a member holds that belongs to the company (member owes Levrotec).
 * @typedef {Object} MemberAdvance
 * @property {string} id @property {string} code @property {string} member_id @property {string} date
 * @property {'given'|'returned'} direction @property {number} amount @property {string} payment_method
 * @property {string} reference @property {string} notes
 */
/**
 * @typedef {Object} Invoice
 * @property {string} id @property {string} project_id @property {string} invoice_number
 * @property {string} invoice_date @property {string|null} due_date @property {number} amount
 * @property {number} tax_amount @property {number} tds_amount
 * @property {'Draft'|'Sent'|'Cancelled'} status  Stored intent only; Paid / Partially Paid / Overdue are calculated.
 * @property {string} notes @property {string|null} attachment_document_id
 */
/**
 * @typedef {Object} DocumentRecord
 * @property {string} id @property {string} name @property {string} category
 * @property {string|null} project_id @property {string|null} invoice_id @property {string|null} expense_id
 * @property {string} description @property {string} created_at
 */
/**
 * @typedef {Object} DocumentVersion
 * @property {string} id @property {string} document_id @property {number} version @property {string} file_name
 * @property {number} file_size @property {string} mime_type @property {string} storage_key @property {string} uploaded_at
 */
export {}
