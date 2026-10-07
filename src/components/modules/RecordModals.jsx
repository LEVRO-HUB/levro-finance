import { useState } from 'react'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ExpenseFormModal } from '../forms/ExpenseFormModal'
import { IncomeFormModal } from '../forms/IncomeFormModal'
import { InvoiceFormModal } from '../forms/InvoiceFormModal'
import { InvoiceBuilderModal } from '../forms/InvoiceBuilderModal'
import { AdvanceModal, RepaymentModal } from '../forms/MemberMoneyModals'
import { DocumentUploadModal } from '../forms/DocumentModals'
import { useData } from '../../store/DataProvider'
import { formatCurrency } from '../../lib/format'

// One controller for every add / edit / delete dialog, so each list page and
// project tab opens exactly the same forms.
//   open({ kind, action: 'add' | 'edit' | 'delete', record?, ...options })
export function useRecordModals({ lockProjectId } = {}) {
  const { api, can } = useData()
  const [s, setS] = useState(null)
  const close = () => setS(null)
  const is = (kind, ...actions) => s?.kind === kind && actions.includes(s.action)
  const form = (kind) => is(kind, 'add', 'edit')

  const DELETE = {
    income: (r) => ({ run: () => api.deleteIncome(r.id), text: `This removes the ${formatCurrency(r.amount)} payment record (${r.code}). Project and invoice balances will be recalculated.` }),
    expense: (r) => ({ run: () => api.deleteExpense(r.id), text: `“${r.title}” (${formatCurrency(r.amount)}) will be permanently removed, along with its receipt.` }),
    invoice: (r) => ({ run: () => api.deleteInvoice(r.id), text: `Invoice ${r.invoice_number} will be permanently removed.` }),
    reimbursement: (r) => ({ run: () => api.deleteReimbursement(r.id), text: `This removes the ${formatCurrency(r.amount)} repayment (${r.code}). The amount becomes pending again.` }),
    advance: (r) => ({ run: () => api.deleteAdvance(r.id), text: `This removes the ${formatCurrency(r.amount)} advance entry (${r.code}).` }),
    document: (r) => ({ run: () => api.deleteDocument(r.id), text: `“${r.name}” and all of its versions will be permanently removed.` }),
  }
  const del = s?.action === 'delete' ? DELETE[s.kind]?.(s.record) : null

  const element = (
    <>
      <IncomeFormModal open={form('income')} onClose={close} income={s?.action === 'edit' ? s.record : null} invoice={s?.invoice} lockProjectId={lockProjectId} />
      <ExpenseFormModal open={form('expense')} onClose={close} expense={s?.action === 'edit' ? s.record : null} mode={s?.mode ?? 'expense'} lockProjectId={lockProjectId} />
      {/* 'create' = the Levrotec template; 'add' = record an invoice made elsewhere. Editing reopens whichever made it. */}
      <InvoiceFormModal open={is('invoice', 'add') || (is('invoice', 'edit') && !s.record?.details)} onClose={close} invoice={s?.action === 'edit' ? s.record : null} lockProjectId={lockProjectId} />
      <InvoiceBuilderModal open={is('invoice', 'create') || (is('invoice', 'edit') && !!s.record?.details)} onClose={close} invoice={s?.action === 'edit' ? s.record : null} lockProjectId={lockProjectId} onCreated={s?.onCreated} />
      <RepaymentModal open={is('reimbursement', 'add')} onClose={close} memberId={s?.memberId} expense={s?.expense} />
      <AdvanceModal open={form('advance')} onClose={close} advance={s?.action === 'edit' ? s.record : null} memberId={s?.memberId} direction={s?.direction} />
      <DocumentUploadModal open={is('document', 'add', 'replace')} onClose={close} lockProjectId={lockProjectId} replaceDoc={s?.action === 'replace' ? s.record : null} />
      <ConfirmDialog open={!!del} onClose={close} onConfirm={() => del.run()} description={del?.text} successMessage="Deleted." />
    </>
  )
  return { open: setS, element, canDelete: can.admin }
}
