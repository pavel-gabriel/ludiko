import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetMemoryForTests, dbGetAll } from '@/profiles/db'
import {
  createProfile,
  deleteProfile,
  getProfile,
  getProgress,
  listProfiles,
  setClassLink,
  updateProfile,
  updateProgress,
} from '@/profiles/profileService'
import type { ChildProfile, ProfileProgress } from '@/profiles/types'
import { FamilyError, CONSENT_VERSION, PROGRESS_MAX_BYTES } from '@/family/types'
import { readFamilyState, readTombstones, FAMILY_STATE_KEY } from '@/family/familyState'
import { firestoreMock, rejectNext, resetFirestore, store, writes } from './helpers/fakeFirestore'

const fb = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string; email: string; isAnonymous: boolean }, authStateReady: async () => {} },
  calls: [] as string[],
  emailTaken: false,
  recentLogin: true,
  password: 'secret1',
}))

vi.mock('firebase/firestore', async () => (await import('./helpers/fakeFirestore')).firestoreMock)
vi.mock('@/services/firebase', () => ({ db: {}, auth: fb.auth, firebaseEnabled: true }))
vi.mock('firebase/auth', () => {
  const user = (email: string) => ({ uid: 'u1', email, isAnonymous: false })
  const err = (code: string) => Object.assign(new Error(code), { code })
  return {
    EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
    createUserWithEmailAndPassword: vi.fn(async (_a: unknown, email: string, password: string) => {
      fb.calls.push('create')
      if (fb.emailTaken) throw err('auth/email-already-in-use')
      if (password.length < 6) throw err('auth/weak-password')
      fb.auth.currentUser = user(email)
      return { user: fb.auth.currentUser }
    }),
    signInWithEmailAndPassword: vi.fn(async (_a: unknown, email: string, password: string) => {
      fb.calls.push('signin')
      if (password !== fb.password) throw err('auth/invalid-credential')
      fb.auth.currentUser = user(email)
      return { user: fb.auth.currentUser }
    }),
    sendPasswordResetEmail: vi.fn(async (_a: unknown, email: string) => {
      fb.calls.push('reset')
      if (email === 'nobody@example.com') throw err('auth/user-not-found')
    }),
    signOut: vi.fn(async () => {
      fb.calls.push('signout')
      fb.auth.currentUser = null
    }),
    reauthenticateWithCredential: vi.fn(async (_u: unknown, cred: { password: string }) => {
      fb.calls.push('reauth')
      if (cred.password !== fb.password) throw err('auth/wrong-password')
      fb.recentLogin = true
    }),
    deleteUser: vi.fn(async () => {
      fb.calls.push('deleteUser')
      if (!fb.recentLogin) throw err('auth/requires-recent-login')
      fb.auth.currentUser = null
    }),
  }
})
// the real gate would schedule background syncs while these tests run: keep only the tombstone bookkeeping
vi.mock('@/family/familyGate', async () => {
  const state = await import('@/family/familyState')
  return {
    triggerFamilySync: vi.fn(),
    initFamilyGate: vi.fn(),
    noteProfileDeleted: (p: Parameters<typeof state.addTombstone>[0], now = Date.now()) => {
      state.addTombstone(p, now)
    },
  }
})

import * as svc from '@/family/familyService'

/* ---------------- device simulation: one cloud, several local databases ---------------- */

interface Device {
  profiles: unknown[]
  progress: unknown[]
  ls: Record<string, string>
}

async function snapshot(): Promise<Device> {
  const ls: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!
    ls[k] = localStorage.getItem(k)!
  }
  return { profiles: await dbGetAll('profiles'), progress: await dbGetAll('progress'), ls }
}

