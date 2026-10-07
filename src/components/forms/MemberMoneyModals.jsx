import { Modal } from '../ui/Modal'
import { FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, MemberField, MethodField } from './common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { formatCurrency, formatDate, todayISO } from '../../lib/format'
import { memberBalance, reimbursementState } from '../../calculations/finance'

// Repay a member. With `expense` it settles that one expense; otherwise the
// amount is applied to the member's outstanding expenses oldest-first.
function RepaymentBody({ memberId, expense, onClose }) {
  const { api, data, memberName } = useData()
  const owedFor = (id) => (id ? memberBalance(id, data).companyOwes : 0)
  const expenseOwed = expense ? reimbursementState(expense, data.reimbursements).owed : 0
  const f = useForm({
    member_id: expense?.paid_by_member_id ?? memberId ?? '', amount: expense ? expenseOwed || '' : owedFor(memberId) || '',
    paid_date: todayISO(), payment_method: '', reference: '', notes: '',
  })
  const owed = expense ? expenseOwed : owedFor(f.values.member_id)
  const owing = data.members.filter((m) => owedFor(m.id) > 0 || m.id === f.values.member_id)
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.recordReimbursement({ ...v, expense_id: expense?.id }), { success: (rows) => `Repayment recorded${rows.length > 1 ? ` across ${rows.length} expenses` : ''}.`, onDone: onClose })}>
      {expense && <p className="mb-3.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Repaying <strong>{memberName(expense.paid_by_member_id)}</strong> for “{expense.title}” ({formatDate(expense.date)}) — {formatCurrency(expenseOwed)} pending of {formatCurrency(expense.amount)}.</p>}
      <Grid>
        {!expense && (
          <FormField label="Member" required error={f.errors.member_id}>
            <Select value={f.values.member_id} invalid={!!f.errors.member_id} onChange={(e) => { f.set('member_id', e.target.value); f.set('amount', owedFor(e.target.value) || '') }}>
              <option value="">Select member</option>
              {owing.map((m) => <option key={m.id} value={m.id}>{m.name} — {formatCurrency(owedFor(m.id))} pending</option>)}
            </Select>
          </FormField>
        )}
        <FormField label="Amount (₹)" required error={f.errors.amount} hint={f.values.member_id || expense ? `Levrotec currently owes ${formatCurrency(owed)}` : undefined}>
          <TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} />
        </FormField>
        <FormField label="Date" required error={f.errors.paid_date}><TextInput type="date" max={todayISO()} {...f.bind('paid_date')} /></FormField>
        <MethodField form={f} />
        <FormField label="Reference"><TextInput {...f.bind('reference')} placeholder="Enter reference (optional)" /></FormField>
      </Grid>
      <FormField label="Notes"><TextArea {...f.bind('notes')} placeholder="Add notes (optional)" /></FormField>
      {!expense && owing.length === 0 && <p className="mb-3 text-xs text-slate-500">No member is waiting on a reimbursement right now.</p>}
      <FormActions onCancel={onClose} saving={f.saving} label="Record Repayment" />
    </form>
  )
}

export function RepaymentModal({ open, onClose, memberId, expense }) {
  return <Modal open={open} onClose={onClose} title="Record Repayment" wide><RepaymentBody memberId={memberId} expense={expense} onClose={onClose} /></Modal>
}

// Company money held by a member: "given" = member now owes Levrotec, "returned" = they paid it back.
function AdvanceBody({ advance, memberId, direction, onClose }) {
  const { api, data } = useData()
  const f = useForm({
    member_id: advance?.member_id ?? memberId ?? '', direction: advance?.direction ?? direction ?? 'given', amount: advance?.amount ?? '',
    date: advance?.date ?? todayISO(), payment_method: advance?.payment_method ?? '', reference: advance?.reference ?? '', notes: advance?.notes ?? '',
  })
  const owes = f.values.member_id ? memberBalance(f.values.member_id, { ...data, advances: data.advances.filter((a) => a.id !== advance?.id) }).memberOwes : 0
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveAdvance(v, advance?.id), { success: 'Member balance updated.', onDone: onClose })}>
      <Grid>
        <MemberField form={f} name="member_id" label="Member" required includeId={advance?.member_id} />
        <FormField label="Type" required error={f.errors.direction}>
          <Select {...f.bind('direction')}>
            <option value="given">Advance given (member owes Levrotec)</option>
            <option value="returned">Returned by member</option>
          </Select>
        </FormField>
        <FormField label="Amount (₹)" required error={f.errors.amount} hint={f.values.member_id ? `Currently owes Levrotec ${formatCurrency(owes)}` : undefined}>
          <TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} />
        </FormField>
        <FormField label="Date" required error={f.errors.date}><TextInput type="date" max={todayISO()} {...f.bind('date')} /></FormField>
        <MethodField form={f} />
        <FormField label="Reference"><TextInput {...f.bind('reference')} /></FormField>
      </Grid>
      <FormField label="Notes / purpose"><TextArea {...f.bind('notes')} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} />
    </form>
  )
}

export function AdvanceModal({ open, onClose, advance, memberId, direction }) {
  return <Modal open={open} onClose={onClose} title={advance ? 'Edit Member Advance' : 'Member Advance'} wide><AdvanceBody advance={advance} memberId={memberId} direction={direction} onClose={onClose} /></Modal>
}
