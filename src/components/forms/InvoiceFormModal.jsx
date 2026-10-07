import { Modal } from '../ui/Modal'
import { FileDrop, FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, ProjectField } from './common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { INVOICE_STORED_STATUSES } from '../../services/schema'
import { formatCurrency, todayISO } from '../../lib/format'
import { addDays } from '../../lib/dates'
import { num, round2 } from '../../calculations/finance'

function nextNumber(invoices) {
  const max = invoices.reduce((m, i) => Math.max(m, Number(/(\d+)\s*$/.exec(i.invoice_number)?.[1] ?? 0)), 0)
  return `INV-${String(max + 1).padStart(3, '0')}`
}

function Body({ invoice, lockProjectId, onClose }) {
  const { api, data, projectById } = useData()
  const f = useForm({
    project_id: invoice?.project_id ?? lockProjectId ?? '', invoice_number: invoice?.invoice_number ?? nextNumber(data.invoices),
    invoice_date: invoice?.invoice_date ?? todayISO(), due_date: invoice?.due_date ?? addDays(todayISO(), 15),
    amount: invoice?.amount ?? '', tax_amount: invoice?.tax_amount || '', tds_amount: invoice?.tds_amount || '',
    status: invoice?.status ?? 'Sent', notes: invoice?.notes ?? '', attachment: null,
  })
  const total = round2(num(f.values.amount) + num(f.values.tax_amount))
  const client = projectById.get(f.values.project_id)?.client_name
  const existing = invoice?.attachment_document_id ? data.documents.find((d) => d.id === invoice.attachment_document_id)?.name : null
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveInvoice(v, invoice?.id), { success: invoice ? 'Invoice updated.' : 'Invoice created.', onDone: onClose })}>
      <Grid>
        <ProjectField form={f} required disabled={!!lockProjectId} />
        <FormField label="Client" hint="Taken from the project."><TextInput value={client || '—'} disabled readOnly /></FormField>
        <FormField label="Invoice Number" required error={f.errors.invoice_number}><TextInput {...f.bind('invoice_number')} /></FormField>
        <FormField label="Status" required error={f.errors.status} hint="Paid / Partially Paid / Overdue are calculated from payments and the due date.">
          <Select {...f.bind('status')}>{INVOICE_STORED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </FormField>
        <FormField label="Invoice Date" required error={f.errors.invoice_date}><TextInput type="date" {...f.bind('invoice_date')} /></FormField>
        <FormField label="Due Date" error={f.errors.due_date}><TextInput type="date" min={f.values.invoice_date || undefined} {...f.bind('due_date')} /></FormField>
        <FormField label="Amount (₹, before tax)" required error={f.errors.amount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} /></FormField>
        <FormField label="Tax / GST (₹)" error={f.errors.tax_amount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('tax_amount')} placeholder="0" /></FormField>
        <FormField label="TDS deducted by client (₹)" error={f.errors.tds_amount} hint="Counts as settled — it never arrives as cash."><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('tds_amount')} placeholder="0" /></FormField>
        <FormField label="Invoice Total"><TextInput value={formatCurrency(total)} disabled readOnly /></FormField>
      </Grid>
      <FormField label="Notes"><TextArea {...f.bind('notes')} /></FormField>
      <FormField label="Attachment" error={f.errors.attachment}><FileDrop file={f.values.attachment} existing={existing} invalid={!!f.errors.attachment} onChange={(file) => f.set('attachment', file)} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={invoice ? 'Save Changes' : 'Create Invoice'} />
    </form>
  )
}

export function InvoiceFormModal({ open, onClose, invoice, lockProjectId }) {
  return <Modal open={open} onClose={onClose} title={invoice ? `Edit Invoice ${invoice.invoice_number}` : 'Add Invoice'} wide><Body invoice={invoice} lockProjectId={lockProjectId} onClose={onClose} /></Modal>
}
