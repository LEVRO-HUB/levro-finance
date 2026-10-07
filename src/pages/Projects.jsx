import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { KebabMenu } from '../components/ui/KebabMenu'
import { Select } from '../components/ui/FormField'
import { PageHeader, SearchInput } from '../components/ui/misc'
import { ProgressBar } from '../components/ui/charts'
import { FilterBar, FilterSelect } from '../components/ui/Filters'
import { ProjectFormModal } from '../components/forms/ProjectFormModal'
import { is, matches, useFilters } from '../hooks/useFilters'
import { useData } from '../store/DataProvider'
import { projectFinancials, sum } from '../calculations/finance'
import { PROJECT_STATUSES } from '../services/schema'
import { formatCurrency } from '../lib/format'

const SORTS = {
  recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  name: (a, b) => a.name.localeCompare(b.name),
  value: (a, b) => b.f.contractValue - a.f.contractValue,
  outstanding: (a, b) => b.f.outstanding - a.f.outstanding,
  result: (a, b) => b.f.operatingResult - a.f.operatingResult,
}

export function Projects() {
  const { data, api, today, can } = useData()
  const { filters, set, reset, activeCount } = useFilters({ q: '', status: 'All', sort: 'recent' })
  const [form, setForm] = useState(null) // { project? }
  const [deleting, setDeleting] = useState(null)

  const all = useMemo(() => data.projects.map((p) => ({ ...p, f: projectFinancials(p, data, today) })), [data, today])
  const rows = useMemo(() => all.filter((p) => is(filters.status, p.status) && matches(filters.q, p.name, p.client_name, p.project_number, p.description)).sort(SORTS[filters.sort]), [all, filters])
  const Metric = ({ label, value, cls = 'text-slate-900' }) => <div><p className="text-xs text-slate-400">{label}</p><p className={`font-medium tabular-nums ${cls}`}>{formatCurrency(value)}</p></div>

  return (
    <div className="space-y-4">
      <PageHeader title="Projects" subtitle="Manage your projects and track their financials">
        <Button onClick={() => setForm({})}><Plus size={16} /> New Project</Button>
      </PageHeader>

      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${all.length} projects · Contract value ${formatCurrency(sum(rows, (p) => p.f.contractValue))} · Received ${formatCurrency(sum(rows, (p) => p.f.received))} · Outstanding ${formatCurrency(sum(rows, (p) => p.f.outstanding))}`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search projects…" />
        <FilterSelect label="Statuses" value={filters.status} onChange={(v) => set('status', v)} options={PROJECT_STATUSES} />
        <Select value={filters.sort} onChange={(e) => set('sort', e.target.value)} className="w-48" aria-label="Sort">
          <option value="recent">Sort: Recent</option><option value="name">Sort: Name</option><option value="value">Sort: Contract value</option>
          <option value="outstanding">Sort: Outstanding</option><option value="result">Sort: Operating result</option>
        </Select>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={Briefcase} title={all.length ? 'No projects match these filters' : 'No projects yet'} description={all.length ? undefined : 'Create your first project to start tracking its finances.'} />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <article key={p.id} className="surface rounded-2xl border border-slate-200/80 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Briefcase size={18} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/projects/${p.slug}`} className="truncate text-sm font-semibold text-slate-900 hover:text-blue-600">{p.name}</Link>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{[p.client_name && `Client: ${p.client_name}`, p.project_number && `Project No: ${p.project_number}`].filter(Boolean).join(' · ') || 'No client set'}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  <Link to={`/projects/${p.slug}`} className="inline-flex min-h-9 items-center rounded-lg bg-slate-100 px-3 text-xs font-medium text-slate-700 hover:bg-slate-200">View Project</Link>
                  <KebabMenu items={[{ label: 'Edit', onClick: () => setForm({ project: p }) }, can.admin && { label: 'Delete', danger: true, onClick: () => setDeleting(p) }]} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <Metric label="Contract Value" value={p.f.contractValue} />
                <Metric label="Received" value={p.f.received} cls="text-emerald-600" />
                <Metric label="Outstanding" value={p.f.outstanding} cls="text-amber-600" />
                <Metric label="Project Costs" value={p.f.projectCosts} />
                <Metric label="Pending Reimbursement" value={p.f.pendingReimbursement} cls={p.f.pendingReimbursement > 0 ? 'text-amber-600' : 'text-slate-900'} />
                <Metric label="Operating Result" value={p.f.operatingResult} cls={p.f.operatingResult >= 0 ? 'text-slate-900' : 'text-red-600'} />
              </div>
              <div className="mt-3 flex items-center gap-3"><div className="flex-1"><ProgressBar pct={p.f.receivedPct} /></div><span className="text-xs tabular-nums text-slate-400">{p.f.receivedPct.toFixed(0)}% received</span></div>
            </article>
          ))}
        </div>
      )}

      <ProjectFormModal open={!!form} onClose={() => setForm(null)} project={form?.project} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => api.deleteProject(deleting.id)} title={`Delete “${deleting?.name}”?`} description="Only projects with no payments, expenses or invoices can be deleted. Its documents will be removed too." successMessage="Project deleted." />
    </div>
  )
}
