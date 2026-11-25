import { beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile, getProfile, updateProgress } from '@/profiles/profileService'
import { JOIN_CODE_PATTERN } from '@/classroom/joinCode'
import { readCachedAssignments, readLastSync } from '@/classroom/assignmentCache'
import { ClassroomError, SYNC_MIN_INTERVAL_MS } from '@/classroom/types'
import { firestoreMock, rejectNext, resetFirestore, store, writes } from './helpers/fakeFirestore'

vi.mock('firebase/firestore', async () => (await import('./helpers/fakeFirestore')).firestoreMock)
vi.mock('@/services/firebase', () => ({ db: {}, firebaseEnabled: true }))
vi.mock('@/services/authService', () => ({ ensureAnonymousAuth: vi.fn(async () => ({ uid: 'anon-1' })) }))

import * as svc from '@/classroom/classroomService'

const T0 = new Date(2026, 10, 25, 10, 0, 0).getTime()

async function childWithProgress() {
  const profile = await createProfile({ nickname: 'Ursulet', avatar: '🐼', grade: 3, language: 'ro' })
  await updateProgress(profile.id, (p) => {
    p.skills['mat.count.10'] = { state: 'mastered', pMastery: 0.95, attempts: 12, correct: 11, lastSeen: T0 }
    p.skills['mat.sub.borrow.100'] = { state: 'gap', pMastery: 0.1, attempts: 6, correct: 1, lastSeen: T0 }
    p.skills['mat.add.10'] = { state: 'unknown', pMastery: 0, attempts: 0, correct: 0, lastSeen: T0 }
    p.playDays = ['2026-11-24', '2026-11-25', '2026-01-02']
    p.placements = {
      mat: {
        subject: 'mat',
        target: { grade: 3, semester: 1 },
        state: {},
        startedAt: 1,
        updatedAt: 2,
        completedAt: 3,
        summary: {
          subject: 'mat',
          level: { grade: 2, semester: 2 },
          gaps: ['mat.sub.borrow.100'],
          missingCount: 4,
          estimatedWeeks: 3,
          statement: { ro: 'Numele Ursulet nu trebuie să plece', en: 'x' },
        },
      },
    }
  })
  return profile
}

/** A class with one seat the way the teacher side would have written it */
function seedClass(code = 'ABC234', linked = false) {
  store.set('classes/c1', { teacherUid: 't1', name: 'Clasa a III-a B', grade: 3, createdAt: 1 })
  store.set(`classes/c1/seats/${code}`, { label: 'A.M.', joinCode: code, linked })
  store.set(`joinCodes/${code}`, { classId: 'c1', className: 'Clasa a III-a B' })
}

beforeEach(() => {
  resetFirestore()
  _resetMemoryForTests()
  localStorage.clear()
  vi.clearAllMocks()
})

