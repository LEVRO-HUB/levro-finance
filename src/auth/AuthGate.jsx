import { useAuth } from './AuthProvider'
import { Login } from '../pages/Login'

export function AuthGate({ children }) {
  const { loading, user } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--color-navy-950)] text-sm text-slate-400">
        Loading…
      </div>
    )
  }
  if (!user) return <Login />
  return children
}
