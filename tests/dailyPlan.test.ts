import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerService } from '@/learner'
import { availableSubjects, isSubjectAvailable, lockedSubjects, subjectMinGrade } from '@/learner/availability'
import { PLAN_ROTATING_SUBJECTS, rotatingOrder } from '@/learner/planOps'
import { getAllSkills, getSkillsBySubject } from '@/engine/content/registry'
import { DAY_MS } from '@/engine/mastery'
import type { Grade, SubjectId } from '@/engine/types'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile, getProgress, toDayString } from '@/profiles/profileService'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
/** Mid semester 2 of 2026/27 */
const MAR_20 = at(2027, 3, 20)
const ALL: SubjectId[] = ['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic']

async function child(grade: Grade) {
  return createProfile({ nickname: 'Ana', avatar: '🦊', grade, language: 'ro' })
}

/** Answer probes of `subject` until the placement is done; the child knows everything or nothing */
async function finishPlacement(profileId: string, subject: SubjectId, knows: boolean, now = MAR_20) {
  for (let i = 0; i < 60; i++) {
    const r = await learnerService.placementNext(profileId, subject, now)
    if ('unavailable' in r) throw new Error(`${subject} is unavailable`)
    if (r.done) return
    await learnerService.placementRecord(profileId, subject, r.skillId, Array(r.itemCount).fill(knows))
  }
  throw new Error('placement did not finish')
}

/** Answer exactly `n` probes of an in-progress placement */
async function answerProbes(profileId: string, subject: SubjectId, n: number, now = MAR_20) {
  for (let i = 0; i < n; i++) {
    const r = await learnerService.placementNext(profileId, subject, now)
    if ('unavailable' in r || r.done) return
    await learnerService.placementRecord(profileId, subject, r.skillId, Array(r.itemCount).fill(true))
  }
}

beforeEach(() => {
  _resetMemoryForTests()
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAR_20)
})
afterEach(() => vi.useRealTimers())

describe('subject availability by grade', () => {
  it('derives each subject\'s minimum grade from the content, not from a list', () => {
    for (const subject of ALL) {
      const grades = getAllSkills().filter((s) => s.subject === subject).map((s) => s.grade)
      expect(subjectMinGrade(subject)).toBe(Math.min(...grades))
    }
    // what the content is today: a regression guard for the owner-reported bug, not the source of truth
    expect(subjectMinGrade('geo')).toBe(4)
    expect(subjectMinGrade('ist')).toBe(4)
    expect(subjectMinGrade('civ')).toBe(3)
    for (const s of ['mat', 'rom', 'stiinte', 'logic'] as const) expect(subjectMinGrade(s)).toBe(0)
  })

  it.each([
    [0, ['mat', 'rom', 'stiinte', 'logic'], ['civ', 'ist', 'geo']],
    [1, ['mat', 'rom', 'stiinte', 'logic'], ['civ', 'ist', 'geo']],
    [3, ['mat', 'rom', 'stiinte', 'civ', 'logic'], ['ist', 'geo']],
    [4, ['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic'], []],
  ] as const)('grade %i: playable subjects and teasers', (grade, playable, teasers) => {
    expect(availableSubjects(ALL, grade)).toEqual(playable)
    expect(lockedSubjects(ALL, grade).map((l) => l.subject).sort()).toEqual([...teasers].sort())
    for (const s of ALL) expect(isSubjectAvailable(s, grade)).toBe(playable.includes(s as never))
  })
})

