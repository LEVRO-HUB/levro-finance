import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (message, { type = 'error', duration = type === 'error' ? 8000 : 3500 } = {}) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, type }])
      if (duration) setTimeout(() => dismiss(id), duration)
      return id
    },
    [dismiss],
  )

  const toast = {
    success: (message) => push(message, { type: 'success' }),
    error: (message) => push(message, { type: 'error' }),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              t.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            {t.type === 'error' ? <XCircle size={18} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function describeError(err) {
  if (!err) return 'Something went wrong.'
  if (typeof err === 'string') return err
  const parts = [err.message, err.details, err.hint].filter(Boolean)
  return parts.length ? parts.join(' — ') : 'Something went wrong. Check the browser console for details.'
}
