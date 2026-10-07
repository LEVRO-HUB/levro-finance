import { Modal } from '../ui/Modal'
import { FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid } from './common'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { PROJECT_STATUSES } from '../../services/schema'
import { todayISO } from '../../lib/format'

function Body({ project, onClose, onSaved }) {
  const { api } = useData()
  const f = useForm({
    name: project?.name ?? '', client_name: project?.client_name ?? '', project_number: project?.project_number ?? '',
    contract_value: project?.contract_value ?? '', start_date: project?.start_date ?? (project ? '' : todayISO()), end_date: project?.end_date ?? '',
    payment_terms: project?.payment_terms ?? '', status: project?.status ?? 'Active', description: project?.description ?? '', notes: project?.notes ?? '',
  })
  return (
    <form noValidate onSubmit={(e) => f.submit(e, (v) => api.saveProject(v, project?.id), { success: project ? 'Project updated.' : 'Project created.', onDone: (row) => { onSaved?.(row); onClose() } })}>
      <Grid>
        <FormField label="Project Name" required error={f.errors.name}><TextInput autoFocus {...f.bind('name')} placeholder="e.g. Chippy ERP" /></FormField>
        <FormField label="Client" error={f.errors.client_name}><TextInput {...f.bind('client_name')} /></FormField>
        <FormField label="Project Number / Code" error={f.errors.project_number}><TextInput {...f.bind('project_number')} placeholder="e.g. CP-001" /></FormField>
        <FormField label="Contract Value (₹)" required error={f.errors.contract_value}><TextInput type="number" inputMode="decimal" min="0" step="0.01" {...f.bind('contract_value')} /></FormField>
        <FormField label="Start Date" error={f.errors.start_date}><TextInput type="date" {...f.bind('start_date')} /></FormField>
        <FormField label="End Date" error={f.errors.end_date}><TextInput type="date" {...f.bind('end_date')} /></FormField>
        <FormField label="Payment Terms" error={f.errors.payment_terms}><TextInput {...f.bind('payment_terms')} placeholder="e.g. 50% advance, 50% on completion" /></FormField>
        <FormField label="Status" required error={f.errors.status}>
          <Select {...f.bind('status')}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </FormField>
      </Grid>
      <FormField label="Description"><TextArea {...f.bind('description')} /></FormField>
      <FormField label="Notes"><TextArea {...f.bind('notes')} /></FormField>
      <FormActions onCancel={onClose} saving={f.saving} label={project ? 'Save Changes' : 'Create Project'} />
    </form>
  )
}

export function ProjectFormModal({ open, onClose, project, onSaved }) {
  return <Modal open={open} onClose={onClose} title={project ? 'Edit Project' : 'New Project'} wide><Body project={project} onClose={onClose} onSaved={onSaved} /></Modal>
}
