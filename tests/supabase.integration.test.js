// Integration tests for the Supabase data layer against a REAL Postgres with
// the real migrations applied (see tests/support/README.md). Skipped unless
// PG_TEST_URL is set, so `npm test` still works anywhere.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import pg from 'pg'
import { createApi } from '../src/services/api'
import { createRemoteAdapter } from '../src/services/supabase/adapter'
import { PAGE_SIZE } from '../src/services/supabase/tables'
import { createPgGateway } from './support/pgGateway'
import * as F from '../src/calculations/finance'
import { todayISO } from '../src/lib/format'

const URL = process.env.PG_TEST_URL
const today = todayISO()
const pdf = (name = 'a.pdf', size = 10) => ({ name, size, type: 'application/pdf' })

describe.skipIf(!URL)('Supabase data layer (real Postgres, real RLS)', () => {
  let root, admin, member, inactive
  const open = (user) => { const gw = createPgGateway(root, user); const adapter = createRemoteAdapter(gw); return { api: createApi(adapter), gw, adapter } }
  const sql = async (text, params) => (await root.query(text, params)).rows

  beforeAll(async () => {
    root = new pg.Pool({ connectionString: URL, max: 30 })
    await sql(`delete from auth.users`)
    const mk = async (email, name) => (await sql(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, { full_name: name }]))[0]
    admin = await mk('admin@test.local', 'Asha Admin'); member = await mk('member@test.local', 'Mani Member'); inactive = await mk('new@test.local', 'New Person')
    await sql(`update public.profiles set role = 'admin', is_active = true where id = $1`, [admin.id])
    await sql(`update public.profiles set is_active = true where id = $1`, [member.id])
  })
  afterAll(async () => { await root?.end() })
  beforeEach(async () => {
    await sql(`truncate public.activity_logs, public.document_versions, public.documents, public.reimbursements, public.member_advances, public.income, public.expenses, public.invoices, public.recurring_items, public.projects, public.members cascade`)
    await sql(`delete from storage.objects`)
    await sql(`alter sequence public.income_code_seq restart; alter sequence public.expense_code_seq restart; alter sequence public.reimbursement_code_seq restart; alter sequence public.advance_code_seq restart`)
    await sql(`update public.app_settings set company_name = 'Levrotec', opening_reserve = 0, reserve_as_of = null`)
    await sql(`update public.categories set name = 'Hosting' where name = 'Cloud'`)
    await sql(`delete from public.categories where name not in ('Hosting','Software','Subscription','Office','Equipment','Furniture','Rent','Utilities','Salary','Travel','Marketing','Vendor Payment','Others')`)
    await sql(`insert into public.categories (name) values ('Hosting') on conflict do nothing`)
    await sql(`delete from public.payment_methods where name = 'Wallet'`)
    await sql(`update public.profiles set full_name = 'Mani Member' where id = $1`, [member.id])
  })

  // ───────── the brief's exact end-to-end flow (§16) ─────────
  it('complete finance flow persists and calculates correctly', async () => {
    const a = open(admin)
    const start = await a.api.load()
    expect(start.projects).toHaveLength(0)
    expect(start.categories.length).toBe(13)
    expect(start.settings.user_name).toBe('Asha Admin')

    const project = await a.api.saveProject({ name: 'Chippy ERP', contract_value: 200000, status: 'Active', client_name: 'Chippy Properties' })
    const hari = await a.api.saveMember({ name: 'Hari', designation: 'Founder' })
    const pf = async (api = a.api) => { const d = await api.load(); return [F.projectFinancials(d.projects[0], d), d] }

    // creating an invoice is NOT money received
    const inv = await a.api.saveInvoice({ project_id: project.id, invoice_number: 'INV-001', amount: 200000, invoice_date: today, status: 'Sent' })
    let [f, d] = await pf()
    expect(F.invoiceState(d.invoices[0], d.income)).toMatchObject({ total: 200000, paid: 0, outstanding: 200000, status: 'Sent' })
    expect(f).toMatchObject({ received: 0, outstanding: 200000, invoiced: 200000 })
    expect(F.companySummary(d).totalIncome).toBe(0)
    expect(F.companyReserve(d).current).toBe(0)
    expect(d.invoices[0].client_name).toBe('Chippy Properties') // derived, not stored

    await a.api.saveIncome({ type: 'client_payment', amount: 100000, date: today, invoice_id: inv.id, payment_method: 'Bank Transfer' })
    ;[f, d] = await pf()
    expect(f).toMatchObject({ received: 100000, outstanding: 100000 })
    expect(F.invoiceState(d.invoices[0], d.income)).toMatchObject({ paid: 100000, outstanding: 100000, status: 'Partially Paid' })
    expect(d.income[0].code).toBe('INC-0001') // assigned by the database sequence

    await a.api.saveExpense({ title: 'Server', amount: 20000, date: today, category: 'Hosting', project_id: project.id, payment_method: 'UPI' })
    const personal = await a.api.saveExpense({ title: 'AWS', amount: 5000, date: today, category: 'Hosting', project_id: project.id, paid_by_member_id: hari.id, payment_method: 'Credit Card' })
    ;[f, d] = await pf()
    expect(f.pendingReimbursement).toBe(5000)
    expect(F.memberBalance(hari.id, d).companyOwes).toBe(5000)
    expect(F.companyReserve(d).moneyOut).toBe(20000)

    await a.api.recordReimbursement({ expense_id: personal.id, amount: 5000, paid_date: today, payment_method: 'UPI' })
    ;[f, d] = await pf()
    expect(f).toMatchObject({ pendingReimbursement: 0, projectCosts: 25000, operatingResult: 75000 })
    expect(F.memberBalance(hari.id, d)).toMatchObject({ companyOwes: 0, reimbursed: 5000 })
    expect(d.reimbursements[0].member_id).toBe(hari.id) // derived from the expense

    // "close the browser and open the app again": a brand-new adapter with no cache
    const [f2, d2] = await pf(open(admin).api)
    expect(f2).toMatchObject({ contractValue: 200000, received: 100000, outstanding: 100000, projectCosts: 25000, pendingReimbursement: 0, operatingResult: 75000 })
    expect(F.invoiceState(d2.invoices[0], d2.income).status).toBe('Partially Paid')
    expect(F.companySummary(d2)).toMatchObject({ totalIncome: 100000, totalExpenses: 25000, netPosition: 75000 })
    expect(F.companyReserve(d2).current).toBe(75000)
    expect(F.buildLedger(d2)).toHaveLength(4)
    expect(d2.activity_logs.length).toBeGreaterThanOrEqual(7)
    expect(new Set(d2.activity_logs.map((l) => l.actor))).toEqual(new Set(['Asha Admin']))
    // nothing calculated is stored
    const cols = (await sql(`select column_name from information_schema.columns where table_schema = 'public'`)).map((r) => r.column_name)
    for (const banned of ['outstanding', 'net_result', 'received', 'paid_amount', 'balance', 'current_reserve', 'pending_reimbursement', 'total_owed']) expect(cols).not.toContain(banned)
  })

  // ───────── roles ─────────
  it('signed-out and inactive users can read and write nothing', async () => {
    const a = open(admin)
    const p = await a.api.saveProject({ name: 'Secret', contract_value: 1, status: 'Active' })
    await a.api.uploadDocument({ file: pdf(), category: 'other', project_id: p.id })
    const path = (await a.api.load()).document_versions[0].storage_key

    await expect(open(null).api.load()).rejects.toThrow(/permission/i) // anon has no table privileges at all
    const x = open(inactive)
    const seen = await x.api.load()
    for (const k of ['projects', 'income', 'expenses', 'invoices', 'members', 'documents', 'document_versions', 'activity_logs', 'categories', 'payment_methods']) expect(seen[k]).toHaveLength(0)
    expect(seen.settings.opening_reserve).toBe(0)
    await expect(x.gw.insert('projects', [{ slug: 'x', name: 'X' }])).rejects.toThrow(/row-level security/)
    await expect(x.gw.insert('income', [{ date: today, type: 'other_income', amount: 5, payment_method: 'UPI' }])).rejects.toThrow(/row-level security/)
    await expect(x.gw.update('projects', p.id, { name: 'Hacked' })).rejects.toThrow(/permission/)
    await expect(x.gw.remove('projects', p.id)).rejects.toThrow(/permission/)
    await expect(x.gw.signedUrl(path)).rejects.toThrow(/permission/)
    await expect(x.gw.uploadFile('evil/file')).rejects.toThrow(/row-level security/)
    await expect(open(null).gw.signedUrl(path)).rejects.toThrow(/permission/)
    await expect(x.gw.update('profiles', inactive.id, { is_active: true })).rejects.toThrow(/Only an admin/)
    expect((await sql(`select name from public.projects`))[0].name).toBe('Secret')
  })

  it('MEMBER: normal finance work allowed, admin operations refused', async () => {
    const a = open(admin), m = open(member)
    const hari = await a.api.saveMember({ name: 'Hari' })
    // permitted
    const p = await m.api.saveProject({ name: 'Member Project', contract_value: 50000, status: 'Active' })
    await m.api.saveProject({ name: 'Member Project', contract_value: 60000, status: 'Active' }, p.id)
    const inv = await m.api.saveInvoice({ project_id: p.id, invoice_number: 'INV-9', amount: 60000, invoice_date: today })
    const pay = await m.api.saveIncome({ type: 'client_payment', amount: 10000, date: today, invoice_id: inv.id, payment_method: 'UPI' })
    const e = await m.api.saveExpense({ title: 'Cab', amount: 800, date: today, category: 'Travel', project_id: p.id, paid_by_member_id: hari.id, payment_method: 'Cash', receipt: pdf('cab.jpg') })
    await m.api.recordReimbursement({ expense_id: e.id, amount: 300, paid_date: today, payment_method: 'UPI' })
    await m.api.saveAdvance({ member_id: hari.id, direction: 'given', amount: 1000, date: today, payment_method: 'Cash' })
    const doc = await m.api.uploadDocument({ file: pdf('agreement.pdf'), category: 'master_agreement', project_id: p.id })
    await m.api.replaceDocument(doc.id, pdf('agreement-v2.pdf', 20))
    let d = await m.api.load()
    expect(d.projects[0].contract_value).toBe(60000)
    expect(d.document_versions.filter((v) => v.document_id === doc.id).map((v) => v.version).sort()).toEqual([1, 2])
    expect(d.expenses[0].receipt_document_id).toBeTruthy() // derived from documents.expense_id
    expect((await m.api.getFile(d.document_versions[0].id)).url).toMatch(/^signed:\/\//)
    expect(d.activity_logs.every((l) => l.actor === 'Mani Member' || l.actor === 'Asha Admin')).toBe(true)

    // refused
    const refused = /permission/i
    await expect(m.api.deleteIncome(pay.id)).rejects.toThrow(refused)
    await expect(m.api.deleteExpense(e.id)).rejects.toThrow(/reimbursements|permission/i)
    await expect(m.api.deleteReimbursement(d.reimbursements[0].id)).rejects.toThrow(refused)
    await expect(m.api.deleteAdvance(d.advances[0].id)).rejects.toThrow(refused)
    await expect(m.api.deleteDocument(doc.id)).rejects.toThrow(refused)
    await expect(m.api.deleteProject((await m.api.saveProject({ name: 'Empty', contract_value: 0, status: 'Active' })).id)).rejects.toThrow(refused)
    await expect(m.api.saveSettings({ company_name: 'Mine', opening_reserve: 999999 })).rejects.toThrow(refused)
    await expect(m.api.saveListItem('categories', 'Bribes')).rejects.toThrow(refused)
    await expect(m.api.saveListItem('payment_methods', 'Crypto')).rejects.toThrow(refused)
    await expect(m.api.saveMember({ name: 'Ghost' })).rejects.toThrow(refused)
    await expect(m.api.setMemberActive(hari.id, false)).rejects.toThrow(refused)
    await expect(m.gw.update('profiles', member.id, { role: 'admin' })).rejects.toThrow(/Only an admin/)
    await expect(m.gw.update('profiles', admin.id, { is_active: false })).rejects.toThrow(/permission/)
    await expect(m.gw.update('activity_logs', d.activity_logs[0].id, { summary: 'edited' })).rejects.toThrow(/permission/i)
    await expect(m.gw.remove('activity_logs', d.activity_logs[0].id)).rejects.toThrow(/permission/i)
    await expect(m.gw.update('document_versions', d.document_versions[0].id, { file_name: 'swapped.pdf' })).rejects.toThrow(/permission/)

    // nothing above changed anything
    d = await open(admin).api.load()
    expect(d.income).toHaveLength(1); expect(d.reimbursements).toHaveLength(1); expect(d.documents).toHaveLength(2)
    expect(d.settings).toMatchObject({ company_name: 'Levrotec', opening_reserve: 0 })
    expect(d.categories.some((c) => c.name === 'Bribes')).toBe(false)
    expect(d.members).toHaveLength(1)
    expect((await sql(`select count(*)::int n from storage.objects`))[0].n).toBe(3)
    // a member may still fix their own display name (company settings untouched)
    await m.api.saveSettings({ company_name: 'Levrotec', opening_reserve: 0, user_name: 'Mani M' })
    expect((await open(member).api.load()).settings.user_name).toBe('Mani M')
  })

  it('ADMIN: full administrative access; delete safeguards still apply', async () => {
    const a = open(admin)
    const hari = await a.api.saveMember({ name: 'Hari' })
    const p = await a.api.saveProject({ name: 'P', contract_value: 1000, status: 'Active' })
    const pay = await a.api.saveIncome({ type: 'project_payment', amount: 100, date: today, project_id: p.id, payment_method: 'UPI' })
    const doc = await a.api.uploadDocument({ file: pdf(), category: 'other', project_id: p.id })
    await a.api.saveSettings({ company_name: 'Levrotec Pvt Ltd', opening_reserve: 50000, reserve_as_of: '', user_name: 'Asha Admin' })
    const cat = await a.api.saveListItem('categories', 'Legal')
    await expect(a.api.deleteProject(p.id)).rejects.toThrow(/financial records/)
    await expect(a.gw.remove('projects', p.id)).rejects.toThrow() // and the database refuses even if the app check were skipped
    await a.api.deleteIncome(pay.id)
    await a.api.deleteDocument(doc.id)
    await a.api.deleteListItem('categories', cat.id)
    await a.api.setMemberActive(hari.id, false)
    await a.api.deleteProject(p.id)
    const d = await open(admin).api.load()
    expect(d.settings).toMatchObject({ company_name: 'Levrotec Pvt Ltd', opening_reserve: 50000 })
    expect(F.companyReserve(d).current).toBe(50000)
    expect(d.projects).toHaveLength(0); expect(d.documents).toHaveLength(0); expect(d.members[0].is_active).toBe(false)
    expect((await sql(`select count(*)::int n from storage.objects`))[0].n).toBe(0)
    expect(d.activity_logs.length).toBeGreaterThan(5) // history survives the project's deletion
    // user access
    await a.gw.update('profiles', inactive.id, { is_active: true, role: 'member' })
    expect((await open(inactive).api.load()).categories.length).toBe(13)
    await a.gw.update('profiles', inactive.id, { is_active: false })
    await expect(a.gw.update('profiles', admin.id, { role: 'member' })).rejects.toThrow(/At least one active admin/)
  })

  // ───────── database-level integrity (frontend validation bypassed) ─────────
  describe('integrity is enforced by the database, even with simultaneous writes', () => {
    let a, m, p, inv, hari, exp
    beforeEach(async () => {
      a = open(admin); m = open(member)
      hari = await a.api.saveMember({ name: 'Hari' })
      p = await a.api.saveProject({ name: 'Chippy ERP', contract_value: 200000, status: 'Active' })
      inv = await a.api.saveInvoice({ project_id: p.id, invoice_number: 'INV-001', amount: 200000, invoice_date: today })
      exp = await a.api.saveExpense({ title: 'AWS', amount: 5000, date: today, category: 'Hosting', project_id: p.id, paid_by_member_id: hari.id, payment_method: 'UPI' })
    })
    const payment = (amount) => [{ date: today, type: 'client_payment', amount, project_id: p.id, invoice_id: inv.id, payment_method: 'UPI' }]
    const repay = (amount) => [{ expense_id: exp.id, amount, paid_date: today, payment_method: 'UPI' }]
    const settle = async (promises) => { const r = await Promise.allSettled(promises); return { ok: r.filter((x) => x.status === 'fulfilled').length, errors: r.filter((x) => x.status === 'rejected').map((x) => x.reason.message) } }

    it('invoice overpayment — two users paying at the same moment', async () => {
      const r = await settle(Array.from({ length: 12 }, (_, i) => (i % 2 ? a : m).gw.insert('income', payment(150000))))
      expect(r.ok).toBe(1)
      expect(r.errors.every((e) => /outstanding balance/.test(e))).toBe(true)
      expect((await sql(`select coalesce(sum(amount),0)::float s from public.income`))[0].s).toBe(150000)
      await expect(a.gw.insert('income', payment(50000.01))).rejects.toThrow(/outstanding balance/)
      await a.gw.insert('income', payment(50000))
    })

    it('a stale screen cannot overpay: the app surfaces the database refusal', async () => {
      await m.api.load() // member's snapshot: invoice fully unpaid
      await a.api.saveIncome({ type: 'client_payment', amount: 200000, date: today, invoice_id: inv.id, payment_method: 'UPI' })
      await expect(m.api.saveIncome({ type: 'client_payment', amount: 100000, date: today, invoice_id: inv.id, payment_method: 'UPI' })).rejects.toThrow(/outstanding balance/)
      expect(F.invoiceState((await m.api.load()).invoices[0], (await m.api.load()).income).status).toBe('Paid') // and the snapshot was refreshed
    })

    it('reimbursement overpayment — simultaneous repayments', async () => {
      const r = await settle(Array.from({ length: 12 }, (_, i) => (i % 2 ? a : m).gw.insert('reimbursements', repay(3000))))
      expect(r.ok).toBe(1)
      expect(r.errors.every((e) => /pending amount/.test(e))).toBe(true)
      await expect(a.gw.insert('reimbursements', repay(2000.01))).rejects.toThrow(/pending amount/)
    })

    it('expense cannot drop below what was reimbursed, nor change payer', async () => {
      await a.gw.insert('reimbursements', repay(3000))
      await expect(m.gw.update('expenses', exp.id, { amount: 2999 })).rejects.toThrow(/already been reimbursed/)
      await expect(m.gw.update('expenses', exp.id, { paid_by_member_id: null })).rejects.toThrow(/can't be changed/)
      await m.gw.update('expenses', exp.id, { amount: 3000 })
      // racing: lower the expense while another repayment lands
      const r = await settle([a.gw.update('expenses', exp.id, { amount: 3000 }), m.gw.insert('reimbursements', repay(0)).catch((e) => { throw e })])
      expect(r.ok).toBe(1)
      const row = (await sql(`select e.amount::float, (select coalesce(sum(amount),0)::float from public.reimbursements) repaid from public.expenses e where id = $1`, [exp.id]))[0]
      expect(row.repaid).toBeLessThanOrEqual(row.amount)
    })

    it('invoice with payments cannot be cancelled, shrunk, moved or deleted', async () => {
      await a.gw.insert('income', payment(100000))
      await expect(m.gw.update('invoices', inv.id, { status: 'Cancelled' })).rejects.toThrow(/has payments/)
      await expect(m.gw.update('invoices', inv.id, { status: 'Draft' })).rejects.toThrow(/has payments/)
      await expect(m.gw.update('invoices', inv.id, { amount: 99999 })).rejects.toThrow(/already received/)
      await expect(a.gw.remove('invoices', inv.id)).rejects.toThrow()
      const other = await a.api.saveProject({ name: 'Other', contract_value: 1, status: 'Active' })
      await expect(m.gw.update('invoices', inv.id, { project_id: other.id })).rejects.toThrow(/can't be moved/)
      await expect(a.gw.insert('income', [{ ...payment(10)[0], project_id: other.id }])).rejects.toThrow(/different project/)
    })

    it('member advance: cannot return more than was given — simultaneous returns', async () => {
      const adv = (direction, amount) => [{ member_id: hari.id, date: today, direction, amount, payment_method: 'Cash' }]
      await expect(a.gw.insert('member_advances', adv('returned', 1))).rejects.toThrow(/more returned/)
      await a.gw.insert('member_advances', adv('given', 1000))
      const r = await settle(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : m).gw.insert('member_advances', adv('returned', 700))))
      expect(r.ok).toBe(1)
      expect(r.errors.every((e) => /more returned/.test(e))).toBe(true) // clean refusals, no deadlocks
      const given = (await sql(`select id from public.member_advances where direction = 'given'`))[0].id
      await expect(a.gw.remove('member_advances', given)).rejects.toThrow(/more returned/)
    })

    it('invalid foreign keys and values are refused', async () => {
      const nope = '00000000-0000-4000-8000-000000000000'
      const base = { date: today, title: 'x', category: 'Hosting', amount: 5, expense_type: 'company_expense', payment_method: 'UPI' }
      await expect(m.gw.insert('expenses', [{ ...base, expense_type: 'project_expense', project_id: nope }])).rejects.toThrow(/foreign key/)
      await expect(m.gw.insert('expenses', [{ ...base, paid_by_member_id: nope }])).rejects.toThrow(/foreign key/)
      await expect(m.gw.insert('expenses', [{ ...base, category: 'Not A Category' }])).rejects.toThrow(/foreign key/)
      await expect(m.gw.insert('expenses', [{ ...base, payment_method: 'Barter' }])).rejects.toThrow(/foreign key/)
      await expect(m.gw.insert('expenses', [{ ...base, amount: 0 }])).rejects.toThrow(/check constraint/)
      await expect(m.gw.insert('expenses', [{ ...base, amount: -5 }])).rejects.toThrow(/check constraint/)
      await expect(m.gw.insert('expenses', [{ ...base, expense_type: 'project_expense' }])).rejects.toThrow(/check constraint/)
      await expect(m.gw.insert('income', [{ date: today, type: 'client_payment', amount: 5, payment_method: 'UPI' }])).rejects.toThrow(/check constraint/)
      await expect(m.gw.insert('income', [{ date: today, type: 'other_income', amount: 5, invoice_id: nope, project_id: p.id, payment_method: 'UPI' }])).rejects.toThrow()
      await expect(m.gw.insert('reimbursements', [{ expense_id: nope, amount: 5, paid_date: today, payment_method: 'UPI' }])).rejects.toThrow()
      await expect(m.gw.insert('invoices', [{ project_id: p.id, invoice_number: 'inv-001', invoice_date: today, amount: 5 }])).rejects.toThrow(/duplicate|unique/)
      await expect(m.gw.insert('document_versions', [{ document_id: nope, version: 1, file_name: 'a', file_size: 5, storage_path: 'x' }])).rejects.toThrow(/foreign key/)
      // and through the app the same refusals read as plain sentences
      await expect(m.api.saveExpense({ ...base, project_id: nope })).rejects.toThrow(/project no longer exists/)
    })
  })

  // ───────── multi-user freshness, pagination, efficiency ─────────
  it('a change by one user is visible to another after refresh (window focus)', async () => {
    const a = open(admin), m = open(member)
    expect((await a.api.load()).projects).toHaveLength(0)
    await m.api.saveProject({ name: 'From Member', contract_value: 10, status: 'Active' })
    expect((await a.api.load()).projects).toHaveLength(0) // cached snapshot until refreshed
    await a.api.refresh()
    const d = await a.api.load()
    expect(d.projects.map((p) => p.name)).toEqual(['From Member'])
    expect(d.activity_logs[0].actor).toBe('Mani Member')
  })

  it('loads tables larger than one API page completely; activity log is capped to the latest 1,000', async () => {
    const n = PAGE_SIZE * 2 + 345
    await sql(`insert into public.expenses (date, title, category, amount, expense_type, payment_method) select current_date - (g % 300), 'Bulk ' || g, 'Office', 10, 'company_expense', 'UPI' from generate_series(1, $1) g`, [n])
    await sql(`insert into public.activity_logs (action, entity, summary) select 'created', 'expense', 'bulk ' || g from generate_series(1, 1500) g`)
    const a = open(admin)
    const d = await a.api.load()
    expect(d.expenses).toHaveLength(n)
    expect(new Set(d.expenses.map((e) => e.id)).size).toBe(n) // no row skipped or repeated across pages
    expect(F.companySummary(d).totalExpenses).toBe(n * 10)
    expect(d.activity_logs).toHaveLength(1000)
    // after a mutation only the tables that changed are re-read
    const before = a.gw.stats.select
    await a.api.saveListItem('payment_methods', 'Wallet')
    await a.api.load()
    expect(a.gw.stats.select - before).toBeLessThanOrEqual(3)
  })

  it('renaming a category cascades in the database without rewriting each expense', async () => {
    const a = open(admin)
    await sql(`insert into public.expenses (date, title, category, amount, expense_type, payment_method) select current_date, 'H ' || g, 'Hosting', 10, 'company_expense', 'UPI' from generate_series(1, 50) g`)
    const d = await a.api.load()
    const updates = a.gw.stats.update
    await a.api.saveListItem('categories', 'Cloud', d.categories.find((c) => c.name === 'Hosting').id)
    expect(a.gw.stats.update - updates).toBe(1)
    const after = await a.api.load()
    expect(after.expenses.filter((e) => e.category === 'Cloud')).toHaveLength(50)
  })

  it('backup export contains every record and no file links', async () => {
    const a = open(admin)
    const p = await a.api.saveProject({ name: 'P', contract_value: 5, status: 'Active' })
    await a.api.uploadDocument({ file: pdf(), category: 'other', project_id: p.id })
    const backup = await a.api.exportData()
    expect(backup.projects).toHaveLength(1); expect(backup.document_versions).toHaveLength(1); expect(backup.exported_at).toBeTruthy()
    expect(JSON.stringify(backup)).not.toMatch(/https?:\/\/|signed:|token=/)
  })

  it('monthly bills and project monthly charges persist, respect roles and stay unique per month', async () => {
    const a = open(admin), m = open(member)
    const month = today.slice(0, 7)
    const p = await a.api.saveProject({ name: 'ERP', contract_value: 100000, status: 'Active', monthly_enabled: true, monthly_amount: 5000, monthly_due_day: 10, monthly_start: month })
    const bill = await m.api.saveRecurring({ kind: 'bill', name: 'Office rent', amount: 15000, due_day: 5, start_month: month, category: 'Rent' })
    let d = await m.api.load()
    expect(d.recurring).toHaveLength(2)
    const charge = d.recurring.find((r) => r.kind === 'maintenance')
    expect(charge).toMatchObject({ project_id: p.id, start_month: `${month}-01` })
    await m.api.payRecurring(charge.id, month, { date: today, payment_method: 'UPI' })
    await m.api.payRecurring(bill.id, month, { date: today, payment_method: 'UPI' })
    await a.api.refresh() // another user wrote these
    d = await a.api.load()
    expect(F.projectFinancials(d.projects[0], d)).toMatchObject({ received: 0, monthlyFees: 5000, outstanding: 100000 })
    expect(F.recurringOverview(d, today)).toMatchObject({ bills: { pendingCount: 0, doneThisMonth: 15000 }, charges: { pendingCount: 0 } })
    expect(d.expenses[0]).toMatchObject({ title: expect.stringContaining('Office rent'), category: 'Rent', recurring_id: bill.id })
    // the database refuses a second payment for the same month
    await expect(sql(`insert into public.expenses (date, title, category, amount, expense_type, payment_method, recurring_id, recurring_month) values ($1, 'dup', 'Rent', 1, 'company_expense', 'UPI', $2, $3)`, [today, bill.id, `${month}-01`])).rejects.toThrow()
    // renaming the category follows through; a member cannot remove a bill, an admin can and the expense stays
    const cat = d.categories.find((c) => c.name === 'Rent')
    await a.api.saveListItem('categories', 'Office Rent', cat.id)
    expect((await a.api.load()).recurring.find((r) => r.id === bill.id).category).toBe('Office Rent')
    await a.api.saveListItem('categories', 'Rent', cat.id)
    await expect(m.api.deleteRecurring(bill.id)).rejects.toThrow()
    await a.api.deleteRecurring(bill.id)
    d = await a.api.load()
    expect(d.recurring).toHaveLength(1)
    expect(d.expenses).toHaveLength(1); expect(d.expenses[0].recurring_id).toBeNull()
  })
})
