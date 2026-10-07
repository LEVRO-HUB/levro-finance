import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

// items: [{ label, onClick, danger?: boolean } | null | false]
export function KebabMenu({ items }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const list = items.filter(Boolean)

  useEffect(() => {
    if (!pos) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setPos(null) }
    const hide = () => setPos(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide) }
  }, [pos])

  if (!list.length) return null

  // Fixed positioning so the menu is never clipped by a scrolling table.
  function toggle(e) {
    if (pos) return setPos(null)
    const r = e.currentTarget.getBoundingClientRect()
    const height = list.length * 32 + 10
    setPos({ top: r.bottom + height > window.innerHeight ? r.top - height : r.bottom + 4, left: Math.max(8, r.right - 176) })
  }

  return (
    <div className="inline-block" ref={ref}>
      <button type="button" onClick={toggle} aria-label="Actions" aria-haspopup="menu" className="flex h-8 w-8 min-h-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600">
        <MoreVertical size={15} />
      </button>
      {pos && (
        <div role="menu" style={pos} className="fixed z-40 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {list.map((item) => (
            <button
              key={item.label} type="button" role="menuitem"
              onClick={() => { setPos(null); item.onClick() }}
              className={`block min-h-0 w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-slate-50 ${item.danger ? 'text-red-600' : 'text-slate-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
