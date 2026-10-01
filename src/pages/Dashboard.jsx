import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, TrendingDown, Scale, HandCoins, Plus, AlertCircle } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate } from '../lib/format'
import { sum, projectFinancials, reimbursementState, expenseCashOut } from '../lib/finance'

const CATEGORY_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-500', 'bg-slate-400']

function monthKey(date) {
  return date ? date.slice(0, 7) : ''
}

export function Dashboard() {
  const expenses = useSupabaseTable('expenses')
  const projects = useSupabaseTable('projects')
  const invoices = useSupabaseTable('invoices')
  const invoicePayments = useSupabaseTable('invoice_payments')
  const reimbursements = useSupabaseTable('reimbursement_payments')
  const members = useSupabaseTable('members', { orderBy: 'name', ascending: true })

  const loading = [expenses, projects, invoices, invoicePayments, reimbursements, members].some((t) => t.loading)
  const loadError = [expenses, projects, invoices, invoicePayments, reimbursements, members].find((t) => t.error)?.error

  const [period, setPeriod] = useState('month') // 'month' | 'all'
  const thisMonth = new Date().toISOString().slice(0, 7)
  const inPeriod = (d) => period === 'all' || monthKey(d) === thisMonth

  const memberName = (id) => members.data.find((m) => m.id === id)?.name ?? '—'

  const kpis = useMemo(() => {
    const periodPayments = invoicePayments.data.filter((p) => inPeriod(p.paid_date))
    const periodExpenses = expenses.data.filter((e) => inPeriod(e.date))
    const totalIncome = sum(periodPayments)
    const totalExpenses = sum(periodExpenses, expenseCashOut)
    const pendingRepayment = sum(
      expenses.data.filter((e) => e.paid_by_member_id),
      (e) => reimbursementState(e, reimbursements.data).owed,
    )
    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      pendingRepayment,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicePayments.data, expenses.data, reimbursements.data, period])

  const projectRows = useMemo(
    () =>
      projects.data
        .filter((p) => p.status === 'Active')
        .map((p) => {
          const f = projectFinancials(p, { expenses: expenses.data, invoices: invoices.data, invoicePayments: invoicePayments.data })
          const pct = f.contractValue > 0 ? Math.min((f.received / f.contractValue) * 100, 100) : 0
          return { ...p, ...f, pct }
        }),
    [projects.data, expenses.data, invoices.data, invoicePayments.data],
  )

  const categoryBreakdown = useMemo(() => {
    const periodExpenses = expenses.data.filter((e) => inPeriod(e.date))
    const totals = new Map()
    for (const e of periodExpenses) totals.set(e.category, (totals.get(e.category) || 0) + (Number(e.amount) || 0))
    const max = Math.max(1, ...totals.values())
    return [...totals.entries()]
      .map(([category, amount], i) => ({ category, amount, pct: (amount / max) * 100, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.amount - a.amount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.data, period])

  const recentTransactions = useMemo(() => {
    const rows = [
      ...invoicePayments.data.map((p) => ({ id: `ip-${p.id}`, date: p.paid_date, type: 'Income', label: 'Invoice payment', amount: Number(p.amount) || 0, direction: 1 })),
      ...expenses.data.map((e) => ({
        id: `ex-${e.id}`,
        date: e.date,
        type: e.paid_by_member_id ? 'Contribution' : 'Expense',
        label: e.title || e.description || e.category,
        amount: Number(e.amount) || 0,
        direction: e.paid_by_member_id ? 0 : -1,
      })),
      ...reimbursements.data.map((r) => ({ id: `rb-${r.id}`, date: r.paid_date, type: 'Repayment', label: 'Reimbursement paid', amount: Number(r.amount) || 0, direction: -1 })),
    ]
    return rows.filter((r) => r.date).sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 8)
  }, [invoicePayments.data, expenses.data, reimbursements.data])

  const pendingItems = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const overdueInvoices = invoices.data.filter((inv) => {
      const paid = sum(invoicePayments.data.filter((p) => p.invoice_id === inv.id)) + (Number(inv.tds_amount) || 0)
      return paid < (Number(inv.amount) || 0) && inv.due_date && inv.due_date < today
    })
    const pendingReimb = expenses.data.filter((e) => e.paid_by_member_id && reimbursementState(e, reimbursements.data).owed > 0)
    return { overdueInvoices, pendingReimb }
  }, [invoices.data, invoicePayments.data, expenses.data, reimbursements.data])

  if (loading) return <div className="py-16 text-center text-sm text-slate-400">Loading dashboard…</div>
  if (loadError) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load the dashboard: {describeError(loadError)}</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Good Morning 👋</h1>
          <p className="text-sm text-slate-500">Here's your financial overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/expenses"><Button><Plus size={16} /> Add Transaction</Button></Link>
          <div className="flex rounded-lg bg-slate-100 p-1">
            {[{ id: 'month', label: 'This Month' }, { id: 'all', label: 'All Time' }].map((o) => (
              <button key={o.id} onClick={() => setPeriod(o.id)} className={`h-8 rounded-md px-3 text-xs font-medium ${period === o.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Income" value={formatCurrency(kpis.totalIncome)} icon={Wallet} accent="positive" />
        <StatCard label="Total Expenses" value={formatCurrency(kpis.totalExpenses)} icon={TrendingDown} accent="negative" />
        <StatCard label="Net Balance" value={formatCurrency(kpis.netBalance)} icon={Scale} accent={kpis.netBalance >= 0 ? 'positive' : 'negative'} />
        <StatCard label="Pending Repayment" value={formatCurrency(kpis.pendingRepayment)} icon={HandCoins} accent="attention" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Project Financial Overview</h2>
        {projectRows.length === 0 ? (
          <EmptyState title="No active projects yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Project</th>
                  <th className="py-2 pr-4 font-medium">Contract Value</th>
                  <th className="py-2 pr-4 font-medium">Received</th>
                  <th className="py-2 pr-4 font-medium">Expenses</th>
                  <th className="py-2 pr-4 font-medium">Balance</th>
                  <th className="py-2 pr-4 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projectRows.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4"><Link to={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-blue-600">{p.name}</Link></td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-600">{formatCurrency(p.contractValue)}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-emerald-600">{formatCurrency(p.received)}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-600">{formatCurrency(p.projectCosts)}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-900">{formatCurrency(p.outstanding)}</td>
                    <td className="w-32 py-2.5 pr-4">
                      <div className="h-1.5 w-24 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${Math.max(p.pct, p.pct > 0 ? 4 : 0)}%` }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Recent Transactions</h2>
          {recentTransactions.length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{t.label}</p>
                    <p className="text-xs text-slate-400">{formatDate(t.date)} · {t.type}</p>
                  </div>
                  <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ${t.direction > 0 ? 'text-emerald-600' : t.direction < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                    {t.direction > 0 ? '+' : t.direction < 0 ? '-' : ''}{formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Expense Categories</h2>
          {categoryBreakdown.length === 0 ? (
            <EmptyState title="No expenses in this period" />
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((c) => (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-600">{c.category}</span>
                    <span className="tabular-nums text-slate-500">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100"><div className={`h-2 rounded-full ${c.color}`} style={{ width: `${Math.max(c.pct, 3)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {(pendingItems.overdueInvoices.length > 0 || pendingItems.pendingReimb.length > 0) && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertCircle size={16} /> Pending Items</h2>
          <ul className="space-y-1.5 text-sm text-amber-800">
            {pendingItems.overdueInvoices.map((inv) => (
              <li key={inv.id}>Invoice <strong>{inv.invoice_number}</strong> is overdue — {formatCurrency(inv.amount)}</li>
            ))}
            {pendingItems.pendingReimb.map((e) => (
              <li key={e.id}>{memberName(e.paid_by_member_id)} is owed {formatCurrency(reimbursementState(e, reimbursements.data).owed)} for "{e.title || e.description || e.category}"</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
