// Who can sign in, and with which role. Admin-only; enforced by RLS and by
// the invite-user edge function (which holds the service-role key server-side).
import { toAppError } from '../errors'

export function createTeamService(supabase) {
  const check = ({ data, error }) => { if (error) throw toAppError(error); return data }
  const log = (summary) => supabase.from('activity_logs').insert({ action: 'updated', entity: 'user_access', summary }).then(() => {}, () => {})

  return {
    async list() {
      return check(await supabase.from('profiles').select('*').order('email'))
    },
    async setAccess(profile, patch) {
      const data = check(await supabase.from('profiles').update(patch).eq('id', profile.id).select('*'))
      if (!data?.length) throw toAppError({ code: '42501', message: 'permission denied' })
      const who = profile.full_name || profile.email
      if ('is_active' in patch) await log(`${patch.is_active ? 'Activated' : 'Deactivated'} sign-in access for ${who}`)
      if ('role' in patch) await log(`Changed ${who}'s role to ${patch.role}`)
      return data[0]
    },
    async invite(email, full_name) {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, full_name, redirect_to: window.location.origin + import.meta.env.BASE_URL },
      })
      if (error) {
        let detail = ''
        try { detail = (await error.context?.json())?.error ?? '' } catch { /* not JSON */ }
        throw toAppError(Object.assign(new Error(detail || error.message), { name: detail ? 'ValidationError' : 'Error' }))
      }
      return data
    },
  }
}
