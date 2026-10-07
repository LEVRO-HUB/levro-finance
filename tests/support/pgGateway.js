// Test double for src/services/supabase/gateway.js that speaks to a plain
// Postgres with the real migrations applied. Every call runs as the given
// user under the `authenticated` role (or `anon` when signed out), exactly
// how PostgREST executes requests — so RLS, triggers and constraints are real.
import pg from 'pg'
import { ValidationError } from '../../src/services/errors.js'

pg.types.setTypeParser(1700, (v) => Number(v)) // numeric
pg.types.setTypeParser(20, (v) => Number(v)) // bigint
pg.types.setTypeParser(1082, (v) => v) // date stays 'YYYY-MM-DD'
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()) // timestamptz

const ident = (s) => `"${String(s).replace(/"/g, '""')}"`
const denied = (what) => new ValidationError(`You don't have permission to ${what}, or it no longer exists.`)

export function createPgGateway(pool, user /* { id } | null */) {
  const stats = { select: 0, insert: 0, update: 0, remove: 0 }
  async function as(fn) {
    const c = await pool.connect()
    try {
      await c.query('begin')
      await c.query(`select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)`, [JSON.stringify(user ? { sub: user.id, role: 'authenticated' } : { role: 'anon' }), user ? 'authenticated' : 'anon'])
      const out = await fn(c)
      await c.query('commit')
      return out
    } catch (err) {
      await c.query('rollback').catch(() => {})
      throw err
    } finally {
      c.release()
    }
  }
  return {
    stats,
    async selectPage(table, { orderBy = ['created_at', 'id'], ascending = true, from = 0, to = 999 } = {}) {
      stats.select++
      const order = orderBy.map((c) => `${ident(c)} ${ascending ? 'asc' : 'desc'}`).join(', ')
      return as(async (c) => (await c.query(`select * from public.${ident(table)} order by ${order} limit $1 offset $2`, [to - from + 1, from])).rows)
    },
    async insert(table, rows) {
      stats.insert++
      const cols = Object.keys(rows[0])
      const values = rows.map((_, i) => `(${cols.map((__, j) => `$${i * cols.length + j + 1}`).join(', ')})`).join(', ')
      await as((c) => c.query(`insert into public.${ident(table)} (${cols.map(ident).join(', ')}) values ${values}`, rows.flatMap((r) => cols.map((k) => r[k]))))
    },
    async update(table, id, patch) {
      stats.update++
      const cols = Object.keys(patch)
      const res = await as((c) => c.query(`update public.${ident(table)} set ${cols.map((k, i) => `${ident(k)} = $${i + 2}`).join(', ')} where id = $1 returning id`, [id, ...cols.map((k) => patch[k])]))
      if (!res.rowCount) throw denied('change this')
    },
    async remove(table, id) {
      stats.remove++
      const res = await as((c) => c.query(`delete from public.${ident(table)} where id = $1 returning id`, [id]))
      if (!res.rowCount) throw denied('delete this')
    },
    async getProfile() {
      if (!user) return null
      return as(async (c) => (await c.query('select * from public.profiles where id = $1', [user.id])).rows[0] ?? null)
    },
    async updateOwnName(full_name) {
      const res = await as((c) => c.query('update public.profiles set full_name = $2 where id = $1 returning id', [user.id, full_name]))
      if (!res.rowCount) throw denied('change this')
    },
    // storage: the object rows (and their RLS policies) are real; the bytes are not stored
    async uploadFile(path) { await as((c) => c.query(`insert into storage.objects (bucket_id, name) values ('documents', $1)`, [path])) },
    async downloadFile(path) {
      const res = await as((c) => c.query(`select 1 from storage.objects where bucket_id = 'documents' and name = $1`, [path]))
      if (!res.rowCount) throw denied('open this file')
      return { size: 1 }
    },
    async removeFile(path) {
      const res = await as((c) => c.query(`delete from storage.objects where bucket_id = 'documents' and name = $1 returning id`, [path]))
      if (!res.rowCount) throw denied('delete this file')
    },
    async signedUrl(path) {
      const res = await as((c) => c.query(`select 1 from storage.objects where bucket_id = 'documents' and name = $1`, [path]))
      if (!res.rowCount) throw denied('open this file')
      return `signed://documents/${path}?token=test`
    },
  }
}
