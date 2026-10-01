import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { AuthGate } from './auth/AuthGate'
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
        <AuthGate>
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
        </AuthGate>
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