describe('teacher: classes, seats, assignments', () => {
  it('creates a class with exactly the contract fields', async () => {
    const c = await svc.createClass('t1', { name: '  Clasa a III-a B ', grade: 3 })
    const stored = store.get(`classes/${c.id}`)!
    expect(Object.keys(stored).sort()).toEqual(['createdAt', 'grade', 'name', 'teacherUid'])
    expect(stored).toMatchObject({ teacherUid: 't1', name: 'Clasa a III-a B', grade: 3 })
    expect(await svc.listClasses('t1')).toHaveLength(1)
    expect(await svc.listClasses('other')).toHaveLength(0)
  })

  it('rejects an empty name or a grade out of range', async () => {
    await expect(svc.createClass('t1', { name: ' ', grade: 3 })).rejects.toBeInstanceOf(ClassroomError)
    await expect(svc.createClass('t1', { name: 'x', grade: 9 })).rejects.toBeInstanceOf(ClassroomError)
  })

  it('adds a seat: seat id == join code, plus the joinCodes index, nothing else', async () => {
    const c = await svc.createClass('t1', { name: 'Clasa', grade: 3 })
    const seat = await svc.addSeat(c.id, '  A.M.  ')
    expect(seat.id).toBe(seat.joinCode)
    expect(seat.joinCode).toMatch(JOIN_CODE_PATTERN)
    expect(store.get(`classes/${c.id}/seats/${seat.id}`)).toEqual({ label: 'A.M.', joinCode: seat.id, linked: false })
    expect(store.get(`joinCodes/${seat.id}`)).toEqual({ classId: c.id, className: 'Clasa' })
  })

  it('truncates labels to 20 characters and refuses an empty label', async () => {
    const c = await svc.createClass('t1', { name: 'Clasa', grade: 3 })
    const seat = await svc.addSeat(c.id, 'x'.repeat(40))
    expect(seat.label).toHaveLength(20)
    await expect(svc.addSeat(c.id, '   ')).rejects.toBeInstanceOf(ClassroomError)
  })

  it('draws a new code when the batch is refused (code taken by another class)', async () => {
    const c = await svc.createClass('t1', { name: 'Clasa', grade: 3 })
    rejectNext('batch', 'permission-denied')
    rejectNext('batch', 'permission-denied')
    const seat = await svc.addSeat(c.id, 'B.C.')
    expect(store.has(`classes/${c.id}/seats/${seat.id}`)).toBe(true)
    expect(firestoreMock.writeBatch).toHaveBeenCalledTimes(3)
  })

  it('unlink gives the seat a new code and removes the old seat, progress and index entry', async () => {
    seedClass('ABC234', true)
    store.set('classes/c1/progress/ABC234', { subjects: {}, playDaysThisWeek: 1, updatedAt: 1 })
    const fresh = await svc.unlinkSeat('c1', 'ABC234')
    expect(fresh.id).not.toBe('ABC234')
    expect(fresh).toMatchObject({ label: 'A.M.', linked: false })
    expect(store.has('classes/c1/seats/ABC234')).toBe(false)
    expect(store.has('classes/c1/progress/ABC234')).toBe(false)
    expect(store.has('joinCodes/ABC234')).toBe(false)
    expect(store.get(`joinCodes/${fresh.id}`)).toEqual({ classId: 'c1', className: 'Clasa a III-a B' })
  })

  it('creates an assignment with exactly the contract fields and validates it', async () => {
    const a = await svc.createAssignment('c1', {
      subject: 'mat',
      skillIds: ['mat.sub.borrow.100', 'mat.sub.borrow.100', 'mat.add.carry.100'],
      title: ' Recuperare ',
      dueDay: '2026-12-01',
    })
    const stored = store.get(`classes/c1/assignments/${a.id}`)!
    expect(Object.keys(stored).sort()).toEqual(['createdAt', 'dueDay', 'skillIds', 'subject', 'title'])
    expect(stored.skillIds).toEqual(['mat.sub.borrow.100', 'mat.add.carry.100'])
    expect(stored.title).toBe('Recuperare')
    const base = { subject: 'mat' as const, title: 't', dueDay: '2026-12-01' }
    await expect(svc.createAssignment('c1', { ...base, skillIds: [] })).rejects.toBeInstanceOf(ClassroomError)
    await expect(svc.createAssignment('c1', { ...base, skillIds: Array.from({ length: 11 }, (_, i) => `s${i}`) })).rejects.toMatchObject({ code: 'limit' })
    await expect(svc.createAssignment('c1', { ...base, skillIds: ['a'], dueDay: '1 dec' })).rejects.toBeInstanceOf(ClassroomError)
  })

  it('deleting a class removes the index, the subcollections and the class', async () => {
    seedClass()
    store.set('classes/c1/progress/ABC234', { subjects: {}, playDaysThisWeek: 0, updatedAt: 1 })
    store.set('classes/c1/assignments/a1', { subject: 'mat', skillIds: ['x'], title: 't', dueDay: '2026-12-01', createdAt: 1 })
    await svc.deleteClass('c1')
    expect([...store.keys()]).toEqual([])
  })
})

