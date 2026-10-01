import { useState } from 'react'
import { Landmark } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Button } from '../components/ui/Button'
import { FormField, TextInput } from '../components/ui/FormField'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setSending(false)
    if (err) {
      const msg = err.message.toLowerCase()
      setError(
        msg.includes('signups not allowed') || msg.includes('not found')
          ? "That email hasn't been invited yet. Ask a Levrotec admin to invite you in Supabase."
          : msg.includes('rate limit') || msg.includes('429')
            ? 'Too many sign-in attempts right now — wait a bit and try again.'
            : err.message,
      )
      return
    }
    setSent(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--color-navy-950)] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-2">
          <Landmark size={20} className="text-blue-600" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">Levro Finance</span>
        </div>
        {sent ? (
          <>
            <p className="mb-1 text-sm font-medium text-slate-900">Check your email</p>
            <p className="text-sm text-slate-500">We sent a sign-in link (and a 6-digit code) to {email}.</p>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <FormField label="Work email">
              <TextInput type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@levrotec.com" />
            </FormField>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={sending} className="w-full">{sending ? 'Sending…' : 'Send sign-in link'}</Button>
          </form>
        )}
      </div>
    </div>
  )
}
