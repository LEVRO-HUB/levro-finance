import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { InvoicesPanel } from '../components/modules/InvoicesPanel'
import { filtersFromParams } from '../hooks/useFilters'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { invoiceState, sum } from '../calculations/finance'
import { INVOICE_STATUSES } from '../services/schema'
import { formatCurrency } from '../lib/format'

export function Invoices() {
  const { data, today } = useData()
  const [params] = useSearchParams()
  const modals = useRecordModals()
  const status = INVOICE_STATUSES.includes(params.get('status')) ? params.get('status') : 'All'
  const t = useMemo(() => {
    const live = data.invoices.map((i) => invoiceState(i, data.income, today)).filter((s) => s.status !== 'Cancelled')
    return { invoiced: sum(live, (s) => s.total), received: sum(live, (s) => s.paid), outstanding: sum(live, (s) => s.outstanding), overdue: sum(live.filter((s) => s.overdue), (s) => s.outstanding), overdueCount: live.filter((s) => s.overdue).length }
  }, [data, today])

  return (
    <div className="space-y-4">
      <PageHeader title="Invoices" subtitle="Invoices raised to clients and what is still outstanding on them">
        <Button onClick={() => modals.open({ kind: 'invoice', action: 'add' })} disabled={data.projects.length === 0} title={data.projects.length === 0 ? 'Create a project first' : undefined}><Plus size={16} /> Add Invoice</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(t.invoiced)} />
        <StatCard label="Received" value={formatCurrency(t.received)} accent="positive" />
        <StatCard label="Outstanding" value={formatCurrency(t.outstanding)} accent="attention" />
        <StatCard label="Overdue" value={formatCurrency(t.overdue)} accent={t.overdue > 0 ? 'negative' : 'neutral'} sub={`${t.overdueCount} invoice(s)`} />
      </div>
      <InvoicesPanel key={params.toString()} modals={modals} initialStatus={status} initial={filtersFromParams(params, ['project', 'q'])} />
      {modals.element}
    </div>
  )
}
