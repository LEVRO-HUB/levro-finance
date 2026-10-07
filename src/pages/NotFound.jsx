import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Compass size={32} className="mb-3 text-slate-300" />
      <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">That address doesn't match anything in the finance tracker.</p>
      <Link to="/" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-pure hover:bg-blue-700">Back to dashboard</Link>
    </div>
  )
}
