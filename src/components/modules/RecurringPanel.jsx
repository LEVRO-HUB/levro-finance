import { useMemo, useState } from 'react'
import { Check, CalendarClock, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { EmptyState } from '../ui/EmptyState'
import { KebabMenu } from '../ui/KebabMenu'
import { FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { ProjectLink } from '../ui/links'
import { FormActions, Grid, MemberField, MethodField, ProjectField } from '../forms/common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { monthName, recurringSchedule } from '../../calculations/finance'
import { formatCurrency, formatDate, todayISO } from '../../lib/format'

const WORDS = {
  bill: { one: 'Monthly Bill', add: 'Add Monthly Bill', done: 'Paid', act: 'Mark as paid', toast: 'Bill marked as paid.' },
  maintenance: { one: 'Monthly Charge', add: 'Add Monthly Charge', done: 'Collected', act: 'Mark as collected', toast: 'Monthly charge marked as collected.' },
}
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1)

export function RecurringFormModal({ open, onClose, kind = 'bill', item, projectId }) {
  return <Modal open={open} onClose={onClose} title={item ? `Edit ${WORDS[kind].one}` : WORDS[kind].add} wide>{open && <ItemForm kind={kind} item={item} projectId={projectId} onClose={onClose} />}</Modal>
}

function ItemForm({ kind, item, projectId, onClose }) {
  const { api, categoryNames } = useData()
  const f = useForm({
    kind, name: item?.name ?? (kind === 'maintenance' ? 'Monthly maintenance' : ''), amount: item?.amount ?? '', due_day: item?.due_day ?? 5,
    start_month: (item?.start_month ?? todayISO()).slice(0, 7), end_month: (item?.end_month ?? '').slice(0, 7),
    category: item?.category ?? '', project_id: item?.project_id ?? projectId ?? '', recipient: item?.recipient ?? '', notes: item?.notes ?? '',
  })
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveRecurring(v, item?.id), { success: item ? 'Saved.' : `${WORDS[kind].one} added.`, onDone: onClose })}>
      <Grid>
        <FormField label="Name" required error={f.errors.name}><TextInput autoFocus {...f.bind('name')} placeholder={kind === 'bill' ? 'e.g. Office rent, Google Workspace' : 'e.g. Monthly maintenance'} /></FormField>
        <FormField label="Amount per month (₹)" required error={f.errors.amount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} /></FormField>
        {kind === 'bill' && (
          <FormField label="Category" required error={f.errors.category}>
            <Select {...f.bind('category')}><option value="">Select category</option>{categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          </FormField>
        )}
        <FormField label="Due on day of month" required error={f.errors.due_day}>
          <Select {...f.bind('due_day')}>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
        </FormField>
        <FormField label="First month" required error={f.errors.start_month}><TextInput type="month" placeholder="YYYY-MM" {...f.bind('start_month')} /></FormField>
        <FormField label="Last month (leave empty if ongoing)" error={f.errors.end_month}><TextInput type="month" placeholder="YYYY-MM" {...f.bind('end_month')} /></FormField>
        {kind === 'bill' && <FormField label="Paid to (optional)" error={f.errors.recipient}><TextInput {...f.bind('recipient')} placeholder="e.g. landlord, vendor, employee" /></FormField>}
        {kind === 'bill' ? <ProjectField form={f} disabled={!!projectId} /> : <ProjectField form={f} required disabled={!!projectId || !!item} />}
      </Grid>
      <FormField label="Notes"><TextArea {...f.bind('notes')} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={item ? 'Save Changes' : WORDS[kind].add} />
    </form>
  )
}

function PayForm({ item, month, onClose }) {
  const { api } = useData()
  const w = WORDS[item.kind]
  const f = useForm({ amount: item.amount, date: todayISO(), payment_method: '', paid_by_member_id: '', reference: '' })
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.payRecurring(item.id, month, v), { success: w.toast, onDone: onClose })}>
      <p className="mb-3 text-sm text-slate-600"><span className="font-medium text-slate-900">{item.name}</span> · {monthName(month)}</p>
      <Grid>
        <FormField label="Amount (₹)" required error={f.errors.amount}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('amount')} /></FormField>
        <FormField label={item.kind === 'bill' ? 'Paid on' : 'Received on'} required error={f.errors.date}><TextInput type="date" {...f.bind('date')} /></FormField>
        <MethodField form={f} />
        {item.kind === 'bill' && <MemberField form={f} name="paid_by_member_id" label="Paid By" emptyLabel="Company" />}
        <FormField label="Reference" error={f.errors.reference}><TextInput {...f.bind('reference')} placeholder="Enter reference (optional)" /></FormField>
      </Grid>
      {item.kind === 'bill' && f.values.paid_by_member_id && <p className="mb-2 text-xs text-amber-600">This will show as money Levrotec owes that member until it is repaid.</p>}
      <FormActions onCancel={onClose} saving={f.saving} label={w.act} />
    </form>
  )
}

