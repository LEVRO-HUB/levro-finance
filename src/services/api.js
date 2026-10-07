// Domain service layer. The UI never touches storage directly — it calls these
// operations, which validate (fields + relationships), write, and append an
// activity-log entry. Phase 2 re-implements the same surface on Supabase.
import { blankState, DOC_CATEGORIES, EXPENSE_TYPES, INCOME_TYPES, INVOICE_STORED_STATUSES, MAX_FILE_BYTES, PROJECT_STATUSES } from './schema'
import { invoiceState, invoiceTotal, memberBalance, reimbursementState, round2, sum } from '../calculations/finance'
import { isValidISODate, addDays } from '../lib/dates'
import { formatCurrency, slugify, todayISO } from '../lib/format'
import { ValidationError } from './errors'

export { ValidationError }


class Checker {
  fields = {}
  add(field, message) { this.fields[field] ??= message; return this }
  check(ok, field, message) { if (!ok) this.add(field, message); return !!ok }
  done() {
    const keys = Object.keys(this.fields)
    if (keys.length) throw new ValidationError(keys.length === 1 ? this.fields[keys[0]] : 'Please fix the highlighted fields.', this.fields)
  }
}

const str = (v) => String(v ?? '').trim()
const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const nowISO = () => new Date().toISOString()

function parseAmount(c, value, field = 'amount', { allowZero = false, label = 'Amount' } = {}) {
  const raw = str(value)
  const n = Number(raw)
  if (raw === '' || !Number.isFinite(n)) { c.add(field, `${label} is required.`); return 0 }
  if (n < 0 || (!allowZero && n === 0)) { c.add(field, `${label} must be greater than zero.`); return 0 }
  if (n > 1e10) { c.add(field, `${label} is too large.`); return 0 }
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) { c.add(field, `${label} can have at most 2 decimal places.`); return 0 }
  return round2(n)
}

function parseDate(c, value, field, { required = true, label = 'Date', allowFuture = true } = {}) {
  const v = str(value)
  if (!v) { if (required) c.add(field, `${label} is required.`); return null }
  if (!isValidISODate(v) || v < '2000-01-01' || v > '2100-12-31') { c.add(field, `${label} is not a valid date.`); return null }
  if (!allowFuture && v > addDays(todayISO(), 1)) { c.add(field, `${label} cannot be in the future.`); return null }
  return v
}

const PREFIX = { income: 'INC', expenses: 'EXP', reimbursements: 'RMB', advances: 'ADV' }
function nextCode(state, collection) {
  const n = (state.meta.counters[collection] ?? 0) + 1
  state.meta.counters[collection] = n
  return `${PREFIX[collection]}-${String(n).padStart(4, '0')}`
}

