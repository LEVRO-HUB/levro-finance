import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
// TEMP (local preview only, not pushed/deployed): login gate bypassed so the
// UI can be reviewed without waiting on Supabase's invite/email rate limit.
// Re-enable AuthGate before pushing — Supabase RLS still blocks real data
// without a session, so this only shows empty states, never real data.
import { ToastProvider } from './components/ui/Toast'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { Expenses } from './pages/Expenses'
import { Members } from './pages/Members'
import { Contributions } from './pages/Contributions'
import { PayOut } from './pages/PayOut'
import { Transactions } from './pages/Transactions'
import { Documents } from './pages/Documents'
import { Settings } from './pages/Settings'

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/members" element={<Members />} />
              <Route path="/contributions" element={<Contributions />} />
              <Route path="/payouts" element={<PayOut />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