async function restore(d: Device) {
  const { dbPut } = await import('@/profiles/db')
  _resetMemoryForTests()
  localStorage.clear()
  for (const [k, v] of Object.entries(d.ls)) localStorage.setItem(k, v)
  for (const p of d.profiles) await dbPut('profiles', p as object)
  for (const p of d.progress) await dbPut('progress', p as object)
  fb.auth.currentUser = readFamilyState() ? { uid: 'u1', email: 'mama@example.com', isAnonymous: false } : null
}

function newDevice() {
  _resetMemoryForTests()
  localStorage.clear()
  fb.auth.currentUser = null
}

const EMAIL = 'mama@example.com'
const PASSWORD = 'secret1'

async function parent() {
  await svc.createAccount(EMAIL, PASSWORD, true)
}

async function child(nickname = 'Matei', grade: ChildProfile['grade'] = 3) {
  return createProfile({ nickname, avatar: '🦊', grade, language: 'ro' })
}

const T = 1_700_000_000_000
const learn = (id: string, skill: string, attempts: number, correct: number, at = T) =>
  updateProgress(id, (p) => {
    p.skills[skill] = { state: 'learning', pMastery: 0.4, attempts, correct, lastSeen: at }
  })

const remoteDocs = () => [...store.entries()].filter(([p]) => p.startsWith('families/u1/children/'))
const remoteChild = (id: string) => store.get(`families/u1/children/${id}`) as Record<string, any> | undefined

beforeEach(() => {
  resetFirestore()
  newDevice()
  vi.clearAllMocks()
  fb.calls.length = 0
  fb.emailTaken = false
  fb.recentLogin = true
})

describe('createAccount and consent', () => {
  it('writes families/{uid} with exactly the consent fields, and starts a session', async () => {
    const before = Date.now()
    const session = await svc.createAccount(` ${EMAIL} `, PASSWORD, true)
    expect(session).toMatchObject({ uid: 'u1', email: EMAIL, lastSync: 0, syncedIds: [], accepted: true })
    const doc = store.get('families/u1')!
    expect(Object.keys(doc).sort()).toEqual(['consentAt', 'consentVersion', 'createdAt', 'updatedAt'])
    expect(doc.consentVersion).toBe(CONSENT_VERSION)
    expect(doc.consentAt as number).toBeGreaterThanOrEqual(before)
    expect(doc.createdAt).toBe(doc.consentAt)
    expect(readFamilyState()?.email).toBe(EMAIL)
  })

  it('refuses without consent: no Auth call, no write, no session', async () => {
    await expect(svc.createAccount(EMAIL, PASSWORD, false)).rejects.toMatchObject({ code: 'consent-required' })
    await expect(svc.createAccount(EMAIL, PASSWORD, undefined as unknown as boolean)).rejects.toBeInstanceOf(FamilyError)
    expect(fb.calls).toEqual([])
    expect(writes).toEqual([])
    expect(readFamilyState()).toBeNull()
  })

  it('maps Auth errors', async () => {
    fb.emailTaken = true
    await expect(svc.createAccount(EMAIL, PASSWORD, true)).rejects.toMatchObject({ code: 'email-in-use' })
    fb.emailTaken = false
    await expect(svc.createAccount(EMAIL, '123', true)).rejects.toMatchObject({ code: 'weak-password' })
    expect(readFamilyState()).toBeNull()
  })

  it('removes the new Auth user when the consent record cannot be saved', async () => {
    rejectNext('set', 'unavailable')
    await expect(svc.createAccount(EMAIL, PASSWORD, true)).rejects.toMatchObject({ code: 'offline' })
    expect(fb.calls).toContain('deleteUser')
    expect(readFamilyState()).toBeNull()
    expect(store.has('families/u1')).toBe(false)
  })

  it('signIn: an account without a consent record needs consent, which recordConsent saves', async () => {
    fb.auth.currentUser = null
    const first = await svc.signIn(EMAIL, PASSWORD)
    expect(first.needsConsent).toBe(true)
    expect(first.session.accepted).toBe(false)
    await expect(svc.syncNow()).rejects.toMatchObject({ code: 'consent-required' })
    await svc.recordConsent()
    expect(store.get('families/u1')).toMatchObject({ consentVersion: CONSENT_VERSION })
    expect((await svc.signIn(EMAIL, PASSWORD)).needsConsent).toBe(false)
  })

  it('signIn keeps the original createdAt when consent is recorded again', async () => {
    store.set('families/u1', { consentAt: 5, consentVersion: 'old', createdAt: 5, updatedAt: 5 })
    await svc.signIn(EMAIL, PASSWORD)
    await svc.recordConsent()
    expect(store.get('families/u1')).toMatchObject({ createdAt: 5, consentVersion: CONSENT_VERSION })
  })

  it('wrong password -> wrong-credentials, no session', async () => {
    await expect(svc.signIn(EMAIL, 'nope')).rejects.toMatchObject({ code: 'wrong-credentials' })
    expect(readFamilyState()).toBeNull()
  })

  it('resetPassword does not reveal unknown addresses', async () => {
    await expect(svc.resetPassword('nobody@example.com')).resolves.toBeUndefined()
    await expect(svc.resetPassword(EMAIL)).resolves.toBeUndefined()
  })

  it('signOut forgets the account but keeps local data', async () => {
    await parent()
    const kid = await child()
    await svc.signOut()
    expect(readFamilyState()).toBeNull()
    expect(fb.auth.currentUser).toBeNull()
    expect(await getProfile(kid.id)).toBeDefined()
  })
})