describe('placement guard', () => {
  it('grade I + geography: no placement is created or completed, the answer says "unavailable"', async () => {
    const p = await child(1)
    const r = await learnerService.placementNext(p.id, 'geo', MAR_20)
    expect(r).toEqual({ done: false, unavailable: true, minGrade: 4 })
    expect(await learnerService.getPlacement(p.id, 'geo')).toBeUndefined()
    expect((await getProgress(p.id)).placements?.geo).toBeUndefined()
    // asking again changes nothing, and there is no mission for it either
    expect(await learnerService.placementNext(p.id, 'geo', MAR_20 + DAY_MS)).toMatchObject({ unavailable: true })
    expect(await learnerService.getTodayMission(p.id, 'geo', MAR_20)).toBeUndefined()
    expect(await learnerService.getTodayBits(p.id, 'geo', MAR_20)).toBeUndefined()
  })

  it('a grade III child cannot check history/geography but can check civics', async () => {
    const p = await child(3)
    expect(await learnerService.placementNext(p.id, 'ist', MAR_20)).toMatchObject({ unavailable: true })
    expect(await learnerService.placementNext(p.id, 'geo', MAR_20)).toMatchObject({ unavailable: true })
    expect(await learnerService.placementNext(p.id, 'civ', MAR_20)).toMatchObject({ done: false, skillId: expect.any(String) })
  })

  it('early in the semester a grade IV child still gets a real geography check (never an empty one)', async () => {
    const p = await child(4)
    const sept = at(2026, 9, 20) // placementTarget would be grade III, semester 2: no geography there
    const r = await learnerService.placementNext(p.id, 'geo', sept)
    expect(r).toMatchObject({ done: false, skillId: expect.stringMatching(/^geo\./) })
    expect((await learnerService.getPlacement(p.id, 'geo'))!.target).toEqual({ grade: 4, semester: 1 })
  })

  it('an unavailable subject never shows up as playable work in the plan', async () => {
    const p = await child(1)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(plan.bits.map((b) => b.subject)).not.toContain('geo')
  })
})

