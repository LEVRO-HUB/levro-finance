import { useMemo, useState } from 'react'
import { HandCoins, Plus } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { StatCard } from '../components/ui/StatCard'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, Select } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import { sum, reimbursementState } from '../lib/finance'

export function Contributions() {
  const toast = useToast()
  const expenses = useSupabaseTable('expenses')
  const members = useSupabaseTable('members', { orderBy: 'name', ascending: true })
  const projects = useSupabaseTable('projects')
  const reimbursements = useSupabaseTable('reimbursement_payments')

  const [tab, setTab] = useState('Contributions')
  const loading = expenses.loading || members.loading || projects.loading || reimbursements.loading

  const memberName = (id) => members.data.find((m) => m.id === id)?.name ?? '—'
  const projectName = (id) => projects.data.find((p) => p.id === id)?.name ?? 'Company'

  const contributions = useMemo(
    () => expenses.data.filter((e) => e.paid_by_member_id).map((e) => ({ ...e, state: reimbursementState(e, reimbursements.data) })),
    [expenses.data, reimbursements.data],
  )

  const totals = useMemo(() => ({
    contributed: sum(contributions),
    repaid: sum(reimbursements.data),
    pending: sum(contributions, (c) => c.state.owed),
  }), [contributions, reimbursements.data])

  // Record Repayment modal
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ member_id: '', amount: '', paid_date: todayISO(), payment_method: '', reference: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const memberPending = useMemo(() => {
    const byMember = new Map()
    for (const c of contributions) {
      if (c.state.owed <= 0) continue
      byMember.set(c.paid_by_member_id, (byMember.get(c.paid_by_member_id) || 0) + c.state.owed)
    }
    return byMember
  }, [contributions])

  function openRecordRepayment() {
    setForm({ member_id: members.data[0]?.id ?? '', amount: '', paid_date: todayISO(), payment_method: '', reference: '', notes: '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      // Allocate this repayment across the member's outstanding contributions,
      // oldest first — each gets its own reimbursement_payments row so every
      // expense's own balance stays exact (never a single lump sum that hides
      // which expenses are actually settled).
      let remaining = Number(form.amount) || 0
      const owedRows = contributions
        .filter((c) => c.paid_by_member_id === form.member_id && c.state.owed > 0)
        .sort((a, b) => (a.date > b.date ? 1 : -1))
      if (remaining <= 0) throw new Error('Enter an amount greater than zero.')
      for (const c of owedRows) {
        if (remaining <= 0) break
        const portion = Math.min(remaining, c.state.owed)
        await reimbursements.insert({ expense_id: c.id, amount: portion, paid_date: form.paid_date, payment_method: form.payment_method, reference: form.reference, notes: form.notes })
        remaining -= portion
      }
      if (remaining > 0.01) {
        toast.error(`Only ${formatCurrency(Number(form.amount) - remaining)} was allocated — that member has no more outstanding contributions to apply the rest to.`)
      } else {
        toast.success('Repayment recorded.')
      }
      setModalOpen(false)
    } catch (err) {
      toast.error(`Could not record this repayment: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const selectedOwed = memberPending.get(form.member_id) || 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Contributions & Repayments</h1>
          <p className="text-sm text-slate-500">Track personal money used for company/project expenses</p>
        </div>
        <Button onClick={openRecordRepayment}><Plus size={16} /> Record Repayment</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Contributed" value={formatCurrency(totals.contributed)} icon={HandCoins} />
        <StatCard label="Total Repaid" value={formatCurrency(totals.repaid)} accent="positive" />
        <StatCard label="Pending Repayment" value={formatCurrency(totals.pending)} accent="attention" />
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {['Contributions', 'Repayments'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>{t}</button>
        ))}
      </div>

      {loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div> : tab === 'Contributions' ? (
        contributions.length === 0 ? <EmptyState title="No contributions recorded" description="Mark an expense as 'Paid personally' to track it here." /> : (
          <Table columns={['Date', 'Member', 'Purpose', 'Project', 'Amount', 'Status', 'Owed']}>
            {contributions.map((c) => (
              <tr key={c.id}>
                <Td>{formatDate(c.date)}</Td>
                <Td className="font-medium text-slate-900">{memberName(c.paid_by_member_id)}</Td>
                <Td>{c.title || c.description || c.category}</Td>
                <Td>{projectName(c.project_id)}</Td>
                <Td className="tabular-nums">{formatCurrency(c.amount)}</Td>
                <Td><StatusBadge status={c.state.status} /></Td>
                <Td className="tabular-nums">{formatCurrency(c.state.owed)}</Td>
              </tr>
            ))}
          </Table>
        )
      ) : (
        reimbursements.data.length === 0 ? <EmptyState title="No repayments recorded yet" /> : (
          <Table columns={['Date', 'Amount', 'Method', 'Reference', 'Notes']}>
            {reimbursements.data.map((r) => (
              <tr key={r.id}>
                <Td>{formatDate(r.paid_date)}</Td>
                <Td className="tabular-nums text-emerald-600">{formatCurrency(r.amount)}</Td>
                <Td>{r.payment_method || '—'}</Td>
                <Td>{r.reference || '—'}</Td>
                <Td>{r.notes || '—'}</Td>
              </tr>
            ))}
          </Table>
        )
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Repayment">
        <form onSubmit={handleSubmit}>
          <FormField label="Member">
            <Select value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              {members.data.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </FormField>
          <p className="-mt-2.5 mb-3.5 text-xs text-slate-400">Currently owed: {formatCurrency(selectedOwed)}</p>
          <FormField label="Amount"><TextInput type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></FormField>
          <FormField label="Date"><TextInput type="date" required value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} /></FormField>
          <FormField label="Payment Method"><TextInput value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></FormField>
          <FormField label="Reference (optional)"><TextInput value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Record Repayment'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