const CHIP = {
  Done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Due: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  Overdue: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
}

// Lists monthly bills (kind="bill") or a project's monthly charges (kind="maintenance"),
// each with a month-by-month row of ticks.
export function RecurringPanel({ kind = 'bill', projectId, showProject = false, emptyTitle, emptyDescription }) {
  const { data, today, api, can } = useData()
  const w = WORDS[kind]
  const [form, setForm] = useState(null)
  const [pay, setPay] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [expanded, setExpanded] = useState({})
  const rows = useMemo(() => (data.recurring ?? [])
    .filter((r) => r.kind === kind && (!projectId || r.project_id === projectId))
    .map((item) => ({ item, ...recurringSchedule(item, data, today) }))
    .sort((a, b) => Number(a.ended) - Number(b.ended) || a.item.name.localeCompare(b.item.name)), [data, today, kind, projectId])

  return (
    <div className="space-y-3">
      {rows.length === 0 ? <EmptyState icon={CalendarClock} title={emptyTitle ?? `No ${w.one.toLowerCase()}s yet`} description={emptyDescription} /> : rows.map(({ item, months, pending, pendingAmount, ended }) => {
        const shown = expanded[item.id] ? months : months.slice(-12)
        return (
          <section key={item.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4" aria-label={item.name}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{item.name}{ended && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Ended</span>}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatCurrency(item.amount)} / month · due on day {item.due_day}
                  {item.category ? ` · ${item.category}` : ''}{item.recipient ? ` · ${item.recipient}` : ''}
                  {showProject && item.project_id ? <> · <ProjectLink id={item.project_id} /></> : null}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className={`text-sm font-medium tabular-nums ${pending.length ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {pending.length ? `${pending.length} month(s) pending · ${formatCurrency(pendingAmount)}` : months.length ? `All ${w.done.toLowerCase()}` : 'Not started yet'}
                </p>
                <KebabMenu items={[
                  { label: 'Edit', onClick: () => setForm({ item }) },
                  can.admin && { label: 'Remove', danger: true, onClick: () => setConfirm(item) },
                ]} />
              </div>
            </div>
            {months.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {shown.map((m) => (
                  <li key={m.month}>
                    {m.record ? (
                      <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${CHIP.Done}`} title={`${w.done} ${formatCurrency(m.record.amount)} on ${formatDate(m.record.date)} (${m.record.code ?? ''})`}>
                        <Check size={13} aria-hidden="true" /> {m.label}<span className="sr-only"> — {w.done}</span>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setPay({ item, month: m.month })} className={`inline-flex min-h-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${CHIP[m.status]}`} title={`${w.act} — due ${formatDate(m.due_date)}`}>
                        <span className="h-3 w-3 rounded-sm border border-current" aria-hidden="true" /> {m.label} · {m.status}
                      </button>
                    )}
                  </li>
                ))}
                {months.length > 12 && <li><button type="button" className="min-h-0 px-1 py-1 text-xs font-medium text-blue-600 hover:underline" onClick={() => setExpanded((e) => ({ ...e, [item.id]: !e[item.id] }))}>{expanded[item.id] ? 'Show last 12' : `Show all ${months.length}`}</button></li>}
              </ul>
            )}
          </section>
        )
      })}
      {projectId && kind === 'maintenance' && rows.length === 0 && <Button variant="secondary" onClick={() => setForm({})}><Plus size={16} /> {w.add}</Button>}

      <RecurringFormModal open={!!form} onClose={() => setForm(null)} kind={kind} item={form?.item} projectId={projectId} />
      <Modal open={!!pay} onClose={() => setPay(null)} title={w.act}>{pay && <PayForm item={pay.item} month={pay.month} onClose={() => setPay(null)} />}</Modal>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => api.deleteRecurring(confirm.id)} title={`Remove “${confirm?.name}”?`} confirmLabel="Remove"
        description="Only the monthly schedule is removed. Payments already recorded stay in your books. To just stop it from a certain month, use Edit and set a last month instead." successMessage="Removed." />
    </div>
  )
}
