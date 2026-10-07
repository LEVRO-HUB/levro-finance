import { useMemo, useState } from 'react'
import { FileSpreadsheet, Paperclip } from 'lucide-react'
import { Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { StatusBadge } from '../ui/StatusBadge'
import { KebabMenu } from '../ui/KebabMenu'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/misc'
import { DateRangeFilter, FilterBar, FilterSelect } from '../ui/Filters'
import { useFileActions } from '../forms/DocumentModals'
import { DEFAULT_RANGE, is, matches, useFilters } from '../../hooks/useFilters'
import { useData } from '../../store/DataProvider'
import { invoiceState, sum } from '../../calculations/finance'
import { INVOICE_STATUSES } from '../../services/schema'
import { inRange } from '../../lib/dates'
import { formatCurrency, formatDate } from '../../lib/format'

function InvoiceDetail({ invoiceId, onClose, modals }) {
  const { data, today, projectName } = useData()
  const inv = data.invoices.find((i) => i.id === invoiceId)
  if (!inv) return null
  const st = invoiceState(inv, data.income, today)
  const rows = [['Project', projectName(inv.project_id)], ['Client', inv.client_name || '—'], ['Invoice Date', formatDate(inv.invoice_date)], ['Due Date', formatDate(inv.due_date) || '—'],
    ['Amount', formatCurrency(inv.amount)], ['Tax', formatCurrency(inv.tax_amount)], ['Total', formatCurrency(st.total)], ...(st.tds ? [['TDS deducted', formatCurrency(st.tds)]] : []),
    ['Received', formatCurrency(st.paid)], ['Outstanding', formatCurrency(st.outstanding)]]
  return (
    <Modal open onClose={onClose} title={`Invoice ${inv.invoice_number}`} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={st.status} /><span className="text-xs text-slate-500">Payment: {st.paymentStatus}</span></div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-slate-400">{k}</dt><dd className="font-medium tabular-nums text-slate-900">{v}</dd></div>)}
      </dl>
      {inv.notes && <p className="mt-3 text-sm text-slate-600">{inv.notes}</p>}
      <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-700">Payments received</h3>
      {st.payments.length === 0 ? <p className="text-sm text-slate-400">No payments recorded against this invoice yet.</p> : (
        <Table columns={['ID', 'Date', 'Method', 'Reference', { label: 'Amount', align: 'right' }, '']}
          footer={<tr><Td colSpan={4}>Outstanding</Td><Td right className="text-amber-600">{formatCurrency(st.outstanding)}</Td><Td /></tr>}>
          {[...st.payments].sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => (
            <tr key={p.id}><Td className="font-mono text-xs text-slate-500">{p.code}</Td><Td>{formatDate(p.date)}</Td><Td>{p.payment_method}</Td><Td>{p.reference || '—'}</Td><Td right className="text-emerald-600">{formatCurrency(p.amount)}</Td>
              <Td right><KebabMenu items={[{ label: 'Edit payment', onClick: () => modals.open({ kind: 'income', action: 'edit', record: p }) }, modals.canDelete && { label: 'Delete payment', danger: true, onClick: () => modals.open({ kind: 'income', action: 'delete', record: p }) }]} /></Td></tr>
          ))}
        </Table>
      )}
      {st.outstanding > 0 && st.status !== 'Cancelled' && <div className="mt-4 flex justify-end"><Button onClick={() => modals.open({ kind: 'income', action: 'add', invoice: inv })}>Record Payment</Button></div>}
    </Modal>
  )
}

