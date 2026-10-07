import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, LogOut, Menu, Search, Settings as SettingsIcon } from 'lucide-react'
import { SidebarContent } from './Sidebar'
import { Avatar, ErrorState, Loading } from './ui/misc'
import { Button } from './ui/Button'
import { useData } from '../store/DataProvider'
import { companyPosition } from '../calculations/finance'
import { formatCurrency } from '../lib/format'

function Notifications() {
  const { data, today } = useData()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const pos = useMemo(() => companyPosition(data, today), [data, today])
  const items = [
    pos.overdueInvoices.length > 0 && { to: '/invoices?status=Overdue', text: `${pos.overdueInvoices.length} overdue invoice${pos.overdueInvoices.length > 1 ? 's' : ''}`, sub: formatCurrency(pos.overdueInvoices.reduce((a, s) => a + s.outstanding, 0)) },
    pos.pendingReimbursements > 0 && { to: '/contributions', text: 'Reimbursements pending', sub: formatCurrency(pos.pendingReimbursements) },
    pos.membersOweCompany > 0 && { to: '/contributions?tab=advances', text: 'Member advances outstanding', sub: formatCurrency(pos.membersOweCompany) },
  ].filter(Boolean)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={`Notifications (${items.length})`} onClick={() => setOpen((v) => !v)} className="relative flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
        <Bell size={18} />
        {items.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold text-slate-500">Needs attention</p>
          {items.length === 0 ? <p className="px-2 py-3 text-sm text-slate-400">Nothing pending right now.</p> : items.map((it) => (
            <Link key={it.to} to={it.to} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
              <span className="text-slate-700">{it.text}</span><span className="font-medium tabular-nums text-amber-600">{it.sub}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu({ name }) {
  const { auth, mode, can } = useData()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-label="Account menu" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100">
        <Avatar name={name} size="h-8 w-8 text-xs" />
        <span className="hidden text-sm font-medium text-slate-700 sm:block">{name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="border-b border-slate-100 px-2 pb-2">
            <p className="truncate text-sm font-medium text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-400">{mode === 'supabase' ? `${auth.user?.email} · ${can.admin ? 'Admin' : 'Member'}` : 'Local demo mode — no sign-in'}</p>
          </div>
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><SettingsIcon size={15} className="text-slate-400" /> Settings</Link>
          {mode === 'supabase' && <button type="button" role="menuitem" onClick={() => auth.signOut()} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><LogOut size={15} className="text-slate-400" /> Sign out</button>}
        </div>
      )}
    </div>
  )
}

function Topbar({ onMenu }) {
  const { data } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const name = data.settings.user_name || 'Admin'
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="flex h-9 w-9 min-h-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden">
        <Menu size={20} />
      </button>
      <form role="search" className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); navigate(`/transactions${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) }}>
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" aria-label="Search transactions" className="h-9 min-h-0 w-full rounded-lg border border-transparent bg-slate-100 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Notifications />
        <UserMenu name={name} />
      </div>
    </header>
  )
}

export function Layout({ children }) {
  const { data, loading, error, api, reload } = useData()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setMobileOpen(false); window.scrollTo(0, 0) }, [location.pathname])

  if (loading) return <div className="min-h-svh bg-[#f4f6f9]"><Loading label="Loading your finance data…" /></div>
  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title="Couldn't load finance data" message={error.message} action={<div className="flex gap-2"><Button variant="secondary" onClick={reload}>Try again</Button>{api.clearAll && <Button variant="danger" onClick={() => api.clearAll()}>Reset local data</Button>}</div>} />
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#f4f6f9]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><SidebarContent companyName={data.settings.company_name} /></aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72"><SidebarContent companyName={data.settings.company_name} onNavigate={() => setMobileOpen(false)} /></aside>
        </div>
      )}
      <div className="lg:ml-64">
        <Topbar onMenu={() => setMobileOpen(true)} />
        {data.meta.demo && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800 sm:px-6 lg:px-8">
            <span>You're looking at <strong>demo data</strong> stored in this browser. Clear it in Settings when you're ready to enter real records.</span>
            <Link to="/settings" className="font-semibold underline">Open Settings</Link>
          </div>
        )}
        <main className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
