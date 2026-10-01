import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Receipt as ReceiptIcon, Paperclip, Upload } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, Select, TextArea } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { sum } from '../lib/finance'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = ['Rent', 'Subscription', 'Office Setup', 'Utilities', 'Salary', 'Travel', 'Others']
const CATEGORY_COLORS = { Rent: '#3b82f6', Subscription: '#10b981', 'Office Setup': '#f59e0b', Utilities: '#ef4444', Salary: '#8b5cf6', Travel: '#06b6d4', Others: '#94a3b8' }
const PAID_BY_COMPANY = '__company__'
const emptyForm = {
  title: '', amount: '', category: CATEGORIES[0], date: todayISO(), payment_method: '',
  paid_by: PAID_BY_COMPANY, project_id: '', description: '', receipt: null,
}

function DonutChart({ segments }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  let acc = 0
  const r = 15.9155
  return (
    <svg viewBox="0 0 36 36" className="h-32 w-32 flex-shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
      {segments.map((s) => {
        const pct = (s.value / total) * 100
        const dash = `${pct} ${100 - pct}`
        const offset = -acc
        acc += pct
        return <circle key={s.label} cx="18" cy="18" r={r} fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={dash} strokeDashoffset={offset} pathLength="100" />
      })}
    </svg>
  )
}

export function Expenses() {
  const toast = useToast()
  const { data, loading, error, insert, update, remove } = useSupabaseTable('expenses', { orderBy: 'date', ascending: false })
  const members = useSupabaseTable('members', { orderBy: 'name', ascending: true })
  const projects = useSupabaseTable('projects', { orderBy: 'name', ascending: true })

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const pageLoading = loading || members.loading || projects.loading
  const memberName = (id) => members.data.find((m) => m.id === id)?.name ?? '—'
  const projectName = (id) => projects.data.find((p) => p.id === id)?.name ?? '—'

  const filtered = useMemo(
    () => data.filter((e) =>
      (categoryFilter === 'All' || e.category === categoryFilter) &&
      (projectFilter === 'All' || e.project_id === projectFilter) &&
      (!dateFrom || e.date >= dateFrom) && (!dateTo || e.date <= dateTo) &&
      (!search || `${e.title ?? ''} ${e.description ?? ''}`.toLowerCase().includes(search.toLowerCase())),
    ),
    [data, categoryFilter, projectFilter, dateFrom, dateTo, search],
  )

  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthExpenses = useMemo(() => data.filter((e) => e.date?.slice(0, 7) === thisMonth), [data, thisMonth])
  const totalThisMonth = sum(monthExpenses)

  const categoryBreakdown = useMemo(() => {
    const totals = new Map()
    for (const e of monthExpenses) totals.set(e.category, (totals.get(e.category) || 0) + (Number(e.amount) || 0))
    return CATEGORIES.map((c) => ({ label: c, value: totals.get(c) || 0, color: CATEGORY_COLORS[c] })).filter((c) => c.value > 0)
  }, [monthExpenses])

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row) {
    setEditing(row)
    setForm({
      title: row.title ?? '', amount: row.amount, category: row.category, date: row.date,
      payment_method: row.payment_method ?? '', paid_by: row.paid_by_member_id ?? PAID_BY_COMPANY,
      project_id: row.project_id ?? '', description: row.description ?? '', receipt: null,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let receipt_path = editing?.receipt_path ?? null
      if (form.receipt) {
        const path = `receipts/${Date.now()}-${form.receipt.name}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, form.receipt)
        if (upErr) throw upErr
        receipt_path = path
      }
      const personal = form.paid_by !== PAID_BY_COMPANY
      const payload = {
        title: form.title, amount: Number(form.amount) || 0, category: form.category, date: form.date,
        payment_method: form.payment_method || null, description: form.description,
        paid_by_member_id: personal ? form.paid_by : null,
        status: personal ? 'Pending' : 'Paid',
        expense_type: form.project_id ? 'project_expense' : 'company_expense',
        project_id: form.project_id || null,
        receipt_path,
      }
      if (editing) await update(editing.id, payload)
      else await insert(payload)
      setModalOpen(false)
      toast.success(editing ? 'Expense updated.' : 'Expense added.')
    } catch (err) {
      toast.error(`Could not save this expense: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function viewReceipt(path) {
    const { data: signed, error: err } = await supabase.storage.from('documents').createSignedUrl(path, 60)
    if (err) { toast.error(`Could not open receipt: ${describeError(err)}`); return }
    window.open(signed.signedUrl, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500">Track and manage your company expenses</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add Expense</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <StatCard label="Total Expenses This Month" value={formatCurrency(totalThisMonth)} icon={ReceiptIcon} />
        {categoryBreakdown.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
            <DonutChart segments={categoryBreakdown} />
            <div className="space-y-1 text-xs">
              {categoryBreakdown.map((c) => (
                <div key={c.label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="text-slate-600">{c.label}</span><span className="text-slate-400">{((c.value / sum(categoryBreakdown.map((x) => ({ amount: x.value })))) * 100).toFixed(0)}%</span></div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-40">
          <option value="All">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-44">
          <option value="All">All projects</option>
          {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" title="From" />
        <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" title="To" />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load expenses: {describeError(error)}</p>}

      {pageLoading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div> : filtered.length === 0 ? (
        <EmptyState icon={ReceiptIcon} title="No expenses match these filters" />
      ) : (
        <Table columns={['Date', 'Title', 'Category', 'Amount', 'Project', 'Paid By', 'Actions']}>
          {filtered.map((row) => (
            <tr key={row.id}>
              <Td>{formatDate(row.date)}</Td>
              <Td><div className="flex items-center gap-1.5">{row.title || row.description || '—'}{row.receipt_path && <button onClick={() => viewReceipt(row.receipt_path)} title="View receipt"><Paperclip size={13} className="text-slate-400 hover:text-blue-600" /></button>}</div></Td>
              <Td>{row.category}</Td>
              <Td className="tabular-nums">{formatCurrency(row.amount)}</Td>
              <Td>{row.project_id ? projectName(row.project_id) : '—'}</Td>
              <Td>{row.paid_by_member_id ? memberName(row.paid_by_member_id) : 'Company'}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(row)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>
                  <button onClick={() => setDeleteId(row.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Expense' : 'Add Expense'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Title"><TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
            <FormField label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
            <FormField label="Payment Method"><TextInput value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="UPI, Bank…" /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Paid By" hint={form.paid_by !== PAID_BY_COMPANY ? 'Tracked as a Contribution until reimbursed.' : undefined}>
              <Select value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })}>
                <option value={PAID_BY_COMPANY}>Company</option>
                {members.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Project (Optional)">
              <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                <option value="">Company</option>
                {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label="Description"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
          <FormField label="Receipt / Bill">
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-center text-xs text-slate-400 hover:border-blue-300 hover:bg-blue-50/30">
              <Upload size={16} />
              <span>{form.receipt ? form.receipt.name : 'Click to upload or drag and drop'}</span>
              <span>PDF, JPG, PNG (Max 5MB)</span>
              <input type="file" className="hidden" onChange={(e) => setForm({ ...form, receipt: e.target.files?.[0] ?? null })} />
            </label>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => remove(deleteId)} description="This expense will be permanently removed." />
    </div>
  )
}
