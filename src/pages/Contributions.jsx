import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HandCoins, Plus, UserMinus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader, Tabs } from '../components/ui/misc'
import { ContributionsPanel } from '../components/modules/ContributionsPanel'
import { filtersFromParams } from '../hooks/useFilters'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { companyPosition, sum } from '../calculations/finance'
import { formatCurrency } from '../lib/format'

const VIEWS = ['contributions', 'repayments', 'advances']

export function Contributions() {
  const { data, today } = useData()
  const [params, setParams] = useSearchParams()
  const modals = useRecordModals()
  const tab = VIEWS.includes(params.get('tab')) ? params.get('tab') : 'contributions'
  const t = useMemo(() => {
    const pos = companyPosition(data, today)
    return { contributed: sum(pos.balances, (b) => b.contributed), repaid: sum(pos.balances, (b) => b.reimbursed), pending: pos.pendingReimbursements, owed: pos.membersOweCompany }
  }, [data, today])

  return (
    <div className="space-y-4">
      <PageHeader title="Member Contributions & Repayments" subtitle="Personal money spent for Levrotec, repayments made, and company money members hold">
        <Button variant="secondary" onClick={() => modals.open({ kind: 'advance', action: 'add' })}><UserMinus size={16} /> Member Advance</Button>
        <Button onClick={() => modals.open({ kind: 'reimbursement', action: 'add' })}><Plus size={16} /> Record Repayment</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Contributed" value={formatCurrency(t.contributed)} icon={HandCoins} />
        <StatCard label="Total Repaid" value={formatCurrency(t.repaid)} accent="positive" />
        <StatCard label="Pending Repayment" value={formatCurrency(t.pending)} accent="attention" sub="Levrotec owes members" />
        <StatCard label="Members Owe Levrotec" value={formatCurrency(t.owed)} icon={UserMinus} sub="advances not yet returned" />
      </div>
      <Tabs value={tab} onChange={(id) => setParams({ ...(id === 'contributions' ? {} : { tab: id }), ...filtersFromParams(params, ['member']) }, { replace: true })}
        tabs={[{ id: 'contributions', label: 'Contributions', count: data.expenses.filter((e) => e.paid_by_member_id).length }, { id: 'repayments', label: 'Repayments', count: data.reimbursements.length }, { id: 'advances', label: 'Member Advances', count: data.advances.length }]} />
      <ContributionsPanel key={params.toString()} view={tab} modals={modals} initial={filtersFromParams(params, ['member', 'project'])} />
      {modals.element}
    </div>
  )
}