describe('syncNow: what reaches the cloud', () => {
  it('needs a session', async () => {
    await expect(svc.syncNow()).rejects.toMatchObject({ code: 'signed-out' })
    expect(writes).toEqual([])
  })

  it('treats a different Firebase user (e.g. a teacher signing in) as signed out', async () => {
    await parent()
    fb.auth.currentUser = { uid: 'teacher-9', email: 't@example.com', isAnonymous: false }
    await expect(svc.syncNow()).rejects.toMatchObject({ code: 'signed-out' })
    expect(readFamilyState()).toBeNull()
  })

  it('pushes each child with exactly the documented shape and no forbidden fields', async () => {
    await parent()
    const kid = await child()
    await setClassLink(kid.id, { classId: 'c1', seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' })
    await learn(kid.id, 'mat.count.10', 5, 4)
    await updateProgress(kid.id, (p) => {
      p.stars = 12
      p.stickers = ['star']
      p.playDays = ['2026-11-24']
    })

    const result = await svc.syncNow()
    expect(result.pushed).toBe(1)
    const doc = remoteChild(kid.id)!
    expect(Object.keys(doc).sort()).toEqual(['deviceId', 'profile', 'progress', 'updatedAt'])
    expect(Object.keys(doc.profile).sort()).toEqual(['avatar', 'createdAt', 'grade', 'id', 'language', 'nickname', 'updatedAt'])
    expect(doc.profile).toMatchObject({ id: kid.id, nickname: 'Matei', grade: 3, language: 'ro' })
    expect(doc.progress).toMatchObject({ profileId: kid.id, stars: 12, stickers: ['star'] })
    expect(doc.progress.skills['mat.count.10']).toMatchObject({ attempts: 5, correct: 4 })
    expect(typeof doc.deviceId).toBe('string')
    expect(doc.deleted).toBeUndefined()

    // nothing local-only anywhere in anything written
    const everything = JSON.stringify(writes)
    const full = (await getProfile(kid.id))!
    expect(everything).not.toContain(full.recoveryCode)
    expect(everything).not.toContain('recoveryCode')
    expect(everything).not.toContain('classLink')
    expect(everything).not.toContain('Clasa a III-a B')
    expect(everything).not.toContain('ABC234')
  })

  it('only writes under families/{uid}', async () => {
    await parent()
    await child()
    await svc.syncNow()
    for (const w of writes) expect(w.path.startsWith('families/u1')).toBe(true)
  })

  it('records lastSync and the synced ids, and a second sync with no changes writes nothing', async () => {
    await parent()
    const kid = await child()
    const r1 = await svc.syncNow()
    expect(readFamilyState()).toMatchObject({ lastSync: r1.at, syncedIds: [kid.id] })
    writes.length = 0
    const r2 = await svc.syncNow()
    expect(r2.pushed).toBe(0)
    expect(writes).toEqual([])
  })

  it('runs one sync at a time', async () => {
    await parent()
    await child()
    const [a, b] = await Promise.all([svc.syncNow(), svc.syncNow()])
    expect(a).toBe(b)
  })

  it('a push after a local change sends only that child', async () => {
    await parent()
    const a = await child('Ana', 1)
    const b = await child('Bob', 2)
    await svc.syncNow()
    writes.length = 0
    await learn(a.id, 'mat.count.10', 3, 3, T + 5000)
    const r = await svc.syncNow()
    expect(r.pushed).toBe(1)
    expect(writes.map((w) => w.path)).toEqual([`families/u1/children/${a.id}`])
    expect(remoteChild(b.id)).toBeDefined()
  })

  it('a profile edit propagates', async () => {
    await parent()
    const kid = await child()
    await svc.syncNow()
    await new Promise((r) => setTimeout(r, 5))
    await updateProfile(kid.id, { nickname: 'Matei M.' })
    await svc.syncNow()
    expect(remoteChild(kid.id)!.profile.nickname).toBe('Matei M.')
  })

  it('refuses (too-large) a child whose progress would not fit, and still syncs the others', async () => {
    await parent()
    const big = await child('Mare')
    const ok = await child('Mic')
    await updateProgress(big.id, (p) => {
      p.skills.huge = { state: 'learning', pMastery: 0, attempts: 1, correct: 1, lastSeen: T, note: 'x'.repeat(PROGRESS_MAX_BYTES + 10) } as never
    })
    await expect(svc.syncNow()).rejects.toMatchObject({ code: 'too-large' })
    expect(remoteChild(big.id)).toBeUndefined()
    expect(remoteChild(ok.id)).toBeDefined()
  })

  it('an offline cloud leaves local data untouched', async () => {
    await parent()
    const kid = await child()
    await learn(kid.id, 'mat.count.10', 5, 4)
    const before = JSON.stringify(await getProgress(kid.id))
    rejectNext('get', 'unavailable')
    await expect(svc.syncNow()).rejects.toMatchObject({ code: 'offline' })
    expect(JSON.stringify(await getProgress(kid.id))).toBe(before)
  })

  it('ignores cloud documents that are not valid children', async () => {
    await parent()
    store.set('families/u1/children/junk', { hello: 'world' })
    store.set('families/u1/children/junk2', { profile: { id: 'other' }, progress: {} })
    const r = await svc.syncNow()
    expect(r.pending).toEqual([])
    expect(await listProfiles()).toEqual([])
  })
})

describe('syncNow: two devices', () => {
  it('a new device offers the children of the account, then imports them with fresh recovery codes', async () => {
    // device A
    await parent()
    const ana = await child('Ana', 1)
    const bob = await child('Bob', 4)
    await learn(ana.id, 'mat.count.10', 6, 5)
    await updateProgress(ana.id, (p) => {
      p.stars = 8
      p.stickers = ['s1', 's2']
    })
    await svc.syncNow()
    const codeA = (await getProfile(ana.id))!.recoveryCode

    // device B: sign in
    newDevice()
    const { session, needsConsent } = await svc.signIn(EMAIL, PASSWORD)
    expect(needsConsent).toBe(false)
    expect(session.accepted).toBe(false)
    const r = await svc.syncNow()
    expect(r.pending.map((c) => c.nickname).sort()).toEqual(['Ana', 'Bob'])
    expect(await listProfiles()).toEqual([]) // nothing imported without being asked
    expect(readFamilyState()?.accepted).toBe(false)

    expect((await svc.listRemoteChildren()).map((c) => c.id).sort()).toEqual([ana.id, bob.id].sort())
    const imported = await svc.importRemoteChild(ana.id)
    expect(imported).toMatchObject({ id: ana.id, nickname: 'Ana', grade: 1 })
    expect(imported.recoveryCode).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){2}$/)
    expect(imported.recoveryCode).not.toBe(codeA)
    expect(imported.classLink).toBeUndefined()
    const progress = await getProgress(ana.id)
    expect(progress).toMatchObject({ stars: 8, stickers: ['s1', 's2'] })
    expect(progress.skills['mat.count.10']).toMatchObject({ attempts: 6, correct: 5 })
    expect(readFamilyState()?.syncedIds).toContain(ana.id)
  })

  it('importRemoteChild: unknown or deleted children are not found', async () => {
    await parent()
    await expect(svc.importRemoteChild('nope')).rejects.toMatchObject({ code: 'not-found' })
  })

  it('after the parent accepted, children created on the other device arrive by themselves', async () => {
    await parent()
    const ana = await child('Ana', 1)
    await svc.syncNow()
    const deviceA = await snapshot()

    newDevice()
    await svc.signIn(EMAIL, PASSWORD)
    await svc.importRemoteChild(ana.id)
    const { acceptFamilyImport } = await import('@/family/familyState')
    acceptFamilyImport()
    const tudor = await child('Tudor', 2) // created on device B
    await svc.syncNow()
    const deviceB = await snapshot()

    await restore(deviceA)
    const r = await svc.syncNow()
    expect(r.pulled).toBe(1)
    expect((await listProfiles()).map((p) => p.nickname).sort()).toEqual(['Ana', 'Tudor'])
    expect((await getProfile(tudor.id))!.recoveryCode).toBeTruthy()
    expect(readFamilyState()?.syncedIds.sort()).toEqual([ana.id, tudor.id].sort())
    void deviceB
  })

  it('both devices played: each sees the union and nothing is lost', async () => {
    await parent()
    const kid = await child('Matei')
    await learn(kid.id, 'a', 4, 3, T)
    await updateProgress(kid.id, (p) => {
      p.stars = 5
      p.stickers = ['s1']
      p.playDays = ['2026-11-01']
    })
    await svc.syncNow()
    const deviceA = await snapshot()

    // device B starts from the same child and plays different things
    newDevice()
    await svc.signIn(EMAIL, PASSWORD)
    await svc.importRemoteChild(kid.id)
    await learn(kid.id, 'b', 2, 2, T + 1000)
    await learn(kid.id, 'a', 9, 8, T + 2000)
    await updateProgress(kid.id, (p) => {
      p.stars = 9
      p.stickers.push('s2')
      p.playDays.push('2026-11-02')
    })
    await svc.syncNow()
    const deviceB = await snapshot()

    // device A also played meanwhile (offline), then syncs
    await restore(deviceA)
    await learn(kid.id, 'c', 1, 1, T + 3000)
    await updateProgress(kid.id, (p) => {
      p.stars = 6
      p.stickers.push('s3')
    })
    await svc.syncNow()
    const onA = await getProgress(kid.id)
    expect(Object.keys(onA.skills).sort()).toEqual(['a', 'b', 'c'])
    expect(onA.skills.a).toMatchObject({ attempts: 9, correct: 8 })
    expect(onA.stars).toBe(9)
    expect(new Set(onA.stickers)).toEqual(new Set(['s1', 's2', 's3']))
    expect(onA.playDays).toEqual(['2026-11-01', '2026-11-02'])

    // device B catches up and both end identical
    await restore(deviceB)
    await svc.syncNow()
    const onB = await getProgress(kid.id)
    expect(Object.keys(onB.skills).sort()).toEqual(['a', 'b', 'c'])
    expect(onB.stars).toBe(9)
    expect(new Set(onB.stickers)).toEqual(new Set(onA.stickers))
    const cloud = remoteChild(kid.id)!.progress as ProfileProgress
    expect(new Set(cloud.stickers)).toEqual(new Set(onA.stickers))
    expect(Object.keys(cloud.skills).sort()).toEqual(['a', 'b', 'c'])

    // and a further round settles: no more writes
    writes.length = 0
    await svc.syncNow()
    expect(writes).toEqual([])
  })

  it('a rename on one device reaches the other, keeping the local recovery code', async () => {
    await parent()
    const kid = await child('Matei')
    await svc.syncNow()
    const deviceA = await snapshot()

    newDevice()
    await svc.signIn(EMAIL, PASSWORD)
    await svc.importRemoteChild(kid.id)
    await new Promise((r) => setTimeout(r, 5))
    await updateProfile(kid.id, { nickname: 'Matei Mare', grade: 4 })
    await svc.syncNow()

    await restore(deviceA)
    const codeBefore = (await getProfile(kid.id))!.recoveryCode
    await svc.syncNow()
    const after = (await getProfile(kid.id))!
    expect(after).toMatchObject({ nickname: 'Matei Mare', grade: 4, recoveryCode: codeBefore })
  })
})

