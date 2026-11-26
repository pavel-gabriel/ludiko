import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { deleteGameHistory, main, BATCH_SIZE } from '../scripts/privacy/delete-game-history.mjs'
import { eraseAll, type EraseDeps } from '@/privacy/eraseAll'
import type { ChildProfile } from '@/profiles/types'

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(p)) out.push(p)
  }
  return out
}

describe('F1: no cloud leaderboard', () => {
  it('no source file references the gameHistory collection or the removed services', () => {
    const offenders = walk('src').filter((f) => /gameHistory|historyService|PersistentLeaderboard|saveGameHistory/.test(readFileSync(f, 'utf8')) && !f.includes('legal'))
    expect(offenders).toEqual([])
    expect(existsSync('src/services/historyService.ts')).toBe(false)
  })

  it('firestore.rules denies all client access to gameHistory', () => {
    const rules = readFileSync('firestore.rules', 'utf8')
    const m = rules.match(/match \/gameHistory\/\{docId\} \{([^}]*)\}/)
    expect(m).not.toBeNull()
    expect(m![1]).toContain('allow read, write: if false;')
    expect(m![1]).not.toMatch(/request\.auth/)
  })
})

function fakeDb(n: number) {
  let docs = Array.from({ length: n }, (_, i) => ({ id: `d${i}`, ref: { i } }))
  const query = (start = 0, lim = BATCH_SIZE) => ({
    limit: (l: number) => query(start, l),
    startAfter: (d: { id: string }) => query(docs.findIndex((x) => x.id === d.id) + 1, lim),
    get: async () => {
      const s = docs.slice(start, start + lim)
      return { empty: s.length === 0, size: s.length, docs: s }
    },
  })
  const commits: number[] = []
  return {
    commits,
    remaining: () => docs.length,
    collection: () => query(),
    batch: () => {
      const refs: { i: number }[] = []
      return {
        delete: (r: { i: number }) => refs.push(r),
        commit: async () => {
          commits.push(refs.length)
          const gone = new Set(refs.map((r) => r.i))
          docs = docs.filter((d) => !gone.has((d.ref as { i: number }).i))
        },
      }
    },
  }
}

describe('delete-game-history script', () => {
  it('dry run counts and deletes nothing', async () => {
    const db = fakeDb(1200)
    expect(await deleteGameHistory(db, { dryRun: true })).toBe(1200)
    expect(db.remaining()).toBe(1200)
    expect(db.commits).toEqual([])
  })
  it('deletes in batches of 500', async () => {
    const db = fakeDb(1200)
    expect(await deleteGameHistory(db)).toBe(1200)
    expect(db.commits).toEqual([500, 500, 200])
    expect(db.remaining()).toBe(0)
  })
  it('main needs the service account and logs only counts', async () => {
    const log = vi.fn()
    expect(await main({ env: {}, argv: [], log })).toBe(1)
    const db = fakeDb(3)
    const log2 = vi.fn()
    expect(await main({ env: { FIREBASE_SERVICE_ACCOUNT: '{}' }, argv: ['--dry-run'], loaders: { firestore: async () => db }, log: log2 })).toBe(0)
    expect(log2).toHaveBeenCalledWith('dry run: 3 document(s) would be deleted')
  })
})

const profile = (id: string, linked: boolean) => ({ id, classLink: linked ? { classId: 'c', seatId: 's' } : undefined }) as unknown as ChildProfile

function deps(over: Partial<EraseDeps> = {}): EraseDeps & Record<string, ReturnType<typeof vi.fn>> {
  return {
    listProfiles: vi.fn(async () => [profile('a', true), profile('b', false)]),
    leaveClass: vi.fn(async () => {}),
    unsubscribePush: vi.fn(async () => {}),
    isFamilySignedIn: vi.fn(() => true),
    deleteCloudAccount: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    deleteProfile: vi.fn(async () => {}),
    isOnline: vi.fn(() => true),
    ...over,
  } as never
}
const byId = (r: { id: string; status: string }[]) => Object.fromEntries(r.map((x) => [x.id, x.status]))

describe('F8: eraseAll', () => {
  it('runs every step, local wipe only when checked', async () => {
    const d = deps()
    const r = await eraseAll({ deleteLocal: false, password: 'pw' }, d)
    expect(d.leaveClass).toHaveBeenCalledTimes(1)
    expect(d.unsubscribePush).toHaveBeenCalled()
    expect(d.deleteCloudAccount).toHaveBeenCalledWith('pw')
    expect(d.deleteProfile).not.toHaveBeenCalled()
    expect(byId(r)).toEqual({ classes: 'done', push: 'done', family: 'done', local: 'skipped', signout: 'done' })

    const d2 = deps()
    const r2 = await eraseAll({ deleteLocal: true }, d2)
    expect(d2.deleteProfile).toHaveBeenCalledTimes(2)
    expect(byId(r2).local).toBe('done')
  })
  it('reports partial failures and still continues; signs out when the account stays', async () => {
    const d = deps({
      deleteCloudAccount: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'reauth-required' }) }),
      unsubscribePush: vi.fn(async () => { throw new Error('boom') }),
    })
    const r = await eraseAll({ deleteLocal: true }, d)
    expect(byId(r)).toEqual({ classes: 'done', push: 'failed', family: 'failed', local: 'done', signout: 'done' })
    expect(r.find((x) => x.id === 'family')!.detail).toBe('reauth-required')
    expect(d.signOut).toHaveBeenCalled()
  })
  it('offline marks best-effort steps partial; not signed in skips family/signout', async () => {
    const d = deps({ isOnline: vi.fn(() => false), isFamilySignedIn: vi.fn(() => false) })
    const r = await eraseAll({ deleteLocal: false }, d)
    expect(byId(r)).toEqual({ classes: 'partial', push: 'partial', family: 'skipped', local: 'skipped', signout: 'skipped' })
    expect(d.deleteCloudAccount).not.toHaveBeenCalled()
  })
})
