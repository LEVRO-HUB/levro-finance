import { useMemo, useState } from 'react'
import { CalendarClock, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { RecurringFormModal, RecurringPanel } from '../components/modules/RecurringPanel'
import { useData } from '../store/DataProvider'
import { recurringOverview } from '../calculations/finance'
import { formatCurrency } from '../lib/format'

export function Bills() {
  const { data, today } = useData()
  const [adding, setAdding] = useState(false)
  const b = useMemo(() => recurringOverview(data, today).bills, [data, today])
  return (
    <div className="space-y-4">
      <PageHeader title="Monthly Bills" subtitle="Rent, subscriptions, salaries and other payments that repeat every month">
        <Button onClick={() => setAdding(true)}><Plus size={16} /> Add Monthly Bill</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total per Month" value={formatCurrency(b.monthly)} icon={CalendarClock} sub="all running bills" />
        <StatCard label="Paid This Month" value={formatCurrency(b.doneThisMonth)} accent="positive" />
        <StatCard label="Pending to Pay" value={formatCurrency(b.pendingAmount)} accent={b.pendingCount ? 'attention' : 'neutral'} sub={`${b.pendingCount} month(s) not yet paid`} />
        <StatCard label="Overdue" value={b.overdueCount} accent={b.overdueCount ? 'negative' : 'neutral'} sub="past their due day" />
      </div>
      <p className="text-xs text-slate-500">Click a month to mark it paid — that records the expense for you. To undo, delete that expense from the Expenses page.</p>
      <RecurringPanel kind="bill" showProject emptyTitle="No monthly bills yet" emptyDescription="Add your office rent, subscriptions and salaries once, then tick them off every month." />
      <RecurringFormModal open={adding} onClose={() => setAdding(false)} kind="bill" />
    </div>
  )
}
