import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Receipt, Building2, Briefcase, HandCoins } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { Card, PageHeader } from '../components/ui/misc'
import { DonutWithLegend } from '../components/ui/charts'
import { ExpensesPanel } from '../components/modules/ExpensesPanel'
import { useRecordModals } from '../components/modules/RecordModals'
import { DEFAULT_RANGE, filtersFromParams } from '../hooks/useFilters'
import { groupTotals, sum } from '../calculations/finance'
import { RANGE_PRESETS } from '../lib/dates'
import { formatCurrency } from '../lib/format'

const THIS_MONTH = { preset: 'this_month', from: '', to: '' }

export function Expenses() {
  const modals = useRecordModals()
  const [params] = useSearchParams()
  // arriving from a link (a member, project or category) shows all dates, not just this month
  const linked = filtersFromParams(params, ['category', 'project', 'paidBy'])
  const initial = Object.keys(linked).length ? { ...linked, range: DEFAULT_RANGE } : undefined
  const [view, setView] = useState({ rows: [], preset: 'this_month' })
  const stats = useMemo(() => ({
    total: sum(view.rows),
    project: sum(view.rows.filter((e) => e.project_id)),
    personal: sum(view.rows.filter((e) => e.paid_by_member_id)),
    pending: sum(view.rows, (e) => e.reimb.owed),
    groups: groupTotals(view.rows, (e) => e.category),
  }), [view.rows])
  const label = RANGE_PRESETS.find((p) => p.id === view.preset)?.label ?? 'Selected'

  return (
    <div className="space-y-4">
      <PageHeader title="Expenses" subtitle="Project, company and team-member expenses — whoever paid">
        <Button onClick={() => modals.open({ kind: 'expense', action: 'add' })}><Plus size={16} /> Add Expense</Button>
      </PageHeader>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={`Total Expenses · ${label}`} value={formatCurrency(stats.total)} icon={Receipt} sub={`${view.rows.length} expense(s) shown`} />
          <StatCard label="Project Expenses" value={formatCurrency(stats.project)} icon={Briefcase} />
          <StatCard label="Company Expenses" value={formatCurrency(stats.total - stats.project)} icon={Building2} />
          <StatCard label="Paid Personally" value={formatCurrency(stats.personal)} icon={HandCoins} accent={stats.pending > 0 ? 'attention' : 'neutral'} sub={`${formatCurrency(stats.pending)} still to reimburse`} />
        </div>
        <Card title="Expense Categories">
          {stats.groups.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">No expenses in this view.</p> : <DonutWithLegend groups={stats.groups} max={6} linkTo={(c) => `/expenses?category=${encodeURIComponent(c)}`} />}
        </Card>
      </div>

      <ExpensesPanel key={params.toString()} initial={initial} modals={modals} defaultRange={THIS_MONTH} onFiltered={(rows, preset) => setView({ rows, preset })} />
      {modals.element}
    </div>
  )
}