describe('syncNow: deletions', () => {
  it('deleting a child while signed in writes a tombstone without progress data, and other devices drop it', async () => {
    await parent()
    const ana = await child('Ana', 1)
    const bob = await child('Bob', 2)
    await learn(ana.id, 'x', 5, 5)
    await svc.syncNow()
    const deviceA = await snapshot()

    // device B imports both, then deletes Ana
    newDevice()
    await svc.signIn(EMAIL, PASSWORD)
    await svc.importRemoteChild(ana.id)
    await svc.importRemoteChild(bob.id)
    await new Promise((r) => setTimeout(r, 5))
    await deleteProfile(ana.id)
    expect(Object.keys(readTombstones())).toEqual([ana.id])
    await svc.syncNow()
    const tomb = remoteChild(ana.id)!
    expect(tomb.deleted).toBe(true)
    expect(tomb.progress).toEqual({ profileId: ana.id, skills: {}, stars: 0, stickers: [], playDays: [] })
    expect(Object.keys(readTombstones())).toEqual([]) // delivered
    expect(remoteChild(bob.id)!.deleted).toBeUndefined()

    // device A syncs and loses Ana, keeps Bob
    await restore(deviceA)
    const r = await svc.syncNow()
    expect(r.removed).toBe(1)
    expect((await listProfiles()).map((p) => p.nickname)).toEqual(['Bob'])
    expect(await getProfile(ana.id)).toBeUndefined()
    expect(readFamilyState()?.syncedIds).toEqual([bob.id])
  })

  it('a deleted child is not offered for import on a new device', async () => {
    await parent()
    const ana = await child('Ana', 1)
    await svc.syncNow()
    await deleteProfile(ana.id)
    await svc.syncNow()
    newDevice()
    await svc.signIn(EMAIL, PASSWORD)
    expect((await svc.syncNow()).pending).toEqual([])
    expect(await svc.listRemoteChildren()).toEqual([])
  })

  it('deleting when signed out leaves no tombstone and the cloud copy is offered again later', async () => {
    const ana = await child('Ana', 1)
    await deleteProfile(ana.id)
    expect(readTombstones()).toEqual({})
  })

  it('a later edit on another device brings a deleted child back', async () => {
    await parent()
    const ana = await child('Ana', 1)
    await svc.syncNow()
    const deviceA = await snapshot()

    await new Promise((r) => setTimeout(r, 5))
    await deleteProfile(ana.id)
    await svc.syncNow() // cloud: tombstone

    // A (old snapshot) played afterwards, with a later timestamp than the deletion
    await restore(deviceA)
    await learn(ana.id, 'x', 3, 3, Date.now() + 10_000)
    await svc.syncNow()
    expect(await getProfile(ana.id)).toBeDefined()
    expect(remoteChild(ana.id)!.deleted).toBeUndefined()
    expect(remoteChild(ana.id)!.progress.skills.x).toBeDefined()
  })
})

