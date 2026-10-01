import { useState } from 'react'
import { Menu } from 'lucide-react'
import { SidebarContent } from './Sidebar'

export function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh bg-[#f4f6f9]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Menu" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold text-slate-900">Levro Finance</span>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  )
}
