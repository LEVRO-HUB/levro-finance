import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, Download } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/ui/StatCard'
import { Table, Td } from '../components/ui/Table'
import { Card, PageHeader, Tabs } from '../components/ui/misc'
import { IncomeExpenseBars } from '../components/ui/charts'
import { DateRangeFilter, FilterBar, FilterSelect } from '../components/ui/Filters'
import { useFilters } from '../hooks/useFilters'
import { useData } from '../store/DataProvider'
import * as F from '../calculations/finance'
import { INCOME_TYPES } from '../services/schema'
import { expenseTypeLabel } from '../components/modules/ExpensesPanel'
import { inRange } from '../lib/dates'
import { formatCurrency, formatDate } from '../lib/format'
import { downloadCSV } from '../lib/csv'

const REPORTS = [
  ['monthly', 'Monthly Summary'], ['income', 'Income'], ['expenses', 'Expenses'], ['company', 'Company Expenses'], ['profitability', 'Project Profitability'],
  ['members', 'Member Balances'], ['reimbursements', 'Reimbursements'], ['outstanding', 'Outstanding Payments'], ['reserve', 'Company Reserve'],
]
const POSITION_REPORTS = new Set(['members', 'outstanding'])
const money = (label, value, extra = {}) => ({ label, value, money: true, align: 'right', ...extra })
const incomeLabel = (id) => INCOME_TYPES.find((t) => t.id === id)?.label ?? id

