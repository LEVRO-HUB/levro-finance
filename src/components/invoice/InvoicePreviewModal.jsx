import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Printer } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { InvoiceDocument } from './InvoiceDocument'
import { useData } from '../../store/DataProvider'

const A4_PX = 793.7 // 210mm at 96dpi

function printRoot() {
  let el = document.getElementById('print-root')
  if (!el) { el = document.createElement('div'); el.id = 'print-root'; document.body.appendChild(el) }
  return el
}

// Shows the invoice exactly as it will print, and saves it as a PDF through the
// device's own print dialog ("Save as PDF"), so the file is sharp, selectable text.
export function InvoicePreviewModal({ invoiceId, onClose }) {
  const { data } = useData()
  const invoice = invoiceId ? data.invoices.find((i) => i.id === invoiceId) : null
  const doc = invoice && <InvoiceDocument invoice={invoice} project={data.projects.find((p) => p.id === invoice.project_id)} settings={data.settings} />
  const box = useRef(null)
  const [scale, setScale] = useState(0.5)
  const [height, setHeight] = useState(0)
  const page = useRef(null)

  useLayoutEffect(() => {
    if (!invoice || !box.current) return
    const fit = () => {
      const k = Math.min(1, box.current.clientWidth / A4_PX)
      setScale(k)
      setHeight((page.current?.offsetHeight ?? 0) * k)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [invoice])

  useEffect(() => {
    if (!invoice) return
    const done = () => { document.title = previous }
    const previous = document.title
    window.addEventListener('afterprint', done)
    return () => { window.removeEventListener('afterprint', done); document.title = previous }
  }, [invoice])

  if (!invoice) return null
  const save = () => { document.title = invoice.invoice_number; window.print() } // the PDF takes this name

  return (
    <Modal open onClose={onClose} title={`Invoice ${invoice.invoice_number}`} wide>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">In the dialog that opens, choose <strong>Save as PDF</strong> to download it, or pick a printer.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={save}><Printer size={16} /> Print</Button>
          <Button onClick={save}><Download size={16} /> Download PDF</Button>
        </div>
      </div>
      <div ref={box} className="overflow-hidden rounded-lg border border-slate-200 bg-pure" style={{ height: height || undefined }}>
        <div ref={page} style={{ width: A4_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{doc}</div>
      </div>
      {createPortal(doc, printRoot())}
    </Modal>
  )
}
