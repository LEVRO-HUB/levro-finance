import { useMemo, useState } from 'react'
import { ArrowLeftRight, Download } from 'lucide-react'
import { Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { KebabMenu } from '../ui/KebabMenu'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Amount, SearchInput } from '../ui/misc'
import { DateRangeFilter, FilterBar, FilterSelect } from '../ui/Filters'
import { DEFAULT_RANGE, is, matches, useFilters } from '../../hooks/useFilters'
import { useData } from '../../store/DataProvider'
import { LEDGER_TYPES, sum } from '../../calculations/finance'
import { REIMBURSEMENT_STATUSES } from '../../services/schema'
import { inRange } from '../../lib/dates'
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format'
import { downloadCSV } from '../../lib/csv'

const sign = (r) => (r.direction === 'in' ? '+' : r.direction === 'out' ? '−' : '')

function Detail({ row, onClose }) {
  const { projectName, memberName } = useData()
  if (!row) return null
  const fields = [
    ['Transaction ID', row.code], ['Date', formatDate(row.date)], ['Type', row.type], ['Category', row.category],
    ['Amount', `${sign(row)}${formatCurrency(row.amount)}`], ['Project', projectName(row.project_id) ?? 'Company'], ['Member', memberName(row.member_id) ?? '—'],
    ['Payment Method', row.payment_method || '—'], ['Payment Source', row.payment_source], ['Description', row.description || '—'],
    ['Reference', row.reference || '—'], ['Notes', row.notes || '—'], ['Created At', formatDateTime(row.created_at)],
  ]
  return (
    <Modal open onClose={onClose} title={`Transaction ${row.code}`}>
      <dl className="divide-y divide-slate-100 text-sm">
        {fields.map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-slate-900">{v}</dd></div>)}
      </dl>
      {row.direction === 'none' && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Paid from personal money — no company cash has moved yet. Status: {row.reimbursement_status}.</p>}
    </Modal>
  )
}

// The unified transaction ledger. `projectId` scopes it to one project (and hides that filter).
export function LedgerPanel({ projectId, modals, initialSearch = '' }) {
  const { data, ledger, sortedProjects, projectName, memberName, categoryNames, methodNames } = useData()
  const { filters, set, reset, activeCount, range } = useFilters({ q: initialSearch, range: DEFAULT_RANGE, flow: 'All', type: 'All', category: 'All', project: 'All', member: 'All', source: 'All', method: 'All', reimb: 'All' })
  const [detail, setDetail] = useState(null)

  const scoped = useMemo(() => (projectId ? ledger.filter((r) => r.project_id === projectId) : ledger), [ledger, projectId])
  const rows = useMemo(() => scoped.filter((r) =>
    inRange(r.date, range) && is(filters.flow, r.flow) && is(filters.type, r.type) && is(filters.category, r.category) &&
    (filters.project === 'All' || (filters.project === '__company__' ? !r.project_id : r.project_id === filters.project)) &&
    is(filters.member, r.member_id) && is(filters.source, r.payment_source) && is(filters.method, r.payment_method) && is(filters.reimb, r.reimbursement_status) &&
    matches(filters.q, r.code, r.description, r.reference, r.notes, r.category, r.type, projectName(r.project_id), memberName(r.member_id), r.amount),
  ), [scoped, filters, range, projectName, memberName])

  const cashIn = sum(rows.filter((r) => r.cash > 0), (r) => r.cash)
  const cashOut = sum(rows.filter((r) => r.cash < 0), (r) => -r.cash)
  const categories = useMemo(() => [...new Set([...categoryNames, ...scoped.map((r) => r.category)])].sort(), [categoryNames, scoped])

  const find = { income: data.income, expense: data.expenses, reimbursement: data.reimbursements, advance: data.advances }
  const menu = (r) => {
    const record = find[r.kind].find((x) => x.id === r.refId)
    return [
      { label: 'View details', onClick: () => setDetail(r) },
      modals && r.kind !== 'reimbursement' && { label: 'Edit', onClick: () => modals.open({ kind: r.kind, action: 'edit', record }) },
      modals?.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: r.kind, action: 'delete', record }) },
    ]
  }

  function exportCSV() {
    downloadCSV('transactions.csv', [
      { label: 'Transaction ID', value: (r) => r.code }, { label: 'Date', value: (r) => r.date }, { label: 'Type', value: (r) => r.type },
      { label: 'Category', value: (r) => r.category }, { label: 'Amount', value: (r) => r.amount }, { label: 'Cash effect', value: (r) => r.cash },
      { label: 'Project', value: (r) => projectName(r.project_id) ?? '' }, { label: 'Member', value: (r) => memberName(r.member_id) ?? '' },
      { label: 'Payment Method', value: (r) => r.payment_method }, { label: 'Payment Source', value: (r) => r.payment_source },
      { label: 'Description', value: (r) => r.description }, { label: 'Reference', value: (r) => r.reference }, { label: 'Notes', value: (r) => r.notes }, { label: 'Created At', value: (r) => r.created_at },
    ], rows)
  }

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${scoped.length} transactions · Money in ${formatCurrency(cashIn)} · Money out ${formatCurrency(cashOut)} · Net cash ${formatCurrency(cashIn - cashOut)}`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search transactions…" />
        <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />
        <FilterSelect label="Flow" allLabel="In & out" value={filters.flow} onChange={(v) => set('flow', v)} options={['Money In', 'Money Out']} width="w-32" />
        <FilterSelect label="Types" value={filters.type} onChange={(v) => set('type', v)} options={LEDGER_TYPES} width="w-44" />
        <FilterSelect label="Categories" value={filters.category} onChange={(v) => set('category', v)} options={categories} />
        {!projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={[{ value: '__company__', label: 'Company (no project)' }, ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} width="w-44" />}
        <FilterSelect label="Members" value={filters.member} onChange={(v) => set('member', v)} options={data.members.map((m) => ({ value: m.id, label: m.name }))} />
        <FilterSelect label="Sources" allLabel="Any payment source" value={filters.source} onChange={(v) => set('source', v)} options={['Company', 'Personal']} width="w-44" />
        <FilterSelect label="Methods" allLabel="Any method" value={filters.method} onChange={(v) => set('method', v)} options={methodNames} width="w-36" />
        <FilterSelect label="Reimbursement" allLabel="Any reimbursement status" value={filters.reimb} onChange={(v) => set('reimb', v)} options={REIMBURSEMENT_STATUSES} width="w-52" />
        <Button variant="secondary" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> CSV</Button>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title={scoped.length ? 'No transactions match these filters' : 'No transactions yet'} description={scoped.length ? 'Try widening the date range or resetting the filters.' : 'Money in and money out will appear here as you record it.'} />
      ) : (
        <Table more={page.more} columns={['ID', 'Date', 'Description', 'Type', 'Category', { label: 'Amount', align: 'right' }, ...(projectId ? [] : ['Project']), 'Member', 'Method', 'Source', '']}>
          {page.visible.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/60">
              <Td className="font-mono text-xs text-slate-500">{r.code}</Td>
              <Td>{formatDate(r.date)}</Td>
              <Td className="max-w-[260px] truncate font-medium text-slate-900"><button type="button" className="min-h-0 max-w-full truncate text-left hover:text-blue-600" onClick={() => setDetail(r)}>{r.description}</button></Td>
              <Td><span className={r.direction === 'in' ? 'text-emerald-700' : r.direction === 'out' ? 'text-red-600' : 'text-blue-700'}>{r.type}</span>{r.reimbursement_status && <StatusBadge status={r.reimbursement_status} className="ml-2" />}</Td>
              <Td>{r.category}</Td>
              <Td right><Amount direction={r.direction} value={`${sign(r)}${formatCurrency(r.amount)}`} className="font-medium" /></Td>
              {!projectId && <Td>{projectName(r.project_id) ?? '—'}</Td>}
              <Td>{memberName(r.member_id) ?? '—'}</Td>
              <Td>{r.payment_method || '—'}</Td>
              <Td><StatusBadge status={r.payment_source} /></Td>
              <Td right><KebabMenu items={menu(r)} /></Td>
            </tr>
          ))}
        </Table>
      )}
      <Detail row={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
