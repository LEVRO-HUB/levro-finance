import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Receipt, Users, HandCoins, Wallet, ArrowLeftRight,
  FileText, Settings, Landmark, LogOut,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'

const SECTIONS = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'BUSINESS',
    items: [
      { to: '/projects', label: 'Projects', icon: Briefcase },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { to: '/contributions', label: 'Contributions & Repayments', icon: HandCoins },
      { to: '/payouts', label: 'Pay Out', icon: Wallet },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    ],
  },
  { label: 'FILES', items: [{ to: '/documents', label: 'Documents', icon: FileText }] },
  { items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

export function SidebarContent({ onNavigate }) {
  const { user, signOut } = useAuth()
  return (
    <div className="flex h-full flex-col bg-[var(--color-navy-950)] text-slate-200">
      <div className="flex items-center gap-2 px-5 py-5">
        <Landmark size={22} className="text-blue-400" />
        <div>
          <p className="text-sm font-semibold leading-tight text-white">LEVROTEC</p>
          <p className="text-[11px] leading-tight text-slate-400">Finance Tracker</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-slate-500">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {user && (
        <div className="border-t border-white/10 px-3 py-3">
          <div className="mb-1 truncate px-3 text-xs text-slate-400">{user.email}</div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
