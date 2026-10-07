import { Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/ui/Toast'
import { DataProvider } from './store/DataProvider'
import { AuthProvider } from './auth/AuthProvider'
import { AuthGate } from './auth/AuthGate'
import { Layout } from './components/Layout'
import { ErrorState } from './components/ui/misc'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Invoices } from './pages/Invoices'
import { Expenses } from './pages/Expenses'
import { Assets } from './pages/Assets'
import { Members } from './pages/Members'
import { Transactions } from './pages/Transactions'
import { Payments } from './pages/Payments'
import { Contributions } from './pages/Contributions'
import { PayOut } from './pages/PayOut'
import { Bills } from './pages/Bills'
import { MonthlyCharges } from './pages/MonthlyCharges'
import { Reports } from './pages/Reports'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'
import { NotFound } from './pages/NotFound'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error(error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState title="This page hit an unexpected error" message={String(this.state.error?.message ?? this.state.error)} action={<button type="button" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200" onClick={() => window.location.reload()}>Reload</button>} />
      </div>
    )
  }
}

// With Supabase configured the app requires sign-in (AuthGate) and reads the
// shared database; without it, it runs in local demo mode with no sign-in.
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
        <DataProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Layout>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/projects" element={<Projects />} />
                  <Route path="/projects/:slug/:tab?" element={<ProjectDetail />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/assets" element={<Assets />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/contributions" element={<Contributions />} />
                  <Route path="/payouts" element={<PayOut />} />
                  <Route path="/bills" element={<Bills />} />
                  <Route path="/monthly-charges" element={<MonthlyCharges />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
            </Layout>
          </BrowserRouter>
        </DataProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
