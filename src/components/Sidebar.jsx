import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, Receipt, Users, HandCoins, Wallet, ArrowLeftRight,
  FileText, Settings, FileSpreadsheet, Banknote, Armchair, BarChart3, CalendarClock, CalendarCheck,
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
      { to: '/monthly-charges', label: 'Monthly Charges', icon: CalendarCheck },
    ],
  },
  { label: 'INSIGHTS', items: [{ to: '/reports', label: 'Reports', icon: BarChart3 }] },
  { label: 'FILES', items: [{ to: '/documents', label: 'Documents', icon: FileText }] },
  { items: [{ to: '/settings', label: 'Settings', icon: Settings }] },
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-linear-to-r from-[#2563eb] to-[#0ea5e9] text-pure shadow-lg shadow-[#2563eb]/50' : 'text-pure/70 hover:bg-pure/10 hover:text-pure'
  }`

export function SidebarContent({ onNavigate, companyName = 'LEVROTEC' }) {
  return (
    <div className="brand-sidebar flex h-full flex-col text-pure/80">
      <div className="mx-3 mb-3 mt-3 flex items-center gap-3 rounded-xl border border-pure/10 bg-pure/5 px-3 py-3">
        <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width="36" height="36" className="h-9 w-9 flex-shrink-0 rounded-lg ring-1 ring-pure/15" />
        <div>
          <p className="text-sm font-semibold uppercase leading-tight tracking-wide text-pure">{companyName}</p>
          <p className="text-[11px] font-medium leading-tight text-sky-300">Finance Tracker</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.14em] text-sky-300/70">{section.label}</p>}
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
