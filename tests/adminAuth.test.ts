import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { getDoc } from 'firebase/firestore'
import { resolveAdminAccess, checkIsAdmin } from '@/services/adminService'

const fb = vi.hoisted(() => ({ enabled: true }))

vi.mock('@/services/firebase', () => ({
  db: {},
  get firebaseEnabled() {
    return fb.enabled
  },
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` })),
  getDoc: vi.fn(),
}))

const mockedGetDoc = vi.mocked(getDoc)
const exists = (v: boolean) => ({ exists: () => v }) as unknown as Awaited<ReturnType<typeof getDoc>>

beforeEach(() => {
  fb.enabled = true
  mockedGetDoc.mockReset()
})

describe('admin gate', () => {
  it('allows a signed-in user with an admins doc', async () => {
    mockedGetDoc.mockResolvedValue(exists(true))
    expect(await resolveAdminAccess({ uid: 'u1', isAnonymous: false })).toBe('admin')
    expect(mockedGetDoc).toHaveBeenCalledWith({ path: 'admins/u1' })
  })

  it('blocks a signed-in user without an admins doc', async () => {
    mockedGetDoc.mockResolvedValue(exists(false))
    expect(await resolveAdminAccess({ uid: 'u2', isAnonymous: false })).toBe('not-admin')
  })

  it('blocks anonymous users without reading Firestore', async () => {
    expect(await resolveAdminAccess({ uid: 'anon', isAnonymous: true })).toBe('anonymous')
    expect(mockedGetDoc).not.toHaveBeenCalled()
  })

  it('reports signed-out and treats read errors as not admin', async () => {
    expect(await resolveAdminAccess(null)).toBe('signed-out')
    mockedGetDoc.mockRejectedValue(new Error('permission-denied'))
    expect(await checkIsAdmin('u3')).toBe(false)
  })

  it('is unavailable when Firebase is disabled', async () => {
    fb.enabled = false
    expect(await resolveAdminAccess({ uid: 'u1', isAnonymous: false })).toBe('unavailable')
  })
})

describe('firestore.rules admin enforcement', () => {
  const rules = readFileSync('firestore.rules', 'utf8')
  const block = (name: string) => {
    const start = rules.indexOf(`match /${name}/`)
    expect(start).toBeGreaterThan(-1)
    const next = rules.indexOf('\n    match /', start + 10)
    return rules.slice(start, next === -1 ? undefined : next)
  }

  it('defines isAdmin() requiring a non-anonymous user with an admins doc', () => {
    expect(rules).toMatch(/function isAdmin\(\)/)
    expect(rules).toContain("exists(/databases/$(database)/documents/admins/$(request.auth.uid))")
    expect(rules).toContain("sign_in_provider != 'anonymous'")
  })

  it('contentReports read and update use isAdmin(); create does not', () => {
    const b = block('contentReports')
    expect(b).toMatch(/allow read: if isAdmin\(\)/)
    expect(b).toMatch(/allow update: if isAdmin\(\)/)
    expect(b).toMatch(/allow create: if request\.auth != null/)
    expect(b).not.toMatch(/allow (read|update): if request\.auth != null/)
  })

  it('admins docs are owner-get only and never client-writable', () => {
    const b = block('admins')
    expect(b).toMatch(/allow get: if request\.auth != null && request\.auth\.uid == uid/)
    expect(b).toMatch(/allow list, write: if false/)
  })

  it('teachers list is admin-only', () => {
    expect(block('teachers')).toMatch(/allow list: if isAdmin\(\)/)
  })
})
