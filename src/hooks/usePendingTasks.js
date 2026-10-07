import { useMemo } from 'react'
import { useData } from '../store/DataProvider'
import { companyPosition, projectFinancials, recurringOverview } from '../calculations/finance'
import { daysSince, STALLED_AFTER_DAYS } from '../lib/products'
import { formatCurrency } from '../lib/format'

// The one list of "things that need doing", shown on the dashboard and in the bell.
export function usePendingTasks() {
  const { data, today } = useData()
  return useMemo(() => {
    const pos = companyPosition(data, today)
    const rec = recurringOverview(data, today)
    const owing = data.projects.filter((p) => p.kind !== 'product' && (p.status === 'Active' || p.status === 'On Hold') && projectFinancials(p, data, today).outstanding > 0)
    const members = pos.balances.filter((b) => b.companyOwes > 0).length
    const overdue = pos.overdueInvoices
    const stalled = data.projects.filter((p) => p.kind === 'product' && p.status === 'Active' && p.stage !== 'Launched' && daysSince(p.stage_updated_at ?? p.created_at, today) > STALLED_AFTER_DAYS)
    return [
      overdue.length > 0 && { key: 'overdue', tone: 'red', to: '/invoices?status=Overdue', text: `${overdue.length} invoice(s) overdue`, amount: formatCurrency(overdue.reduce((a, s) => a + s.outstanding, 0)) },
      rec.charges.pendingCount > 0 && { key: 'charges', tone: rec.charges.overdueCount ? 'red' : 'amber', to: '/monthly-charges', text: `${rec.charges.pendingCount} monthly charge(s) to collect`, amount: formatCurrency(rec.charges.pendingAmount) },
      rec.bills.pendingCount > 0 && { key: 'bills', tone: rec.bills.overdueCount ? 'red' : 'amber', to: '/bills', text: `${rec.bills.pendingCount} monthly bill(s) to pay`, amount: formatCurrency(rec.bills.pendingAmount) },
      owing.length > 0 && { key: 'projects', tone: 'amber', to: '/projects', text: `${owing.length} project payment(s) pending`, amount: formatCurrency(pos.pendingReceivables) },
      pos.pendingReimbursements > 0 && { key: 'reimb', tone: 'amber', to: '/contributions', text: `${members} member reimbursement(s) pending`, amount: formatCurrency(pos.pendingReimbursements) },
      pos.membersOweCompany > 0 && { key: 'advances', tone: 'amber', to: '/contributions?tab=advances', text: 'Member advances to be returned', amount: formatCurrency(pos.membersOweCompany) },
      ...stalled.map((p) => ({ key: `product-${p.id}`, tone: 'amber', to: '/products', text: `${p.name}: no progress update for ${daysSince(p.stage_updated_at ?? p.created_at, today)} days`, amount: '' })),
    ].filter(Boolean)
  }, [data, today])
}
