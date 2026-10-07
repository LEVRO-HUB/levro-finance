// The only file that talks to Supabase for finance data. Deliberately thin:
// every rule lives either in the service layer above or in the database below.
import { ValidationError } from '../errors'
import { BUCKET } from './tables'

const denied = (what) => new ValidationError(`You don't have permission to ${what}, or it no longer exists.`)

export function createSupabaseGateway(supabase) {
  const check = ({ data, error }) => { if (error) throw error; return data }

  return {
    // One page of a table (inclusive row range), in a stable order.
    async selectPage(table, { orderBy = ['created_at', 'id'], ascending = true, from = 0, to = 999 } = {}) {
      let q = supabase.from(table).select('*')
      for (const col of orderBy) q = q.order(col, { ascending })
      return check(await q.range(from, to))
    },
    async insert(table, rows) { check(await supabase.from(table).insert(rows)) },
    // RLS hides rows silently on update/delete, so "0 rows changed" is reported as a refusal.
    async update(table, id, patch) {
      const data = check(await supabase.from(table).update(patch).eq('id', id).select('id'))
      if (!data?.length) throw denied('change this')
    },
    async remove(table, id) {
      const data = check(await supabase.from(table).delete().eq('id', id).select('id'))
      if (!data?.length) throw denied('delete this')
    },
    async getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      return check(await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle())
    },
    async updateOwnName(full_name) {
      const { data: { user } } = await supabase.auth.getUser()
      const data = check(await supabase.from('profiles').update({ full_name }).eq('id', user.id).select('id'))
      if (!data?.length) throw denied('change this')
    },
    async uploadFile(path, blob, contentType) {
      check(await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false, cacheControl: '3600' }))
    },
    async downloadFile(path) { return check(await supabase.storage.from(BUCKET).download(path)) },
    async removeFile(path) {
      const data = check(await supabase.storage.from(BUCKET).remove([path]))
      if (!data?.length) throw denied('delete this file')
    },
    async signedUrl(path, { download = false, expiresIn = 120 } = {}) {
      return check(await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn, download ? { download } : undefined)).signedUrl
    },
  }
}