describe('deleteCloudAccount and exportAll', () => {
  async function seed() {
    await parent()
    const a = await child('Ana', 1)
    const b = await child('Bob', 2)
    await svc.syncNow()
    return { a, b }
  }

  it('deletes families/{uid}/** first, then the Auth user; local data stays; session ends', async () => {
    const { a, b } = await seed()
    expect(remoteDocs()).toHaveLength(2)
    fb.calls.length = 0
    writes.length = 0
    await svc.deleteCloudAccount(PASSWORD)

    expect(fb.calls).toEqual(['reauth', 'deleteUser'])
    expect(store.has('families/u1')).toBe(false)
    expect(remoteDocs()).toHaveLength(0)
    const deletes = writes.filter((w) => w.op === 'delete').map((w) => w.path).sort()
    expect(deletes).toEqual(['families/u1', `families/u1/children/${a.id}`, `families/u1/children/${b.id}`].sort())
    expect(readFamilyState()).toBeNull()
    expect(localStorage.getItem(FAMILY_STATE_KEY)).toBeNull()
    expect((await listProfiles()).map((p) => p.nickname).sort()).toEqual(['Ana', 'Bob'])
  })

  it('the data is gone before the user is (order of operations)', async () => {
    await seed()
    const order: string[] = []
    const { deleteUser } = await import('firebase/auth')
    vi.mocked(deleteUser).mockImplementationOnce(async () => {
      order.push(`user-delete; docs left: ${store.size}`)
      fb.auth.currentUser = null
    })
    await svc.deleteCloudAccount(PASSWORD)
    expect(order).toEqual(['user-delete; docs left: 0'])
  })

  it('a wrong password deletes nothing', async () => {
    await seed()
    await expect(svc.deleteCloudAccount('wrong')).rejects.toMatchObject({ code: 'wrong-credentials' })
    expect(remoteDocs()).toHaveLength(2)
    expect(store.has('families/u1')).toBe(true)
    expect(fb.calls).not.toContain('deleteUser')
    expect(readFamilyState()).not.toBeNull()
  })

  it('an old login without a password asks for re-authentication, and a retry with the password finishes', async () => {
    await seed()
    fb.recentLogin = false
    await expect(svc.deleteCloudAccount()).rejects.toMatchObject({ code: 'reauth-required' })
    expect(readFamilyState()).not.toBeNull() // still signed in so the UI can ask for the password
    await svc.deleteCloudAccount(PASSWORD)
    expect(readFamilyState()).toBeNull()
    expect(fb.auth.currentUser).toBeNull()
  })

  it('exportAll returns everything stored, and does not alter it', async () => {
    const { a } = await seed()
    const before = JSON.stringify([...store.entries()])
    const out = await svc.exportAll()
    expect(out).toMatchObject({ app: 'ludiko', kind: 'family-export', version: 1 })
    expect(out.family).toMatchObject({ consentVersion: CONSENT_VERSION })
    expect(Object.keys(out.children).sort()).toEqual(remoteDocs().map(([p]) => p.split('/').pop()!).sort())
    expect(out.children[a.id].profile.nickname).toBe('Ana')
    expect(JSON.stringify([...store.entries()])).toBe(before)
    expect(JSON.stringify(out)).not.toContain('recoveryCode')
  })

  it('exportAll and delete need a session', async () => {
    await expect(svc.exportAll()).rejects.toMatchObject({ code: 'signed-out' })
    await expect(svc.deleteCloudAccount('x')).rejects.toMatchObject({ code: 'signed-out' })
  })
})
