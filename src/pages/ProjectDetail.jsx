import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, FileText, Upload, Download } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, TextArea } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { projectFinancials, invoiceStatus } from '../lib/finance'
import { supabase } from '../lib/supabaseClient'

const TABS = ['Overview', 'Expenses', 'Invoices', 'Documents']
const DOC_CATEGORIES = [
  { id: 'master_agreement', label: 'Master Agreement' },
  { id: 'quotation', label: 'Quotation' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'other', label: 'Other' },
]

export function ProjectDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [tab, setTab] = useState('Overview')

  const projects = useSupabaseTable('projects')
  const expenses = useSupabaseTable('expenses')
  const invoices = useSupabaseTable('invoices', { orderBy: 'invoice_date', ascending: false })
  const invoicePayments = useSupabaseTable('invoice_payments')
  const documents = useSupabaseTable('documents')

  const project = projects.data.find((p) => p.id === id)
  const loading = projects.loading || expenses.loading || invoices.loading || invoicePayments.loading || documents.loading

  const f = useMemo(
    () => (project ? projectFinancials(project, { expenses: expenses.data, invoices: invoices.data, invoicePayments: invoicePayments.data }) : null),
    [project, expenses.data, invoices.data, invoicePayments.data],
  )
  const projectDocs = useMemo(() => documents.data.filter((d) => d.project_id === id && d.is_current), [documents.data, id])

  // ---- Invoice modal ----
  const [invModalOpen, setInvModalOpen] = useState(false)
  const [editingInv, setEditingInv] = useState(null)
  const [invForm, setInvForm] = useState({ invoice_number: '', invoice_date: todayISO(), due_date: '', amount: '', tax_amount: '', tds_amount: '', notes: '' })
  const [savingInv, setSavingInv] = useState(false)
  const [deleteInvId, setDeleteInvId] = useState(null)
  const [showTax, setShowTax] = useState(false)

  function openAddInvoice() {
    setEditingInv(null); setShowTax(false)
    setInvForm({ invoice_number: `INV-${String(invoices.data.filter((i) => i.project_id === id).length + 1).padStart(3, '0')}`, invoice_date: todayISO(), due_date: '', amount: '', tax_amount: '', tds_amount: '', notes: '' })
    setInvModalOpen(true)
  }
  function openEditInvoice(inv) {
    setEditingInv(inv); setShowTax(!!(inv.tax_amount || inv.tds_amount))
    setInvForm({ invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, due_date: inv.due_date ?? '', amount: inv.amount, tax_amount: inv.tax_amount ?? '', tds_amount: inv.tds_amount ?? '', notes: inv.notes ?? '' })
    setInvModalOpen(true)
  }
  async function handleInvoiceSubmit(e) {
    e.preventDefault()
    setSavingInv(true)
    try {
      const payload = {
        project_id: id, invoice_number: invForm.invoice_number, invoice_date: invForm.invoice_date,
        due_date: invForm.due_date || null, amount: Number(invForm.amount) || 0,
        tax_amount: invForm.tax_amount === '' ? null : Number(invForm.tax_amount),
        tds_amount: invForm.tds_amount === '' ? null : Number(invForm.tds_amount),
        notes: invForm.notes,
      }
      if (editingInv) await invoices.update(editingInv.id, payload)
      else await invoices.insert(payload)
      setInvModalOpen(false)
      toast.success(editingInv ? 'Invoice updated.' : 'Invoice added.')
    } catch (err) {
      toast.error(`Could not save this invoice: ${describeError(err)}`)
    } finally {
      setSavingInv(false)
    }
  }

  // ---- Payment modal ----
  const [payModal, setPayModal] = useState(null) // invoice row
  const [payForm, setPayForm] = useState({ amount: '', paid_date: todayISO(), method: '' })
  const [savingPay, setSavingPay] = useState(false)

  function openAddPayment(inv) {
    const st = invoiceStatus(inv, invoicePayments.data)
    setPayModal(inv)
    setPayForm({ amount: st.outstanding > 0 ? String(st.outstanding) : '', paid_date: todayISO(), method: '' })
  }
  async function handlePaySubmit(e) {
    e.preventDefault()
    setSavingPay(true)
    try {
      await invoicePayments.insert({ invoice_id: payModal.id, amount: Number(payForm.amount) || 0, paid_date: payForm.paid_date, method: payForm.method })
      setPayModal(null)
      toast.success('Payment recorded.')
    } catch (err) {
      toast.error(`Could not record this payment: ${describeError(err)}`)
    } finally {
      setSavingPay(false)
    }
  }

  // ---- Document upload ----
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [docForm, setDocForm] = useState({ category: 'other', file: null })
  const [savingDoc, setSavingDoc] = useState(false)

  async function handleDocSubmit(e) {
    e.preventDefault()
    if (!docForm.file) return
    setSavingDoc(true)
    try {
      const path = `projects/${id}/${Date.now()}-${docForm.file.name}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, docForm.file)
      if (upErr) throw upErr
      await documents.insert({ project_id: id, category: docForm.category, file_name: docForm.file.name, storage_path: path, file_size: docForm.file.size })
      setDocModalOpen(false)
      setDocForm({ category: 'other', file: null })
      toast.success('Document uploaded.')
    } catch (err) {
      toast.error(`Could not upload this document: ${describeError(err)}`)
    } finally {
      setSavingDoc(false)
    }
  }
  async function downloadDoc(doc) {
    const { data, error: err } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (err) { toast.error(`Could not open this file: ${describeError(err)}`); return }
    window.open(data.signedUrl, '_blank')
  }

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
  if (!project) return <EmptyState title="Project not found" description="It may have been deleted." />

  return (
    <div className="space-y-5">
      <div>
        <Link to="/projects" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"><ArrowLeft size={13} /> Projects</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-sm text-slate-500">{project.client_name && `Client: ${project.client_name}`} {project.project_number && `· Project No: ${project.project_number}`}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ['Contract Value', f.contractValue, 'what the client agreed to pay'],
          ['Invoiced', f.invoiced, 'billed so far, excl. tax'],
          ['Received', f.received, 'cash actually in hand'],
          ['Outstanding', f.outstanding, 'still owed by client'],
          ['Project Profit', f.profit, 'received − costs'],
        ].map(([label, value, sub]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{formatCurrency(value)}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Project Details</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Start Date</dt><dd>{formatDate(project.start_date) || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Expected Completion</dt><dd>{formatDate(project.expected_completion) || '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Payment Terms</dt><dd className="text-right">{project.payment_terms || '—'}</dd></div>
            </dl>
            {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Recent Expenses</h2>
            {f.projectExpenses.length === 0 ? <EmptyState title="No expenses yet" /> : (
              <div className="space-y-1.5">
                {f.projectExpenses.slice(0, 6).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-700">{e.title || e.description || e.category}</span>
                    <span className="tabular-nums text-slate-900">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'Expenses' && (
        f.projectExpenses.length === 0 ? <EmptyState title="No expenses linked to this project" description="Add an expense and set this project from the Expenses page." /> : (
          <Table columns={['Date', 'Title', 'Category', 'Amount', 'Paid By']}>
            {f.projectExpenses.map((e) => (
              <tr key={e.id}>
                <Td>{formatDate(e.date)}</Td>
                <Td>{e.title || e.description || '—'}</Td>
                <Td>{e.category}</Td>
                <Td className="tabular-nums">{formatCurrency(e.amount)}</Td>
                <Td>{e.paid_by_member_id ? 'Personal' : 'Company'}</Td>
              </tr>
            ))}
          </Table>
        )
      )}

      {tab === 'Invoices' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button onClick={openAddInvoice}><Plus size={16} /> Add Invoice</Button></div>
          {f.projectInvoices.length === 0 ? <EmptyState title="No invoices yet" /> : (
            <Table columns={['Invoice #', 'Amount', 'Invoice Date', 'Due Date', 'Status', 'Received', 'Actions']}>
              {f.projectInvoices.map((inv) => {
                const st = invoiceStatus(inv, invoicePayments.data)
                return (
                  <tr key={inv.id}>
                    <Td>{inv.invoice_number}</Td>
                    <Td className="tabular-nums">{formatCurrency(inv.amount)}</Td>
                    <Td>{formatDate(inv.invoice_date)}</Td>
                    <Td>{formatDate(inv.due_date) || '—'}</Td>
                    <Td><StatusBadge status={st.status} /></Td>
                    <Td className="tabular-nums">{formatCurrency(st.settled)}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openAddPayment(inv)} className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Record Payment</button>
                        <button onClick={() => openEditInvoice(inv)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteInvId(inv.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </Table>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        <div className="space-y-3">
          <div className="flex justify-end"><Button onClick={() => setDocModalOpen(true)}><Upload size={16} /> Add Document</Button></div>
          {projectDocs.length === 0 ? <EmptyState icon={FileText} title="No documents yet" description="Upload the master agreement, quotation, or other project files." /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {projectDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{d.file_name}</p>
                    <p className="text-xs text-slate-400">{DOC_CATEGORIES.find((c) => c.id === d.category)?.label ?? d.category} · v{d.version} · {formatDate(d.uploaded_at?.slice(0, 10))}</p>
                  </div>
                  <button onClick={() => downloadDoc(d)} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Download size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice modal */}
      <Modal open={invModalOpen} onClose={() => setInvModalOpen(false)} title={editingInv ? 'Edit Invoice' : 'Add Invoice'}>
        <form onSubmit={handleInvoiceSubmit}>
          <FormField label="Invoice Number"><TextInput required value={invForm.invoice_number} onChange={(e) => setInvForm({ ...invForm, invoice_number: e.target.value })} /></FormField>
          <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={invForm.amount} onChange={(e) => setInvForm({ ...invForm, amount: e.target.value })} /></FormField>
          <FormField label="Invoice Date"><TextInput type="date" required value={invForm.invoice_date} onChange={(e) => setInvForm({ ...invForm, invoice_date: e.target.value })} /></FormField>
          <FormField label="Due Date"><TextInput type="date" value={invForm.due_date} onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })} /></FormField>
          {!showTax ? (
            <button type="button" onClick={() => setShowTax(true)} className="mb-3.5 text-xs font-medium text-blue-600 hover:underline">+ Add tax details (GST / TDS)</button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tax Amount (optional)"><TextInput type="number" min="0" step="0.01" value={invForm.tax_amount} onChange={(e) => setInvForm({ ...invForm, tax_amount: e.target.value })} /></FormField>
              <FormField label="TDS Amount (optional)"><TextInput type="number" min="0" step="0.01" value={invForm.tds_amount} onChange={(e) => setInvForm({ ...invForm, tds_amount: e.target.value })} /></FormField>
            </div>
          )}
          <FormField label="Notes"><TextArea value={invForm.notes} onChange={(e) => setInvForm({ ...invForm, notes: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInvModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingInv}>{savingInv ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      </Modal>

      {/* Payment modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record Payment — ${payModal?.invoice_number ?? ''}`}>
        <form onSubmit={handlePaySubmit}>
          <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></FormField>
          <FormField label="Date"><TextInput type="date" required value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} /></FormField>
          <FormField label="Method"><TextInput value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} placeholder="UPI, Bank Transfer…" /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPayModal(null)}>Cancel</Button>
            <Button type="submit" disabled={savingPay}>{savingPay ? 'Saving…' : 'Record Payment'}</Button>
          </div>
        </form>
      </Modal>

      {/* Document modal */}
      <Modal open={docModalOpen} onClose={() => setDocModalOpen(false)} title="Add Document">
        <form onSubmit={handleDocSubmit}>
          <FormField label="Type">
            <select className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm" value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}>
              {DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="File">
            <input type="file" required onChange={(e) => setDocForm({ ...docForm, file: e.target.files?.[0] ?? null })} className="block w-full text-sm" />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDocModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingDoc}>{savingDoc ? 'Uploading…' : 'Upload'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteInvId} onClose={() => setDeleteInvId(null)} onConfirm={() => invoices.remove(deleteInvId)} description="This invoice and its payments will be removed." />
    </div>
  )
}
