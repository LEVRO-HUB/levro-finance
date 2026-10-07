import { useMemo } from 'react'
import { HandCoins } from 'lucide-react'
import { Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { KebabMenu } from '../ui/KebabMenu'
import { SearchInput } from '../ui/misc'
import { DateRangeFilter, FilterBar, FilterSelect } from '../ui/Filters'
import { DEFAULT_RANGE, is, matches, useFilters } from '../../hooks/useFilters'
import { InvoiceLink, MemberLink, ProjectLink } from '../ui/links'
import { useData } from '../../store/DataProvider'
import { reimbursementState, sum } from '../../calculations/finance'
import { REIMBURSEMENT_STATUSES } from '../../services/schema'
import { inRange } from '../../lib/dates'
import { formatCurrency, formatDate } from '../../lib/format'

// view: 'contributions' (personally-paid expenses) | 'repayments' | 'advances'
export function ContributionsPanel({ view = 'contributions', projectId, modals, initial }) {
  const { data, sortedProjects, projectName, memberName } = useData()
  const { filters, set, reset, activeCount, range } = useFilters({ q: '', range: DEFAULT_RANGE, member: 'All', project: 'All', status: 'All', direction: 'All' }, initial)
  const expenseById = useMemo(() => new Map(data.expenses.map((e) => [e.id, e])), [data.expenses])
  const byDate = (key) => (a, b) => (a[key] === b[key] ? String(b.created_at).localeCompare(String(a.created_at)) : a[key] < b[key] ? 1 : -1)
  const projectMatch = (id) => filters.project === 'All' || (filters.project === '__company__' ? !id : id === filters.project)

  const all = useMemo(() => {
    if (view === 'contributions') return data.expenses.filter((e) => e.paid_by_member_id && (!projectId || e.project_id === projectId)).map((e) => ({ ...e, st: reimbursementState(e, data.reimbursements) })).sort(byDate('date'))
    if (view === 'repayments') return data.reimbursements.map((r) => ({ ...r, expense: expenseById.get(r.expense_id) })).filter((r) => !projectId || r.expense?.project_id === projectId).sort(byDate('paid_date'))
    return [...data.advances].sort(byDate('date'))
  }, [view, data, projectId, expenseById])

  const rows = useMemo(() => all.filter((r) => {
    if (view === 'contributions') return inRange(r.date, range) && is(filters.member, r.paid_by_member_id) && projectMatch(r.project_id) && is(filters.status, r.st.status) && matches(filters.q, r.code, r.title, r.category, memberName(r.paid_by_member_id), projectName(r.project_id), r.amount)
    if (view === 'repayments') return inRange(r.paid_date, range) && is(filters.member, r.member_id) && projectMatch(r.expense?.project_id) && matches(filters.q, r.code, r.expense?.title, r.reference, r.notes, memberName(r.member_id), r.amount)
    return inRange(r.date, range) && is(filters.member, r.member_id) && is(filters.direction, r.direction) && matches(filters.q, r.code, r.notes, r.reference, memberName(r.member_id), r.amount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [all, view, filters, range])

  const summary = view === 'contributions'
    ? `${rows.length} of ${all.length} contributions · Contributed ${formatCurrency(sum(rows))} · Pending ${formatCurrency(sum(rows, (r) => r.st.owed))}`
    : view === 'repayments' ? `${rows.length} of ${all.length} repayments · Repaid ${formatCurrency(sum(rows))}`
      : `${rows.length} of ${all.length} entries · Given ${formatCurrency(sum(rows.filter((r) => r.direction === 'given')))} · Returned ${formatCurrency(sum(rows.filter((r) => r.direction === 'returned')))}`

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={summary}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} />
        <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />
        <FilterSelect label="Members" value={filters.member} onChange={(v) => set('member', v)} options={data.members.map((m) => ({ value: m.id, label: m.name }))} />
        {view !== 'advances' && !projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={[{ value: '__company__', label: 'Company (no project)' }, ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} width="w-44" />}
        {view === 'contributions' && <FilterSelect label="Statuses" value={filters.status} onChange={(v) => set('status', v)} options={REIMBURSEMENT_STATUSES} width="w-48" />}
        {view === 'advances' && <FilterSelect label="Types" value={filters.direction} onChange={(v) => set('direction', v)} options={[{ value: 'given', label: 'Advance given' }, { value: 'returned', label: 'Returned' }]} />}
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={HandCoins} title={all.length ? 'Nothing matches these filters' : view === 'contributions' ? 'No personal spending recorded' : view === 'repayments' ? 'No repayments recorded yet' : 'No member advances recorded'}
          description={all.length ? undefined : view === 'contributions' ? 'Add an expense and choose a member under “Paid By” to track it here.' : view === 'advances' ? 'Record an advance when a member is holding company money.' : undefined} />
      ) : view === 'contributions' ? (
        <Table more={page.more} columns={['Date', 'Member', 'Purpose', ...(projectId ? [] : ['Project']), { label: 'Amount', align: 'right' }, { label: 'Reimbursed', align: 'right' }, { label: 'Levrotec Owes', align: 'right' }, 'Status', '']}>
          {page.visible.map((c) => (
            <tr key={c.id}>
              <Td>{formatDate(c.date)}</Td><Td className="font-medium text-slate-900"><MemberLink id={c.paid_by_member_id} /></Td><Td className="max-w-[240px] truncate">{c.title}</Td>
              {!projectId && <Td><ProjectLink id={c.project_id} fallback="Company" /></Td>}
              <Td right>{formatCurrency(c.amount)}</Td><Td right className="text-emerald-600">{formatCurrency(c.st.reimbursed)}</Td>
              <Td right className={c.st.owed > 0 ? 'font-medium text-amber-600' : ''}>{formatCurrency(c.st.owed)}</Td><Td><StatusBadge status={c.st.status} /></Td>
              <Td right><KebabMenu items={[
                c.st.owed > 0 && { label: 'Record repayment', onClick: () => modals.open({ kind: 'reimbursement', action: 'add', expense: c }) },
                { label: 'Edit expense', onClick: () => modals.open({ kind: 'expense', action: 'edit', record: c }) },
              ]} /></Td>
            </tr>
          ))}
        </Table>
      ) : view === 'repayments' ? (
        <Table more={page.more} columns={['ID', 'Date', 'Member', 'For Expense', ...(projectId ? [] : ['Project']), 'Method', 'Reference', { label: 'Amount', align: 'right' }, '']}>
          {page.visible.map((r) => (
            <tr key={r.id}>
              <Td className="font-mono text-xs text-slate-500">{r.code}</Td><Td>{formatDate(r.paid_date)}</Td><Td className="font-medium text-slate-900"><MemberLink id={r.member_id} /></Td>
              <Td className="max-w-[240px] truncate">{r.expense?.title ?? '—'}</Td>{!projectId && <Td><ProjectLink id={r.expense?.project_id} fallback="Company" /></Td>}
              <Td>{r.payment_method || '—'}</Td><Td>{r.reference || '—'}</Td><Td right className="text-emerald-600">{formatCurrency(r.amount)}</Td>
              <Td right><KebabMenu items={[modals.canDelete && { label: 'Delete repayment', danger: true, onClick: () => modals.open({ kind: 'reimbursement', action: 'delete', record: r }) }]} /></Td>
            </tr>
          ))}
        </Table>
      ) : (
        <Table more={page.more} columns={['ID', 'Date', 'Member', 'Type', 'Purpose / Notes', 'Method', { label: 'Amount', align: 'right' }, '']}>
          {page.visible.map((a) => (
            <tr key={a.id}>
              <Td className="font-mono text-xs text-slate-500">{a.code}</Td><Td>{formatDate(a.date)}</Td><Td className="font-medium text-slate-900"><MemberLink id={a.member_id} /></Td>
              <Td>{a.direction === 'given' ? 'Advance given' : 'Returned by member'}</Td><Td className="max-w-[260px] truncate">{a.notes || '—'}</Td><Td>{a.payment_method || '—'}</Td>
              <Td right className={a.direction === 'given' ? 'text-red-500' : 'text-emerald-600'}>{a.direction === 'given' ? '−' : '+'}{formatCurrency(a.amount)}</Td>
              <Td right><KebabMenu items={[{ label: 'Edit', onClick: () => modals.open({ kind: 'advance', action: 'edit', record: a }) }, modals.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: 'advance', action: 'delete', record: a }) }]} /></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
