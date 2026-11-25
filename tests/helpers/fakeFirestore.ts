import { vi } from 'vitest'

/**
 * A tiny in-memory stand-in for the parts of `firebase/firestore` the classroom service uses.
 * Security rules cannot be emulated here: tests assert the exact document shapes instead, and
 * `rejectNext` lets a test make a write fail the way the rules or the network would.
 */
export const store = new Map<string, Record<string, unknown>>()
export const failures: { code: string; on: 'batch' | 'set' | 'update' | 'get' | 'delete' }[] = []
export const writes: { op: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown> }[] = []
let auto = 0

export function resetFirestore() {
  store.clear()
  failures.length = 0
  writes.length = 0
  auto = 0
}

/** The next operation of this kind rejects with a Firestore-style error code */
export function rejectNext(on: 'batch' | 'set' | 'update' | 'get' | 'delete', code: string) {
  failures.push({ on, code })
}

function maybeFail(on: 'batch' | 'set' | 'update' | 'get' | 'delete') {
  const i = failures.findIndex((f) => f.on === on)
  if (i >= 0) {
    const [f] = failures.splice(i, 1)
    throw Object.assign(new Error(`firestore ${f.code}`), { code: f.code })
  }
}

interface Ref {
  path: string
  id: string
}

const join = (segments: string[]) => segments.join('/')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function apply(op: 'set' | 'update' | 'delete', ref: Ref, data?: Record<string, unknown>) {
  if (data && Object.values(data).some((v) => v === undefined)) throw new Error('Firestore rejects undefined fields')
  writes.push({ op, path: ref.path, ...(data ? { data: clone(data) } : {}) })
  if (op === 'delete') store.delete(ref.path)
  else if (op === 'set') store.set(ref.path, clone(data!))
  else {
    const cur = store.get(ref.path)
    if (!cur) throw Object.assign(new Error('not found'), { code: 'not-found' })
    store.set(ref.path, { ...cur, ...clone(data!) })
  }
}

const children = (colPath: string) =>
  [...store.entries()]
    .filter(([p]) => p.startsWith(colPath + '/') && !p.slice(colPath.length + 1).includes('/'))
    .map(([p, d]) => ({ id: p.split('/').pop()!, ref: { path: p, id: p.split('/').pop()! }, data: () => clone(d) }))

export const firestoreMock = {
  doc: (_db: unknown, ...segments: string[]): Ref => ({ path: join(segments), id: segments[segments.length - 1] }),
  collection: (_db: unknown, ...segments: string[]) => ({ path: join(segments), kind: 'collection' as const }),
  where: (field: string, _op: string, value: unknown) => ({ field, value }),
  query: (col: { path: string }, ...filters: { field: string; value: unknown }[]) => ({ ...col, filters }),
  getDoc: vi.fn(async (ref: Ref) => {
    maybeFail('get')
    const d = store.get(ref.path)
    return { id: ref.id, exists: () => d !== undefined, data: () => (d ? clone(d) : undefined) }
  }),
  getDocs: vi.fn(async (q: { path: string; filters?: { field: string; value: unknown }[] }) => {
    maybeFail('get')
    const docs = children(q.path).filter((d) => (q.filters ?? []).every((f) => d.data()[f.field] === f.value))
    return { docs }
  }),
  setDoc: vi.fn(async (ref: Ref, data: Record<string, unknown>) => {
    maybeFail('set')
    apply('set', ref, data)
  }),
  addDoc: vi.fn(async (col: { path: string }, data: Record<string, unknown>) => {
    maybeFail('set')
    const id = `auto${++auto}`
    apply('set', { path: `${col.path}/${id}`, id }, data)
    return { id, path: `${col.path}/${id}` }
  }),
  updateDoc: vi.fn(async (ref: Ref, data: Record<string, unknown>) => {
    maybeFail('update')
    apply('update', ref, data)
  }),
  deleteDoc: vi.fn(async (ref: Ref) => {
    maybeFail('delete')
    apply('delete', ref)
  }),
  writeBatch: vi.fn(() => {
    const ops: (() => void)[] = []
    return {
      set: (ref: Ref, data: Record<string, unknown>) => ops.push(() => apply('set', ref, data)),
      delete: (ref: Ref) => ops.push(() => apply('delete', ref)),
      commit: async () => {
        maybeFail('batch')
        for (const op of ops) op()
      },
    }
  }),
}
