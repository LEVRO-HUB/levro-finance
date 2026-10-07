import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Upload } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { Card, PageHeader, Tabs } from '../components/ui/misc'
import { ProgressBar } from '../components/ui/charts'
import { Table, Td } from '../components/ui/Table'
import { ProjectFormModal } from '../components/forms/ProjectFormModal'
import { useRecordModals } from '../components/modules/RecordModals'
import { LedgerPanel } from '../components/modules/LedgerPanel'
import { ExpensesPanel } from '../components/modules/ExpensesPanel'
import { InvoicesPanel } from '../components/modules/InvoicesPanel'
import { PaymentsPanel } from '../components/modules/PaymentsPanel'
import { DocumentsPanel } from '../components/modules/DocumentsPanel'
import { RecurringPanel } from '../components/modules/RecurringPanel'
import { ContributionsPanel } from '../components/modules/ContributionsPanel'
import { useData } from '../store/DataProvider'
import { groupTotals, monthlySummary, projectFinancials } from '../calculations/finance'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'

const TABS = [
  ['overview', 'Overview'], ['transactions', 'Transactions'], ['expenses', 'Expenses'], ['invoices', 'Invoices'], ['payments', 'Payments'],
  ['documents', 'Documents'], ['reimbursements', 'Reimbursements'], ['summary', 'Financial Summary'], ['activity', 'Activity'],
]

function SummaryList({ f, full = false }) {
  const rows = [
    ['Contract Value', f.contractValue], ['Received', f.received, 'text-emerald-600'], ['Outstanding', f.outstanding, 'text-amber-600'],
    ...(f.monthlyFees ? [['Monthly Charges Collected', f.monthlyFees, 'text-emerald-600']] : []),
    ['Project Expenses', f.projectCosts], ['Pending Reimbursement', f.pendingReimbursement, f.pendingReimbursement > 0 ? 'text-amber-600' : ''],
    ...(full ? [['Total Costs Incurred', f.totalCosts], ['Invoiced', f.invoiced], ['Not Yet Invoiced', f.unbilled], ['Outstanding on Invoices', f.invoiceOutstanding], ...(f.tdsDeducted ? [['TDS Deducted by Client', f.tdsDeducted]] : [])] : []),
  ]
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value, cls]) => <div key={label} className="flex items-center justify-between"><dt className="text-slate-500">{label}</dt><dd className={`font-medium tabular-nums ${cls || 'text-slate-900'}`}>{formatCurrency(value)}</dd></div>)}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2"><dt className="font-semibold text-slate-700">Net Result</dt><dd className={`text-base font-semibold tabular-nums ${f.operatingResult >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(f.operatingResult)}</dd></div>
    </dl>
  )
}

