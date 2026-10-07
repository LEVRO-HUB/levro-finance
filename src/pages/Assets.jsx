import { useMemo } from 'react'
import { Armchair, Plus, ShoppingBag } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { ExpensesPanel } from '../components/modules/ExpensesPanel'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { sum } from '../calculations/finance'
import { resolveRange, inRange } from '../lib/dates'
import { formatCurrency } from '../lib/format'

export function Assets() {
  const { data, today } = useData()
  const modals = useRecordModals()
  const s = useMemo(() => {
    const purchases = data.expenses.filter((e) => e.expense_type === 'company_purchase')
    const year = resolveRange('this_year', {}, today)
    return { total: sum(purchases), assets: purchases.filter((e) => e.is_asset), thisYear: sum(purchases.filter((e) => inRange(e.date, year))), count: purchases.length }
  }, [data.expenses, today])

  return (
    <div className="space-y-4">
      <PageHeader title="Purchases & Assets" subtitle="Company purchases — furniture, equipment, software. Each one is also a company expense.">
        <Button onClick={() => modals.open({ kind: 'expense', action: 'add', mode: 'purchase' })}><Plus size={16} /> Add Purchase</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Purchases" value={formatCurrency(s.total)} icon={ShoppingBag} sub={`${s.count} purchase(s)`} />
        <StatCard label="Purchased This Year" value={formatCurrency(s.thisYear)} />
        <StatCard label="Tracked Assets" value={s.assets.length} icon={Armchair} />
        <StatCard label="Asset Value (at cost)" value={formatCurrency(sum(s.assets))} />
      </div>
      <ExpensesPanel variant="purchase" modals={modals} />
      {modals.element}
    </div>
  )
}