// Each report is { columns, rows, totals?, cards?, note? } built from the same calculation module the rest of the app uses.
function buildReport(id, ctx) {
  const { data, range, today, projectName, memberName, project } = ctx
  const inProject = (pid) => project === 'All' || (project === '__company__' ? !pid : pid === project)
  const scoped = { ...data, income: data.income.filter((i) => inProject(i.project_id)), expenses: data.expenses.filter((e) => inProject(e.project_id)) }
  const s = F.companySummary(scoped, range)

  switch (id) {
    case 'monthly': {
      const rows = F.monthlySummary(scoped, { range: range ?? {}, today }).reverse()
      return {
        chart: [...rows].reverse().slice(-12),
        cards: [['Income', s.totalIncome, 'positive'], ['Expenses', s.totalExpenses, 'negative'], ['Net Position', s.netPosition, s.netPosition >= 0 ? 'positive' : 'negative']],
        columns: [{ label: 'Month', value: (r) => r.label }, money('Income', (r) => r.income), money('Expenses', (r) => r.expenses), money('Net', (r) => r.net)],
        rows, totals: ['Total', s.totalIncome, s.totalExpenses, s.netPosition],
      }
    }
    case 'income': {
      const rows = [...s.income].sort((a, b) => (a.date < b.date ? 1 : -1))
      return {
        cards: [['Total Income', s.totalIncome, 'positive'], ['Project Revenue', s.projectRevenue], ['Other Income', s.otherIncome]],
        breakdowns: [['By type', F.groupTotals(rows, (r) => incomeLabel(r.type))], ['By project', F.groupTotals(rows, (r) => projectName(r.project_id) ?? 'No project')]],
        columns: [{ label: 'ID', value: (r) => r.code }, { label: 'Date', value: (r) => r.date, date: true }, { label: 'Description', value: (r) => r.description || incomeLabel(r.type) }, { label: 'Type', value: (r) => incomeLabel(r.type) },
          { label: 'Project', value: (r) => projectName(r.project_id) ?? '—' }, { label: 'Method', value: (r) => r.payment_method }, money('Amount', (r) => r.amount)],
        rows, totals: ['Total', '', '', '', '', '', s.totalIncome],
      }
    }
    case 'expenses':
    case 'company': {
      const rows = s.expenses.filter((e) => id === 'expenses' || !e.project_id).sort((a, b) => (a.date < b.date ? 1 : -1))
      const total = F.sum(rows)
      return {
        cards: id === 'expenses'
          ? [['Total Expenses', total, 'negative'], ['Project Costs', s.projectCosts], ['Company Expenses', s.companyExpenses], ['Paid Personally', F.sum(rows.filter((e) => e.paid_by_member_id))]]
          : [['Company Expenses', total, 'negative'], ['Purchases / Assets', F.sum(rows.filter((e) => e.expense_type === 'company_purchase'))], ['Running Costs', F.sum(rows.filter((e) => e.expense_type !== 'company_purchase'))]],
        breakdowns: [['By category', F.groupTotals(rows, (r) => r.category)], id === 'expenses' ? ['By project', F.groupTotals(rows, (r) => projectName(r.project_id) ?? 'Company')] : ['By type', F.groupTotals(rows, (r) => expenseTypeLabel(r.expense_type))]],
        columns: [{ label: 'ID', value: (r) => r.code }, { label: 'Date', value: (r) => r.date, date: true }, { label: 'Title', value: (r) => r.title }, { label: 'Type', value: (r) => expenseTypeLabel(r.expense_type) }, { label: 'Category', value: (r) => r.category },
          ...(id === 'expenses' ? [{ label: 'Project', value: (r) => projectName(r.project_id) ?? '—' }] : [{ label: 'Vendor', value: (r) => r.recipient || '—' }]),
          { label: 'Paid By', value: (r) => memberName(r.paid_by_member_id) ?? 'Company' }, money('Amount', (r) => r.amount)],
        rows, totals: ['Total', '', '', '', '', '', '', total],
      }
    }
    case 'profitability': {
      const rows = data.projects.filter((p) => project === 'All' || p.id === project).map((p) => {
        const period = F.projectFinancials(p, { ...data, income: data.income.filter((i) => inRange(i.date, range)), expenses: data.expenses.filter((e) => inRange(e.date, range)) }, today)
        const now = F.projectFinancials(p, data, today)
        return { p, received: period.received, costs: period.totalCosts, result: F.round2(period.received - period.totalCosts), margin: period.received > 0 ? ((period.received - period.totalCosts) / period.received) * 100 : null, outstanding: now.outstanding, pending: now.pendingReimbursement }
      }).sort((a, b) => b.result - a.result)
      const t = (k) => F.sum(rows, (r) => r[k])
      return {
        cards: [['Revenue Received', t('received'), 'positive'], ['Project Costs', t('costs'), 'negative'], ['Operating Result', t('result'), t('result') >= 0 ? 'positive' : 'negative']],
        note: 'Received, Costs and Result follow the selected period. Outstanding and Pending Reimbursement are the position today.',
        columns: [{ label: 'Project', value: (r) => r.p.name }, { label: 'Client', value: (r) => r.p.client_name || '—' }, { label: 'Status', value: (r) => r.p.status }, money('Contract Value', (r) => F.num(r.p.contract_value)), money('Received', (r) => r.received),
          money('Costs', (r) => r.costs), money('Operating Result', (r) => r.result, { signed: true }), { label: 'Margin', align: 'right', value: (r) => (r.margin === null ? '—' : `${r.margin.toFixed(1)}%`) }, money('Outstanding', (r) => r.outstanding), money('Pending Reimb.', (r) => r.pending)],
        rows, totals: ['Total', '', '', F.sum(rows, (r) => F.num(r.p.contract_value)), t('received'), t('costs'), t('result'), '', t('outstanding'), t('pending')],
      }
    }
    case 'members': {
      const rows = F.allMemberBalances(data).filter((b) => b.contributed > 0 || b.advancesGiven > 0 || b.member.is_active).sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      const t = (k) => F.sum(rows, (r) => r[k])
      return {
        cards: [['Levrotec Owes Members', t('companyOwes'), 'attention'], ['Members Owe Levrotec', t('memberOwes')], ['Net Owed to Members', F.round2(t('companyOwes') - t('memberOwes'))]],
        note: 'Balances as of today. Net > 0 means Levrotec owes the member; net < 0 means the member owes Levrotec.',
        columns: [{ label: 'Member', value: (r) => r.member.name }, money('Personal Spend', (r) => r.contributed), money('Reimbursed', (r) => r.reimbursed), money('Levrotec Owes', (r) => r.companyOwes),
          money('Advances Given', (r) => r.advancesGiven), money('Returned', (r) => r.advancesReturned), money('Owes Levrotec', (r) => r.memberOwes), money('Net Balance', (r) => r.net, { signed: true })],
        rows, totals: ['Total', t('contributed'), t('reimbursed'), t('companyOwes'), t('advancesGiven'), t('advancesReturned'), t('memberOwes'), F.round2(t('companyOwes') - t('memberOwes'))],
      }
    }
    case 'reimbursements': {
      const rows = scoped.expenses.filter((e) => e.paid_by_member_id && inRange(e.date, range)).map((e) => ({ e, st: F.reimbursementState(e, data.reimbursements) })).sort((a, b) => (a.e.date < b.e.date ? 1 : -1))
      const t = [F.sum(rows, (r) => r.e.amount), F.sum(rows, (r) => r.st.reimbursed), F.sum(rows, (r) => r.st.owed)]
      return {
        cards: [['Personal Spend', t[0]], ['Reimbursed', t[1], 'positive'], ['Pending', t[2], 'attention']],
        breakdowns: [['Pending by member', F.groupTotals(rows.filter((r) => r.st.owed > 0), (r) => memberName(r.e.paid_by_member_id), (r) => r.st.owed)]],
        columns: [{ label: 'Date', value: (r) => r.e.date, date: true }, { label: 'Member', value: (r) => memberName(r.e.paid_by_member_id) }, { label: 'Expense', value: (r) => r.e.title }, { label: 'Project', value: (r) => projectName(r.e.project_id) ?? 'Company' },
          money('Amount', (r) => r.e.amount), money('Reimbursed', (r) => r.st.reimbursed), money('Pending', (r) => r.st.owed), { label: 'Status', value: (r) => r.st.status }],
        rows, totals: ['Total', '', '', '', ...t, ''],
      }
    }
    case 'outstanding': {
      const pos = F.companyPosition(data, today)
      const rows = data.projects.filter((p) => p.status !== 'Cancelled' && (project === 'All' || p.id === project)).map((p) => ({ p, f: F.projectFinancials(p, data, today) })).filter((r) => r.f.outstanding > 0).sort((a, b) => b.f.outstanding - a.f.outstanding)
      const t = (k) => F.sum(rows, (r) => r.f[k])
      return {
        cards: [['Pending Receivables', t('outstanding'), 'attention'], ['Outstanding on Invoices', t('invoiceOutstanding')], ['Not Yet Invoiced', t('unbilled')], ['Overdue', F.sum(pos.overdueInvoices.filter((s) => project === 'All' || s.invoice.project_id === project), (s) => s.outstanding), 'negative']],
        note: 'Position as of today: contract value not yet received, per project (cancelled projects excluded).',
        columns: [{ label: 'Project', value: (r) => r.p.name }, { label: 'Client', value: (r) => r.p.client_name || '—' }, money('Contract Value', (r) => r.f.contractValue), money('Received', (r) => r.f.received), money('Outstanding', (r) => r.f.outstanding),
          money('Invoiced, Unpaid', (r) => r.f.invoiceOutstanding), money('Not Yet Invoiced', (r) => r.f.unbilled), { label: 'Overdue Invoices', align: 'right', value: (r) => r.f.invoiceStates.filter((x) => x.overdue).map((x) => x.invoice.invoice_number).join(', ') || '—' }],
        rows, totals: ['Total', '', t('contractValue'), t('received'), t('outstanding'), t('invoiceOutstanding'), t('unbilled'), ''],
      }
    }
    case 'reserve': {
      const r = F.companyReserve(data)
      const ledger = F.buildLedger(data).filter((x) => x.cash !== 0 && (!r.asOf || x.date >= r.asOf))
      const before = ledger.filter((x) => range?.from && x.date < range.from)
      const openingAtStart = F.round2(r.opening + F.sum(before, (x) => x.cash))
      const period = ledger.filter((x) => inRange(x.date, range))
      const rows = F.groupTotals(period, (x) => x.type, (x) => x.cash).map((g) => ({ ...g, flow: g.amount >= 0 ? 'Money In' : 'Money Out' })).sort((a, b) => b.amount - a.amount)
      const moneyIn = F.sum(period.filter((x) => x.cash > 0), (x) => x.cash), moneyOut = F.sum(period.filter((x) => x.cash < 0), (x) => -x.cash)
      return {
        cards: [[range?.from ? 'Reserve at Start of Period' : 'Opening Reserve', openingAtStart], ['Money In', moneyIn, 'positive'], ['Money Out', moneyOut, 'negative'], [range?.to ? 'Reserve at End of Period' : 'Current Reserve', F.round2(openingAtStart + moneyIn - moneyOut)]],
        note: `Cash basis. Current reserve today: ${formatCurrency(r.current)} (opening ${formatCurrency(r.opening)}${r.asOf ? ` as of ${formatDate(r.asOf)}` : ''}). Personal spending moves the reserve only when it is reimbursed.`,
        columns: [{ label: 'Movement', value: (x) => x.key }, { label: 'Flow', value: (x) => x.flow }, { label: 'Entries', align: 'right', value: (x) => x.count }, money('Cash Effect', (x) => x.amount, { signed: true })],
        rows, totals: ['Net change', '', period.length, F.round2(moneyIn - moneyOut)],
      }
    }
    default:
      return { columns: [], rows: [] }
  }
}

