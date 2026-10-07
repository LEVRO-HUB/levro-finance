import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Rocket } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { KebabMenu } from '../components/ui/KebabMenu'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/misc'
import { ProgressBar } from '../components/ui/charts'
import { FormField, Select, TextArea, TextInput } from '../components/ui/FormField'
import { FormActions, Grid } from '../components/forms/common'
import { useForm } from '../hooks/useForm'
import { useData } from '../store/DataProvider'
import { projectFinancials } from '../calculations/finance'
import { PRODUCT_STAGES, productActivity } from '../lib/products'
import { formatCurrency, formatDate } from '../lib/format'

const TONE = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-600 ring-red-200', grey: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const Badge = ({ tone, children }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>{children}</span>

function ProductForm({ product, mode, onClose }) {
  const { api } = useData()
  const update = mode === 'update'
  const f = useForm({ name: product?.name ?? '', description: product?.description ?? '', stage: product?.stage ?? 'Idea', progress: product?.progress ?? 0, stage_note: update ? '' : product?.stage_note ?? '' })
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveProduct({ ...v, touch: update }, product?.id), { success: update ? 'Progress updated.' : product ? 'Product saved.' : 'Product added.', onDone: onClose })}>
      {!update && (
        <>
          <FormField label="Product Name" required error={f.errors.name}><TextInput autoFocus {...f.bind('name')} placeholder="e.g. Zapptude" /></FormField>
          <FormField label="What it is (optional)"><TextArea {...f.bind('description')} className="min-h-14" /></FormField>
        </>
      )}
      <Grid>
        <FormField label="Stage" required error={f.errors.stage}><Select {...f.bind('stage')}>{PRODUCT_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></FormField>
        <FormField label="Progress (%)" error={f.errors.progress}><TextInput type="number" inputMode="numeric" min="0" max="100" step="1" {...f.bind('progress')} /></FormField>
      </Grid>
      <FormField label={update ? 'What was done since the last update?' : 'Latest status (optional)'}><TextArea autoFocus={update} {...f.bind('stage_note')} placeholder="e.g. Login and dashboard finished; payments next" /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={update ? 'Save Update' : product ? 'Save Changes' : 'Add Product'} />
    </form>
  )
}

// Levrotec's own products (not client work): what stage each is at, how far
// along it is, and whether anyone has moved it forward recently.
export function Products() {
  const { data, api, today, can } = useData()
  const [form, setForm] = useState(null) // { product?, mode: 'edit' | 'update' }
  const [deleting, setDeleting] = useState(null)
  const rows = useMemo(() => data.projects.filter((p) => p.kind === 'product')
    .map((p) => ({ ...p, f: projectFinancials(p, data, today), activity: productActivity(p, today) }))
    .sort((a, b) => a.name.localeCompare(b.name)), [data, today])
  const building = rows.filter((p) => p.stage !== 'Launched' && p.stage !== 'On Hold')
  const stalled = rows.filter((p) => p.activity.tone === 'amber' || p.activity.tone === 'red')

  return (
    <div className="space-y-4">
      <PageHeader title="Our Products" subtitle="Levrotec's own products — their stage, progress, and whether they are moving">
        <Button onClick={() => setForm({ mode: 'edit' })}><Plus size={16} /> Add Product</Button>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Products" value={rows.length} icon={Rocket} sub={`${building.length} being built`} />
        <StatCard label="Launched" value={rows.filter((p) => p.stage === 'Launched').length} accent="positive" />
        <StatCard label="Not Moving" value={stalled.length} accent={stalled.length ? 'attention' : 'neutral'} sub="no update in over 14 days" />
        <StatCard label="Spent on Products" value={formatCurrency(rows.reduce((a, p) => a + p.f.totalCosts, 0))} sub={`${formatCurrency(rows.reduce((a, p) => a + p.f.totalReceived, 0))} earned so far`} />
      </div>

      {rows.length === 0 ? <EmptyState icon={Rocket} title="No products yet" description="Add the products Levrotec is building for itself, then post a short progress update whenever work moves forward." /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((p) => (
            <article key={p.id} className="surface min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4" aria-label={p.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{p.name}</h2>
                  {p.description && <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>}
                </div>
                <KebabMenu items={[
                  { label: 'Edit details', onClick: () => setForm({ product: p, mode: 'edit' }) },
                  can.admin && { label: 'Delete', danger: true, onClick: () => setDeleting(p) },
                ]} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone="grey">{p.stage || 'Idea'}</Badge><Badge tone={p.activity.tone}>{p.activity.label}</Badge></div>
              <div className="mt-3 flex items-center gap-3"><div className="flex-1"><ProgressBar pct={p.progress ?? 0} /></div><span className="text-sm font-semibold tabular-nums text-slate-900">{p.progress ?? 0}%</span></div>
              {p.stage_note && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="block text-[11px] font-medium text-slate-400">Latest update · {formatDate(String(p.stage_updated_at ?? '').slice(0, 10))}</span>{p.stage_note}</p>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">Spent <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(p.f.totalCosts)}</span> · Earned <span className="font-semibold tabular-nums text-emerald-600">{formatCurrency(p.f.totalReceived)}</span></p>
                <div className="flex gap-2">
                  <Link to={`/projects/${p.slug}/expenses`} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-800 hover:bg-blue-50">Costs & history</Link>
                  <Button className="min-h-9 px-3 text-xs" onClick={() => setForm({ product: p, mode: 'update' })}>Update progress</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.mode === 'update' ? `Progress update — ${form.product.name}` : form?.product ? `Edit ${form.product.name}` : 'Add Product'}>
        {form && <ProductForm product={form.product} mode={form.mode} onClose={() => setForm(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => api.deleteProject(deleting.id)} title={`Delete “${deleting?.name}”?`} description="Only products with no payments, expenses or invoices can be deleted." successMessage="Product deleted." />
    </div>
  )
}
