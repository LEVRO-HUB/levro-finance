import { createClient } from '@supabase/supabase-js'

// Public values only. The publishable (anon) key is safe in a browser because
// every table and the storage bucket are protected by Row Level Security.
// NEVER put a service-role / secret key in a VITE_ variable.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

function looksSecret(k) {
  if (/^sb_secret_/.test(k)) return true
  try { return /service_role/.test(atob((k.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) } catch { return false }
}
if (key && looksSecret(key)) {
  throw new Error('A secret / service-role Supabase key was put in a VITE_ variable. Use the publishable (anon) key only.')
}

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null