describe('daily plan', () => {
  it('a fresh grade I child gets Matematică, Limba română and one of Științe/Jocuri de logică, each a short check', async () => {
    const p = await child(1)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(plan.day).toBe(toDayString(MAR_20))
    expect(plan.bits).toHaveLength(3)
    expect(plan.bits.map((b) => b.index)).toEqual([0, 1, 2])
    expect(plan.bits[0].subject).toBe('mat')
    expect(plan.bits[1].subject).toBe('rom')
    expect(['stiinte', 'logic']).toContain(plan.bits[2].subject)
    for (const b of plan.bits) {
      expect(b.source).toBe('placement') // no placement yet: a short chunk of the check, resumable
      expect(b.done).toBe(false)
      expect(b.steps).toEqual([])
      expect(b.itemCount).toBeLessThanOrEqual(6)
    }
    // creating the plan did not start any placement
    expect((await getProgress(p.id)).placements).toBeUndefined()
  })

  it('only offers subjects of the grade, and rotates the third bit by day', async () => {
    const small = await child(1)
    const big = await child(4)
    const thirdSmall = new Set<string>()
    const thirdBig = new Set<string>()
    for (let d = 0; d < 10; d++) {
      const now = MAR_20 + d * DAY_MS
      thirdSmall.add((await learnerService.getTodayPlan(small.id, now)).bits[2].subject)
      thirdBig.add((await learnerService.getTodayPlan(big.id, now)).bits[2].subject)
    }
    expect([...thirdSmall].sort()).toEqual(['logic', 'stiinte']) // grade I: nothing above its grade, both used
    expect([...thirdBig].every((s) => PLAN_ROTATING_SUBJECTS.includes(s as SubjectId))).toBe(true)
    expect(thirdBig.size).toBeGreaterThanOrEqual(4) // grade IV rotates through the others
    // two consecutive days differ
    const a = (await learnerService.getTodayPlan(big.id, MAR_20 + 20 * DAY_MS)).bits[2].subject
    const b = (await learnerService.getTodayPlan(big.id, MAR_20 + 21 * DAY_MS)).bits[2].subject
    expect(a).not.toBe(b)
  })

  it('is stable within a day, also after the child progressed, and recomposed the next day', async () => {
    const p = await child(4)
    const first = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(await learnerService.getTodayPlan(p.id, MAR_20 + 3600_000)).toEqual(first)
    // progress that changes what a fresh plan would pick must not reshuffle today's bits
    await finishPlacement(p.id, 'mat', true)
    const again = await learnerService.getTodayPlan(p.id, MAR_20 + 7200_000)
    expect(again.bits.map((b) => [b.subject, b.source])).toEqual(first.bits.map((b) => [b.subject, b.source]))
    // next day: a new plan (mat has a placement now, so its bit is a mission bit)
    const tomorrow = await learnerService.getTodayPlan(p.id, MAR_20 + DAY_MS)
    expect(tomorrow.day).toBe(toDayString(MAR_20 + DAY_MS))
    expect(tomorrow.bits[0]).toMatchObject({ subject: 'mat', source: 'mission' })
  })

  it('a subject with a finished placement contributes a slice of its own mission, and completion is derived from the mission steps', async () => {
    const p = await child(2)
    await finishPlacement(p.id, 'mat', false) // gaps everywhere: a rich mission
    const day = toDayString(MAR_20)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    const mat = plan.bits[0]
    expect(mat).toMatchObject({ subject: 'mat', source: 'mission', done: false, day })
    expect(mat.steps.length).toBeGreaterThan(0)
    const mine = (await learnerService.getTodayBits(p.id, 'mat', MAR_20))![mat.bitIndex!]
    expect(mine.steps).toEqual(mat.steps)
    expect(plan.bits[1]).toMatchObject({ subject: 'rom', source: 'placement' }) // rom has no placement yet

    // finishing the bit = completing its mission steps, through the existing contract call
    for (const s of mat.steps) await learnerService.completeMissionStep(p.id, 'mat', day, s.stepIndex, 1)
    const after = await learnerService.getTodayPlan(p.id, MAR_20 + 1000)
    expect(after.bits.map((b) => b.subject)).toEqual(plan.bits.map((b) => b.subject))
    expect(after.bits[0].done).toBe(true)
    expect(after.bits[1].done).toBe(false)
  })

  it('a placement chunk is two probes: done after them, resumable, and the whole placement counts too', async () => {
    const p = await child(2)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    const rom = plan.bits.find((b) => b.subject === 'rom')!
    expect(rom.source).toBe('placement')

    await answerProbes(p.id, 'rom', 1)
    expect((await learnerService.getTodayPlan(p.id, MAR_20)).bits[rom.index].done).toBe(false)
    expect((await learnerService.getPlacement(p.id, 'rom'))!.completedAt).toBeUndefined() // resumable
    await answerProbes(p.id, 'rom', 1)
    const done = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(done.bits[rom.index].done).toBe(true)
    expect(done.bits[rom.index].source).toBe('placement') // the bit does not turn into something else mid-day
    // the other bits were not touched
    expect(done.bits.filter((b) => b.done)).toHaveLength(1)
  })

  it('celebration state: every bit done once all chunks and mission bits are finished', async () => {
    const p = await child(1)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    for (const b of plan.bits) await answerProbes(p.id, b.subject, 2)
    const done = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(done.bits.every((b) => b.done)).toBe(true)
  })

  it('the next day, a subject whose placement finished switches to missions; placement chunks continue otherwise', async () => {
    const p = await child(1)
    await getPlanAndFinish(p.id)
    const tomorrow = await learnerService.getTodayPlan(p.id, MAR_20 + DAY_MS)
    expect(tomorrow.bits.find((b) => b.subject === 'mat')!.source).toBe('mission')
    expect(tomorrow.bits.find((b) => b.subject === 'rom')!.source).toBe('placement')

    async function getPlanAndFinish(id: string) {
      await learnerService.getTodayPlan(id, MAR_20)
      await finishPlacement(id, 'mat', true)
    }
  })

  it('prefers a rotating subject with work (unchecked or gaps) over one that is fully known', async () => {
    const profile = await child(4)
    await finishPlacement(profile.id, 'logic', true) // everything known, nothing due today
    const progress = await getProgress(profile.id)
    expect(getSkillsBySubject('logic').every((s) => progress.skills[s.id]?.state !== 'gap')).toBe(true)
    const order = rotatingOrder(progress, profile, toDayString(MAR_20), MAR_20)
    expect(order.sort()).toEqual(['civ', 'geo', 'ist', 'stiinte']) // logic has nothing to do: it sits this one out
    expect((await learnerService.getTodayPlan(profile.id, MAR_20)).bits[2].subject).not.toBe('logic')

    // a gap brings it back
    await finishPlacement(profile.id, 'stiinte', false)
    const later = await getProgress(profile.id)
    expect(rotatingOrder(later, profile, toDayString(MAR_20), MAR_20)).toContain('stiinte')
  })

  it('a grade IV child with every subject placed still gets a rotating bit from the mission', async () => {
    const p = await child(4)
    for (const s of ['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic'] as const) await finishPlacement(p.id, s, false)
    const plan = await learnerService.getTodayPlan(p.id, MAR_20)
    expect(plan.bits).toHaveLength(3)
    expect(plan.bits.every((b) => b.source === 'mission')).toBe(true)
    expect(new Set(plan.bits.map((b) => b.subject)).size).toBe(3)
  })
})
