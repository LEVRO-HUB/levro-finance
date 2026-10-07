import { Download, Eye } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { FileDrop, FormField, Select, TextArea, TextInput } from '../ui/FormField'
import { FormActions, Grid, ProjectField } from './common'
import { IconButton, RowActions, Table, Td } from '../ui/Table'
import { useForm } from '../../hooks/useForm'
import { useData } from '../../store/DataProvider'
import { useToast, describeError } from '../ui/Toast'
import { DOC_CATEGORIES } from '../../services/schema'
import { formatDateTime, formatSize } from '../../lib/format'
import { downloadBlob } from '../../lib/csv'

export function useFileActions() {
  const { api } = useData()
  const toast = useToast()
  async function open(version, mode) {
    try {
      const { blob, url, file_name, mime_type } = await api.getFile(version.id, { download: mode === 'download' })
      if (url) {
        // short-lived signed link to the private bucket
        if (mode === 'download') { const a = document.createElement('a'); a.href = url; a.download = file_name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove() }
        else window.open(url, '_blank', 'noopener')
        return
      }
      const typed = blob.type ? blob : new Blob([blob], { type: mime_type })
      if (mode === 'download') return downloadBlob(typed, file_name)
      const objectUrl = URL.createObjectURL(typed)
      const win = window.open(objectUrl, '_blank', 'noopener')
      if (!win) downloadBlob(typed, file_name)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (err) {
      toast.error(describeError(err))
    }
  }
  return { view: (v) => open(v, 'view'), download: (v) => open(v, 'download') }
}

function UploadBody({ lockProjectId, doc, onClose }) {
  const { api } = useData()
  const f = useForm({ file: null, name: doc?.name ?? '', category: doc?.category ?? 'other', project_id: doc?.project_id ?? lockProjectId ?? '', description: doc?.description ?? '' })
  const save = (v) => {
    if (doc) return v.file ? api.replaceDocument(doc.id, v.file) : Promise.reject(Object.assign(new Error('Choose a file.'), { name: 'ValidationError', fields: { file: 'Choose the new file.' } }))
    return api.uploadDocument({ ...v, project_id: v.project_id || null })
  }
  return (
    <form noValidate onSubmit={(e) => f.submit(e, save, { success: doc ? 'New version uploaded.' : 'Document uploaded.', onDone: onClose })}>
      {doc && <p className="mb-3.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Uploading a new version of <strong>{doc.name}</strong>. Earlier versions stay available in its version history.</p>}
      <FormField label="File" required error={f.errors.file}><FileDrop file={f.values.file} invalid={!!f.errors.file} onChange={(file) => { f.set('file', file); if (file && !f.values.name) f.set('name', file.name) }} /></FormField>
      {!doc && (
        <>
          <Grid>
            <FormField label="Name" error={f.errors.name}><TextInput {...f.bind('name')} placeholder="Enter file name" /></FormField>
            <FormField label="Type" required error={f.errors.category}>
              <Select {...f.bind('category')}>{DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </FormField>
          </Grid>
          <ProjectField form={f} disabled={!!lockProjectId} emptyLabel="Company (no project)" />
          <FormField label="Description"><TextArea {...f.bind('description')} placeholder="Add description (optional)" /></FormField>
        </>
      )}
      <FormActions onCancel={onClose} saving={f.saving} label={doc ? 'Upload New Version' : 'Upload'} savingLabel="Uploading…" />
    </form>
  )
}

export function DocumentUploadModal({ open, onClose, lockProjectId, replaceDoc }) {
  return <Modal open={open} onClose={onClose} title={replaceDoc ? 'Replace Document' : 'Upload Document'} wide={!replaceDoc}><UploadBody lockProjectId={lockProjectId} doc={replaceDoc} onClose={onClose} /></Modal>
}

export function VersionHistoryModal({ doc, onClose }) {
  const { data } = useData()
  const files = useFileActions()
  const versions = doc ? data.document_versions.filter((v) => v.document_id === doc.id).sort((a, b) => b.version - a.version) : []
  return (
    <Modal open={!!doc} onClose={onClose} title={`Version history — ${doc?.name ?? ''}`} wide>
      <Table columns={['Version', 'File', 'Size', 'Uploaded', { label: 'Actions', align: 'right' }]}>
        {versions.map((v, i) => (
          <tr key={v.id}>
            <Td className="font-medium text-slate-900">v{v.version}{i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">Current</span>}</Td>
            <Td>{v.file_name}</Td>
            <Td>{formatSize(v.file_size)}</Td>
            <Td>{formatDateTime(v.uploaded_at)}</Td>
            <Td><RowActions><IconButton icon={Eye} label="View" onClick={() => files.view(v)} /><IconButton icon={Download} label="Download" onClick={() => files.download(v)} /></RowActions></Td>
          </tr>
        ))}
      </Table>
    </Modal>
  )
}