export function ProjectDetail() {
  const { slug, tab = 'overview' } = useParams()
  const navigate = useNavigate()
  const { data, today } = useData()
  const project = data.projects.find((p) => p.slug === slug) ?? data.projects.find((p) => p.id === slug)
  const modals = useRecordModals({ lockProjectId: project?.id })
  const [editing, setEditing] = useState(false)
  const f = useMemo(() => (project ? projectFinancials(project, data, today) : null), [project, data, today])

  if (!project) return <EmptyState title="Project not found" description="It may have been deleted or the link is wrong." />
  if (project.slug !== slug) return <Navigate to={`/projects/${project.slug}`} replace />
  if (!TABS.some(([id]) => id === tab)) return <Navigate to={`/projects/${slug}`} replace />

  const base = `/projects/${slug}`
  const tabLabel = TABS.find(([id]) => id === tab)[1]
  const logs = data.activity_logs.filter((l) => l.project_id === project.id).sort((a, b) => String(b.at).localeCompare(String(a.at)))
  const actions = {
    transactions: <><Button variant="secondary" onClick={() => modals.open({ kind: 'expense', action: 'add' })}><Plus size={16} /> Money Out</Button><Button onClick={() => modals.open({ kind: 'income', action: 'add' })}><Plus size={16} /> Money In</Button></>,
    expenses: <Button onClick={() => modals.open({ kind: 'expense', action: 'add' })}><Plus size={16} /> Add Expense</Button>,
    invoices: <><Button variant="secondary" onClick={() => modals.open({ kind: 'invoice', action: 'add' })}>Record Existing</Button><Button onClick={() => modals.open({ kind: 'invoice', action: 'create' })}><Plus size={16} /> Invoice</Button></>,
    payments: <Button onClick={() => modals.open({ kind: 'income', action: 'add' })}><Plus size={16} /> Record Payment</Button>,
    documents: <Button onClick={() => modals.open({ kind: 'document', action: 'add' })}><Upload size={16} /> Add Document</Button>,
    reimbursements: <Button onClick={() => modals.open({ kind: 'expense', action: 'add' })}><Plus size={16} /> Add Member Expense</Button>,
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-slate-400"><Link to="/projects" className="hover:text-slate-600">Projects</Link><ChevronRight size={12} /><Link to={base} className="hover:text-slate-600">{project.name}</Link>{tab !== 'overview' && <><ChevronRight size={12} /><span className="text-slate-600">{tabLabel}</span></>}</nav>}
        title={<span className="flex flex-wrap items-center gap-2">{project.name} <StatusBadge status={project.status} /></span>}
        subtitle={[project.client_name && `Client: ${project.client_name}`, project.project_number && `Project No: ${project.project_number}`].filter(Boolean).join(' · ')}
      >
        {actions[tab]}
        <Button variant="secondary" onClick={() => setEditing(true)}><Pencil size={15} /> Edit</Button>
      </PageHeader>

      <Tabs tabs={TABS.map(([id, label]) => ({ id, label, to: id === 'overview' ? base : `${base}/${id}` }))} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Financial Summary">
            <SummaryList f={f} />
            <div className="mt-4"><ProgressBar pct={f.receivedPct} /><p className="mt-1 text-right text-xs text-slate-400">{f.receivedPct.toFixed(0)}% of contract received</p></div>
          </Card>
          <Card title="Project Details">
            <dl className="space-y-2 text-sm">
              {[['Client', project.client_name || '—'], ['Project Number', project.project_number || '—'], ['Start Date', formatDate(project.start_date) || '—'], ['End Date', formatDate(project.end_date) || '—'], ['Payment Terms', project.payment_terms || '—']].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-slate-500">{k}</dt><dd className="text-right text-slate-900">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-xs text-slate-400">Description</p><p className="text-sm text-slate-700">{project.description || '—'}</p></div>
            <div className="mt-3"><p className="text-xs text-slate-400">Notes</p><p className="text-sm text-slate-700">{project.notes || '—'}</p></div>
          </Card>
          <Card title="Monthly Charges" className="lg:col-span-2">
            <RecurringPanel kind="maintenance" projectId={project.id} emptyTitle="No monthly charge for this project" emptyDescription="If the client pays a monthly maintenance or support fee, add it here and tick off each month as it is collected." />
          </Card>
          <Card title="Monthly Bills for this Project" className="lg:col-span-2">
            <RecurringPanel kind="bill" projectId={project.id} emptyTitle="No monthly bills linked to this project" emptyDescription="Hosting, domains or subscriptions paid every month for this project can be added from Monthly Bills." />
          </Card>
        </div>
      )}

      {tab === 'transactions' && <LedgerPanel projectId={project.id} modals={modals} />}
      {tab === 'expenses' && <ExpensesPanel projectId={project.id} modals={modals} />}
      {tab === 'invoices' && <InvoicesPanel projectId={project.id} modals={modals} />}
      {tab === 'payments' && <PaymentsPanel projectId={project.id} modals={modals} />}
      {tab === 'documents' && <DocumentsPanel projectId={project.id} modals={modals} />}
      {tab === 'reimbursements' && (
        <div className="space-y-6">
          <ContributionsPanel view="contributions" projectId={project.id} modals={modals} />
          <div><h2 className="mb-2 text-sm font-semibold text-slate-700">Repayments made</h2><ContributionsPanel view="repayments" projectId={project.id} modals={modals} /></div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Financial Summary"><SummaryList f={f} full />{f.margin !== null && <p className="mt-3 text-xs text-slate-400">Margin on money received: {f.margin.toFixed(1)}%</p>}</Card>
          <Card title="Costs by Category">
            {f.expenses.length === 0 ? <EmptyState title="No costs recorded" /> : (
              <ul className="space-y-2 text-sm">{groupTotals(f.expenses, (e) => e.category).map((g) => (
                <li key={g.key}><div className="mb-1 flex justify-between"><span className="text-slate-600">{g.key}</span><span className="tabular-nums text-slate-900">{formatCurrency(g.amount)} <span className="text-xs text-slate-400">({g.pct.toFixed(0)}%)</span></span></div><ProgressBar pct={g.pct} /></li>
              ))}</ul>
            )}
          </Card>
          <div className="lg:col-span-2">
            <Table columns={['Month', { label: 'Received', align: 'right' }, { label: 'Costs', align: 'right' }, { label: 'Net', align: 'right' }]}>
              {monthlySummary({ income: f.income, expenses: f.expenses }, { range: {}, today }).filter((m) => m.income || m.expenses).reverse().map((m) => (
                <tr key={m.key}><Td>{m.label}</Td><Td right className="text-emerald-600">{formatCurrency(m.income)}</Td><Td right>{formatCurrency(m.expenses)}</Td><Td right className={m.net < 0 ? 'text-red-600' : 'font-medium text-slate-900'}>{formatCurrency(m.net)}</Td></tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      {tab === 'activity' && (
        logs.length === 0 ? <EmptyState title="No activity yet" description="Changes to this project's finances will be listed here." /> : (
          <ol className="surface rounded-2xl border border-slate-200/80 bg-white">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${l.action === 'deleted' ? 'bg-red-400' : l.action === 'updated' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                <div className="min-w-0 flex-1"><p className="text-sm text-slate-800">{l.summary}</p><p className="text-xs text-slate-400">{formatDateTime(l.at)} · {l.actor}</p></div>
              </li>
            ))}
          </ol>
        )
      )}

      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={project} onSaved={(row) => row.slug !== slug && navigate(`/projects/${row.slug}`)} />
      {modals.element}
    </div>
  )
}