describe('child: joining a class', () => {
  it('reads the index, links the seat once (only linked + linkedAt change), and stores the class link', async () => {
    seedClass()
    const profile = await createProfile({ nickname: 'Ursulet', avatar: '🐼', grade: 3, language: 'ro' })
    const link = await svc.joinClass(profile.id, 'abc 234')
    expect(link).toEqual({ classId: 'c1', seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' })
    expect((await getProfile(profile.id))!.classLink).toEqual(link)

    const seatWrite = writes.find((w) => w.path === 'classes/c1/seats/ABC234' && w.op === 'update')!
    expect(Object.keys(seatWrite.data!).sort()).toEqual(['linked', 'linkedAt'])
    expect(seatWrite.data!.linked).toBe(true)
    expect(typeof seatWrite.data!.linkedAt).toBe('number')
  })

  it('rejects malformed codes without touching the network', async () => {
    const profile = await createProfile({ nickname: 'Ursulet', avatar: '🐼', grade: 3, language: 'ro' })
    await expect(svc.joinClass(profile.id, 'ABC')).rejects.toMatchObject({ code: 'invalid-code' })
    await expect(svc.joinClass(profile.id, 'OOO111')).rejects.toMatchObject({ code: 'invalid-code' }) // O, 1 are not in the alphabet
    expect(firestoreMock.getDoc).not.toHaveBeenCalled()
  })

  it('an unknown code is invalid; a code already used is "already-used"; offline is "offline"', async () => {
    const profile = await createProfile({ nickname: 'Ursulet', avatar: '🐼', grade: 3, language: 'ro' })
    await expect(svc.joinClass(profile.id, 'ZZZ999')).rejects.toMatchObject({ code: 'invalid-code' })

    seedClass('ABC234', true)
    rejectNext('update', 'permission-denied') // the rules only allow linked: false -> true
    await expect(svc.joinClass(profile.id, 'ABC234')).rejects.toMatchObject({ code: 'already-used' })
    expect((await getProfile(profile.id))!.classLink).toBeUndefined()

    rejectNext('get', 'unavailable')
    await expect(svc.joinClass(profile.id, 'ABC234')).rejects.toMatchObject({ code: 'offline' })
  })

  it('syncs the first summary right after joining and caches the assignments', async () => {
    seedClass()
    store.set('classes/c1/assignments/a1', { subject: 'mat', skillIds: ['mat.sub.borrow.100'], title: 'Tema', dueDay: '2026-12-01', createdAt: 5 })
    const profile = await childWithProgress()
    await svc.joinClass(profile.id, 'ABC234')
    expect(store.has('classes/c1/progress/ABC234')).toBe(true)
    expect(readCachedAssignments('c1')).toEqual([{ id: 'a1', subject: 'mat', skillIds: ['mat.sub.borrow.100'], title: 'Tema', dueDay: '2026-12-01' }])
  })
})

describe('child: progress sync', () => {
  async function linkedChild() {
    seedClass('ABC234', true)
    const profile = await childWithProgress()
    const { setClassLink } = await import('@/profiles/profileService')
    await setClassLink(profile.id, { classId: 'c1', seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' })
    return profile
  }

  it('writes exactly the contract document and nothing personal', async () => {
    const profile = await linkedChild()
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('synced')
    const doc = store.get('classes/c1/progress/ABC234')!
    expect(Object.keys(doc).sort()).toEqual(['playDaysThisWeek', 'subjects', 'updatedAt'])
    expect(doc.updatedAt).toBe(T0)
    expect(doc.playDaysThisWeek).toBe(2) // 24 and 25 Nov are in the last 7 days; 2 Jan is not
    expect(doc.subjects).toEqual({
      mat: {
        level: { grade: 2, semester: 2 },
        missingCount: 4,
        // unknown skills are left out: absent means unknown
        skills: { 'mat.count.10': 'mastered', 'mat.sub.borrow.100': 'gap' },
      },
    })
    const json = JSON.stringify(doc)
    for (const secret of ['Ursulet', '🐼', profile.recoveryCode, 'pMastery', 'attempts', 'lastSeen', 'statement']) {
      expect(json).not.toContain(secret)
    }
  })

  it('throttles to once per 10 minutes and sends again afterwards', async () => {
    const profile = await linkedChild()
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('synced')
    expect(await svc.syncProgress(profile.id, { now: T0 + 60_000 })).toBe('throttled')
    expect(await svc.syncProgress(profile.id, { now: T0 + SYNC_MIN_INTERVAL_MS - 1 })).toBe('throttled')
    expect(firestoreMock.setDoc).toHaveBeenCalledTimes(1)
    expect(await svc.syncProgress(profile.id, { now: T0 + SYNC_MIN_INTERVAL_MS })).toBe('synced')
    expect(firestoreMock.setDoc).toHaveBeenCalledTimes(2)
    // `force` (used right after joining) skips the throttle
    expect(await svc.syncProgress(profile.id, { now: T0 + SYNC_MIN_INTERVAL_MS + 1, force: true })).toBe('synced')
  })

  it('offline: reports it, keeps the last-sync time, and the next call retries at once', async () => {
    const profile = await linkedChild()
    rejectNext('set', 'unavailable')
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('offline')
    expect(readLastSync(profile.id)).toBe(0)
    expect(await svc.syncProgress(profile.id, { now: T0 + 1000 })).toBe('synced')
    expect(readLastSync(profile.id)).toBe(T0 + 1000)
  })

  it('does nothing without a class link or without anything to share', async () => {
    const profile = await childWithProgress()
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('no-link')
    const empty = await createProfile({ nickname: 'Nou', avatar: '🦊', grade: 1, language: 'ro' })
    const { setClassLink } = await import('@/profiles/profileService')
    await setClassLink(empty.id, { classId: 'c1', seatId: 'ABC234', joinCode: 'ABC234', className: 'x' })
    expect(await svc.syncProgress(empty.id, { now: T0 })).toBe('nothing')
  })

  it('when the seat is gone (unlinked by the teacher) the link is dropped', async () => {
    const profile = await linkedChild()
    store.delete('joinCodes/ABC234')
    rejectNext('set', 'permission-denied')
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('revoked')
    expect((await getProfile(profile.id))!.classLink).toBeUndefined()
  })

  it('a refused write while the seat still exists keeps the link (retry later)', async () => {
    const profile = await linkedChild()
    rejectNext('set', 'permission-denied')
    expect(await svc.syncProgress(profile.id, { now: T0 })).toBe('failed')
    expect((await getProfile(profile.id))!.classLink).toBeDefined()
  })

  it('leaving erases the summary (best effort) and the local link', async () => {
    const profile = await linkedChild()
    await svc.syncProgress(profile.id, { now: T0 })
    await svc.leaveClass(profile.id)
    expect(store.has('classes/c1/progress/ABC234')).toBe(false)
    expect((await getProfile(profile.id))!.classLink).toBeUndefined()
    expect(readLastSync(profile.id)).toBe(0)
  })

  it('leaving works offline: the local link goes even if the delete cannot be sent', async () => {
    const profile = await linkedChild()
    rejectNext('delete', 'unavailable')
    await svc.leaveClass(profile.id)
    expect((await getProfile(profile.id))!.classLink).toBeUndefined()
  })
})
