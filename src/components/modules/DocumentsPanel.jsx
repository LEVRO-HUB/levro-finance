import { useMemo, useState } from 'react'
import { Download, Eye, FileText } from 'lucide-react'
import { IconButton, RowActions, Table, Td, usePaged } from '../ui/Table'
import { EmptyState } from '../ui/EmptyState'
import { KebabMenu } from '../ui/KebabMenu'
import { SearchInput } from '../ui/misc'
import { FilterBar, FilterSelect } from '../ui/Filters'
import { useFileActions, VersionHistoryModal } from '../forms/DocumentModals'
import { is, matches, useFilters } from '../../hooks/useFilters'
import { InvoiceLink, MemberLink, ProjectLink } from '../ui/links'
import { useData } from '../../store/DataProvider'
import { DOC_CATEGORIES, docCategoryLabel } from '../../services/schema'
import { formatDate, formatSize } from '../../lib/format'

export function DocumentsPanel({ projectId, modals }) {
  const { data, sortedProjects, projectName } = useData()
  const files = useFileActions()
  const { filters, set, reset, activeCount } = useFilters({ q: '', project: 'All', category: 'All', versions: 'All' })
  const [historyId, setHistoryId] = useState(null)

  const scoped = useMemo(() => data.documents.filter((d) => !projectId || d.project_id === projectId).map((d) => {
    const versions = data.document_versions.filter((v) => v.document_id === d.id).sort((a, b) => b.version - a.version)
    return { ...d, versions, current: versions[0] }
  }).filter((d) => d.current).sort((a, b) => String(b.current.uploaded_at).localeCompare(String(a.current.uploaded_at))), [data, projectId])

  const rows = useMemo(() => scoped.filter((d) =>
    is(filters.category, d.category) &&
    (filters.project === 'All' || (filters.project === '__none__' ? !d.project_id : d.project_id === filters.project)) &&
    (filters.versions === 'All' || (filters.versions === 'multi' ? d.versions.length > 1 : d.versions.length === 1)) &&
    matches(filters.q, d.name, d.description, d.current.file_name, projectName(d.project_id), docCategoryLabel(d.category))), [scoped, filters, projectName])

  const page = usePaged(rows)
  return (
    <div className="space-y-3">
      <FilterBar onReset={reset} activeCount={activeCount} summary={`${rows.length} of ${scoped.length} documents`}>
        <SearchInput value={filters.q} onChange={(v) => set('q', v)} placeholder="Search documents…" />
        {!projectId && <FilterSelect label="Projects" value={filters.project} onChange={(v) => set('project', v)} options={[{ value: '__none__', label: 'Company (no project)' }, ...sortedProjects.map((p) => ({ value: p.id, label: p.name }))]} width="w-44" />}
        <FilterSelect label="Types" value={filters.category} onChange={(v) => set('category', v)} options={DOC_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        <FilterSelect label="Versions" value={filters.versions} onChange={(v) => set('versions', v)} options={[{ value: 'multi', label: 'Has older versions' }, { value: 'single', label: 'Single version' }]} width="w-44" />
      </FilterBar>
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={scoped.length ? 'No documents match these filters' : 'No documents yet'} description={scoped.length ? undefined : 'Upload the master agreement, quotation, invoices or receipts.'} />
      ) : (
        <Table more={page.more} columns={['Name', 'Type', ...(projectId ? [] : ['Project']), 'Version', 'Size', 'Uploaded On', { label: 'Actions', align: 'right' }]}>
          {page.visible.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50/60">
              <Td className="font-medium text-slate-900"><div className="flex items-center gap-2"><FileText size={15} className="flex-shrink-0 text-red-400" /><span className="max-w-[260px] truncate" title={d.current.file_name}>{d.name}</span></div></Td>
              <Td>{docCategoryLabel(d.category)}</Td>
              {!projectId && <Td><ProjectLink id={d.project_id} fallback="Company" tab="documents" /></Td>}
              <Td><button type="button" className="min-h-0 text-blue-600 hover:underline" onClick={() => setHistoryId(d.id)} title="Version history">v{d.current.version}.0</button></Td>
              <Td>{formatSize(d.current.file_size)}</Td>
              <Td>{formatDate(d.current.uploaded_at.slice(0, 10))}</Td>
              <Td><RowActions>
                <IconButton icon={Eye} label="View" onClick={() => files.view(d.current)} />
                <IconButton icon={Download} label="Download" onClick={() => files.download(d.current)} />
                <KebabMenu items={[
                  { label: 'Replace (new version)', onClick: () => modals.open({ kind: 'document', action: 'replace', record: d }) },
                  { label: `Version history (${d.versions.length})`, onClick: () => setHistoryId(d.id) },
                  modals.canDelete && { label: 'Delete', danger: true, onClick: () => modals.open({ kind: 'document', action: 'delete', record: d }) },
                ]} />
              </RowActions></Td>
            </tr>
          ))}
        </Table>
      )}
      <VersionHistoryModal doc={data.documents.find((d) => d.id === historyId)} onClose={() => setHistoryId(null)} />
    </div>
  )
}
