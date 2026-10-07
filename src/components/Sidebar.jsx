import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Receipt, Users, HandCoins, Wallet, ArrowLeftRight,
  FileText, Settings, Landmark, FileSpreadsheet, Banknote, Armchair, BarChart3, CalendarClock,
} from 'lucide-react'

export const NAV_SECTIONS = [
  { items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'BUSINESS',
    items: [
      { to: '/projects', label: 'Projects', icon: Briefcase },
      { to: '/invoices', label: 'Invoices', icon: FileSpreadsheet },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/assets', label: 'Purchases & Assets', icon: Armchair },
      { to: '/members', label: 'Members', icon: Users },
    ],
  },
  {
    label: 'MONEY',
    items: [
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/payments', label: 'Payments', icon: Banknote },
      { to: '/contributions', label: 'Contributions & Repayments', icon: HandCoins },
      { to: '/payouts', label: 'Pay Out', icon: Wallet },
      { to: '/bills', label: 'Monthly Bills', icon: CalendarClock },
    ],
  },
  { label: 'INSIGHTS', items: [{ to: '/reports', label: 'Reports', icon: BarChart3 }] },
  { label: 'FILES', items: [{ to: '/documents', label: 'Documents', icon: FileText }] },
  { items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`

export function SidebarContent({ onNavigate, companyName = 'LEVROTEC' }) {
  return (
    <div className="flex h-full flex-col bg-[var(--color-navy-950)] text-slate-200">
      <div className="flex items-center gap-2 px-5 py-5">
        <Landmark size={22} className="text-blue-400" />
        <div>
          <p className="text-sm font-semibold uppercase leading-tight tracking-wide text-white">{companyName}</p>
          <p className="text-[11px] leading-tight text-slate-400">Finance Tracker</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-slate-500">{section.label}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
                  <item.icon size={17} className="flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
