import { useMemo } from 'react'
import { Modal } from '../ui/Modal'
import { FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, MethodField, ProjectField } from './common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { INCOME_TYPES } from '../../services/schema'
import { formatCurrency, todayISO } from '../../lib/format'
import { invoiceState } from '../../calculations/finance'

// Money in. Pass `invoice` to record a payment against it, `lockProjectId` on a project page.
function Body({ income, invoice, lockProjectId, onClose }) {
  const { api, data, today } = useData()
  const preset = invoice ? invoiceState(invoice, data.income, today) : null
  const f = useForm({
    type: income?.type ?? 'client_payment', amount: income?.amount ?? (preset?.outstanding > 0 ? preset.outstanding : ''), date: income?.date ?? todayISO(),
    project_id: income?.project_id ?? invoice?.project_id ?? lockProjectId ?? '', invoice_id: income?.invoice_id ?? invoice?.id ?? '',
    payment_method: income?.payment_method ?? '', reference: income?.reference ?? '', description: income?.description ?? '', notes: income?.notes ?? '',
  })
  const type = INCOME_TYPES.find((t) => t.id === f.values.type)
  const lockProject = !!lockProjectId || !!invoice
  const openInvoices = useMemo(() => data.invoices
    .filter((i) => i.project_id === f.values.project_id && i.status !== 'Cancelled')
    .map((i) => ({ i, st: invoiceState(i, data.income.filter((p) => p.id !== income?.id), today) }))
    .filter(({ i, st }) => st.outstanding > 0 || i.id === f.values.invoice_id), [data, f.values.project_id, f.values.invoice_id, income, today])
  const selected = openInvoices.find(({ i }) => i.id === f.values.invoice_id)

  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveIncome(v, income?.id), { success: income ? 'Payment updated.' : 'Payment recorded.', onDone: onClose })}>
      <Grid>
        <FormField label="Type" required error={f.errors.type}>
          <Select {...f.bind('type')} disabled={!!invoice}>{INCOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
        </FormField>
        <FormField label="Amount (₹)" required error={f.errors.amount} hint={selected ? `Invoice outstanding: ${formatCurrency(selected.st.outstanding)}` : undefined}>
          <TextInput autoFocus type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} />
        </FormField>
        <FormField label="Date Received" required error={f.errors.date}><TextInput type="date" max={todayISO()} {...f.bind('date')} /></FormField>
        <MethodField form={f} />
        <ProjectField form={{ ...f, bind: (k) => ({ ...f.bind(k), onChange: (e) => { f.set('project_id', e.target.value); f.set('invoice_id', '') } }) }} required={!!type?.needsProject} disabled={lockProject} emptyLabel="Not linked to a project" />
        <FormField label="Against Invoice (optional)" error={f.errors.invoice_id} hint={!f.values.project_id ? 'Choose a project to see its open invoices.' : openInvoices.length === 0 ? 'No open invoices for this project.' : undefined}>
          <Select {...f.bind('invoice_id')} disabled={!!invoice || !f.values.project_id}>
            <option value="">No invoice — direct payment</option>
            {openInvoices.map(({ i, st }) => <option key={i.id} value={i.id}>{i.invoice_number} — {formatCurrency(st.outstanding)} due</option>)}
          </Select>
        </FormField>
        <FormField label="Description" error={f.errors.description}><TextInput {...f.bind('description')} placeholder="e.g. Milestone 2 payment" /></FormField>
        <FormField label="Reference" error={f.errors.reference}><TextInput {...f.bind('reference')} placeholder="UTR / cheque no. (optional)" /></FormField>
      </Grid>
      <FormField label="Notes"><TextArea {...f.bind('notes')} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={income ? 'Save Changes' : 'Record Payment'} />
    </form>
  )
}

export function IncomeFormModal({ open, onClose, income, invoice, lockProjectId }) {
  const title = income ? 'Edit Money In' : invoice ? `Record Payment — ${invoice.invoice_number}` : 'Add Money In'
  return <Modal open={open} onClose={onClose} title={title} wide><Body income={income} invoice={invoice} lockProjectId={lockProjectId} onClose={onClose} /></Modal>
}
