import { useMemo, useState } from 'react'
import { CalendarCheck, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { RecurringFormModal, RecurringPanel } from '../components/modules/RecurringPanel'
import { useData } from '../store/DataProvider'
import { recurringOverview } from '../calculations/finance'
import { formatCurrency } from '../lib/format'

// Every project that pays a monthly fee (maintenance / support), in one place,
// with a tick for each month. The same ticks appear on the project's own page.
export function MonthlyCharges() {
  const { data, today } = useData()
  const [adding, setAdding] = useState(false)
  const c = useMemo(() => recurringOverview(data, today).charges, [data, today])
  const none = data.projects.length === 0
  return (
    <div className="space-y-4">
      <PageHeader title="Monthly Charges" subtitle="Projects that pay a monthly fee, and whether each month has been collected">
        <Button onClick={() => setAdding(true)} disabled={none} title={none ? 'Create a project first' : undefined}><Plus size={16} /> Add Monthly Charge</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Expected per Month" value={formatCurrency(c.monthly)} icon={CalendarCheck} sub={`${c.rows.filter((r) => !r.ended).length} project charge(s) running`} />
        <StatCard label="Collected This Month" value={formatCurrency(c.doneThisMonth)} accent="positive" />
        <StatCard label="Pending to Collect" value={formatCurrency(c.pendingAmount)} accent={c.pendingCount ? 'attention' : 'neutral'} sub={`${c.pendingCount} month(s) not yet collected`} />
        <StatCard label="Overdue" value={c.overdueCount} accent={c.overdueCount ? 'negative' : 'neutral'} sub="past their due day" />
      </div>
      <p className="text-xs text-slate-500">Click a month to tick it as collected — that records the payment for you. To undo a tick, delete that payment from the Payments page.</p>
      <RecurringPanel kind="maintenance" showProject emptyTitle="No project has a monthly charge yet" emptyDescription="Add one here, or tick “This project has a monthly charge” when editing a project." />
      <RecurringFormModal open={adding} onClose={() => setAdding(false)} kind="maintenance" />
    </div>
  )
}
