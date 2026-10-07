import { Upload } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/misc'
import { DocumentsPanel } from '../components/modules/DocumentsPanel'
import { useRecordModals } from '../components/modules/RecordModals'

export function Documents() {
  const modals = useRecordModals()
  return (
    <div className="space-y-4">
      <PageHeader title="Documents" subtitle="Central repository for all your files — agreements, invoices and receipts">
        <Button onClick={() => modals.open({ kind: 'document', action: 'add' })}><Upload size={16} /> Upload Document</Button>
      </PageHeader>
      <DocumentsPanel modals={modals} />
      {modals.element}
    </div>
  )
}
