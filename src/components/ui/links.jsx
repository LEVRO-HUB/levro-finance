import { Link } from 'react-router-dom'
import { useData } from '../../store/DataProvider'

const cls = 'hover:text-blue-600 hover:underline'

// Names that take you to the thing they name, wherever they appear.
export function ProjectLink({ id, fallback = '—', tab = '' }) {
  const { projectById } = useData()
  const p = id ? projectById?.get(id) : null
  if (!p) return fallback
  return <Link to={`/projects/${p.slug}${tab ? `/${tab}` : ''}`} className={cls} title={`Open project ${p.name}`}>{p.name}</Link>
}

// A member's name opens every transaction that involves them.
export function MemberLink({ id, fallback = '—', to = 'transactions' }) {
  const { memberById } = useData()
  const m = id ? memberById?.get(id) : null
  if (!m) return fallback
  return <Link to={`/${to}?member=${m.id}`} className={cls} title={`Show ${to} for ${m.name}`}>{m.name}</Link>
}

export function InvoiceLink({ id, fallback = '—' }) {
  const { data, projectById } = useData()
  const inv = id ? data.invoices.find((i) => i.id === id) : null
  const p = inv && projectById.get(inv.project_id)
  if (!inv || !p) return fallback
  return <Link to={`/projects/${p.slug}/invoices`} className={cls} title={`Open ${inv.invoice_number} in ${p.name}`}>{inv.invoice_number}</Link>
}
