const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

export function FormField({ label, hint, children }) {
  return (
    <label className="mb-3.5 block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function TextInput(props) {
  return <input className={`${fieldClass} h-10`} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={`${fieldClass} h-10`} {...props}>
      {children}
    </select>
  )
}

export function TextArea(props) {
  return <textarea className={`${fieldClass} min-h-20 py-2`} {...props} />
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="mb-3.5 flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" {...props} />
      {label}
    </label>
  )
}
