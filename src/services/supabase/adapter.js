// Remote persistence behind the SAME service API the UI already uses.
//
//   UI → service operations (src/services/api.js: validation + business rules)
//      → this adapter: works out exactly which rows an operation changed and
//        writes only those rows
//      → gateway (supabase-js in the app, node-postgres in tests)
//      → Postgres (constraints, triggers, RLS) / Storage
//
// The service validates against the cached snapshot for fast, friendly errors;
// the database re-checks every rule, so a stale snapshot or two people saving
// at once can never break a balance.
import { emptyState, SCHEMA_VERSION } from '../schema'
import { toAppError, ValidationError } from '../errors'
import { PAGE_SIZE, TABLES } from './tables'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const same = (a, b) => (a ?? null) === (b ?? null) || (a && b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b)) || (typeof a === 'number' && Number(a) === Number(b)) || (a === '' && b == null) || (b === '' && a == null)
const byId = (rows) => new Map(rows.map((r) => [r.id, r]))

// app field → column value
function toColumn(def, col, row) {
  if (def.c === 'document_versions' && col === 'storage_path') return row.storage_key
  if (def.c === 'activity_logs' && col === 'entity_id') return UUID.test(String(row.entity_id ?? '')) ? row.entity_id : null
  const v = row[col]
  return v === undefined || v === '' && /(_date|_id|_month)$|^date$|^category$/.test(col) ? null : v
}
const toRecord = (def, row) => Object.fromEntries(def.cols.map((c) => [c, toColumn(def, c, row)]))

