import { beforeEach, describe, expect, it } from 'vitest'
import { writeCachedAssignments } from '@/classroom/assignmentCache'
import { learnerService } from '@/learner'
import { _resetMemoryForTests } from '@/profiles/db'
import {
  createProfile,
  exportProfile,
  getProfile,
  importProfile,
  sanitizeClassLink,
  setClassLink,
  updateProfile,
  updateProgress,
} from '@/profiles/profileService'
import type { ClassLink } from '@/profiles/types'

const LINK: ClassLink = { classId: 'class1', seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' }
const input = { nickname: 'Ursulet', avatar: '🐼', grade: 3 as const, language: 'ro' as const }

beforeEach(() => {
  _resetMemoryForTests()
  localStorage.clear()
})

describe('profile classLink', () => {
  it('is set, kept across profile edits, and removed again', async () => {
    const p = await createProfile(input)
    expect(p.classLink).toBeUndefined()
    expect((await setClassLink(p.id, LINK)).classLink).toEqual(LINK)
    await updateProfile(p.id, { nickname: 'Ursulica' })
    expect((await getProfile(p.id))!.classLink).toEqual(LINK)
    const removed = await setClassLink(p.id, null)
    expect('classLink' in removed).toBe(false)
  })

  it('survives a backup round trip', async () => {
    const p = await createProfile(input)
    await setClassLink(p.id, LINK)
    const backup = await exportProfile(p.id)
    expect(backup.profile.classLink).toEqual(LINK)

    _resetMemoryForTests()
    const restored = await importProfile(JSON.stringify(backup))
    expect(restored.classLink).toEqual(LINK)
    expect((await getProfile(p.id))!.classLink).toEqual(LINK)
  })

  it('an old backup without a link imports without one', async () => {
    const p = await createProfile(input)
    const text = JSON.stringify(await exportProfile(p.id))
    _resetMemoryForTests()
    expect((await importProfile(text)).classLink).toBeUndefined()
  })

  it('a malformed link in a backup file is dropped, never trusted', async () => {
    const p = await createProfile(input)
    const backup = await exportProfile(p.id)
    const bad = { ...backup, profile: { ...backup.profile, classLink: { classId: 5, seatId: 'x'.repeat(500), joinCode: '', className: {} } } }
    _resetMemoryForTests()
    expect((await importProfile(JSON.stringify(bad))).classLink).toBeUndefined()
    expect(sanitizeClassLink(null)).toBeUndefined()
    expect(sanitizeClassLink({ ...LINK, extra: 'dropped' })).toEqual(LINK)
  })
})

describe('learnerService.getClassAssignments', () => {
  const day = (n: number) => {
    const d = new Date(Date.now() + n * 86_400_000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('is empty without a class link or without cached assignments', async () => {
    const p = await createProfile(input)
    expect(await learnerService.getClassAssignments(p.id)).toEqual([])
    await setClassLink(p.id, LINK)
    expect(await learnerService.getClassAssignments(p.id)).toEqual([])
  })

  it('derives the bit from the cached assignment and the child\'s own skill states', async () => {
    const p = await createProfile(input)
    await setClassLink(p.id, LINK)
    writeCachedAssignments(LINK.classId, [
      { id: 'a1', subject: 'mat', skillIds: ['mat.count.10', 'mat.add.10'], title: 'Tema 1', dueDay: day(3) },
    ])
    let [bit] = await learnerService.getClassAssignments(p.id)
    expect(bit).toMatchObject({ kind: 'assignment', title: 'Tema 1', doneCount: 0, total: 2, done: false })

    await updateProgress(p.id, (g) => {
      g.skills['mat.count.10'] = { state: 'mastered', pMastery: 0.9, attempts: 5, correct: 5, lastSeen: Date.now() }
      g.skills['mat.add.10'] = { state: 'practised', pMastery: 0.7, attempts: 5, correct: 4, lastSeen: Date.now() }
    })
    ;[bit] = await learnerService.getClassAssignments(p.id)
    expect(bit).toMatchObject({ doneCount: 2, done: true })
  })

  it('other classes\' cached assignments are not shown', async () => {
    const p = await createProfile(input)
    await setClassLink(p.id, LINK)
    writeCachedAssignments('other-class', [{ id: 'x', subject: 'mat', skillIds: ['mat.count.10'], title: 'X', dueDay: day(1) }])
    expect(await learnerService.getClassAssignments(p.id)).toEqual([])
  })
})
