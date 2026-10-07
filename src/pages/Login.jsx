import { useState } from 'react'
import { Landmark } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { FormField, TextInput } from '../components/ui/FormField'

const Brand = ({ sub }) => (
  <div className="mb-5">
    <div className="flex items-center gap-2"><Landmark size={20} className="text-blue-600" /><span className="text-lg font-semibold tracking-tight text-slate-900">Levrotec Finance Tracker</span></div>
    <p className="mt-1 text-sm text-slate-500">{sub}</p>
  </div>
)

function friendly(err) {
  const msg = String(err?.message ?? err).toLowerCase()
  if (msg.includes('invalid login credentials')) return 'That email and password don’t match.'
  if (msg.includes('email not confirmed')) return 'This email hasn’t been confirmed yet. Open the invite email first.'
  if (msg.includes('rate limit') || msg.includes('429')) return 'Too many attempts right now — wait a few minutes and try again.'
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Could not reach the server. Check your connection.'
  if (msg.includes('should be different')) return 'Choose a password you haven’t used here before.'
  return err?.message ?? 'Something went wrong.'
}

export function Login() {
  const auth = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'forgot' | 'sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (mode === 'signin') await auth.signIn(email.trim(), password)
      else { await auth.sendPasswordReset(email.trim()); setMode('sent') }
    } catch (err) {
      setError(friendly(err))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'sent') {
    return (
      <>
        <Brand sub="Check your email" />
        <p className="mb-4 text-sm text-slate-600">If <strong>{email}</strong> has an account, a link to set a new password is on its way.</p>
        <Button variant="secondary" className="w-full" onClick={() => setMode('signin')}>Back to sign in</Button>
      </>
    )
  }
  return (
    <form onSubmit={submit} noValidate>
      <Brand sub={mode === 'signin' ? 'Sign in with your work email' : 'We’ll email you a link to set a new password'} />
      <FormField label="Email"><TextInput type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@levrotec.com" /></FormField>
      {mode === 'signin' && <FormField label="Password"><TextInput type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></FormField>}
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy || !email || (mode === 'signin' && !password)} className="w-full">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}</Button>
      <button type="button" className="mt-3 w-full text-center text-xs font-medium text-blue-600 hover:underline" onClick={() => { setMode(mode === 'signin' ? 'forgot' : 'signin'); setError('') }}>
        {mode === 'signin' ? 'Forgot password?' : 'Back to sign in'}
      </button>
      <p className="mt-4 text-center text-xs text-slate-400">Access is by invitation only. Ask a Levrotec admin if you need an account.</p>
    </form>
  )
}

// Shown after opening an invite or password-reset link.
export function SetPassword() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const problem = password.length < 10 ? 'Use at least 10 characters.' : password !== confirm ? 'The two passwords don’t match.' : ''

  async function submit(e) {
    e.preventDefault()
    if (problem) return setError(problem)
    setBusy(true); setError('')
    try { await auth.setPassword(password) } catch (err) { setError(friendly(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} noValidate>
      <Brand sub={`Set a password for ${auth.user?.email ?? 'your account'}`} />
      <FormField label="New password" hint="At least 10 characters."><TextInput type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} /></FormField>
      <FormField label="Confirm password"><TextInput type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></FormField>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy} className="w-full">{busy ? 'Saving…' : 'Save password'}</Button>
      <button type="button" className="mt-3 w-full text-center text-xs font-medium text-slate-500 hover:underline" onClick={auth.signOut}>Sign out</button>
    </form>
  )
}
