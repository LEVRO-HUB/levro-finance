import { useMemo } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { ChangeBadge, PageHeader } from '../components/ui/misc'
import { ExpensesPanel } from '../components/modules/ExpensesPanel'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { pctChange, sum } from '../calculations/finance'
import { inRange, resolveRange } from '../lib/dates'
import { formatCurrency } from '../lib/format'

// Pay Out = company-paid expenses to a named external recipient (vendor / payee).
// It is a focused view of the same expense records, never a second copy.
export function PayOut() {
  const { data, today } = useData()
  const modals = useRecordModals()
  const s = useMemo(() => {
    const payouts = data.expenses.filter((e) => !e.paid_by_member_id && e.recipient && e.expense_type !== 'company_purchase')
    const month = sum(payouts.filter((e) => inRange(e.date, resolveRange('this_month', {}, today))))
    const last = sum(payouts.filter((e) => inRange(e.date, resolveRange('last_month', {}, today))))
    return { month, change: pctChange(month, last), total: sum(payouts), recipients: new Set(payouts.map((e) => e.recipient.toLowerCase())).size }
  }, [data.expenses, today])

  return (
    <div className="space-y-4">
      <PageHeader title="Company Pay Out" subtitle="Regular company payments to vendors and other recipients">
        <Button onClick={() => modals.open({ kind: 'expense', action: 'add', mode: 'payout' })}><Plus size={16} /> New Pay Out</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total Paid This Month" value={formatCurrency(s.month)} icon={Wallet} sub={<span className="inline-flex items-center gap-1"><ChangeBadge value={s.change} goodWhenUp={false} /> vs last month</span>} />
        <StatCard label="Total Paid (all time)" value={formatCurrency(s.total)} />
        <StatCard label="Recipients" value={s.recipients} />
      </div>
      <ExpensesPanel variant="payout" modals={modals} />
      {modals.element}
    </div>
  )
}
