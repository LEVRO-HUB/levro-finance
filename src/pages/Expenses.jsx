import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Receipt as ReceiptIcon, Paperclip } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, Select, TextArea, Checkbox } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { sum } from '../lib/finance'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = ['Rent', 'Subscription', 'Office Setup', 'Utilities', 'Salary', 'Travel', 'Others']
const emptyForm = {
  title: '', amount: '', category: CATEGORIES[0], date: todayISO(), payment_method: '',
  personal: false, paid_by_member_id: '', project_id: '', description: '', receipt: null,
}

export function Expenses() {
  const toast = useToast()
  const { data, loading, error, insert, update, remove } = useSupabaseTable('expenses', { orderBy: 'date', ascending: false })
  const members = useSupabaseTable('members', { orderBy: 'name', ascending: true })
  const projects = useSupabaseTable('projects', { orderBy: 'name', ascending: true })

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
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
      (!search || `${e.title ?? ''} ${e.description ?? ''}`.toLowerCase().includes(search.toLowerCase())),
    ),
    [data, categoryFilter, projectFilter, search],
  )

  const thisMonth = new Date().toISOString().slice(0, 7)
  const totalThisMonth = useMemo(() => sum(data.filter((e) => e.date?.slice(0, 7) === thisMonth)), [data, thisMonth])

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row) {
    setEditing(row)
    setForm({
      title: row.title ?? '', amount: row.amount, category: row.category, date: row.date,
      payment_method: row.payment_method ?? '', personal: !!row.paid_by_member_id,
      paid_by_member_id: row.paid_by_member_id ?? '', project_id: row.project_id ?? '',
      description: row.description ?? '', receipt: null,
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
      const payload = {
        title: form.title, amount: Number(form.amount) || 0, category: form.category, date: form.date,
        payment_method: form.payment_method || null, description: form.description,
        paid_by_member_id: form.personal ? form.paid_by_member_id || null : null,
        status: form.personal ? 'Pending' : 'Paid',
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

      <StatCard label="Total Expenses This Month" value={formatCurrency(totalThisMonth)} icon={ReceiptIcon} />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
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
              <Td>{row.paid_by_member_id ? `${memberName(row.paid_by_member_id)} (Personal)` : 'Company'}</Td>
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
          <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
          <FormField label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
          <FormField label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
          <FormField label="Payment Method"><TextInput value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="UPI, Bank Transfer, Cash…" /></FormField>
          <FormField label="Project (Optional)">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Company (not project-specific)</option>
              {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FormField>
          <Checkbox label="Paid personally (not from company funds)" checked={form.personal} onChange={(e) => setForm({ ...form, personal: e.target.checked, paid_by_member_id: e.target.checked ? members.data[0]?.id ?? '' : '' })} />
          {form.personal && (
            <FormField label="Paid By" hint="Creates a Contribution — tracked under Contributions & Repayments until reimbursed.">
              <Select value={form.paid_by_member_id} onChange={(e) => setForm({ ...form, paid_by_member_id: e.target.value })}>
                {members.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </FormField>
          )}
          <FormField label="Description"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
          <FormField label="Receipt"><input type="file" onChange={(e) => setForm({ ...form, receipt: e.target.files?.[0] ?? null })} className="block w-full text-sm" /></FormField>
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