export function Reports() {
  const { data, today, projectName, memberName, sortedProjects } = useData()
  const [params, setParams] = useSearchParams()
  const id = REPORTS.some(([r]) => r === params.get('tab')) ? params.get('tab') : 'monthly'
  const { filters, set, reset, activeCount, range } = useFilters({ range: { preset: 'this_year', from: '', to: '' }, project: 'All' })
  const report = useMemo(() => buildReport(id, { data, range, today, projectName, memberName, project: filters.project }), [id, data, range, today, projectName, memberName, filters.project])
  const title = REPORTS.find(([r]) => r === id)[1]
  const usesRange = !POSITION_REPORTS.has(id)
  const usesProject = !['members', 'company', 'reserve'].includes(id)
  const cell = (c, r) => {
    const v = c.value(r)
    if (c.money) return formatCurrency(v)
    if (c.date) return formatDate(v)
    return v
  }
  const cls = (c, v) => (c.signed && typeof v === 'number' && v < 0 ? 'text-red-600' : c.signed ? 'font-medium text-slate-900' : '')

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Financial reports calculated from your recorded transactions">
        <Button variant="secondary" disabled={!report.rows.length} onClick={() => downloadCSV(`${id}-report.csv`, report.columns.map((c) => ({ label: c.label, value: c.value })), report.rows)}><Download size={15} /> Export CSV</Button>
      </PageHeader>
      <Tabs value={id} onChange={(t) => setParams(t === 'monthly' ? {} : { tab: t }, { replace: true })} tabs={REPORTS.map(([r, label]) => ({ id: r, label }))} />

      <FilterBar onReset={reset} activeCount={activeCount} summary={usesRange ? (range.from || range.to ? `Period: ${range.from ? formatDate(range.from) : 'beginning'} – ${range.to ? formatDate(range.to) : 'today'}` : 'Period: all time') : 'This report shows the position as of today.'}>
        {usesRange && <DateRangeFilter value={filters.range} onChange={(v) => set('range', v)} />}
        {usesProject && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} width="w-48"
          options={[...(['profitability', 'outstanding'].includes(id) ? [] : [{ value: '__company__', label: 'Company (no project)' }]), ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} />}
      </FilterBar>

      {report.cards && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {report.cards.map(([label, value, accent]) => <StatCard key={label} label={label} value={formatCurrency(value)} accent={accent ?? 'neutral'} />)}
        </div>
      )}
      {report.chart?.length > 1 && <Card title="Income vs Expenses"><IncomeExpenseBars rows={report.chart} height="h-44" /></Card>}
      {report.breakdowns && (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.breakdowns.map(([heading, groups]) => (
            <Card key={heading} title={heading}>
              {groups.length === 0 ? <p className="text-sm text-slate-400">Nothing to show.</p> : (
                <ul className="space-y-1.5 text-sm">{groups.map((g) => (
                  <li key={g.key} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-slate-600">{g.key}</span><span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full bg-blue-500" style={{ width: `${g.pct}%` }} /></span><span className="w-24 text-right tabular-nums text-slate-900">{formatCurrency(g.amount)}</span><span className="w-10 text-right text-xs tabular-nums text-slate-400">{g.pct.toFixed(0)}%</span></li>
                ))}</ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {report.rows.length === 0 ? <EmptyState icon={BarChart3} title={`Nothing to report for ${title.toLowerCase()}`} description={usesRange ? 'Try a wider date range.' : undefined} /> : (
        <Table columns={report.columns.map((c) => ({ label: c.label, align: c.align }))}
          footer={report.totals && <tr>{report.totals.map((v, i) => <Td key={i} right={report.columns[i].align === 'right'}>{typeof v === 'number' && report.columns[i].money ? formatCurrency(v) : v}</Td>)}</tr>}>
          {report.rows.map((r, i) => (
            <tr key={r.id ?? r.key ?? r.p?.id ?? r.e?.id ?? r.member?.id ?? i}>
              {report.columns.map((c, j) => <Td key={c.label} right={c.align === 'right'} className={`${j === 0 ? 'font-medium text-slate-900' : ''} ${cls(c, c.value(r))} max-w-[280px] truncate`}>{cell(c, r)}</Td>)}
            </tr>
          ))}
        </Table>
      )}
      {report.note && <p className="text-xs text-slate-400">{report.note}</p>}
    </div>
  )
}
