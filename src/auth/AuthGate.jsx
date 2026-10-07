import { useAuth } from './AuthProvider'
import { Login, SetPassword } from '../pages/Login'
import { Button } from '../components/ui/Button'

const Shell = ({ children }) => (
  <div className="flex min-h-svh items-center justify-center bg-[var(--color-navy-950)] px-4">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">{children}</div>
  </div>
)

export function AuthGate({ children }) {
  const auth = useAuth()
  if (auth.status === 'ready') return children
  if (auth.status === 'loading') return <div className="flex min-h-svh items-center justify-center bg-[var(--color-navy-950)] text-sm text-slate-400" role="status">Loading…</div>
  if (auth.status === 'signed_out') return <Shell><Login /></Shell>
  if (auth.status === 'set_password') return <Shell><SetPassword /></Shell>
  return (
    <Shell>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Waiting for activation</h1>
      <p className="mb-1 text-sm text-slate-600">You're signed in as <strong>{auth.user?.email}</strong>, but a Levrotec admin hasn't activated this account yet.</p>
      <p className="mb-5 text-sm text-slate-500">Ask an admin to activate you under Settings → Team access, then check again.</p>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={auth.refreshProfile}>Check again</Button>
        <Button variant="secondary" onClick={auth.signOut}>Sign out</Button>
      </div>
    </Shell>
  )
}