export function createRemoteAdapter(gateway) {
  const raw = {} // table → rows as stored
  let rawSettings = null
  let rawProfile = null
  const dirty = new Set([...TABLES.map((d) => d.t), 'app_settings', 'profile'])
  const baselines = new WeakMap()
  let loading = null

  // Reads a whole table page by page, so nothing is silently cut off at the
  // API's per-request row limit however large the history grows.
  async function selectAll(table, { orderBy, ascending, max }) {
    const rows = []
    for (let from = 0; rows.length < max; from += PAGE_SIZE) {
      const to = Math.min(from + PAGE_SIZE, max) - 1
      const page = await gateway.selectPage(table, { orderBy, ascending, from, to })
      rows.push(...page)
      if (page.length < to - from + 1) break
    }
    return rows
  }

  async function fetchDirty() {
    const todo = [...dirty]
    dirty.clear()
    try {
      await Promise.all(todo.map(async (t) => {
        if (t === 'app_settings') rawSettings = (await gateway.selectPage('app_settings', { orderBy: ['id'], ascending: true, from: 0, to: 0 }))[0] ?? {}
        else if (t === 'profile') rawProfile = await gateway.getProfile()
        else {
          const def = TABLES.find((d) => d.t === t)
          raw[t] = await selectAll(t, def.latest
            ? { orderBy: [def.order, 'id'], ascending: false, max: def.latest }
            : { orderBy: [def.order ?? 'created_at', 'id'], ascending: true, max: Infinity })
        }
      }))
    } catch (err) {
      for (const t of todo) dirty.add(t)
      throw toAppError(err)
    }
  }

  // Stored rows → the shape the app has always worked with. Values that are
  // not stored (because they can be derived) are filled in here.
  function assemble() {
    const state = emptyState()
    for (const def of TABLES) state[def.c] = (raw[def.t] ?? []).map((r) => ({ ...r }))
    const projects = byId(state.projects)
    const expenses = byId(state.expenses)
    const docByInvoice = new Map(state.documents.filter((d) => d.invoice_id).map((d) => [d.invoice_id, d.id]))
    const docByExpense = new Map(state.documents.filter((d) => d.expense_id).map((d) => [d.expense_id, d.id]))
    for (const i of state.invoices) { i.client_name = projects.get(i.project_id)?.client_name ?? ''; i.attachment_document_id = docByInvoice.get(i.id) ?? null }
    for (const e of state.expenses) e.receipt_document_id = docByExpense.get(e.id) ?? null
    for (const r of state.reimbursements) r.member_id = expenses.get(r.expense_id)?.paid_by_member_id ?? null
    for (const v of state.document_versions) v.storage_key = v.storage_path
    for (const l of state.activity_logs) l.actor = l.actor_name
    state.settings = {
      company_name: rawSettings?.company_name ?? 'Levrotec',
      opening_reserve: Number(rawSettings?.opening_reserve ?? 0),
      reserve_as_of: rawSettings?.reserve_as_of ?? '',
      invoice_profile: rawSettings?.invoice_profile ?? {},
      user_name: rawProfile?.full_name || (rawProfile?.email ?? '').split('@')[0] || '',
    }
    state.meta = { version: SCHEMA_VERSION, counters: {}, backend: 'supabase' }
    return state
  }

  async function load() {
    if (dirty.size) {
      loading ??= fetchDirty().finally(() => { loading = null })
      await loading
      if (dirty.size) await fetchDirty()
    }
    const state = assemble()
    baselines.set(state, JSON.stringify(state))
    return state
  }

  async function save(state) {
    const before = baselines.get(state)
    if (!before) throw new Error('save() must be given the state returned by load().')
    const base = JSON.parse(before)
    const touched = new Set()
    const run = async (table, fn) => { touched.add(table); await fn() }

    try {
      // Renaming a category / payment method cascades in the database, so the
      // matching edits the service made on other rows must not be re-sent.
      const renames = { category: new Map(), payment_method: new Map() }
      for (const [c, field] of [['categories', 'category'], ['payment_methods', 'payment_method']]) {
        const old = byId(base[c])
        for (const r of state[c]) if (old.has(r.id) && old.get(r.id).name !== r.name) renames[field].set(old.get(r.id).name, r.name)
      }
      const cascades = renames.category.size || renames.payment_method.size
      const changedCols = (def, was, now) => def.cols.filter((col) => {
        const a = toColumn(def, col, was), b = toColumn(def, col, now)
        if (same(a, b)) return false
        if (def.c !== 'categories' && def.c !== 'payment_methods' && renames[col]?.get(a) === b) return false
        return true
      })

      const deletes = []
      for (const def of TABLES) {
        const old = byId(base[def.c]), cur = byId(state[def.c])
        const inserts = state[def.c].filter((r) => !old.has(r.id))
        for (const r of state[def.c]) {
          if (!old.has(r.id) || def.immutable || def.appendOnly) continue
          const cols = changedCols(def, old.get(r.id), r)
          if (cols.length) await run(def.t, () => gateway.update(def.t, r.id, Object.fromEntries(cols.map((c) => [c, toColumn(def, c, r)]))))
        }
        if (inserts.length) {
          const rows = inserts.map((r) => toRecord(def, r))
          if (def.appendOnly) {
            // the audit trail must never block the financial write it describes
            try { await run(def.t, () => gateway.insert(def.t, rows)) } catch (err) { console.warn('Activity log not written:', err?.message ?? err) }
          } else await run(def.t, () => gateway.insert(def.t, rows)) // one statement per table → all rows or none
        }
        if (!def.appendOnly) for (const r of base[def.c]) if (!cur.has(r.id)) deletes.push([def, r])
      }
      // children before parents
      for (const [def, r] of deletes.reverse()) {
        await run(def.t, () => gateway.remove(def.t, r.id))
        // the database unlinks that bill's / charge's payments
        if (def.t === 'recurring_items') { touched.add('income'); touched.add('expenses') }
      }

      const s0 = base.settings, s1 = state.settings
      const patch = {}
      if (!same(s0.company_name, s1.company_name)) patch.company_name = s1.company_name
      if (!same(s0.opening_reserve, s1.opening_reserve)) patch.opening_reserve = s1.opening_reserve
      if (!same(s0.reserve_as_of, s1.reserve_as_of)) patch.reserve_as_of = s1.reserve_as_of || null
      if (JSON.stringify(s0.invoice_profile ?? {}) !== JSON.stringify(s1.invoice_profile ?? {})) patch.invoice_profile = s1.invoice_profile ?? {}
      if (Object.keys(patch).length) await run('app_settings', () => gateway.update('app_settings', true, patch))
      if (!same(s0.user_name, s1.user_name)) await run('profile', () => gateway.updateOwnName(s1.user_name ?? ''))

      if (cascades) for (const t of ['expenses', 'income', 'reimbursements', 'member_advances', 'recurring_items']) touched.add(t)
      for (const t of touched) dirty.add(t)
    } catch (err) {
      // something was refused part-way: re-read everything so the screen shows the truth
      for (const d of TABLES) dirty.add(d.t)
      dirty.add('app_settings'); dirty.add('profile')
      throw toAppError(err)
    }
  }

  const wrap = (fn) => async (...args) => { try { return await fn(...args) } catch (err) { throw toAppError(err) } }

  return {
    load,
    save,
    // A table changed elsewhere (live update): re-read just that table next load.
    invalidate(table) {
      if (table === 'profiles') dirty.add('profile')
      if (table === 'app_settings' || TABLES.some((d) => d.t === table)) dirty.add(table)
    },
    subscribe: (onChange) => gateway.subscribe?.(onChange) ?? (() => {}),
    refresh() { for (const d of TABLES) dirty.add(d.t); dirty.add('app_settings'); dirty.add('profile') },
    files: {
      put: wrap((path, blob, contentType) => gateway.uploadFile(path, blob, contentType)),
      get: wrap((path) => gateway.downloadFile(path)),
      remove: wrap((path) => gateway.removeFile(path)),
      signedUrl: wrap((path, opts) => gateway.signedUrl(path, opts)),
      clear: async () => { throw new ValidationError('Bulk file deletion is not available on the shared database.') },
    },
  }
}
