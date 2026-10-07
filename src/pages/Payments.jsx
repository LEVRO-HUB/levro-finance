import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { PaymentsPanel } from '../components/modules/PaymentsPanel'
import { filtersFromParams } from '../hooks/useFilters'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { companyPosition, companySummary } from '../calculations/finance'
import { resolveRange } from '../lib/dates'
import { formatCurrency } from '../lib/format'

export function Payments() {
  const { data, today } = useData()
  const modals = useRecordModals()
  const [params] = useSearchParams()
  const s = useMemo(() => ({ all: companySummary(data), month: companySummary(data, resolveRange('this_month', {}, today)), pos: companyPosition(data, today) }), [data, today])
  return (
    <div className="space-y-4">
      <PageHeader title="Payments" subtitle="Money received — against invoices, directly for projects, or other income">
        <Button onClick={() => modals.open({ kind: 'income', action: 'add' })}><Plus size={16} /> Record Payment</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Received This Month" value={formatCurrency(s.month.totalIncome)} accent="positive" />
        <StatCard label="Total Received" value={formatCurrency(s.all.totalIncome)} />
        <StatCard label="Project Revenue" value={formatCurrency(s.all.projectRevenue)} sub={`${formatCurrency(s.all.otherIncome)} other income`} />
        <StatCard label="Pending Receivables" value={formatCurrency(s.pos.pendingReceivables)} accent="attention" sub="contract value not yet received" />
      </div>
      <PaymentsPanel key={params.toString()} modals={modals} initial={filtersFromParams(params, ['project', 'q'])} />
      {modals.element}
    </div>
  )
}
