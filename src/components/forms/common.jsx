import { Button } from '../ui/Button'
import { FormField, Select } from '../ui/FormField'
import { useData } from '../../store/DataProvider'

export function FormActions({ onCancel, saving, label = 'Save', savingLabel = 'Saving…' }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? savingLabel : label}</Button>
    </div>
  )
}

export const Grid = ({ children }) => <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>

export function MethodField({ form, name = 'payment_method', required = true }) {
  const { methodNames } = useData()
  return (
    <FormField label="Payment Method" required={required} error={form.errors[name]}>
      <Select {...form.bind(name)}>
        <option value="">Select payment method</option>
        {methodNames.map((m) => <option key={m} value={m}>{m}</option>)}
      </Select>
    </FormField>
  )
}

export function ProjectField({ form, name = 'project_id', label = 'Project', required = false, disabled = false, emptyLabel = 'Company (not project-specific)' }) {
  const { sortedProjects } = useData()
  return (
    <FormField label={required ? label : `${label} (optional)`} required={required} error={form.errors[name]}>
      <Select {...form.bind(name)} disabled={disabled}>
        <option value="">{required ? 'Select project' : emptyLabel}</option>
        {sortedProjects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === 'Cancelled' ? ' (cancelled)' : ''}</option>)}
      </Select>
    </FormField>
  )
}

export function MemberField({ form, name, label, required = false, emptyLabel, includeId }) {
  const { data } = useData()
  const members = data.members.filter((m) => m.is_active || m.id === includeId || m.id === form.values[name]).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <FormField label={label} required={required} error={form.errors[name]}>
      <Select {...form.bind(name)}>
        <option value="">{emptyLabel ?? 'Select member'}</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </Select>
    </FormField>
  )
}
