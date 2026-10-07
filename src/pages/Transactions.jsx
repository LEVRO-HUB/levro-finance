import { useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/misc'
import { LedgerPanel } from '../components/modules/LedgerPanel'
import { filtersFromParams } from '../hooks/useFilters'
import { useRecordModals } from '../components/modules/RecordModals'

export function Transactions() {
  const [params] = useSearchParams()
  const modals = useRecordModals()
  const q = params.get('q') ?? ''
  return (
    <div className="space-y-4">
      <PageHeader title="All Transactions" subtitle="Every financial event in one ledger — view, search and filter">
        <Button variant="secondary" onClick={() => modals.open({ kind: 'reimbursement', action: 'add' })}><HandCoins size={16} /> Reimburse</Button>
        <Button variant="secondary" onClick={() => modals.open({ kind: 'expense', action: 'add' })}><ArrowUpRight size={16} /> Money Out</Button>
        <Button onClick={() => modals.open({ kind: 'income', action: 'add' })}><ArrowDownLeft size={16} /> Money In</Button>
      </PageHeader>
      <LedgerPanel key={params.toString()} modals={modals} initialSearch={q} initial={filtersFromParams(params, ['project', 'member', 'type', 'category', 'flow'])} />
      {modals.element}
    </div>
  )
}
