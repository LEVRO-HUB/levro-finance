import { useEffect, useMemo } from 'react'
import { Paperclip, Receipt } from 'lucide-react'
import { Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { KebabMenu } from '../ui/KebabMenu'
import { SearchInput } from '../ui/misc'
import { DateRangeFilter, FilterBar, FilterSelect } from '../ui/Filters'
import { useFileActions } from '../forms/DocumentModals'
import { DEFAULT_RANGE, is, matches, useFilters } from '../../hooks/useFilters'
import { InvoiceLink, MemberLink, ProjectLink } from '../ui/links'
import { useData } from '../../store/DataProvider'
import { paymentSource, reimbursementState, sum } from '../../calculations/finance'
import { EXPENSE_TYPES, REIMBURSEMENT_STATUSES } from '../../services/schema'
import { inRange } from '../../lib/dates'
import { formatCurrency, formatDate } from '../../lib/format'

export const expenseTypeLabel = (id) => EXPENSE_TYPES.find((t) => t.id === id)?.label ?? id

// variant: 'all' | 'payout' (company-paid to a recipient) | 'purchase' (assets register)
export function ExpensesPanel({ projectId, variant = 'all', modals, defaultRange = DEFAULT_RANGE, onFiltered, initial }) {
  const { data, sortedProjects, projectName, memberName, categoryNames } = useData()
  const files = useFileActions()
  const { filters, set, reset, activeCount, range } = useFilters({ q: '', range: defaultRange, category: 'All', project: 'All', type: 'All', paidBy: 'All', source: 'All', reimb: 'All' }, initial)

  const scoped = useMemo(() => data.expenses.filter((e) =>
    (!projectId || e.project_id === projectId) &&
    (variant === 'all' || (variant === 'purchase' ? e.expense_type === 'company_purchase' : !e.paid_by_member_id && e.recipient && e.expense_type !== 'company_purchase')),
  ).map((e) => ({ ...e, reimb: reimbursementState(e, data.reimbursements), source: paymentSource(e) }))
    .sort((a, b) => (a.date === b.date ? String(b.created_at).localeCompare(String(a.created_at)) : a.date < b.date ? 1 : -1)), [data, projectId, variant])

  const rows = useMemo(() => {
    const out = scoped.filter((e) =>
      inRange(e.date, range) && is(filters.category, e.category) && is(filters.type, e.expense_type) && is(filters.source, e.source) &&
      (filters.project === 'All' || (filters.project === '__company__' ? !e.project_id : e.project_id === filters.project)) &&
      (filters.paidBy === 'All' || (filters.paidBy === '__company__' ? !e.paid_by_member_id : e.paid_by_member_id === filters.paidBy || e.purchased_by_member_id === filters.paidBy)) &&
      (filters.reimb === 'All' || (e.reimb.applicable && e.reimb.status === filters.reimb)) &&
      matches(filters.q, e.code, e.title, e.description, e.recipient, e.reference, e.category, projectName(e.project_id), memberName(e.paid_by_member_id), e.amount),
    )
    return out
  }, [scoped, filters, range, projectName, memberName])
  useEffect(() => { onFiltered?.(rows, filters.range.preset) }, [rows, filters.range.preset]) // eslint-disable-line react-hooks/exhaustive-deps

  const receipt = (e) => {
    const v = e.receipt_document_id && data.document_versions.filter((x) => x.document_id === e.receipt_document_id).sort((a, b) => b.version - a.version)[0]
    return v ? <button type="button" title="View receipt" aria-label="View receipt" className="min-h-0 text-slate-400 hover:text-blue-600" onClick={() => files.view(v)}><Paperclip size={13} /></button> : null
  }
  const nouns = { all: 'expenses', payout: 'pay outs', purchase: 'purchases' }
  const cols = variant === 'payout'
    ? ['Date', 'Recipient', 'Purpose', 'Category', { label: 'Amount', align: 'right' }, ...(projectId ? [] : ['Project']), 'Method', '']
    : variant === 'purchase'
      ? ['Purchase Date', 'Asset / Purchase', 'Category', { label: 'Amount', align: 'right' }, 'Vendor', 'Purchased By', 'Payment Source', ...(projectId ? [] : ['Project']), 'Asset', '']
      : ['Date', 'Title', 'Type', 'Category', { label: 'Amount', align: 'right' }, ...(projectId ? [] : ['Project']), 'Paid By', 'Payment', 'Reimbursement', '']

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${scoped.length} ${nouns[variant]} · Total ${formatCurrency(sum(rows))}`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} />
        <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />
        <FilterSelect label="Categories" value={filters.category} onChange={(v) => set('category', v)} options={categoryNames} />
        {!projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={[{ value: '__company__', label: 'Company (no project)' }, ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} width="w-44" />}
        {variant === 'all' && !projectId && <FilterSelect label="Types" value={filters.type} onChange={(v) => set('type', v)} options={EXPENSE_TYPES.map((t) => ({ value: t.id, label: t.label }))} width="w-44" />}
        {variant !== 'payout' && <FilterSelect label={variant === 'purchase' ? 'Purchased by' : 'Paid by'} allLabel={variant === 'purchase' ? 'Anyone' : 'Paid by anyone'} value={filters.paidBy} onChange={(v) => set('paidBy', v)} options={[{ value: '__company__', label: 'Company' }, ...data.members.map((m) => ({ value: m.id, label: m.name }))]} />}
        {variant !== 'payout' && <FilterSelect label="Sources" allLabel="Any payment source" value={filters.source} onChange={(v) => set('source', v)} options={['Company', 'Personal']} width="w-44" />}
        {variant === 'all' && <FilterSelect label="Reimbursement" allLabel="Any reimbursement status" value={filters.reimb} onChange={(v) => set('reimb', v)} options={REIMBURSEMENT_STATUSES} width="w-52" />}
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={Receipt} title={scoped.length ? `No ${nouns[variant]} match these filters` : `No ${nouns[variant]} yet`} description={scoped.length ? 'Try resetting the filters.' : undefined} />
      ) : (
        <Table more={page.more} columns={cols}>
          {page.visible.map((e) => {
            const menu = (
              <KebabMenu items={[
                { label: 'Edit', onClick: () => modals.open({ kind: 'expense', action: 'edit', record: e, mode: variant === 'payout' ? 'payout' : 'expense' }) },
                e.reimb.owed > 0 && { label: 'Reimburse member', onClick: () => modals.open({ kind: 'reimbursement', action: 'add', expense: e }) },
                modals.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: 'expense', action: 'delete', record: e }) },
              ]} />
            )
            const title = <div className="flex items-center gap-1.5"><span className="max-w-[240px] truncate">{e.title}</span>{receipt(e)}</div>
            const project = !projectId && <Td><ProjectLink id={e.project_id} /></Td>
            if (variant === 'payout') return (
              <tr key={e.id}><Td>{formatDate(e.date)}</Td><Td className="font-medium text-slate-900">{e.recipient}</Td><Td>{title}</Td><Td>{e.category}</Td><Td right>{formatCurrency(e.amount)}</Td>{project}<Td>{e.payment_method || '—'}</Td><Td right>{menu}</Td></tr>
            )
            if (variant === 'purchase') return (
              <tr key={e.id}><Td>{formatDate(e.date)}</Td><Td className="font-medium text-slate-900">{title}</Td><Td>{e.category}</Td><Td right>{formatCurrency(e.amount)}</Td><Td>{e.recipient || '—'}</Td>
                <Td><MemberLink id={e.purchased_by_member_id ?? e.paid_by_member_id} /></Td><Td><StatusBadge status={e.source} /></Td>{project}<Td>{e.is_asset ? 'Yes' : 'No'}</Td><Td right>{menu}</Td></tr>
            )
            return (
              <tr key={e.id}>
                <Td>{formatDate(e.date)}</Td><Td className="font-medium text-slate-900">{title}</Td><Td>{expenseTypeLabel(e.expense_type)}</Td><Td>{e.category}</Td><Td right>{formatCurrency(e.amount)}</Td>{project}
                <Td><MemberLink id={e.paid_by_member_id} fallback="Company" to="contributions" /></Td><Td><StatusBadge status={e.source} /></Td>
                <Td>{e.reimb.applicable ? <span className="inline-flex items-center gap-2"><StatusBadge status={e.reimb.status} />{e.reimb.owed > 0 && <span className="text-xs tabular-nums text-amber-600">{formatCurrency(e.reimb.owed)} due</span>}</span> : <span className="text-slate-300">—</span>}</Td>
                <Td right>{menu}</Td>
              </tr>
            )
          })}
        </Table>
      )}
    </div>
  )
}
