import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createApi } from '../services/api'
import { createLocalAdapter } from '../services/localAdapter'
import { createRemoteAdapter } from '../services/supabase/adapter'
import { createSupabaseGateway } from '../services/supabase/gateway'
import { createTeamService } from '../services/supabase/team'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { demoState } from '../data/seed/demo'
import { buildLedger } from '../calculations/finance'
import { todayISO } from '../lib/format'
import { useAuth } from '../auth/AuthProvider'

// The one place the data backend is chosen. Pages only ever see `api`.
//   Supabase configured → shared Postgres database (per signed-in user)
//   otherwise           → local demo mode in this browser
const demoSeed = () => ({ ...demoState(), meta: { ...demoState().meta, demo: true } })
function createService() {
  if (isSupabaseConfigured) {
    const adapter = createRemoteAdapter(createSupabaseGateway(supabase))
    return { api: createApi(adapter), team: createTeamService(supabase), live: adapter }
  }
  return { api: createApi(createLocalAdapter({ seed: demoSeed })), team: null, live: null }
}

const READ_ONLY = new Set(['load', 'getFile', 'exportData', 'refresh'])
const FOCUS_REFRESH_MS = 20_000
const LIVE_DEBOUNCE_MS = 400
const DataContext = createContext(null)

export function DataProvider({ children }) {
  const auth = useAuth()
  // a fresh service (and cache) per signed-in user — nothing carries over between accounts
  const service = useMemo(() => createService(), [auth.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const lastLoad = useRef(0)

  const reload = useCallback(async () => {
    try {
      setData(await service.api.load())
      setError(null)
      lastLoad.current = Date.now()
    } catch (err) {
      setError(err)
    }
  }, [service])

  useEffect(() => { setData(null); reload() }, [reload]) // eslint-disable-line react-hooks/set-state-in-effect

  // Multi-user freshness without polling: when the window comes back into
  // focus, re-read from the database (at most once every 20 seconds).
  useEffect(() => {
    if (auth.mode !== 'supabase') return
    const onFocus = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastLoad.current < FOCUS_REFRESH_MS) return
      lastLoad.current = Date.now()
      await service.api.refresh()
      await reload()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus) }
  }, [auth.mode, service, reload])

  // Live updates: when anyone changes a record, the database tells every open
  // session which table changed; we re-read that table and every page recalculates.
  const refreshProfile = auth.refreshProfile
  useEffect(() => {
    if (auth.mode !== 'supabase' || !auth.user?.id || !service.live) return
    let timer = null
    let profileChanged = false
    const stop = service.live.subscribe((table) => {
      service.live.invalidate(table)
      if (table === 'profiles') profileChanged = true
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (profileChanged) { profileChanged = false; refreshProfile?.() }
        reload()
      }, LIVE_DEBOUNCE_MS)
    })
    return () => { clearTimeout(timer); stop() }
  }, [auth.mode, auth.user?.id, service, reload, refreshProfile])

  // Every mutation refreshes the shared snapshot (success or failure), so all
  // pages recalculate from the same records at the same moment.
  const api = useMemo(() => {
    const wrapped = {}
    for (const [name, fn] of Object.entries(service.api)) {
      wrapped[name] = READ_ONLY.has(name) ? fn : async (...args) => {
        try {
          return await fn(...args)
        } finally {
          await reload()
        }
      }
    }
    wrapped.refreshNow = async () => { await service.api.refresh(); await reload() }
    if (auth.mode === 'local') {
      wrapped.loadDemo = () => wrapped.resetData('demo', demoSeed)
      wrapped.clearAll = () => wrapped.resetData('blank')
    }
    return wrapped
  }, [service, reload, auth.mode])

  const value = useMemo(() => {
    const shared = { api, reload, team: service.team, mode: auth.mode, can: { admin: auth.isAdmin }, auth }
    if (!data) return { ...shared, data: null, loading: !error, error }
    const projectById = new Map(data.projects.map((p) => [p.id, p]))
    const memberById = new Map(data.members.map((m) => [m.id, m]))
    return {
      ...shared, data, loading: false, error,
      today: todayISO(),
      ledger: buildLedger(data),
      projectById, memberById,
      projectName: (id) => projectById.get(id)?.name ?? null,
      memberName: (id) => memberById.get(id)?.name ?? null,
      activeMembers: data.members.filter((m) => m.is_active).sort((a, b) => a.name.localeCompare(b.name)),
      sortedProjects: [...data.projects].sort((a, b) => a.name.localeCompare(b.name)),
      categoryNames: data.categories.map((c) => c.name).sort((a, b) => a.localeCompare(b)),
      methodNames: data.payment_methods.map((m) => m.name),
    }
  }, [data, error, api, reload, service, auth])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
