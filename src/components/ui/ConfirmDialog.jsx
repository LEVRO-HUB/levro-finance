import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useToast, describeError } from './Toast'

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Delete this entry?', description }) {
  const toast = useToast()
  const [working, setWorking] = useState(false)

  async function handleConfirm() {
    setWorking(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      toast.error(`Delete failed: ${describeError(err)}`)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal open={open} onClose={working ? () => {} : onClose} title={title}>
      {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={working}>Cancel</Button>
        <Button variant="danger" onClick={handleConfirm} disabled={working}>{working ? 'Deleting…' : 'Delete'}</Button>
      </div>
    </Modal>
  )
}
