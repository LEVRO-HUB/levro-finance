import { cloneElement, isValidElement, useId } from 'react'
import { Upload } from 'lucide-react'

const base =
  'rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400'
const ok = 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'
const bad = 'border-red-300 focus:border-red-500 focus:ring-red-100'
// A caller-supplied width (w-40 …) replaces the default full width instead of fighting it.
const cls = (invalid, extra, className) => `${base} ${/(^|\s)w-/.test(className ?? '') ? '' : 'w-full'} ${invalid ? bad : ok} ${extra} ${className ?? ''}`

// The label is linked by id (not by wrapping) so a select's options never
// leak into the field's accessible name.
export function FormField({ label, hint, error, required, children, className = '' }) {
  const id = useId()
  const child = isValidElement(children) && typeof children.type !== 'string' && !children.props.id ? cloneElement(children, { id }) : children
  const msgId = `${id}-msg`
  return (
    <div className={`mb-3.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-600">
          {label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
      )}
      {child}
      {error ? <span id={msgId} role="alert" className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span id={msgId} className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </div>
  )
}

export function TextInput({ className, invalid, ...props }) {
  return <input className={cls(invalid, 'h-10', className)} aria-invalid={invalid || undefined} {...props} />
}

export function Select({ children, className, invalid, ...props }) {
  return <select className={cls(invalid, 'h-10 pr-8', className)} aria-invalid={invalid || undefined} {...props}>{children}</select>
}

export function TextArea({ className, invalid, ...props }) {
  return <textarea className={cls(invalid, 'min-h-20 py-2', className)} aria-invalid={invalid || undefined} {...props} />
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="mb-3.5 flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 min-h-0 rounded border-slate-300 text-blue-600" {...props} />
      {label}
    </label>
  )
}

export function FileDrop({ file, onChange, existing, invalid, id }) {
  return (
    <label
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onChange(f) }}
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs text-slate-400 focus-within:border-blue-400 hover:border-blue-300 hover:bg-blue-50/30 ${invalid ? 'border-red-300' : 'border-slate-200'}`}
    >
      <Upload size={16} />
      <span className={file ? 'font-medium text-slate-700' : ''}>{file ? file.name : existing ? `Current: ${existing} — click to replace` : 'Click to upload or drag and drop'}</span>
      <span>PDF, JPG, PNG, DOC, ZIP (max 5 MB)</span>
      <input id={id} type="file" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  )
}
