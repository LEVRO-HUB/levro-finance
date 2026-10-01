import { useMemo, useState } from 'react'
import { Plus, Wallet, Pencil, Trash2, Upload, Paperclip } from 'lucide-react'
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

const CATEGORIES = ['Vendor Payment', 'Hosting', 'Office', 'Equipment', 'Software', 'Travel', 'Others']
const emptyForm = { recipient: '', amount: '', category: CATEGORIES[0], date: todayISO(), payment_method: '', project_id: '', description: '', attachment: null }

// Pay Out = company-paid expenses to an external recipient (vendor/payee),
// shown and filtered separately from internal team member contributions.
export function PayOut() {
  const toast = useToast()
  const { data, loading, error, insert, update, remove } = useSupabaseTable('expenses', { orderBy: 'date', ascending: false })
  const projects = useSupabaseTable('projects', { orderBy: 'name', ascending: true })

  const payouts = useMemo(() => data.filter((e) => !e.paid_by_member_id && e.recipient), [data])
  const projectName = (id) => projects.data.find((p) => p.id === id)?.name ?? '—'

  const thisMonth = new Date().toISOString().slice(0, 7)
  const totalThisMonth = useMemo(() => sum(payouts.filter((e) => e.date?.slice(0, 7) === thisMonth)), [payouts, thisMonth])

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row) {
    setEditing(row)
    setForm({ recipient: row.recipient ?? '', amount: row.amount, category: row.category, date: row.date, payment_method: row.payment_method ?? '', project_id: row.project_id ?? '', description: row.description ?? '', attachment: null })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let receipt_path = editing?.receipt_path ?? null
      if (form.attachment) {
        const path = `payouts/${Date.now()}-${form.attachment.name}`
        const { error: upErr } = await supabase.storage.from('documents').upload(path, form.attachment)
        if (upErr) throw upErr
        receipt_path = path
      }
      const payload = {
        recipient: form.recipient, amount: Number(form.amount) || 0, category: form.category, date: form.date,
        payment_method: form.payment_method || null, description: form.description, status: 'Paid',
        expense_type: form.project_id ? 'project_expense' : 'company_expense', project_id: form.project_id || null,
        receipt_path,
      }
      if (editing) await update(editing.id, payload)
      else await insert(payload)
      setModalOpen(false)
      toast.success(editing ? 'Pay out updated.' : 'Pay out recorded.')
    } catch (err) {
      toast.error(`Could not save this pay out: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Company Pay Out</h1>
          <p className="text-sm text-slate-500">Manage regular company payments</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> New Pay Out</Button>
      </div>

      <StatCard label="Total Paid This Month" value={formatCurrency(totalThisMonth)} icon={Wallet} />

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load pay outs: {describeError(error)}</p>}

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div> : payouts.length === 0 ? (
        <EmptyState icon={Wallet} title="No pay outs recorded yet" />
      ) : (
        <Table columns={['Date', 'Recipient', 'Category', 'Amount', 'Project', 'Actions']}>
          {payouts.map((row) => (
            <tr key={row.id}>
              <Td>{formatDate(row.date)}</Td>
              <Td className="font-medium text-slate-900"><div className="flex items-center gap-1.5">{row.recipient}{row.receipt_path && <Paperclip size={12} className="text-slate-400" />}</div></Td>
              <Td>{row.category}</Td>
              <Td className="tabular-nums">{formatCurrency(row.amount)}</Td>
              <Td>{row.project_id ? projectName(row.project_id) : '—'}</Td>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pay Out' : 'Add Pay Out'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Recipient"><TextInput required value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} /></FormField>
          <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
          <FormField label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select></FormField>
          <FormField label="Date"><TextInput type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></FormField>
          <FormField label="Payment Method"><TextInput value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></FormField>
          <FormField label="Project (Optional)">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Company (not project-specific)</option>
              {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Description"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
          <FormField label="Attachment">
            <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200 text-center text-xs text-slate-400 hover:border-blue-300 hover:bg-blue-50/30">
              <Upload size={16} />
              <span>{form.attachment ? form.attachment.name : 'Click to upload or drag and drop'}</span>
              <span>PDF, JPG, PNG (Max 5MB)</span>
              <input type="file" className="hidden" onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] ?? null })} />
            </label>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Pay Out'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => remove(deleteId)} description="This pay out will be permanently removed." />
    </div>
  )
}
