import { useMemo, useState } from 'react'
import { Search, ArrowLeftRight } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Select, TextInput } from '../components/ui/FormField'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate } from '../lib/format'

const TYPES = ['Income', 'Expense', 'Contribution', 'Repayment', 'Payout']

export function Transactions() {
  const invoicePayments = useSupabaseTable('invoice_payments')
  const expenses = useSupabaseTable('expenses')
  const reimbursements = useSupabaseTable('reimbursement_payments')
  const invoices = useSupabaseTable('invoices')
  const projects = useSupabaseTable('projects')
  const members = useSupabaseTable('members')

  const loading = [invoicePayments, expenses, reimbursements, invoices, projects, members].some((t) => t.loading)
  const loadError = [invoicePayments, expenses, reimbursements, invoices, projects, members].find((t) => t.error)?.error

  const projectName = (id) => (id ? projects.data.find((p) => p.id === id)?.name : null)
  const memberName = (id) => (id ? members.data.find((m) => m.id === id)?.name : null)

  const rows = useMemo(() => {
    const invById = new Map(invoices.data.map((i) => [i.id, i]))
    const list = [
      ...invoicePayments.data.map((p) => {
        const inv = invById.get(p.invoice_id)
        return { id: `ip-${p.id}`, date: p.paid_date, type: 'Income', description: `Payment — ${inv?.invoice_number ?? 'invoice'}`, project: projectName(inv?.project_id), member: null, amount: p.amount, direction: 1, source: p.method }
      }),
      ...expenses.data.map((e) => {
        const type = e.paid_by_member_id ? 'Contribution' : e.recipient ? 'Payout' : 'Expense'
        return { id: `ex-${e.id}`, date: e.date, type, description: e.title || e.recipient || e.description || e.category, project: projectName(e.project_id), member: memberName(e.paid_by_member_id), amount: e.amount, direction: type === 'Contribution' ? 0 : -1, source: e.payment_method, status: e.status }
      }),
      ...reimbursements.data.map((r) => ({ id: `rb-${r.id}`, date: r.paid_date, type: 'Repayment', description: 'Reimbursement paid', project: null, member: null, amount: r.amount, direction: -1, source: r.payment_method })),
    ]
    return list.filter((r) => r.date).sort((a, b) => (b.date > a.date ? 1 : -1))
  }, [invoicePayments.data, expenses.data, reimbursements.data, invoices.data, projects.data, members.data])

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [memberFilter, setMemberFilter] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = rows.filter((r) =>
    (typeFilter === 'All' || r.type === typeFilter) &&
    (projectFilter === 'All' || r.project === projects.data.find((p) => p.id === projectFilter)?.name) &&
    (memberFilter === 'All' || r.member === members.data.find((m) => m.id === memberFilter)?.name) &&
    (!from || r.date >= from) && (!to || r.date <= to) &&
    (!search || r.description.toLowerCase().includes(search.toLowerCase())),
  )

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>
  if (loadError) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load transactions: {describeError(loadError)}</p>

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500">View and filter all financial transactions</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-36">
          <option value="All">All types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-40">
          <option value="All">All projects</option>
          {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} className="w-40">
          <option value="All">All members</option>
          {members.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <button onClick={() => { setTypeFilter('All'); setProjectFilter('All'); setMemberFilter('All'); setFrom(''); setTo(''); setSearch('') }} className="rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50">Reset</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transactions match these filters" />
      ) : (
        <Table columns={['Date', 'Type', 'Description', 'Project', 'Member', 'Amount', 'Source']}>
          {filtered.map((r) => (
            <tr key={r.id}>
              <Td>{formatDate(r.date)}</Td>
              <Td>{r.type}</Td>
              <Td className="font-medium text-slate-900">{r.description}</Td>
              <Td>{r.project || '—'}</Td>
              <Td>{r.member || '—'}</Td>
              <Td className={`tabular-nums ${r.direction > 0 ? 'text-emerald-600' : r.direction < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                {r.direction > 0 ? '+' : r.direction < 0 ? '-' : ''}{formatCurrency(r.amount)}
              </Td>
              <Td>{r.source || '—'}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  )
}
