// Phase 1 persistence: one JSON document in localStorage + file blobs in
// IndexedDB. The rest of the app only ever sees { load, save, files }, which
// is what the Supabase adapter will implement in Phase 2.
import { emptyState, SCHEMA_VERSION } from './schema'

export const STORAGE_KEY = 'levro-finance:data:v1'

export function createMemoryStorage() {
  const map = new Map()
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) }
}

export function createMemoryFileStore() {
  const map = new Map()
  return {
    async put(key, blob) { map.set(key, blob) },
    async get(key) { return map.get(key) ?? null },
    async remove(key) { map.delete(key) },
    async clear() { map.clear() },
  }
}

export function createIdbFileStore(dbName = 'levro-finance-files') {
  if (typeof indexedDB === 'undefined') return createMemoryFileStore()
  let dbPromise
  const open = () => {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore('files')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }
  const run = async (mode, fn) => {
    const db = await open()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode)
      const req = fn(tx.objectStore('files'))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  return {
    put: (key, blob) => run('readwrite', (s) => s.put(blob, key)),
    get: async (key) => (await run('readonly', (s) => s.get(key))) ?? null,
    remove: (key) => run('readwrite', (s) => s.delete(key)),
    clear: () => run('readwrite', (s) => s.clear()),
  }
}

export function createLocalAdapter({ storage, files, seed } = {}) {
  const store = storage ?? window.localStorage
  const fileStore = files ?? createIdbFileStore()

  function persist(state) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      throw new Error(`Could not save data to this browser's storage (${err?.name ?? 'error'}). Storage may be full or blocked.`, { cause: err })
    }
  }

  return {
    files: fileStore,
    async load() {
      const raw = store.getItem(STORAGE_KEY)
      if (raw == null) {
        const initial = seed ? seed() : emptyState()
        persist(initial)
        return structuredClone(initial)
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch (err) {
        throw new Error('Saved finance data in this browser is corrupted and could not be read.', { cause: err })
      }
      const base = emptyState()
      return { ...base, ...parsed, meta: { ...base.meta, ...parsed.meta, version: SCHEMA_VERSION }, settings: { ...base.settings, ...parsed.settings } }
    },
    async save(state) { persist(state) },
    async replace(state) {
      await fileStore.clear()
      persist(state)
    },
  }
}
