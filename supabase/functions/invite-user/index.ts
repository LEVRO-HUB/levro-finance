// Invites a teammate by email. Only an ACTIVE ADMIN may call it.
// The service-role key lives only here, on the server — never in the browser.
// The invited account starts inactive; an admin activates it in Settings.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' })

  const url = Deno.env.get('SUPABASE_URL')!
  const authorization = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'Sign in first.' })

  // Read through the caller's own permissions (RLS), not the service role.
  const { data: me } = await caller.from('profiles').select('role, is_active').eq('id', user.id).maybeSingle()
  if (!me?.is_active || me.role !== 'admin') return json(403, { error: 'Only an admin can invite people.' })

  let body: { email?: string; full_name?: string; redirect_to?: string }
  try { body = await req.json() } catch { return json(400, { error: 'Invalid request.' }) }
  const email = String(body.email ?? '').trim().toLowerCase()
  const fullName = String(body.full_name ?? '').trim().slice(0, 120)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: 'Enter a valid email address.' })

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: typeof body.redirect_to === 'string' ? body.redirect_to : undefined, // only honoured if allow-listed in Auth settings
  })
  if (error) {
    const already = /already.*registered|already exists/i.test(error.message)
    return json(already ? 409 : 400, { error: already ? 'That email already has an account.' : error.message })
  }
  await caller.from('activity_logs').insert({ action: 'created', entity: 'user_access', summary: `Invited ${fullName || email} (${email})` })
  return json(200, { ok: true })
})
