import { Modal } from '../ui/Modal'
import { Checkbox, FileDrop, FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, MemberField, MethodField, ProjectField } from './common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { todayISO } from '../../lib/format'
import { reimbursementState } from '../../calculations/finance'

const COPY = {
  expense: { noun: 'Expense', title: 'Title', recipient: 'Vendor / Paid To' },
  payout: { noun: 'Pay Out', title: 'Purpose', recipient: 'Recipient' },
  purchase: { noun: 'Purchase', title: 'Asset / Purchase', recipient: 'Vendor' },
}

// mode: 'expense' | 'payout' | 'purchase'.  lockProjectId pins the project (project page).
function Body({ expense, mode, lockProjectId, onClose }) {
  const { api, data, categoryNames } = useData()
  const copy = COPY[mode]
  const f = useForm({
    title: expense?.title ?? '', amount: expense?.amount ?? '', category: expense?.category ?? '', date: expense?.date ?? todayISO(),
    payment_method: expense?.payment_method ?? '', paid_by_member_id: expense?.paid_by_member_id ?? '',
    project_id: expense?.project_id ?? lockProjectId ?? '', recipient: expense?.recipient ?? '', reference: expense?.reference ?? '',
    description: expense?.description ?? '', purchased_by_member_id: expense?.purchased_by_member_id ?? '',
    is_asset: expense ? !!expense.is_asset : true, receipt: null,
  })
  const existingReceipt = expense?.receipt_document_id ? data.documents.find((d) => d.id === expense.receipt_document_id)?.name : null
  const reimbursed = expense ? reimbursementState(expense, data.reimbursements).reimbursed : 0
  const personal = !!f.values.paid_by_member_id

  function save(v) {
    if (mode === 'payout' && !String(v.recipient).trim()) {
      const err = new Error('Recipient is required.')
      err.name = 'ValidationError'
      err.fields = { recipient: 'Recipient is required.' }
      throw err
    }
    return api.saveExpense({ ...v, expense_type: mode === 'purchase' ? 'company_purchase' : undefined, paid_by_member_id: mode === 'payout' ? '' : v.paid_by_member_id }, expense?.id)
  }

  return (
    <form noValidate onSubmit={(e) => f.submit(e, save, { success: `${copy.noun} ${expense ? 'updated' : 'saved'}.`, onDone: onClose })}>
      <Grid>
        <FormField label={copy.title} required error={f.errors.title}><TextInput autoFocus {...f.bind('title')} placeholder={mode === 'purchase' ? 'e.g. Office chair' : 'e.g. AWS hosting'} /></FormField>
        <FormField label="Amount (₹)" required error={f.errors.amount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} /></FormField>
        <FormField label="Category" required error={f.errors.category}>
          <Select {...f.bind('category')}>
            <option value="">Select category</option>
            {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label={mode === 'purchase' ? 'Purchase Date' : 'Date'} required error={f.errors.date}><TextInput type="date" max={todayISO()} {...f.bind('date')} /></FormField>
        <MethodField form={f} />
        {mode !== 'payout' && (
          <FormField label="Paid By (payment source)" required error={f.errors.paid_by_member_id} hint={personal ? 'Personal money — tracked as owed to this member until reimbursed.' : 'Paid from company money.'}>
            <Select {...f.bind('paid_by_member_id')} disabled={reimbursed > 0}>
              <option value="">Company</option>
              {data.members.filter((m) => m.is_active || m.id === f.values.paid_by_member_id).map((m) => <option key={m.id} value={m.id}>{m.name} (personal)</option>)}
            </Select>
          </FormField>
        )}
        <ProjectField form={f} disabled={!!lockProjectId} />
        <FormField label={copy.recipient} required={mode === 'payout'} error={f.errors.recipient}><TextInput {...f.bind('recipient')} /></FormField>
        {mode === 'purchase' && <MemberField form={f} name="purchased_by_member_id" label="Purchased By" emptyLabel="Not specified" />}
        <FormField label="Reference" error={f.errors.reference}><TextInput {...f.bind('reference')} placeholder="Bill / transaction no. (optional)" /></FormField>
      </Grid>
      {mode === 'purchase' && <Checkbox label="Track as a company asset" checked={f.values.is_asset} onChange={(e) => f.set('is_asset', e.target.checked)} />}
      <FormField label={mode === 'purchase' ? 'Notes' : 'Description'}><TextArea {...f.bind('description')} /></FormField>
      <FormField label="Receipt / Bill" error={f.errors.receipt}><FileDrop file={f.values.receipt} existing={existingReceipt} invalid={!!f.errors.receipt} onChange={(file) => f.set('receipt', file)} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={`Save ${copy.noun}`} />
    </form>
  )
}

export function ExpenseFormModal({ open, onClose, expense, mode = 'expense', lockProjectId }) {
  const m = expense ? (expense.expense_type === 'company_purchase' ? 'purchase' : mode === 'purchase' ? 'expense' : mode) : mode
  return <Modal open={open} onClose={onClose} title={`${expense ? 'Edit' : 'Add'} ${COPY[m].noun}`} wide><Body expense={expense} mode={m} lockProjectId={lockProjectId} onClose={onClose} /></Modal>
}
