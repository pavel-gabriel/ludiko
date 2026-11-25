/**
 * Tiny IndexedDB wrapper (schema v1: `profiles` keyed by `id`, `progress`
 * keyed by `profileId`). Falls back to an in-memory store when IndexedDB is
 * unavailable (private mode, tests). `isPersistent()` reports which is active.
 */
const DB_NAME = 'ludiko-profiles'
const DB_VERSION = 1
export type StoreName = 'profiles' | 'progress'
const KEY_PATH: Record<StoreName, string> = { profiles: 'id', progress: 'profileId' }

const memory: Record<StoreName, Map<string, unknown>> = {
  profiles: new Map(),
  progress: new Map(),
}

let dbPromise: Promise<IDBDatabase | null> | null = null
let persistent = false

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null)
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        for (const name of Object.keys(KEY_PATH) as StoreName[]) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: KEY_PATH[name] })
          }
        }
      }
      req.onsuccess = () => {
        persistent = true
        resolve(req.result)
      }
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export function isPersistent(): boolean {
  return persistent
}

/** Resolves once the backend is chosen; returns whether it is persistent. */
export async function initDb(): Promise<boolean> {
  await openDb()
  return persistent
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb()
  if (!db) return [...memory[store].values()].map(clone) as T[]
  return wrap(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb()
  if (!db) {
    const v = memory[store].get(key)
    return v === undefined ? undefined : (clone(v) as T)
  }
  return wrap(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<T | undefined>
}

export async function dbPut<T extends object>(store: StoreName, value: T): Promise<void> {
  const db = await openDb()
  if (!db) {
    const key = (value as Record<string, unknown>)[KEY_PATH[store]] as string
    memory[store].set(key, clone(value))
    return
  }
  await wrap(db.transaction(store, 'readwrite').objectStore(store).put(value))
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory[store].delete(key)
    return
  }
  await wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key))
}

/** Test helper: wipe the in-memory fallback. */
export function _resetMemoryForTests(): void {
  memory.profiles.clear()
  memory.progress.clear()
}
