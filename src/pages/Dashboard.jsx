import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Briefcase, HandCoins, Landmark, Plus, Scale, TrendingDown, TrendingUp, UserMinus, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { StatCard } from '../components/ui/StatCard'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/FormField'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Amount, Card, ChangeBadge, PageHeader } from '../components/ui/misc'
import { DonutWithLegend, IncomeExpenseBars, ProgressBar } from '../components/ui/charts'
import { useRecordModals } from '../components/modules/RecordModals'
import { useData } from '../store/DataProvider'
import { companyPosition, companyReserve, companySummary, groupTotals, monthlySummary, pctChange, projectFinancials } from '../calculations/finance'
import { previousRange, relativeDate, resolveRange } from '../lib/dates'
import { formatCurrency } from '../lib/format'

const PERIODS = [['this_month', 'This Month'], ['last_month', 'Last Month'], ['this_quarter', 'This Quarter'], ['this_year', 'This Year'], ['all', 'All Time']]

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()))
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export function Dashboard() {
  const { data, ledger, today, projectName } = useData()
  const modals = useRecordModals()
  const [period, setPeriod] = useState('this_month')
  const [addOpen, setAddOpen] = useState(false)

  const v = useMemo(() => {
    const range = resolveRange(period, {}, today)
    const cur = companySummary(data, range)
    const prevRange = previousRange(period, range)
    const prev = prevRange ? companySummary(data, prevRange) : null
    return {
      cur,
      change: prev ? { income: pctChange(cur.totalIncome, prev.totalIncome), expenses: pctChange(cur.totalExpenses, prev.totalExpenses), net: pctChange(cur.netPosition, prev.netPosition) } : {},
      position: companyPosition(data, today),
      reserve: companyReserve(data),
      trend: monthlySummary(data, { months: 6, today }),
      categories: groupTotals(cur.expenses, (e) => e.category),
      projects: data.projects.filter((p) => p.status === 'Active' || p.status === 'On Hold').map((p) => ({ ...p, f: projectFinancials(p, data, today) })),
    }
  }, [data, period, today])

  const recent = ledger.slice(0, 6)
  const recentPayments = ledger.filter((r) => r.kind === 'income').slice(0, 5)
  const { position: pos, reserve } = v
  const pendingProjects = v.projects.filter((p) => p.f.outstanding > 0)
  const name = data.settings.user_name

  return (
    <div className="space-y-5">
      <PageHeader title={`${greeting()}${name ? `, ${name}` : ''} 👋`} subtitle="Here's your financial overview">
        <div className="relative">
          <Button onClick={() => setAddOpen((o) => !o)} aria-haspopup="menu"><Plus size={16} /> Add Transaction</Button>
          {addOpen && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" onMouseLeave={() => setAddOpen(false)}>
              {[['Money In', { kind: 'income', action: 'add' }, ArrowDownLeft], ['Money Out (expense)', { kind: 'expense', action: 'add' }, ArrowUpRight], ['Reimburse member', { kind: 'reimbursement', action: 'add' }, HandCoins]].map(([label, target, Icon]) => (
                <button key={label} type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setAddOpen(false); modals.open(target) }}><Icon size={15} className="text-slate-400" />{label}</button>
              ))}
            </div>
          )}
        </div>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36" aria-label="Period">
          {PERIODS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Income" value={formatCurrency(v.cur.totalIncome)} icon={TrendingUp} accent="positive" sub={<ChangeBadge value={v.change.income} />} to="/payments" />
        <StatCard label="Total Expenses" value={formatCurrency(v.cur.totalExpenses)} icon={TrendingDown} accent="negative" sub={<ChangeBadge value={v.change.expenses} goodWhenUp={false} />} to="/expenses" />
        <StatCard label="Net Position" value={formatCurrency(v.cur.netPosition)} icon={Scale} accent={v.cur.netPosition >= 0 ? 'positive' : 'negative'} sub={<ChangeBadge value={v.change.net} />} to="/reports" />
        <StatCard label="Pending Repayment" value={formatCurrency(pos.pendingReimbursements)} icon={HandCoins} accent="attention" sub="Levrotec owes members" to="/contributions" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard compact label="Project Revenue" value={formatCurrency(v.cur.projectRevenue)} sub="in this period" />
        <StatCard compact label="Project Costs" value={formatCurrency(v.cur.projectCosts)} sub="in this period" />
        <StatCard compact label="Company Expenses" value={formatCurrency(v.cur.companyExpenses)} sub="non-project, this period" />
        <StatCard compact label="Pending Receivables" value={formatCurrency(pos.pendingReceivables)} icon={Briefcase} accent="attention" sub="contract value not yet received" to="/projects" />
        <StatCard compact label="Members Owe Levrotec" value={formatCurrency(pos.membersOweCompany)} icon={UserMinus} sub="outstanding advances" to="/contributions?tab=advances" />
        <StatCard compact label="Company Reserve" value={formatCurrency(reserve.current)} icon={Landmark} accent={reserve.current >= 0 ? 'neutral' : 'negative'} sub="cash position now" to="/reports?tab=reserve" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Project Financial Overview" className="xl:col-span-2" action={<Link to="/projects" className="text-xs font-medium text-blue-600 hover:underline">All projects</Link>}>
          {v.projects.length === 0 ? <EmptyState title="No active projects yet" description="Create a project to track its contract, payments and costs." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead><tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  {['Project', 'Value', 'Received', 'Expenses', 'Balance', 'Result', 'Progress'].map((h, i) => <th key={h} className={`py-2 pr-4 font-medium ${i > 0 && i < 6 ? 'text-right' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {v.projects.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pr-4"><Link to={`/projects/${p.slug}`} className="font-medium text-slate-900 hover:text-blue-600">{p.name}</Link>{p.status !== 'Active' && <StatusBadge status={p.status} className="ml-2" />}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{formatCurrency(p.f.contractValue)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-600">{formatCurrency(p.f.received)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{formatCurrency(p.f.totalCosts)}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-amber-600">{formatCurrency(p.f.outstanding)}</td>
                      <td className={`py-2.5 pr-4 text-right font-medium tabular-nums ${p.f.operatingResult >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatCurrency(p.f.operatingResult)}</td>
                      <td className="w-36 py-2.5"><div className="flex items-center gap-2"><div className="w-20"><ProgressBar pct={p.f.receivedPct} color="bg-emerald-500" /></div><span className="text-xs tabular-nums text-slate-400">{p.f.receivedPct.toFixed(0)}%</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Recent Transactions" action={<Link to="/transactions" className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}>
          {recent.length === 0 ? <EmptyState title="No transactions yet" /> : (
            <ul className="space-y-1.5">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{t.description}</p><p className="truncate text-xs text-slate-400">{t.type}{t.project_id ? ` · ${projectName(t.project_id)}` : ''} · {relativeDate(t.date, today)}</p></div>
                  <Amount direction={t.direction} className="flex-shrink-0 text-sm font-semibold" value={`${t.direction === 'in' ? '+' : t.direction === 'out' ? '−' : ''}${formatCurrency(t.amount)}`} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Monthly Income vs Expenses"><IncomeExpenseBars rows={v.trend} /></Card>
        <Card title="Expense Categories">
          {v.categories.length === 0 ? <EmptyState title="No expenses in this period" /> : <DonutWithLegend groups={v.categories} max={6} />}
        </Card>
        <Card title="Company Reserve" action={<Link to="/settings" className="text-xs font-medium text-blue-600 hover:underline">Set opening</Link>}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Opening Reserve{reserve.asOf ? ` (from ${reserve.asOf})` : ''}</dt><dd className="tabular-nums">{formatCurrency(reserve.opening)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Money In</dt><dd className="tabular-nums text-emerald-600">+{formatCurrency(reserve.moneyIn)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Money Out</dt><dd className="tabular-nums text-red-500">−{formatCurrency(reserve.moneyOut)}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold"><dt className="text-slate-700">Current Reserve</dt><dd className={`tabular-nums ${reserve.current < 0 ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(reserve.current)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">Money out counts company-paid expenses, reimbursements paid and advances given. Personal spending affects it only when reimbursed.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Recent Payments" action={<Link to="/payments" className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}>
          {recentPayments.length === 0 ? <EmptyState icon={Wallet} title="No payments received yet" /> : (
            <ul className="divide-y divide-slate-100">
              {recentPayments.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{t.description}</p><p className="text-xs text-slate-400">{projectName(t.project_id) ?? t.type} · {t.payment_method} · {relativeDate(t.date, today)}</p></div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-600">+{formatCurrency(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <section className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertCircle size={16} /> Pending</h2>
          {pos.pendingReimbursements <= 0 && pendingProjects.length === 0 && pos.overdueInvoices.length === 0 && pos.membersOweCompany <= 0 ? (
            <p className="text-sm text-amber-700">Nothing pending right now.</p>
          ) : (
            <ul className="space-y-2 text-sm text-amber-900">
              {pos.pendingReimbursements > 0 && <li className="flex justify-between gap-3"><Link className="hover:underline" to="/contributions">{pos.balances.filter((b) => b.companyOwes > 0).length} member reimbursement(s) pending</Link><span className="font-semibold tabular-nums">{formatCurrency(pos.pendingReimbursements)}</span></li>}
              {pendingProjects.length > 0 && <li className="flex justify-between gap-3"><Link className="hover:underline" to="/projects">{pendingProjects.length} project payment(s) pending</Link><span className="font-semibold tabular-nums">{formatCurrency(pos.pendingReceivables)}</span></li>}
              {pos.overdueInvoices.length > 0 && <li className="flex justify-between gap-3"><Link className="hover:underline" to="/invoices?status=Overdue">{pos.overdueInvoices.length} invoice(s) overdue</Link><span className="font-semibold tabular-nums">{formatCurrency(pos.overdueInvoices.reduce((a, s) => a + s.outstanding, 0))}</span></li>}
              {pos.membersOweCompany > 0 && <li className="flex justify-between gap-3"><Link className="hover:underline" to="/contributions?tab=advances">Member advances to be returned</Link><span className="font-semibold tabular-nums">{formatCurrency(pos.membersOweCompany)}</span></li>}
            </ul>
          )}
        </section>
      </div>
      {modals.element}
    </div>
  )
}
