import { useMemo, useState } from 'react'
import { Search, Upload, Download, FileText } from 'lucide-react'
import { useSupabaseTable } from '../hooks/useSupabaseTable'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { EmptyState } from '../components/ui/EmptyState'
import { Table, Td } from '../components/ui/Table'
import { FormField, TextInput, Select } from '../components/ui/FormField'
import { useToast, describeError } from '../components/ui/Toast'
import { formatDate } from '../lib/format'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = [
  { id: 'master_agreement', label: 'Master Agreement' }, { id: 'quotation', label: 'Quotation' },
  { id: 'proposal', label: 'Proposal' }, { id: 'requirements', label: 'Requirements' },
  { id: 'invoice', label: 'Invoice' }, { id: 'other', label: 'Other' },
]

function formatSize(bytes) {
  if (!bytes) return '—'
  const kb = bytes / 1024
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

export function Documents() {
  const toast = useToast()
  const docs = useSupabaseTable('documents', { orderBy: 'uploaded_at', ascending: false })
  const projects = useSupabaseTable('projects', { orderBy: 'name', ascending: true })

  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')

  const projectName = (id) => projects.data.find((p) => p.id === id)?.name ?? '—'

  const filtered = useMemo(
    () => docs.data.filter((d) =>
      d.is_current &&
      (projectFilter === 'All' || d.project_id === projectFilter) &&
      (typeFilter === 'All' || d.category === typeFilter) &&
      (!search || d.file_name.toLowerCase().includes(search.toLowerCase())),
    ),
    [docs.data, projectFilter, typeFilter, search],
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ project_id: '', category: 'other', file: null })
  const [saving, setSaving] = useState(false)

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.file || !form.project_id) return
    setSaving(true)
    try {
      const path = `projects/${form.project_id}/${Date.now()}-${form.file.name}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, form.file)
      if (upErr) throw upErr
      await docs.insert({ project_id: form.project_id, category: form.category, file_name: form.file.name, storage_path: path, file_size: form.file.size })
      setModalOpen(false)
      setForm({ project_id: '', category: 'other', file: null })
      toast.success('Document uploaded.')
    } catch (err) {
      toast.error(`Could not upload this document: ${describeError(err)}`)
    } finally {
      setSaving(false)
    }
  }

  async function downloadDoc(doc) {
    const { data, error: err } = await supabase.storage.from('documents').createSignedUrl(doc.storage_path, 60)
    if (err) { toast.error(`Could not open this file: ${describeError(err)}`); return }
    window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500">Central repository for all your files</p>
        </div>
        <Button onClick={() => setModalOpen(true)}><Upload size={16} /> Upload Document</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" />
        </div>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="w-44">
          <option value="All">All projects</option>
          {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-40">
          <option value="All">All types</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>

      {docs.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">Couldn't load documents: {describeError(docs.error)}</p>}

      {docs.loading ? <div className="py-16 text-center text-sm text-slate-400">Loading…</div> : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="No documents found" />
      ) : (
        <Table columns={['File Name', 'Type', 'Project', 'Size', 'Uploaded Date', 'Actions']}>
          {filtered.map((d) => (
            <tr key={d.id}>
              <Td className="font-medium text-slate-900">{d.file_name}</Td>
              <Td>{CATEGORIES.find((c) => c.id === d.category)?.label ?? d.category}</Td>
              <Td>{projectName(d.project_id)}</Td>
              <Td>{formatSize(d.file_size)}</Td>
              <Td>{formatDate(d.uploaded_at?.slice(0, 10))}</Td>
              <Td><button onClick={() => downloadDoc(d)} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Download size={14} /></button></Td>
            </tr>
          ))}
        </Table>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Upload Document">
        <form onSubmit={handleUpload}>
          <FormField label="Project">
            <Select required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">Select a project…</option>
              {projects.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Type">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </FormField>
          <FormField label="File"><input type="file" required onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} className="block w-full text-sm" /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Uploading…' : 'Upload'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
