import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Pencil, Trash2, Briefcase } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { FormField, TextInput, Select, TextArea } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatCurrency, todayISO } from '../lib/format'
import { projectFinancials } from '../lib/finance'

const STATUSES = ['Active', 'Completed', 'On Hold', 'Cancelled']
const emptyForm = {
  name: '', client_name: '', project_number: '', contract_value: '', start_date: todayISO(),
  expected_completion: '', payment_terms: '', status: 'Active', description: '', notes: '',
}

export function Projects() {
  const toast = useToast()
  const { data, loading, error, insert, update, remove } = useSupabaseTable('projects', { orderBy: 'created_at', ascending: false })
  const expenses = useSupabaseTable('expenses')
  const invoices = useSupabaseTable('invoices')
  const invoicePayments = useSupabaseTable('invoice_payments')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortBy, setSortBy] = useState('recent')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)

  const pageLoading = loading || expenses.loading || invoices.loading || invoicePayments.loading

  const rows = useMemo(() => {
    let r = data.filter(
      (p) => (statusFilter === 'All' || p.status === statusFilter) && p.name.toLowerCase().includes(search.toLowerCase()),
    )
    if (sortBy === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'value') r = [...r].sort((a, b) => (Number(b.contract_value) || 0) - (Number(a.contract_value) || 0))
    return r.map((p) => ({ ...p, f: projectFinancials(p, { expenses: expenses.data, invoices: invoices.data, invoicePayments: invoicePayments.data }) }))
  }, [data, search, statusFilter, sortBy, expenses.data, invoices.data, invoicePayments.data])

  function openAdd() { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name, client_name: row.client_name ?? '', project_number: row.project_number ?? '',
      contract_value: row.contract_value, start_date: row.start_date ?? '', expected_completion: row.expected_completion ?? '',
      payment_terms: row.payment_terms ?? '', status: row.status, description: row.description ?? '', notes: row.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, contract_value: Number(form.contract_value) || 0, start_date: form.start_date || null, expected_completion: form.expected_completion || null }
      if (editing) await update(editing.id, payload)
      else await insert(payload)
      setModalOpen(false)
      toast.success(editing ? 'Project updated.' : 'Project added.')
    } catch (err) {
      toast.error(`Could not save this project: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Manage your projects and track their financials</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> New Project</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="All">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-40">
          <option value="recent">Sort: Recent</option>
          <option value="name">Sort: Name</option>
          <option value="value">Sort: Contract value</option>
        </Select>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load projects: {describeError(error)}</p>}

      {pageLoading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects yet" description="Create your first project to start tracking its finances." />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const pct = p.f.contractValue > 0 ? Math.min((p.f.received / p.f.contractValue) * 100, 100) : 0
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Briefcase size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {p.client_name && `Client: ${p.client_name}`}{p.client_name && p.project_number && ' · '}{p.project_number && `Project No: ${p.project_number}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <Link to={`/projects/${p.id}`}><Button variant="secondary" className="text-xs">View Project</Button></Link>
                    <button onClick={() => openEdit(p)} aria-label="Edit" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteId(p.id)} aria-label="Delete" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-sm">
                  <div><p className="text-xs text-slate-400">Contract Value</p><p className="font-medium tabular-nums text-slate-900">{formatCurrency(p.f.contractValue)}</p></div>
                  <div><p className="text-xs text-slate-400">Received</p><p className="font-medium tabular-nums text-emerald-600">{formatCurrency(p.f.received)}</p></div>
                  <div><p className="text-xs text-slate-400">Outstanding</p><p className="font-medium tabular-nums text-amber-600">{formatCurrency(p.f.outstanding)}</p></div>
                </div>

                <div className="mt-3">
                  <div className="h-1.5 w-full rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.max(pct, pct > 0 ? 4 : 0)}%` }} /></div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Project' : 'Add Project'} wide>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <FormField label="Project Name"><TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
            <FormField label="Client"><TextInput value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></FormField>
            <FormField label="Project Number"><TextInput value={form.project_number} onChange={(e) => setForm({ ...form, project_number: e.target.value })} /></FormField>
            <FormField label="Contract Value"><TextInput type="number" min="0" step="0.01" required value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} /></FormField>
            <FormField label="Start Date"><TextInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></FormField>
            <FormField label="Expected Completion"><TextInput type="date" value={form.expected_completion} onChange={(e) => setForm({ ...form, expected_completion: e.target.value })} /></FormField>
            <FormField label="Payment Terms"><TextInput value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="e.g. 50% advance, 50% on completion" /></FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
            </FormField>
          </div>
          <FormField label="Description"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
          <FormField label="Notes"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Project'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => remove(deleteId)} description="This project will be permanently removed, along with its invoices and documents." />
    </div>
  )
}
