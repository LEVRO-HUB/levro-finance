import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'

// Sign-in state for the shared (Supabase) backend.
//   signed_out → Login          set_password → invite / reset link was opened
//   inactive   → account exists but an admin has not activated it yet
//   ready      → active profile; the app loads
// Without Supabase configured the app runs in local demo mode with no sign-in.
const LOCAL = { mode: 'local', status: 'ready', user: null, profile: null, isAdmin: true, signOut: async () => {} }
const AuthContext = createContext(LOCAL)

// An invite or password-reset link lands here with this marker in the URL.
const arrivedFromEmailLink = typeof window !== 'undefined' && /type=(recovery|invite)/.test(window.location.hash + window.location.search)

function RemoteAuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(undefined)
  const [needsPassword, setNeedsPassword] = useState(arrivedFromEmailLink)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true)
      setSession(next ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id ?? null
  const loadProfile = useCallback(async () => {
    if (!userId) return setProfile(null)
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(error ? null : data ?? null)
  }, [userId])
  useEffect(() => { setProfile(undefined); loadProfile() }, [loadProfile]) // eslint-disable-line react-hooks/set-state-in-effect

  const value = useMemo(() => {
    let status = 'ready'
    if (session === undefined || (session && profile === undefined)) status = 'loading'
    else if (!session) status = 'signed_out'
    else if (needsPassword) status = 'set_password'
    else if (!profile?.is_active) status = 'inactive'
    return {
      mode: 'supabase', status, user: session?.user ?? null, profile: profile ?? null,
      isAdmin: status === 'ready' && profile?.role === 'admin',
      refreshProfile: loadProfile,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signOut() { await supabase.auth.signOut() },
      async sendPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + import.meta.env.BASE_URL })
        if (error) throw error
      },
      async setPassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setNeedsPassword(false)
        window.history.replaceState(null, '', window.location.pathname)
      },
    }
  }, [session, profile, needsPassword, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }) {
  return isSupabaseConfigured ? <RemoteAuthProvider>{children}</RemoteAuthProvider> : children
}

export function useAuth() {
  return useContext(AuthContext)
}
