import { useCallback, useEffect, useState } from 'react'
import { Check, Download, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { FormField, TextInput } from '../components/ui/FormField'
import { IconButton } from '../components/ui/Table'
import { Card, PageHeader } from '../components/ui/misc'
import { useToast, describeError } from '../components/ui/Toast'
import { useForm } from '../hooks/useForm'
import { useData } from '../store/DataProvider'
import { companyReserve } from '../calculations/finance'
import { formatCurrency } from '../lib/format'
import { downloadBlob } from '../lib/csv'

function ListEditor({ title, description, collection, usage }) {
  const { data, api, can } = useData()
  const toast = useToast()
  const [name, setName] = useState('')
  const [edit, setEdit] = useState(null) // { id, name }
  const [error, setError] = useState('')
  const items = [...data[collection]].sort((a, b) => a.name.localeCompare(b.name))

  async function run(fn, ok) {
    try { await fn(); setError(''); ok?.() } catch (err) { err?.name === 'ValidationError' ? setError(err.message) : toast.error(describeError(err)) }
  }
  return (
    <Card title={title}>
      <p className="-mt-2 mb-3 text-xs text-slate-400">{description}</p>
      {can.admin ? (
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api.saveListItem(collection, name), () => { setName(''); toast.success('Added.') }) }}>
          <TextInput value={name} onChange={(e) => { setName(e.target.value); setError('') }} placeholder={`New ${title.toLowerCase().replace(/s$/, '')}…`} aria-label={`New ${title}`} />
          <Button type="submit" disabled={!name.trim()}><Plus size={15} /> Add</Button>
        </form>
      ) : <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Only an admin can change this list.</p>}
      {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 py-1.5 text-sm">
            {edit?.id === it.id ? (
              <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); run(() => api.saveListItem(collection, edit.name, it.id), () => { setEdit(null); toast.success('Renamed.') }) }}>
                <TextInput autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="h-8 min-h-0" aria-label="Rename" />
                <IconButton icon={Check} label="Save" type="submit" /><IconButton icon={X} label="Cancel" onClick={() => setEdit(null)} />
              </form>
            ) : (
              <>
                <span className="flex-1 text-slate-700">{it.name}</span>
                <span className="text-xs text-slate-400">{usage(it.name)} used</span>
                {can.admin && <IconButton icon={Pencil} label={`Rename ${it.name}`} onClick={() => { setEdit({ id: it.id, name: it.name }); setError('') }} />}
                {can.admin && <IconButton icon={Trash2} label={`Delete ${it.name}`} danger onClick={() => run(() => api.deleteListItem(collection, it.id), () => toast.success('Deleted.'))} />}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function TeamAccess() {
  const { team, auth, api } = useData()
  const toast = useToast()
  const [people, setPeople] = useState(null)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState({ email: '', full_name: '' })
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => team.list().then(setPeople, (e) => setError(describeError(e))), [team])
  useEffect(() => { load() }, [load])

  async function change(person, patch, done) {
    try { await team.setAccess(person, patch); toast.success(done); await load(); await api.refreshNow() } catch (err) { toast.error(describeError(err)) }
  }
  async function sendInvite(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await team.invite(invite.email.trim(), invite.full_name.trim())
      toast.success(`Invitation sent to ${invite.email.trim()}. Activate them here once they appear.`)
      setInvite({ email: '', full_name: '' }); await load()
    } catch (err) { toast.error(describeError(err)) } finally { setBusy(false) }
  }
  return (
    <Card title="Team Access" className="lg:col-span-2">
      <p className="-mt-2 mb-3 text-xs text-slate-400">Who can sign in. New accounts stay inactive until you activate them. Members can view and record finance data; only admins can delete, change settings or manage access.</p>
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={sendInvite}>
        <TextInput type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="teammate@levrotec.com" aria-label="Invite email" />
        <TextInput value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} placeholder="Full name" aria-label="Invite name" />
        <Button type="submit" disabled={busy || !invite.email.trim()}><Plus size={15} /> {busy ? 'Sending…' : 'Invite'}</Button>
      </form>
      {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
      {!people ? <p className="text-sm text-slate-400">Loading…</p> : (
        <ul className="divide-y divide-slate-100">
          {people.map((p) => {
            const self = p.id === auth.user?.id
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <div className="min-w-0 flex-1"><p className="truncate font-medium text-slate-900">{p.full_name || p.email}{self && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}</p><p className="truncate text-xs text-slate-400">{p.email}</p></div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${p.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                <select aria-label={`Role for ${p.email}`} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs" value={p.role} disabled={self} onChange={(e) => change(p, { role: e.target.value }, 'Role updated.')}>
                  <option value="member">Member</option><option value="admin">Admin</option>
                </select>
                <Button variant={p.is_active ? 'danger' : 'primary'} className="min-h-8 px-3 text-xs" disabled={self} onClick={() => change(p, { is_active: !p.is_active }, p.is_active ? 'Access removed.' : 'Account activated.')}>{p.is_active ? 'Deactivate' : 'Activate'}</Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function Settings() {
  const { data, api, can, mode, auth } = useData()
  const toast = useToast()
  const f = useForm({ company_name: data.settings.company_name ?? '', user_name: data.settings.user_name ?? '', opening_reserve: data.settings.opening_reserve ?? 0, reserve_as_of: data.settings.reserve_as_of ?? '' })
  const [confirm, setConfirm] = useState(null)
  const reserve = companyReserve(data)
  const methodUse = (n) => ['income', 'expenses', 'reimbursements', 'advances'].reduce((a, k) => a + data[k].filter((r) => r.payment_method === n).length, 0)

  async function exportJSON() {
    const snapshot = await api.exportData()
    downloadBlob(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }), `levro-finance-backup-${new Date().toISOString().slice(0, 10)}.json`)
    toast.success('Backup downloaded. It has every record; uploaded file contents are not included.')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Company details, opening reserve, categories and data" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Company & Reserve">
          <form noValidate onSubmit={(e) => f.submit(e, async (v) => { await api.saveSettings(v); await auth.refreshProfile?.() }, { success: 'Settings saved.' })}>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <FormField label="Company Name" required error={f.errors.company_name}><TextInput {...f.bind('company_name')} disabled={!can.admin} /></FormField>
              <FormField label="Your Name" hint="Shown in the header and the activity log."><TextInput {...f.bind('user_name')} /></FormField>
              <FormField label="Opening Reserve (₹)" required error={f.errors.opening_reserve} hint="Company money held before the first recorded transaction."><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('opening_reserve')} disabled={!can.admin} /></FormField>
              <FormField label="Opening As-of Date" error={f.errors.reserve_as_of} hint="Optional. If set, only transactions on or after this date move the reserve."><TextInput type="date" {...f.bind('reserve_as_of')} disabled={!can.admin} /></FormField>
            </div>
            <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Saved: opening {formatCurrency(reserve.opening)} + money in {formatCurrency(reserve.moneyIn)} − money out {formatCurrency(reserve.moneyOut)} = <strong>current reserve {formatCurrency(reserve.current)}</strong>
            </div>
            {!can.admin && <p className="mb-3 text-xs text-slate-500">Only an admin can change company settings. You can update your own name.</p>}
            <div className="flex justify-end"><Button type="submit" disabled={f.saving}>{f.saving ? 'Saving…' : can.admin ? 'Save Settings' : 'Save My Name'}</Button></div>
          </form>
        </Card>

        <Card title="Data">
          <p className="mb-3 text-sm text-slate-500">{mode === 'supabase' ? 'Records are stored in the shared Levrotec database and are visible to every active team member. Changes made by others appear when you return to this window.' : 'Local demo mode: records are stored only in this browser on this computer and are not shared with anyone.'}</p>
          <ul className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
            {[['Projects', 'projects'], ['Members', 'members'], ['Payments', 'income'], ['Expenses', 'expenses'], ['Invoices', 'invoices'], ['Repayments', 'reimbursements'], ['Documents', 'documents'], ['Log entries', 'activity_logs']].map(([label, k]) => <li key={k} className="flex justify-between"><span>{label}</span><span className="tabular-nums text-slate-900">{data[k].length}</span></li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportJSON}><Download size={15} /> Download backup (JSON)</Button>
            {mode === 'supabase' && <Button variant="secondary" onClick={() => api.refreshNow().then(() => toast.success('Up to date.'))}>Refresh from database</Button>}
            {mode === 'local' && <Button variant="secondary" onClick={() => setConfirm('demo')}>Load demo data</Button>}
            {mode === 'local' && <Button variant="danger" onClick={() => setConfirm('clear')}>Clear all data</Button>}
          </div>
        </Card>

        <ListEditor title="Expense Categories" collection="categories" description="Used by expenses, pay outs and purchases. Renaming updates existing records." usage={(n) => data.expenses.filter((e) => e.category === n).length} />
        {mode === 'supabase' && can.admin && <TeamAccess />}
        <ListEditor title="Payment Methods" collection="payment_methods" description="Used wherever money moves. Renaming updates existing records." usage={methodUse} />
      </div>

      {mode === 'local' && <>
      <ConfirmDialog open={confirm === 'clear'} onClose={() => setConfirm(null)} onConfirm={async () => { await api.clearAll(); f.setValues({ company_name: 'Levrotec', user_name: '', opening_reserve: 0, reserve_as_of: '' }) }} title="Clear all data?" confirmLabel="Clear everything" description="Every project, transaction, invoice, member and uploaded file stored in this browser will be permanently deleted. Download a backup first if you might need it." successMessage="All data cleared — you're starting fresh." />
      <ConfirmDialog open={confirm === 'demo'} onClose={() => setConfirm(null)} onConfirm={async () => { await api.loadDemo(); f.setValues({ company_name: 'Levrotec', user_name: 'Hari', opening_reserve: 150000, reserve_as_of: '' }) }} title="Replace everything with demo data?" confirmLabel="Load demo data" description="This replaces all current records and uploaded files in this browser with the sample workspace." successMessage="Demo data loaded." />
      </>}
    </div>
  )
}
