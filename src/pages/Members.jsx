import { useMemo, useState } from 'react'
import { Plus, Users as UsersIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { StatusBadge } from '../components/ui/StatusBadge'
import { KebabMenu } from '../components/ui/KebabMenu'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/ui/StatCard'
import { Table, Td } from '../components/ui/Table'
import { FormField, Select, TextArea, TextInput } from '../components/ui/FormField'
import { Avatar, PageHeader, SearchInput } from '../components/ui/misc'
import { FilterBar, FilterSelect } from '../components/ui/Filters'
import { FormActions, Grid } from '../components/forms/common'
import { useRecordModals } from '../components/modules/RecordModals'
import { useForm } from '../hooks/useForm'
import { is, matches, useFilters } from '../hooks/useFilters'
import { useData } from '../store/DataProvider'
import { allMemberBalances, sum } from '../calculations/finance'
import { DESIGNATIONS } from '../services/schema'
import { formatCurrency, formatDate, todayISO } from '../lib/format'

function MemberForm({ member, onClose }) {
  const { api } = useData()
  const f = useForm({ name: member?.name ?? '', designation: member?.designation ?? DESIGNATIONS[2], email: member?.email ?? '', phone: member?.phone ?? '', joining_date: member?.joining_date ?? (member ? '' : todayISO()), notes: member?.notes ?? '' })
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveMember(v, member?.id), { success: member ? 'Member updated.' : 'Member added.', onDone: onClose })}>
      <Grid>
        <FormField label="Name" required error={f.errors.name}><TextInput autoFocus {...f.bind('name')} /></FormField>
        <FormField label="Designation"><Select {...f.bind('designation')}>{DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}</Select></FormField>
        <FormField label="Email" error={f.errors.email}><TextInput type="email" {...f.bind('email')} /></FormField>
        <FormField label="Phone" error={f.errors.phone}><TextInput type="tel" {...f.bind('phone')} /></FormField>
        <FormField label="Joining Date" error={f.errors.joining_date}><TextInput type="date" {...f.bind('joining_date')} /></FormField>
      </Grid>
      <FormField label="Notes"><TextArea {...f.bind('notes')} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} />
    </form>
  )
}

