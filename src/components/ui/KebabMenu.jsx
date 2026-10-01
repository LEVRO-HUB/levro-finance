import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

// items: [{ label, onClick, danger?: boolean }]
export function KebabMenu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label="Actions" className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick() }}
              className={`block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-50 ${item.danger ? 'text-red-600' : 'text-slate-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