export function InvoicesPanel({ projectId, modals, initialStatus = 'All' }) {
  const { data, today, sortedProjects, projectName } = useData()
  const files = useFileActions()
  const { filters, set, reset, activeCount, range } = useFilters({ q: '', range: DEFAULT_RANGE, project: 'All', status: initialStatus, payment: 'All' })
  const [detailId, setDetailId] = useState(null)

  const scoped = useMemo(() => data.invoices.filter((i) => !projectId || i.project_id === projectId)
    .map((i) => ({ ...i, st: invoiceState(i, data.income, today) }))
    .sort((a, b) => (a.invoice_date === b.invoice_date ? b.invoice_number.localeCompare(a.invoice_number) : a.invoice_date < b.invoice_date ? 1 : -1)), [data, projectId, today])
  const rows = useMemo(() => scoped.filter((i) =>
    inRange(i.invoice_date, range) && is(filters.project, i.project_id) && is(filters.status, i.st.status) && is(filters.payment, i.st.paymentStatus) &&
    matches(filters.q, i.invoice_number, i.client_name, i.notes, projectName(i.project_id), i.st.total)), [scoped, filters, range, projectName])

  const live = rows.filter((i) => i.st.status !== 'Cancelled')
  const totals = { invoiced: sum(live, (i) => i.st.total), received: sum(live, (i) => i.st.paid), outstanding: sum(live, (i) => i.st.outstanding), overdue: sum(live.filter((i) => i.st.overdue), (i) => i.st.outstanding) }
  const attachment = (i) => {
    const v = i.attachment_document_id && data.document_versions.filter((x) => x.document_id === i.attachment_document_id).sort((a, b) => b.version - a.version)[0]
    return v ? <button type="button" title="View attachment" aria-label="View attachment" className="ml-1.5 min-h-0 text-slate-400 hover:text-blue-600" onClick={() => files.view(v)}><Paperclip size={13} /></button> : null
  }

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${scoped.length} invoices · Invoiced ${formatCurrency(totals.invoiced)} · Received ${formatCurrency(totals.received)} · Outstanding ${formatCurrency(totals.outstanding)}`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search invoices…" />
        <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />
        {!projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={sortedProjects.map((p) => ({ value: p.id, label: p.name }))} width="w-44" />}
        <FilterSelect label="Statuses" value={filters.status} onChange={(v) => set('status', v)} options={INVOICE_STATUSES} />
        <FilterSelect label="Payment" allLabel="Any payment status" value={filters.payment} onChange={(v) => set('payment', v)} options={['Unpaid', 'Partially Paid', 'Paid']} width="w-44" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title={scoped.length ? 'No invoices match these filters' : 'No invoices yet'} description={scoped.length ? undefined : 'Create an invoice to start tracking what clients owe.'} />
      ) : (
        <Table more={page.more} columns={['Invoice #', ...(projectId ? [] : ['Project', 'Client']), 'Invoice Date', 'Due Date', { label: 'Amount', align: 'right' }, { label: 'Tax', align: 'right' }, { label: 'Total', align: 'right' }, { label: 'Received', align: 'right' }, { label: 'Outstanding', align: 'right' }, 'Status', 'Payment', '']}>
          {page.visible.map((i) => (
            <tr key={i.id} className="hover:bg-slate-50/60">
              <Td className="font-medium text-slate-900"><button type="button" className="min-h-0 hover:text-blue-600" onClick={() => setDetailId(i.id)}>{i.invoice_number}</button>{attachment(i)}</Td>
              {!projectId && <><Td>{projectName(i.project_id)}</Td><Td>{i.client_name || '—'}</Td></>}
              <Td>{formatDate(i.invoice_date)}</Td><Td>{formatDate(i.due_date) || '—'}</Td>
              <Td right>{formatCurrency(i.amount)}</Td><Td right>{formatCurrency(i.tax_amount)}</Td><Td right className="font-medium text-slate-900">{formatCurrency(i.st.total)}</Td>
              <Td right className="text-emerald-600">{formatCurrency(i.st.paid)}</Td><Td right className={i.st.outstanding > 0 ? 'text-amber-600' : ''}>{formatCurrency(i.st.outstanding)}</Td>
              <Td><StatusBadge status={i.st.status} /></Td><Td><StatusBadge status={i.st.paymentStatus} /></Td>
              <Td right><KebabMenu items={[
                { label: 'View', onClick: () => setDetailId(i.id) },
                i.st.outstanding > 0 && i.st.status !== 'Cancelled' && { label: 'Record payment', onClick: () => modals.open({ kind: 'income', action: 'add', invoice: i }) },
                { label: 'Edit', onClick: () => modals.open({ kind: 'invoice', action: 'edit', record: i }) },
                modals.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: 'invoice', action: 'delete', record: i }) },
              ]} /></Td>
            </tr>
          ))}
        </Table>
      )}
      <InvoiceDetail invoiceId={detailId} onClose={() => setDetailId(null)} modals={modals} />
    </div>
  )
}