export function Members() {
  const { data, api, can } = useData()
  const modals = useRecordModals()
  const { filters, set, reset, activeCount } = useFilters({ q: '', status: 'Active', designation: 'All', balance: 'All' })
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null) // { member, action: 'deactivate' | 'delete' }

  const all = useMemo(() => allMemberBalances(data).map((b) => ({ ...b.member, b })).sort((a, b) => a.name.localeCompare(b.name)), [data])
  const rows = all.filter((m) =>
    is(filters.status, m.is_active ? 'Active' : 'Inactive') && is(filters.designation, m.designation) &&
    (filters.balance === 'All' || (filters.balance === 'owed' ? m.b.companyOwes > 0 : filters.balance === 'owes' ? m.b.memberOwes > 0 : m.b.companyOwes === 0 && m.b.memberOwes === 0)) &&
    matches(filters.q, m.name, m.email, m.phone, m.designation))

  return (
    <div className="space-y-4">
      <PageHeader title="Members" subtitle="Manage your team members, their details and balances">
        {can.admin && <Button onClick={() => setForm({})}><Plus size={16} /> Add Member</Button>}
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active Members" value={all.filter((m) => m.is_active).length} icon={UsersIcon} />
        <StatCard label="Levrotec Owes Members" value={formatCurrency(sum(all, (m) => m.b.companyOwes))} accent="attention" sub="pending reimbursements" to="/contributions" />
        <StatCard label="Members Owe Levrotec" value={formatCurrency(sum(all, (m) => m.b.memberOwes))} sub="advances outstanding" to="/contributions?tab=advances" />
        <StatCard label="Total Personal Spend" value={formatCurrency(sum(all, (m) => m.b.contributed))} sub="all time" />
      </div>

      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${all.length} members`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search members…" />
        <FilterSelect label="Statuses" allLabel="Active & inactive" value={filters.status} onChange={(v) => set('status', v)} options={['Active', 'Inactive']} />
        <FilterSelect label="Designations" value={filters.designation} onChange={(v) => set('designation', v)} options={DESIGNATIONS} width="w-44" />
        <FilterSelect label="Balances" allLabel="Any balance" value={filters.balance} onChange={(v) => set('balance', v)} options={[{ value: 'owed', label: 'Levrotec owes them' }, { value: 'owes', label: 'They owe Levrotec' }, { value: 'settled', label: 'Settled' }]} width="w-48" />
      </FilterBar>

      {rows.length === 0 ? <EmptyState icon={UsersIcon} title={all.length ? 'No members match these filters' : 'No members yet'} /> : (
        <Table columns={['Name', 'Designation', 'Email', 'Phone', 'Joining Date', { label: 'Levrotec Owes', align: 'right' }, { label: 'Owes Levrotec', align: 'right' }, 'Status', '']}>
          {rows.map((m) => (
            <tr key={m.id} className={m.is_active ? '' : 'opacity-60'}>
              <Td><div className="flex items-center gap-2.5"><Avatar name={m.name} /><span className="font-medium text-slate-900">{m.name}</span></div></Td>
              <Td>{m.designation || '—'}</Td><Td>{m.email || '—'}</Td><Td>{m.phone || '—'}</Td><Td>{formatDate(m.joining_date) || '—'}</Td>
              <Td right className={m.b.companyOwes > 0 ? 'font-medium text-amber-600' : 'text-slate-400'}>{formatCurrency(m.b.companyOwes)}</Td>
              <Td right className={m.b.memberOwes > 0 ? 'font-medium text-red-500' : 'text-slate-400'}>{formatCurrency(m.b.memberOwes)}</Td>
              <Td><StatusBadge status={m.is_active ? 'Active' : 'Inactive'} /></Td>
              <Td right><KebabMenu items={[
                can.admin && { label: 'Edit', onClick: () => setForm({ member: m }) },
                m.b.companyOwes > 0 && { label: 'Record repayment', onClick: () => modals.open({ kind: 'reimbursement', action: 'add', memberId: m.id }) },
                { label: 'Give advance', onClick: () => modals.open({ kind: 'advance', action: 'add', memberId: m.id, direction: 'given' }) },
                m.b.memberOwes > 0 && { label: 'Advance returned', onClick: () => modals.open({ kind: 'advance', action: 'add', memberId: m.id, direction: 'returned' }) },
                can.admin && (m.is_active ? { label: 'Deactivate', danger: true, onClick: () => setConfirm({ member: m, action: 'deactivate' }) } : { label: 'Reactivate', onClick: () => api.setMemberActive(m.id, true) }),
                can.admin && { label: 'Delete', danger: true, onClick: () => setConfirm({ member: m, action: 'delete' }) },
              ]} /></Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.member ? 'Edit Member' : 'Add Member'} wide><MemberForm member={form?.member} onClose={() => setForm(null)} /></Modal>
      <ConfirmDialog open={confirm?.action === 'deactivate'} onClose={() => setConfirm(null)} onConfirm={() => api.setMemberActive(confirm.member.id, false)} title={`Deactivate ${confirm?.member.name}?`} confirmLabel="Deactivate" description="They'll be hidden from pickers and active lists, but their financial history and balances stay intact." successMessage="Member deactivated." />
      <ConfirmDialog open={confirm?.action === 'delete'} onClose={() => setConfirm(null)} onConfirm={() => api.deleteMember(confirm.member.id)} title={`Delete ${confirm?.member.name}?`} description="Only members with no financial history can be deleted. Otherwise deactivate them." successMessage="Member deleted." />
      {modals.element}
    </div>
  )
}
