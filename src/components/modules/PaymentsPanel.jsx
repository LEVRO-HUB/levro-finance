import { useMemo } from 'react'
import { Banknote } from 'lucide-react'
import { Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { KebabMenu } from '../ui/KebabMenu'
import { SearchInput } from '../ui/misc'
import { DateRangeFilter, FilterBar, FilterSelect } from '../ui/Filters'
import { DEFAULT_RANGE, is, matches, useFilters } from '../../hooks/useFilters'
import { useData } from '../../store/DataProvider'
import { sum } from '../../calculations/finance'
import { INCOME_TYPES } from '../../services/schema'
import { inRange } from '../../lib/dates'
import { formatCurrency, formatDate } from '../../lib/format'

const typeLabel = (id) => INCOME_TYPES.find((t) => t.id === id)?.label ?? id

// Actual payment records (money in). Recording a payment never edits an invoice amount.
export function PaymentsPanel({ projectId, modals }) {
  const { data, sortedProjects, projectName, methodNames } = useData()
  const { filters, set, reset, activeCount, range } = useFilters({ q: '', range: DEFAULT_RANGE, type: 'All', project: 'All', method: 'All', linked: 'All' })
  const invoiceNo = useMemo(() => new Map(data.invoices.map((i) => [i.id, i.invoice_number])), [data.invoices])
  const scoped = useMemo(() => data.income.filter((i) => !projectId || i.project_id === projectId)
    .sort((a, b) => (a.date === b.date ? String(b.created_at).localeCompare(String(a.created_at)) : a.date < b.date ? 1 : -1)), [data.income, projectId])
  const rows = useMemo(() => scoped.filter((p) =>
    inRange(p.date, range) && is(filters.type, p.type) && is(filters.method, p.payment_method) &&
    (filters.project === 'All' || (filters.project === '__none__' ? !p.project_id : p.project_id === filters.project)) &&
    (filters.linked === 'All' || (filters.linked === 'invoice' ? !!p.invoice_id : !p.invoice_id)) &&
    matches(filters.q, p.code, p.description, p.reference, p.notes, projectName(p.project_id), invoiceNo.get(p.invoice_id), p.amount)), [scoped, filters, range, projectName, invoiceNo])

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${scoped.length} payments · Total received ${formatCurrency(sum(rows))}`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search payments…" />
        <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />
        <FilterSelect label="Types" value={filters.type} onChange={(v) => set('type', v)} options={INCOME_TYPES.map((t) => ({ value: t.id, label: t.label }))} width="w-44" />
        {!projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={[{ value: '__none__', label: 'No project' }, ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} width="w-44" />}
        <FilterSelect label="Methods" allLabel="Any method" value={filters.method} onChange={(v) => set('method', v)} options={methodNames} width="w-36" />
        <FilterSelect label="Invoice link" allLabel="With or without invoice" value={filters.linked} onChange={(v) => set('linked', v)} options={[{ value: 'invoice', label: 'Against an invoice' }, { value: 'direct', label: 'Direct (no invoice)' }]} width="w-52" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={Banknote} title={scoped.length ? 'No payments match these filters' : 'No payments recorded yet'} />
      ) : (
        <Table more={page.more} columns={['ID', 'Date', 'Description', 'Type', ...(projectId ? [] : ['Project']), 'Invoice', 'Method', 'Reference', { label: 'Amount', align: 'right' }, '']}
          footer={<tr><Td colSpan={projectId ? 7 : 8}>Total received</Td><Td right className="text-emerald-600">{formatCurrency(sum(rows))}</Td><Td /></tr>}>
          {page.visible.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50/60">
              <Td className="font-mono text-xs text-slate-500">{p.code}</Td><Td>{formatDate(p.date)}</Td>
              <Td className="max-w-[240px] truncate font-medium text-slate-900">{p.description || typeLabel(p.type)}</Td><Td>{typeLabel(p.type)}</Td>
              {!projectId && <Td>{projectName(p.project_id) ?? '—'}</Td>}
              <Td>{invoiceNo.get(p.invoice_id) ?? '—'}</Td><Td>{p.payment_method || '—'}</Td><Td>{p.reference || '—'}</Td>
              <Td right className="font-medium text-emerald-600">+{formatCurrency(p.amount)}</Td>
              <Td right><KebabMenu items={[{ label: 'Edit', onClick: () => modals.open({ kind: 'income', action: 'edit', record: p }) }, modals.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: 'income', action: 'delete', record: p }) }]} /></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