export function createApi(adapter) {
  // Serialise writes so two quick saves can never interleave a read-modify-write.
  let queue = Promise.resolve()
  function mutate(fn) {
    const run = queue.then(async () => {
      const state = await adapter.load()
      const result = await fn(state)
      await adapter.save(state)
      return result
    })
    queue = run.catch(() => {})
    return run
  }

  function log(state, action, entity, entityId, summary, projectId = null) {
    state.activity_logs.push({ id: uid(), at: nowISO(), action, entity, entity_id: entityId, summary, project_id: projectId, actor: state.settings.user_name || 'You' })
    if (state.activity_logs.length > 2000) state.activity_logs.splice(0, state.activity_logs.length - 2000)
  }

  const find = (state, collection, id) => state[collection].find((r) => r.id === id)
  function upsert(state, collection, id, values) {
    if (id) {
      const row = find(state, collection, id)
      if (!row) throw new ValidationError('This record no longer exists. Refresh and try again.')
      Object.assign(row, values, { updated_at: nowISO() })
      return row
    }
    const row = { id: uid(), ...values, created_at: nowISO(), updated_at: nowISO() }
    if (PREFIX[collection]) row.code = nextCode(state, collection)
    state[collection].push(row)
    return row
  }

  function checkMethod(c, state, value, field = 'payment_method', required = true) {
    const v = str(value)
    if (!v) { if (required) c.add(field, 'Payment method is required.'); return '' }
    c.check(state.payment_methods.some((m) => m.name === v), field, 'Choose a payment method from the list.')
    return v
  }

  // ── Documents (shared helpers) ──
  async function storeVersion(state, doc, file) {
    if (!file || typeof file.size !== 'number') throw new ValidationError('Choose a file to upload.', { file: 'Choose a file to upload.' })
    if (file.size === 0) throw new ValidationError('That file is empty.', { file: 'That file is empty.' })
    if (file.size > MAX_FILE_BYTES) throw new ValidationError('Files must be 5 MB or smaller.', { file: 'Files must be 5 MB or smaller.' })
    const versions = state.document_versions.filter((v) => v.document_id === doc.id)
    const version = versions.length ? Math.max(...versions.map((v) => v.version)) + 1 : 1
    const storage_key = `${doc.id}/v${version}-${uid()}`
    await adapter.files.put(storage_key, file, file.type || 'application/octet-stream')
    const row = { id: uid(), document_id: doc.id, version, file_name: file.name || `file-v${version}`, file_size: file.size, mime_type: file.type || 'application/octet-stream', storage_key, uploaded_at: nowISO(), uploaded_by: state.settings.user_name || 'You' }
    state.document_versions.push(row)
    return row
  }

  async function createDocument(state, { file, name, category, project_id = null, invoice_id = null, expense_id = null, description = '' }) {
    const c = new Checker()
    c.check(DOC_CATEGORIES.some((d) => d.id === category), 'category', 'Choose a document type.')
    if (project_id) c.check(find(state, 'projects', project_id), 'project_id', 'That project no longer exists.')
    c.check(file, 'file', 'Choose a file to upload.')
    c.done()
    const doc = { id: uid(), name: str(name) || file.name, category, project_id, invoice_id, expense_id, description: str(description), created_at: nowISO() }
    await storeVersion(state, doc, file)
    state.documents.push(doc)
    log(state, 'uploaded', 'document', doc.id, `Uploaded document “${doc.name}”`, project_id)
    return doc
  }

  async function removeDocument(state, id) {
    const doc = find(state, 'documents', id)
    if (!doc) return
    for (const v of state.document_versions.filter((x) => x.document_id === id)) await adapter.files.remove(v.storage_key)
    state.document_versions = state.document_versions.filter((v) => v.document_id !== id)
    state.documents = state.documents.filter((d) => d.id !== id)
    for (const e of state.expenses) if (e.receipt_document_id === id) e.receipt_document_id = null
    for (const i of state.invoices) if (i.attachment_document_id === id) i.attachment_document_id = null
    return doc
  }

  const api = {
    load: () => adapter.load(),

    // ───────── Projects ─────────
    saveProject: (values, id = null) => mutate((state) => {
      const c = new Checker()
      const name = str(values.name)
      c.check(name, 'name', 'Project name is required.')
      c.check(name.length <= 120, 'name', 'Project name is too long.')
      const project_number = str(values.project_number)
      c.check(!project_number || !state.projects.some((p) => p.id !== id && str(p.project_number).toLowerCase() === project_number.toLowerCase()), 'project_number', 'Another project already uses this number.')
      c.check(!state.projects.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase()), 'name', 'A project with this name already exists.')
      const contract_value = parseAmount(c, values.contract_value, 'contract_value', { allowZero: true, label: 'Contract value' })
      c.check(PROJECT_STATUSES.includes(values.status), 'status', 'Choose a status.')
      const start_date = parseDate(c, values.start_date, 'start_date', { required: false, label: 'Start date' })
      const end_date = parseDate(c, values.end_date, 'end_date', { required: false, label: 'End date' })
      if (start_date && end_date) c.check(end_date >= start_date, 'end_date', 'End date cannot be before the start date.')
      c.done()
      const payload = { name, project_number, client_name: str(values.client_name), description: str(values.description), status: values.status, start_date, end_date, contract_value, payment_terms: str(values.payment_terms), notes: str(values.notes) }
      if (!id) {
        let slug = slugify(name)
        for (let i = 2; state.projects.some((p) => p.slug === slug); i++) slug = `${slugify(name)}-${i}`
        payload.slug = slug
      }
      const row = upsert(state, 'projects', id, payload)
      log(state, id ? 'updated' : 'created', 'project', row.id, `${id ? 'Updated' : 'Created'} project “${row.name}” (contract ${formatCurrency(contract_value)})`, row.id)
      return row
    }),

    deleteProject: (id) => mutate(async (state) => {
      const p = find(state, 'projects', id)
      if (!p) return
      const linked = ['income', 'expenses', 'invoices'].filter((k) => state[k].some((r) => r.project_id === id))
      if (linked.length) throw new ValidationError(`“${p.name}” has financial records (${linked.join(', ')}) and can't be deleted. Set its status to Cancelled instead, or remove those records first.`)
      for (const d of state.documents.filter((x) => x.project_id === id)) await removeDocument(state, d.id)
      state.projects = state.projects.filter((x) => x.id !== id)
      state.activity_logs = state.activity_logs.filter((l) => l.project_id !== id)
      log(state, 'deleted', 'project', id, `Deleted project “${p.name}”`)
    }),

    // ───────── Members ─────────
    saveMember: (values, id = null) => mutate((state) => {
      const c = new Checker()
      const name = str(values.name)
      c.check(name, 'name', 'Name is required.')
      c.check(!state.members.some((m) => m.id !== id && m.name.toLowerCase() === name.toLowerCase()), 'name', 'A member with this name already exists.')
      const email = str(values.email)
      c.check(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'email', 'Enter a valid email address.')
      const phone = str(values.phone)
      c.check(!phone || /^[+\d][\d\s-]{6,17}$/.test(phone), 'phone', 'Enter a valid phone number.')
      const joining_date = parseDate(c, values.joining_date, 'joining_date', { required: false, label: 'Joining date' })
      c.done()
      const row = upsert(state, 'members', id, { name, designation: str(values.designation), email, phone, joining_date, notes: str(values.notes), ...(id ? {} : { is_active: true }) })
      log(state, id ? 'updated' : 'created', 'member', row.id, `${id ? 'Updated' : 'Added'} member ${row.name}`)
      return row
    }),

    setMemberActive: (id, is_active) => mutate((state) => {
      const row = upsert(state, 'members', id, { is_active })
      log(state, 'updated', 'member', id, `${is_active ? 'Reactivated' : 'Deactivated'} member ${row.name}`)
      return row
    }),

    deleteMember: (id) => mutate((state) => {
      const m = find(state, 'members', id)
      if (!m) return
      const used = state.expenses.some((e) => e.paid_by_member_id === id || e.purchased_by_member_id === id) || state.advances.some((a) => a.member_id === id) || state.reimbursements.some((r) => r.member_id === id)
      if (used) throw new ValidationError(`${m.name} has financial history and can't be deleted. Deactivate them instead.`)
      state.members = state.members.filter((x) => x.id !== id)
      log(state, 'deleted', 'member', id, `Deleted member ${m.name}`)
    }),

    // ───────── Money in ─────────
    saveIncome: (values, id = null) => mutate((state) => {
      const c = new Checker()
      const type = INCOME_TYPES.find((t) => t.id === values.type)
      c.check(type, 'type', 'Choose an income type.')
      const amount = parseAmount(c, values.amount)
      const date = parseDate(c, values.date, 'date', { allowFuture: false })
      const invoice = values.invoice_id ? find(state, 'invoices', values.invoice_id) : null
      let project_id = values.project_id || null
      if (values.invoice_id) {
        if (c.check(invoice, 'invoice_id', 'That invoice no longer exists.')) {
          if (project_id) c.check(invoice.project_id === project_id, 'invoice_id', 'That invoice belongs to a different project.')
          project_id = invoice.project_id
          c.check(invoice.status !== 'Cancelled', 'invoice_id', 'This invoice is cancelled — payments can’t be recorded against it.')
          const others = state.income.filter((i) => i.id !== id)
          const { outstanding } = invoiceState(invoice, others)
          if (amount > 0) c.check(amount <= outstanding + 0.005, 'amount', `This is more than the invoice's outstanding balance (${formatCurrency(outstanding)}).`)
        }
      }
      if (type?.needsProject) c.check(project_id, 'project_id', 'Choose the project this payment is for.')
      if (project_id) c.check(find(state, 'projects', project_id), 'project_id', 'That project no longer exists.')
      const payment_method = checkMethod(c, state, values.payment_method)
      c.done()
      const row = upsert(state, 'income', id, { type: type.id, amount, date, project_id, invoice_id: invoice?.id ?? null, payment_method, reference: str(values.reference), description: str(values.description), notes: str(values.notes) })
      log(state, id ? 'updated' : 'created', 'income', row.id, `${id ? 'Updated' : 'Recorded'} ${type.label.toLowerCase()} of ${formatCurrency(amount)}${invoice ? ` against ${invoice.invoice_number}` : ''}`, project_id)
      return row
    }),

    deleteIncome: (id) => mutate((state) => {
      const row = find(state, 'income', id)
      if (!row) return
      state.income = state.income.filter((r) => r.id !== id)
      log(state, 'deleted', 'income', id, `Deleted ${row.code} (${formatCurrency(row.amount)} received)`, row.project_id)
    }),

    // ───────── Money out ─────────
    // values.receipt (File) is optional; values.paid_by is '' / null for company or a member id.
    saveExpense: (values, id = null) => mutate(async (state) => {
      const c = new Checker()
      const existing = id ? find(state, 'expenses', id) : null
      const title = str(values.title)
      c.check(title, 'title', 'Title is required.')
      const amount = parseAmount(c, values.amount)
      const date = parseDate(c, values.date, 'date', { allowFuture: false })
      const category = str(values.category)
      c.check(category, 'category', 'Category is required.')
      if (category) c.check(state.categories.some((k) => k.name === category), 'category', 'Choose a category from the list.')
      const project_id = values.project_id || null
      let expense_type = values.expense_type || (project_id ? 'project_expense' : 'company_expense')
      if (expense_type !== 'company_purchase') expense_type = project_id ? 'project_expense' : 'company_expense'
      c.check(EXPENSE_TYPES.some((t) => t.id === expense_type), 'expense_type', 'Choose an expense type.')
      if (project_id) c.check(find(state, 'projects', project_id), 'project_id', 'That project no longer exists.')
      const paid_by_member_id = values.paid_by_member_id || null
      if (paid_by_member_id) c.check(find(state, 'members', paid_by_member_id), 'paid_by_member_id', 'That member no longer exists.')
      const purchased_by_member_id = values.purchased_by_member_id || null
      const payment_method = checkMethod(c, state, values.payment_method)
      if (existing) {
        const st = reimbursementState(existing, state.reimbursements)
        if (st.reimbursed > 0) {
          c.check(paid_by_member_id === existing.paid_by_member_id, 'paid_by_member_id', 'Reimbursements are already recorded for this expense — “Paid by” can’t be changed.')
          if (amount > 0) c.check(amount >= st.reimbursed - 0.005, 'amount', `${formatCurrency(st.reimbursed)} has already been reimbursed — the amount can't be lower than that.`)
        }
      }
      if (values.receipt) {
        c.check(values.receipt.size <= MAX_FILE_BYTES, 'receipt', 'Files must be 5 MB or smaller.')
        c.check(values.receipt.size > 0, 'receipt', 'That file is empty.')
      }
      c.done()
      const row = upsert(state, 'expenses', id, {
        title, amount, date, category, expense_type, project_id, paid_by_member_id, purchased_by_member_id, payment_method,
        recipient: str(values.recipient), reference: str(values.reference), description: str(values.description),
        is_asset: expense_type === 'company_purchase' ? values.is_asset !== false : false,
        receipt_document_id: existing?.receipt_document_id ?? null,
      })
      if (values.receipt) {
        const prev = row.receipt_document_id && find(state, 'documents', row.receipt_document_id)
        if (prev) await storeVersion(state, prev, values.receipt)
        else row.receipt_document_id = (await createDocument(state, { file: values.receipt, name: `Receipt — ${title}`, category: 'receipt', project_id, expense_id: row.id })).id
      }
      const who = paid_by_member_id ? ` paid personally by ${find(state, 'members', paid_by_member_id)?.name}` : ''
      log(state, id ? 'updated' : 'created', 'expense', row.id, `${id ? 'Updated' : 'Added'} expense “${title}” ${formatCurrency(amount)}${who}`, project_id)
      return row
    }),

    deleteExpense: (id) => mutate(async (state) => {
      const row = find(state, 'expenses', id)
      if (!row) return
      if (state.reimbursements.some((r) => r.expense_id === id)) throw new ValidationError('This expense has reimbursements recorded against it. Delete those repayments first.')
      if (row.receipt_document_id) await removeDocument(state, row.receipt_document_id)
      state.expenses = state.expenses.filter((r) => r.id !== id)
      log(state, 'deleted', 'expense', id, `Deleted expense “${row.title}” (${formatCurrency(row.amount)})`, row.project_id)
    }),

    // ───────── Reimbursements ─────────
    // Repay one expense (expense_id) or a member's outstanding expenses oldest-first (member_id).
    recordReimbursement: (values) => mutate((state) => {
      const c = new Checker()
      const amount = parseAmount(c, values.amount)
      const paid_date = parseDate(c, values.paid_date, 'paid_date', { allowFuture: false })
      const payment_method = checkMethod(c, state, values.payment_method)
      let targets = []
      if (values.expense_id) {
        const e = find(state, 'expenses', values.expense_id)
        if (c.check(e?.paid_by_member_id, 'expense_id', 'That expense was not paid personally.')) targets = [e]
      } else {
        const m = values.member_id && find(state, 'members', values.member_id)
        if (c.check(m, 'member_id', 'Choose a member.')) {
          targets = state.expenses.filter((e) => e.paid_by_member_id === m.id).sort((a, b) => (a.date === b.date ? String(a.created_at).localeCompare(String(b.created_at)) : a.date < b.date ? -1 : 1))
        }
      }
      const owedRows = targets.map((e) => ({ e, owed: reimbursementState(e, state.reimbursements).owed })).filter((x) => x.owed > 0.005)
      const totalOwed = sum(owedRows, (x) => x.owed)
      if (targets.length || values.expense_id) {
        if (c.check(totalOwed > 0, 'amount', 'Nothing is pending reimbursement here.') && amount > 0) {
          c.check(amount <= totalOwed + 0.005, 'amount', `That's more than the pending amount (${formatCurrency(totalOwed)}).`)
        }
      }
      // only the expenses this amount will actually reach (oldest first)
      let reach = amount
      for (const x of owedRows) {
        if (reach <= 0.005 || !paid_date) break
        c.check(paid_date >= x.e.date, 'paid_date', 'Repayment date can’t be before the expense it repays.')
        reach -= x.owed
      }
      c.done()
      let remaining = amount
      const created = []
      for (const { e, owed } of owedRows) {
        if (remaining <= 0.005) break
        const portion = round2(Math.min(remaining, owed))
        created.push(upsert(state, 'reimbursements', null, { expense_id: e.id, member_id: e.paid_by_member_id, amount: portion, paid_date, payment_method, reference: str(values.reference), notes: str(values.notes) }))
        remaining = round2(remaining - portion)
        log(state, 'created', 'reimbursement', created.at(-1).id, `Reimbursed ${find(state, 'members', e.paid_by_member_id)?.name ?? 'member'} ${formatCurrency(portion)} for “${e.title}”`, e.project_id)
      }
      return created
    }),

    deleteReimbursement: (id) => mutate((state) => {
      const row = find(state, 'reimbursements', id)
      if (!row) return
      state.reimbursements = state.reimbursements.filter((r) => r.id !== id)
      log(state, 'deleted', 'reimbursement', id, `Deleted repayment ${row.code} (${formatCurrency(row.amount)})`, find(state, 'expenses', row.expense_id)?.project_id)
    }),

    // ───────── Member advances (member owes Levrotec) ─────────
    saveAdvance: (values, id = null) => mutate((state) => {
      const c = new Checker()
      const m = values.member_id && find(state, 'members', values.member_id)
      c.check(m, 'member_id', 'Choose a member.')
      c.check(['given', 'returned'].includes(values.direction), 'direction', 'Choose a type.')
      const amount = parseAmount(c, values.amount)
      const date = parseDate(c, values.date, 'date', { allowFuture: false })
      const payment_method = checkMethod(c, state, values.payment_method)
      if (m && values.direction === 'returned' && amount > 0) {
        const others = { ...state, advances: state.advances.filter((a) => a.id !== id) }
        const owes = memberBalance(m.id, others).memberOwes
        c.check(amount <= owes + 0.005, 'amount', `${m.name} only owes ${formatCurrency(owes)}.`)
      }
      c.done()
      const row = upsert(state, 'advances', id, { member_id: m.id, direction: values.direction, amount, date, payment_method, reference: str(values.reference), notes: str(values.notes) })
      log(state, id ? 'updated' : 'created', 'advance', row.id, values.direction === 'given' ? `Advance of ${formatCurrency(amount)} given to ${m.name}` : `${m.name} returned ${formatCurrency(amount)}`)
      return row
    }),

    deleteAdvance: (id) => mutate((state) => {
      const row = find(state, 'advances', id)
      if (!row) return
      const rest = { ...state, advances: state.advances.filter((a) => a.id !== id) }
      const b = memberBalance(row.member_id, rest)
      if (b.advancesReturned > b.advancesGiven + 0.005) throw new ValidationError('Deleting this advance would leave more returned than was ever given. Delete the matching return first.')
      state.advances = rest.advances
      log(state, 'deleted', 'advance', id, `Deleted advance ${row.code} (${formatCurrency(row.amount)})`)
    }),

    // ───────── Invoices ─────────
    saveInvoice: (values, id = null) => mutate(async (state) => {
      const c = new Checker()
      const project = values.project_id && find(state, 'projects', values.project_id)
      c.check(project, 'project_id', 'Choose a project.')
      const invoice_number = str(values.invoice_number)
      c.check(invoice_number, 'invoice_number', 'Invoice number is required.')
      c.check(!state.invoices.some((i) => i.id !== id && i.invoice_number.toLowerCase() === invoice_number.toLowerCase()), 'invoice_number', 'This invoice number is already used.')
      const amount = parseAmount(c, values.amount)
      const tax_amount = str(values.tax_amount) === '' ? 0 : parseAmount(c, values.tax_amount, 'tax_amount', { allowZero: true, label: 'Tax' })
      const tds_amount = str(values.tds_amount) === '' ? 0 : parseAmount(c, values.tds_amount, 'tds_amount', { allowZero: true, label: 'TDS' })
      const invoice_date = parseDate(c, values.invoice_date, 'invoice_date', { label: 'Invoice date' })
      const due_date = parseDate(c, values.due_date, 'due_date', { required: false, label: 'Due date' })
      if (invoice_date && due_date) c.check(due_date >= invoice_date, 'due_date', 'Due date cannot be before the invoice date.')
      const status = values.status || 'Sent'
      c.check(INVOICE_STORED_STATUSES.includes(status), 'status', 'Choose a status.')
      c.check(tds_amount <= amount + tax_amount, 'tds_amount', 'TDS cannot exceed the invoice total.')
      if (id) {
        const paid = sum(state.income.filter((i) => i.invoice_id === id))
        if (paid > 0) {
          c.check(amount + tax_amount - tds_amount >= paid - 0.005, 'amount', `${formatCurrency(paid)} is already received against this invoice — the total can't be lower.`)
          c.check(status !== 'Cancelled' && status !== 'Draft', 'status', 'This invoice has payments — delete them before marking it Draft or Cancelled.')
          c.check(find(state, 'invoices', id)?.project_id === project?.id, 'project_id', 'This invoice has payments and can’t be moved to another project.')
        }
      }
      if (values.attachment) c.check(values.attachment.size <= MAX_FILE_BYTES && values.attachment.size > 0, 'attachment', 'Attachment must be between 1 byte and 5 MB.')
      c.done()
      const row = upsert(state, 'invoices', id, { project_id: project.id, client_name: project.client_name, invoice_number, invoice_date, due_date, amount, tax_amount, tds_amount, status, notes: str(values.notes), attachment_document_id: id ? find(state, 'invoices', id).attachment_document_id ?? null : null })
      if (values.attachment) {
        const prev = row.attachment_document_id && find(state, 'documents', row.attachment_document_id)
        if (prev) await storeVersion(state, prev, values.attachment)
        else row.attachment_document_id = (await createDocument(state, { file: values.attachment, name: `Invoice ${invoice_number}`, category: 'invoice', project_id: project.id, invoice_id: row.id })).id
      }
      log(state, id ? 'updated' : 'created', 'invoice', row.id, `${id ? 'Updated' : 'Created'} invoice ${invoice_number} for ${formatCurrency(invoiceTotal(row))}`, project.id)
      return row
    }),

    deleteInvoice: (id) => mutate(async (state) => {
      const row = find(state, 'invoices', id)
      if (!row) return
      if (state.income.some((i) => i.invoice_id === id)) throw new ValidationError('This invoice has payments recorded. Delete the payments first, or mark the invoice Cancelled.')
      if (row.attachment_document_id) await removeDocument(state, row.attachment_document_id)
      state.invoices = state.invoices.filter((r) => r.id !== id)
      log(state, 'deleted', 'invoice', id, `Deleted invoice ${row.invoice_number}`, row.project_id)
    }),

    // ───────── Documents ─────────
    uploadDocument: (values) => mutate((state) => createDocument(state, values)),

    replaceDocument: (id, file) => mutate(async (state) => {
      const doc = find(state, 'documents', id)
      if (!doc) throw new ValidationError('This document no longer exists.')
      const v = await storeVersion(state, doc, file)
      log(state, 'updated', 'document', id, `Replaced “${doc.name}” with v${v.version}`, doc.project_id)
      return v
    }),

    updateDocument: (id, values) => mutate((state) => {
      const c = new Checker()
      c.check(str(values.name), 'name', 'Name is required.')
      c.check(DOC_CATEGORIES.some((d) => d.id === values.category), 'category', 'Choose a document type.')
      c.done()
      return upsert(state, 'documents', id, { name: str(values.name), category: values.category, description: str(values.description) })
    }),

    deleteDocument: (id) => mutate(async (state) => {
      const doc = await removeDocument(state, id)
      if (doc) log(state, 'deleted', 'document', id, `Deleted document “${doc.name}”`, doc.project_id)
    }),

    // -> { blob | url, file_name, mime_type } for a version id.
    // A remote store hands back a short-lived signed URL instead of the bytes.
    async getFile(versionId, { download = false } = {}) {
      const state = await adapter.load()
      const v = state.document_versions.find((x) => x.id === versionId)
      if (!v) throw new Error('This file version no longer exists.')
      if (adapter.files.signedUrl) {
        return { url: await adapter.files.signedUrl(v.storage_key, { download: download ? v.file_name : false }), file_name: v.file_name, mime_type: v.mime_type }
      }
      const blob = await adapter.files.get(v.storage_key)
      if (!blob) throw new Error('The file contents are missing from this browser’s storage.')
      return { blob, file_name: v.file_name, mime_type: v.mime_type }
    },

    // ───────── Settings & reference lists ─────────
    saveSettings: (values) => mutate((state) => {
      const c = new Checker()
      const opening_reserve = parseAmount(c, values.opening_reserve, 'opening_reserve', { allowZero: true, label: 'Opening reserve' })
      const reserve_as_of = parseDate(c, values.reserve_as_of, 'reserve_as_of', { required: false, label: 'As-of date' }) ?? ''
      c.check(str(values.company_name), 'company_name', 'Company name is required.')
      c.done()
      Object.assign(state.settings, { company_name: str(values.company_name), user_name: str(values.user_name), opening_reserve, reserve_as_of })
      log(state, 'updated', 'settings', 'app', `Updated settings (opening reserve ${formatCurrency(opening_reserve)})`)
      return state.settings
    }),

    saveListItem: (collection, name, id = null) => mutate((state) => {
      if (!['categories', 'payment_methods'].includes(collection)) throw new Error('Unknown list')
      const c = new Checker()
      const v = str(name)
      c.check(v, 'name', 'Name is required.')
      c.check(v.length <= 40, 'name', 'Keep it under 40 characters.')
      c.check(!state[collection].some((r) => r.id !== id && r.name.toLowerCase() === v.toLowerCase()), 'name', 'That already exists.')
      c.done()
      if (id) {
        const old = find(state, collection, id)?.name
        if (old && old !== v) {
          // keep history consistent: a rename renames it on existing records too
          if (collection === 'categories') for (const e of state.expenses) if (e.category === old) e.category = v
          if (collection === 'payment_methods') for (const k of ['income', 'expenses', 'reimbursements', 'advances']) for (const r of state[k]) if (r.payment_method === old) r.payment_method = v
        }
      }
      return upsert(state, collection, id, { name: v })
    }),

    deleteListItem: (collection, id) => mutate((state) => {
      const row = find(state, collection, id)
      if (!row) return
      const inUse = collection === 'categories'
        ? state.expenses.some((e) => e.category === row.name)
        : ['income', 'expenses', 'reimbursements', 'advances'].some((k) => state[k].some((r) => r.payment_method === row.name))
      if (inUse) throw new ValidationError(`“${row.name}” is used by existing records and can't be deleted. Rename it instead.`)
      if (state[collection].length <= 1) throw new ValidationError('At least one entry is required.')
      state[collection] = state[collection].filter((r) => r.id !== id)
    }),

    // ───────── Workspace ─────────
    // Re-read everything from the backend (used when the window regains focus).
    async refresh() {
      await queue
      await adapter.refresh?.()
    },
    // Local mode only: replace the whole workspace.
    async resetData(kind, seed) {
      if (!adapter.replace) throw new ValidationError('Resetting data is not available on the shared database.')
      await queue
      await adapter.replace(kind === 'demo' && seed ? seed() : blankState())
    },
    // Full backup of every record. File contents are not included — only each
    // file's name, size and storage path (never a public or signed link).
    async exportData() {
      const state = await adapter.load()
      return { exported_at: new Date().toISOString(), format: 'levro-finance-backup/1', ...state }
    },
  }
  return api
}
