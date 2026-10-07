import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeftRight, Bell, Briefcase, LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Receipt, Search, Settings as SettingsIcon, Sun } from 'lucide-react'
import { SidebarContent } from './Sidebar'
import { Avatar, ErrorState, Loading } from './ui/misc'
import { Button } from './ui/Button'
import { useData } from '../store/DataProvider'
import { companyPosition } from '../calculations/finance'
import { formatCurrency } from '../lib/format'
import { getTheme, setTheme } from '../lib/theme'

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
        <div className="absolute right-0 z-40 mt-2 w-72 surface rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg">
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

function ThemeToggle() {
  const [theme, set] = useState(getTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button type="button" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => { setTheme(next); set(next) }} className="flex h-9 w-9 min-h-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800">
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
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
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 surface rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg">
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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="flex h-9 w-9 min-h-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden">
        <Menu size={20} />
      </button>
      <form role="search" className="relative max-w-md flex-1" onSubmit={(e) => { e.preventDefault(); navigate(`/transactions${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) }}>
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" aria-label="Search transactions" className="h-9 min-h-0 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Notifications />
        <UserMenu name={name} />
      </div>
    </header>
  )
}

// Phone-only: the four most-used pages one thumb-tap away, like a native app.
const QUICK = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: Briefcase },
  { to: '/transactions', label: 'Ledger', icon: ArrowLeftRight },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
]
function BottomBar({ onMore }) {
  const item = 'flex min-h-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold transition-colors'
  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 px-2 pt-1.5 backdrop-blur-lg lg:hidden" style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto flex max-w-md items-stretch gap-1">
        {QUICK.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `${item} ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
            {({ isActive }) => (<><span className={`flex h-8 w-12 items-center justify-center rounded-full ${isActive ? 'bg-linear-to-r from-[#2563eb] to-[#0ea5e9] text-pure shadow-lg shadow-[#2563eb]/50' : ''}`}><Icon size={18} /></span>{label}</>)}
          </NavLink>
        ))}
        <button type="button" onClick={onMore} aria-label="More pages" className={`${item} text-slate-500`}><span className="flex h-8 w-12 items-center justify-center rounded-full"><MoreHorizontal size={18} /></span>More</button>
      </div>
    </nav>
  )
}

export function Layout({ children }) {
  const { data, loading, error, api, reload } = useData()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { setMobileOpen(false); window.scrollTo(0, 0) }, [location.pathname])

  if (loading) return <div className="app-canvas min-h-svh"><Loading label="Loading your finance data…" /></div>
  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title="Couldn't load finance data" message={error.message} action={<div className="flex gap-2"><Button variant="secondary" onClick={reload}>Try again</Button>{api.clearAll && <Button variant="danger" onClick={() => api.clearAll()}>Reset local data</Button>}</div>} />
      </div>
    )
  }

  return (
    <div className="app-canvas min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><SidebarContent companyName={data.settings.company_name} /></aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
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
        <main className="px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">{children}</main>
      </div>
      <BottomBar onMore={() => setMobileOpen(true)} />
    </div>
  )
}
