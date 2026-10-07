import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, ProjectField } from './common'
import { InvoicePreviewModal } from '../invoice/InvoicePreviewModal'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { TAX_LINES, companyProfile, invoiceBreakdown, nextInvoiceNumber, rupeesInWords } from '../../lib/company'
import { formatCurrency, todayISO } from '../../lib/format'

const blankItem = () => ({ title: '', description: '', qty: '1', rate: '' })
const PAY = [['account_name', 'Account name'], ['bank', 'Bank'], ['account_no', 'Account number'], ['ifsc', 'IFSC'], ['upi', 'UPI ID']]

function Body({ invoice, lockProjectId, onClose, onSaved }) {
  const { api, data, projectById } = useData()
  const d = invoice?.details
  const company = companyProfile(data.settings)
  const newest = [...data.invoices].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))
  // payment details come from Settings; failing that, from the most recent invoice that had them
  const configured = Object.fromEntries(PAY.map(([k]) => [k, company[k]]))
  const lastPay = Object.values(configured).some(Boolean) ? configured : newest.find((i) => Object.values(i.details?.pay ?? {}).some(Boolean))?.details.pay ?? {}
  // a project has only a client name, so the rest of the client block is carried over from that project's last invoice
  const clientOf = (projectId) => {
    const p = projectById.get(projectId)
    const last = newest.find((i) => i.project_id === projectId && i.details)?.details
    return { bill_to_name: last?.bill_to_name || p?.client_name || p?.name || '', bill_to_line: last?.bill_to_line ?? '', bill_to_address: last?.bill_to_address ?? '', bill_to_email: last?.bill_to_email ?? '', bill_to_gstin: last?.bill_to_gstin ?? '' }
  }
  const startProject = invoice?.project_id ?? lockProjectId ?? ''
  const start = clientOf(startProject)
  const startClient = start.bill_to_name
  const f = useForm({
    project_id: startProject,
    bill_to_name: d?.bill_to_name ?? start.bill_to_name, bill_to_line: d?.bill_to_line ?? start.bill_to_line,
    bill_to_address: d?.bill_to_address ?? start.bill_to_address, bill_to_email: d?.bill_to_email ?? start.bill_to_email, bill_to_gstin: d?.bill_to_gstin ?? start.bill_to_gstin,
    discount: d?.discount ? String(d.discount) : '', other_label: d?.tax?.other_label ?? '',
    ...Object.fromEntries(TAX_LINES.map(([k]) => [`${k}_rate`, d?.tax?.[`${k}_rate`] ? String(d.tax[`${k}_rate`]) : ''])),
    invoice_number: invoice?.invoice_number ?? (startProject ? nextInvoiceNumber(data.invoices, startClient, todayISO()) : ''),
    invoice_date: invoice?.invoice_date ?? todayISO(), due_date: invoice?.due_date ?? '',
    billing_period: d?.billing_period ?? '', payment_terms: d?.payment_terms ?? company.payment_terms,
    status: invoice?.status ?? 'Sent', notes: invoice?.notes ?? '',
    ...Object.fromEntries(PAY.map(([k]) => [`pay_${k}`, (d?.pay ?? lastPay)[k] ?? ''])),
  })
  const [items, setItems] = useState(() => (d?.items?.length ? d.items.map((it) => ({ ...it, qty: String(it.qty), rate: String(it.rate) })) : [blankItem()]))
  const setItem = (i, key, value) => setItems((rows) => rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)))
  const taxOf = (v) => ({ other_label: v.other_label, ...Object.fromEntries(TAX_LINES.map(([k]) => [`${k}_rate`, v[`${k}_rate`]])) })
  const b = invoiceBreakdown({ items, discount: f.values.discount, tax: taxOf(f.values) })
  const total = b.total
  const [extras, setExtras] = useState(() => b.discount > 0 || b.taxes.length > 0)
  const itemError = Object.entries(f.errors).find(([k, v]) => v && (k === 'items' || k.startsWith('item_')))?.[1] ?? (f.errors.amount || null)

  // choosing the project fills in the client and proposes the next number (new invoices only)
  function pickProject(e) {
    const id = e.target.value
    f.set('project_id', id)
    if (invoice) return
    const client = clientOf(id)
    f.setValues((v) => ({ ...v, project_id: id, ...client, invoice_number: id ? nextInvoiceNumber(data.invoices, client.bill_to_name, v.invoice_date) : '' }))
  }

  const save = (v) => api.saveInvoice({
    project_id: v.project_id, invoice_number: v.invoice_number, invoice_date: v.invoice_date, due_date: v.due_date, status: v.status, notes: v.notes,
    tds_amount: invoice?.tds_amount ?? 0,
    details: { bill_to_name: v.bill_to_name, bill_to_line: v.bill_to_line, bill_to_address: v.bill_to_address, bill_to_email: v.bill_to_email, bill_to_gstin: v.bill_to_gstin,
      billing_period: v.billing_period, payment_terms: v.payment_terms, items, discount: extras ? v.discount : '', tax: extras ? taxOf(v) : {}, pay: Object.fromEntries(PAY.map(([k]) => [k, v[`pay_${k}`]])) },
  }, invoice?.id)

  const project = f.bind('project_id')
  return (
    <form noValidate onSubmit={(e) => f.submit(e, save, { success: invoice ? 'Invoice updated.' : 'Invoice created.', onDone: (row) => { onClose(); onSaved(row.id) } })}>
      <Grid>
        <ProjectField form={{ ...f, bind: (k) => (k === 'project_id' ? { ...project, onChange: pickProject } : f.bind(k)) }} required disabled={!!lockProjectId} />
        <FormField label="Invoice Number" required error={f.errors.invoice_number}><TextInput {...f.bind('invoice_number')} placeholder="e.g. LEV-CHP-2026-001" /></FormField>
        <FormField label="Billed To" required error={f.errors.bill_to_name}><TextInput {...f.bind('bill_to_name')} placeholder="Client name" /></FormField>
        <FormField label="Client legal / company name (optional)"><TextInput {...f.bind('bill_to_line')} placeholder="Registered company name" /></FormField>
        <FormField label="Client address (optional)"><TextArea {...f.bind('bill_to_address')} className="min-h-14" /></FormField>
        <div>
          <FormField label="Client email (optional)"><TextInput type="email" {...f.bind('bill_to_email')} /></FormField>
          <FormField label="Client GSTIN (optional)"><TextInput {...f.bind('bill_to_gstin')} /></FormField>
        </div>
        <FormField label="Invoice Date" required error={f.errors.invoice_date}><TextInput type="date" {...f.bind('invoice_date')} /></FormField>
        <FormField label="Due Date (optional)" error={f.errors.due_date}><TextInput type="date" min={f.values.invoice_date || undefined} {...f.bind('due_date')} /></FormField>
        <FormField label="Billing Period (optional)"><TextInput {...f.bind('billing_period')} placeholder="e.g. September 2026" /></FormField>
        <FormField label="Payment Terms"><TextInput {...f.bind('payment_terms')} placeholder="e.g. Due on receipt" /></FormField>
      </Grid>

      <fieldset className="mb-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">Items</legend>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className={i ? 'border-t border-slate-200 pt-3' : ''}>
              <div className="mb-2 flex items-center gap-2">
                <span className="w-6 flex-shrink-0 text-xs font-semibold tabular-nums text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                <TextInput aria-label={`Item ${i + 1} title`} value={it.title} onChange={(e) => setItem(i, 'title', e.target.value)} placeholder="What you are billing for" invalid={!!f.errors[`item_${i}_title`]} />
                <button type="button" aria-label={`Remove item ${i + 1}`} disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((_, n) => n !== i))} className="flex h-10 w-9 min-h-0 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"><Trash2 size={15} /></button>
              </div>
              <div className="grid gap-2 pl-8 sm:grid-cols-[1fr_5.5rem_8rem_7.5rem] sm:items-start">
                <TextArea aria-label={`Item ${i + 1} description`} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} placeholder="Description (optional)" className="min-h-10" rows={2} />
                <label className="block text-[11px] font-medium text-slate-500">Qty
                  <TextInput aria-label={`Item ${i + 1} quantity`} type="number" inputMode="decimal" min="0" step="any" value={it.qty} onChange={(e) => setItem(i, 'qty', e.target.value)} invalid={!!f.errors[`item_${i}_qty`]} className="mt-0.5" /></label>
                <label className="block text-[11px] font-medium text-slate-500">Rate (₹)
                  <TextInput aria-label={`Item ${i + 1} rate`} type="number" inputMode="decimal" min="0" step="0.01" value={it.rate} onChange={(e) => setItem(i, 'rate', e.target.value)} invalid={!!f.errors[`item_${i}_rate`]} className="mt-0.5" /></label>
                <div className="text-right text-[11px] font-medium text-slate-500">Amount
                  <p className="mt-0.5 flex h-10 items-center justify-end text-sm font-semibold tabular-nums text-slate-900">{formatCurrency((Number(it.qty) || 0) * (Number(it.rate) || 0))}</p></div>
              </div>
            </div>
          ))}
        </div>
        {itemError && <p role="alert" className="mt-2 text-xs text-red-600">{itemError}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="secondary" onClick={() => setItems((rows) => [...rows, blankItem()])}><Plus size={15} /> Add item</Button>
          <p className="text-sm text-slate-600">Subtotal <span className="ml-2 font-semibold tabular-nums text-slate-900">{formatCurrency(b.subtotal)}</span></p>
        </div>
      </fieldset>

      <fieldset className="mb-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">Discount and tax</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={extras} onChange={(e) => setExtras(e.target.checked)} />
          This invoice has a discount or tax (GST)
        </label>
        {extras && (
          <div className="mt-3 grid gap-x-4 sm:grid-cols-3">
            <FormField label="Discount (₹)" error={f.errors.discount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('discount')} placeholder="0" /></FormField>
            {TAX_LINES.filter(([k]) => k !== 'other').map(([k, label]) => (
              <FormField key={k} label={`${label} %`} error={f.errors[`${k}_rate`]}><TextInput type="number" inputMode="decimal" min="0" max="100" step="any" {...f.bind(`${k}_rate`)} placeholder="0" /></FormField>
            ))}
            <FormField label="Other tax name"><TextInput {...f.bind('other_label')} placeholder="e.g. Cess" /></FormField>
            <FormField label="Other tax %" error={f.errors.other_rate}><TextInput type="number" inputMode="decimal" min="0" max="100" step="any" {...f.bind('other_rate')} placeholder="0" /></FormField>
          </div>
        )}
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          {extras && b.discount > 0 && <div className="flex justify-between text-slate-600"><dt>Discount</dt><dd className="tabular-nums">− {formatCurrency(b.discount)}</dd></div>}
          {extras && b.taxes.map((t) => <div key={t.key} className="flex justify-between text-slate-600"><dt>{t.label} ({t.rate}%)</dt><dd className="tabular-nums">{formatCurrency(t.amount)}</dd></div>)}
          <div className="flex items-baseline justify-between"><dt className="text-slate-600">Total Due</dt><dd className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(extras ? total : b.subtotal)}</dd></div>
          <p className="text-xs text-slate-500">{rupeesInWords(extras ? total : b.subtotal)}</p>
        </dl>
      </fieldset>

      <FormField label="Note (optional — printed on the invoice)"><TextArea {...f.bind('notes')} /></FormField>

      <fieldset className="mb-4 rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold text-slate-600">Payment details (optional — filled from Settings; leave empty to leave them off the invoice)</legend>
        <Grid>{PAY.map(([k, label]) => <FormField key={k} label={label}><TextInput {...f.bind(`pay_${k}`)} /></FormField>)}</Grid>
      </fieldset>

      <FormField label="Status" hint="Draft invoices are not counted as outstanding.">
        <Select {...f.bind('status')} className="w-40"><option value="Sent">Sent</option><option value="Draft">Draft</option>{invoice && <option value="Cancelled">Cancelled</option>}</Select>
      </FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={invoice ? 'Save & Preview' : 'Create Invoice'} />
    </form>
  )
}

// Create (or edit) an invoice on the Levrotec template, then show it ready to download.
export function InvoiceBuilderModal({ open, onClose, invoice, lockProjectId }) {
  const [previewId, setPreviewId] = useState(null)
  return (
    <>
      <Modal open={open} onClose={onClose} title={invoice ? `Edit Invoice ${invoice.invoice_number}` : 'New Invoice'} wide>
        {open && <Body invoice={invoice} lockProjectId={lockProjectId} onClose={onClose} onSaved={setPreviewId} />}
      </Modal>
      <InvoicePreviewModal invoiceId={previewId} onClose={() => setPreviewId(null)} />
    </>
  )
}
