import { useState } from 'react'
import { Plus, Pencil, UserX, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, Select, TextArea } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatDate, todayISO } from '../lib/format'

const DESIGNATIONS = ['Founder', 'Project Manager', 'Developer', 'Designer', 'Accountant', 'Intern', 'Other']
const emptyForm = { name: '', designation: DESIGNATIONS[0], email: '', phone: '', joining_date: todayISO(), notes: '' }

export function Members() {
  const toast = useToast()
  const { data, loading, error, insert, update } = useSupabaseTable('members', { orderBy: 'name', ascending: true })

  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)

  const rows = data.filter((m) => showInactive || m.is_active)

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row) {
    setEditing(row)
    setForm({ name: row.name, designation: row.designation ?? DESIGNATIONS[0], email: row.email ?? '', phone: row.phone ?? '', joining_date: row.joining_date ?? '', notes: row.notes ?? '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, joining_date: form.joining_date || null }
      if (editing) await update(editing.id, payload)
      else await insert({ ...payload, is_active: true })
      setModalOpen(false)
      toast.success(editing ? 'Member updated.' : 'Member added.')
    } catch (err) {
      toast.error(`Could not save this member: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Members</h1>
          <p className="text-sm text-slate-500">Manage your team members and their details</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> Add Member</Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-500">
        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show inactive members
      </label>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load members: {describeError(error)}</p>}

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div> : rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No members yet" />
      ) : (
        <Table columns={['Name', 'Designation', 'Email', 'Phone', 'Joining Date', 'Status', 'Actions']}>
          {rows.map((m) => (
            <tr key={m.id}>
              <Td className={!m.is_active ? 'text-slate-400' : 'font-medium text-slate-900'}>{m.name}</Td>
              <Td>{m.designation || '—'}</Td>
              <Td>{m.email || '—'}</Td>
              <Td>{m.phone || '—'}</Td>
              <Td>{formatDate(m.joining_date) || '—'}</Td>
              <Td><StatusBadge status={m.is_active ? 'Active' : 'Cancelled'} /></Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(m)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>
                  {m.is_active ? (
                    <button onClick={() => setDeactivateTarget(m)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" title="Deactivate"><UserX size={13} /></button>
                  ) : (
                    <button onClick={() => update(m.id, { is_active: true })} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" title="Reactivate"><UserCheck size={13} /></button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Member' : 'Add Member'}>
        <form onSubmit={handleSubmit}>
          <FormField label="Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
          <FormField label="Designation"><Select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>{DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></FormField>
          <FormField label="Email"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
          <FormField label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></FormField>
          <FormField label="Joining Date"><TextInput type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></FormField>
          <FormField label="Notes"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} onConfirm={() => update(deactivateTarget.id, { is_active: false })} title="Deactivate member?" description="They'll be hidden from active lists but their financial history stays intact." />
    </div>
  )
}
