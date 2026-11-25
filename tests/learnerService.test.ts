import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerService } from '@/learner'
import type { PlacementDone } from '@/learner'
import { placementTarget, schoolSemester } from '@/learner/time'
import { PARENT_TIPS, tipForWeek } from '@/learner/tips'
import { getSkillsBySubject } from '@/engine/content/registry'
import { DAY_MS } from '@/engine/mastery'
import type { ChoiceItem, Grade, Item, ItemResult, NumberInputItem } from '@/engine/types'
import { _resetMemoryForTests, dbPut } from '@/profiles/db'
import {
  createProfile,
  exportProfile,
  getProgress,
  importProfile,
  saveProgress,
  toDayString,
} from '@/profiles/profileService'
import type { ProfileProgress, SkillProgress } from '@/profiles/types'
import { knowsFn } from './helpers/engineSim'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
/** Mid semester 2 of 2026/27 (more than 6 weeks after 1 Feb) */
const MAR_20 = at(2027, 3, 20)

const prov = { source: 'test' } as unknown as NumberInputItem['provenance']
function numItem(skillId: string, id = `${skillId}#1`): NumberInputItem {
  return { id, type: 'number-input', skillId, difficulty: 1, prompt: { ro: '1+1' }, correct: 2, reviewStatus: 'auto-checked', provenance: prov }
}
function choiceItem(skillId: string, n: number): ChoiceItem {
  return {
    id: `${skillId}#c${n}`,
    type: 'choice',
    skillId,
    difficulty: 1,
    prompt: { ro: 'x' },
    options: Array.from({ length: n }, (_, i) => ({ id: `o${i}`, text: { ro: String(i) } })),
    correctId: 'o0',
    reviewStatus: 'auto-checked',
    provenance: prov,
  }
}
const res = (item: Item, correct: boolean): ItemResult => ({ itemId: item.id, correct, response: { type: 'number-input', value: 0 }, timeMs: 1000 })
const practiceMeta = { retry: false, mode: 'practice' as const }

async function newProfile(grade: Grade = 2) {
  return createProfile({ nickname: 'Ana', avatar: '🦊', grade, language: 'ro' })
}

/** Drives placement to the end with a child who answers all items of a skill right iff `knows(skill)`. */
async function runPlacement(profileId: string, knows: (id: string) => boolean, now: number, maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const r = await learnerService.placementNext(profileId, 'mat', now)
    if (r.done) return r
    expect(r.progress).toBeGreaterThanOrEqual(0)
    expect(r.progress).toBeLessThan(1)
    await learnerService.placementRecord(profileId, 'mat', r.skillId, Array(r.itemCount).fill(knows(r.skillId)))
  }
  throw new Error('placement did not finish')
}

const mathIds = () => getSkillsBySubject('mat').map((s) => s.id)
const grade0Only = () => knowsFn(getSkillsBySubject('mat'), new Set(getSkillsBySubject('mat').filter((s) => s.grade >= 1).map((s) => s.id)))

beforeEach(() => {
  _resetMemoryForTests()
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAR_20)
})
afterEach(() => vi.useRealTimers())

describe('school semester', () => {
  it('Sep–Jan is semester 1, Feb–Aug semester 2', () => {
    expect(schoolSemester(at(2026, 9, 1))).toBe(1)
    expect(schoolSemester(at(2027, 1, 31))).toBe(1)
    expect(schoolSemester(at(2027, 2, 1))).toBe(2)
    expect(schoolSemester(at(2027, 8, 31))).toBe(2)
    expect(learnerService.schoolSemester(at(2026, 12, 1))).toBe(1)
  })

  it('uses the previous semester during the first 6 weeks of a semester', () => {
    // semester 1 starts 1 Sep: early until 13 Oct
    expect(placementTarget(2, at(2026, 9, 15))).toEqual({ grade: 1, semester: 2 })
    expect(placementTarget(2, at(2026, 10, 12))).toEqual({ grade: 1, semester: 2 })
    expect(placementTarget(2, at(2026, 10, 14))).toEqual({ grade: 2, semester: 1 })
    expect(placementTarget(2, at(2027, 1, 20))).toEqual({ grade: 2, semester: 1 })
    // semester 2 starts 1 Feb: early until 15 Mar
    expect(placementTarget(2, at(2027, 2, 10))).toEqual({ grade: 2, semester: 1 })
    expect(placementTarget(2, at(2027, 3, 14))).toEqual({ grade: 2, semester: 1 })
    expect(placementTarget(2, at(2027, 3, 20))).toEqual({ grade: 2, semester: 2 })
    // never below the start of the preparatory grade
    expect(placementTarget(0, at(2026, 9, 15))).toEqual({ grade: 0, semester: 1 })
  })

  it('placementNext stores the target it was started with', async () => {
    const early = await newProfile(2)
    await learnerService.placementNext(early.id, 'mat', at(2026, 9, 20))
    expect((await learnerService.getPlacement(early.id, 'mat'))!.target).toEqual({ grade: 1, semester: 2 })

    const later = await newProfile(2)
    await learnerService.placementNext(later.id, 'mat', at(2026, 11, 20))
    expect((await learnerService.getPlacement(later.id, 'mat'))!.target).toEqual({ grade: 2, semester: 1 })
  })
})

describe('recordItemResult', () => {
  it('moves mastery on first tries, counts play days', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)
    const prog = await getProgress(p.id)
    const rec = prog.skills['mat.count.10']
    expect(rec.state).toBe('learning')
    expect(rec.pMastery).toBeGreaterThan(0.2)
    expect(rec.attempts).toBe(1)
    expect(rec.correct).toBe(1)
    expect(rec.stateChangedAt).toBe(MAR_20)
    expect(prog.playDays).toEqual([toDayString(MAR_20)])
  })

  it('wrong first answer makes a gap', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, false), practiceMeta)
    expect((await getProgress(p.id)).skills['mat.count.10'].state).toBe('gap')
  })

  it('retries count as attempts but never move pMastery or the state', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, false), practiceMeta)
    const before = (await getProgress(p.id)).skills['mat.count.10']
    await learnerService.recordItemResult(p.id, item, res(item, true), { retry: true, mode: 'practice' })
    const after = (await getProgress(p.id)).skills['mat.count.10']
    expect(after.attempts).toBe(before.attempts + 1)
    expect(after.correct).toBe(before.correct + 1)
    expect(after.pMastery).toBe(before.pMastery)
    expect(after.state).toBe(before.state)
    expect(after.nextReview).toBe(before.nextReview)
  })

  it('placement attempts only count; later practice still starts from the prior', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, true), { retry: false, mode: 'placement' })
    let rec = (await getProgress(p.id)).skills['mat.count.10']
    expect(rec).toMatchObject({ state: 'unknown', attempts: 1, correct: 1 })
    await learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)
    rec = (await getProgress(p.id)).skills['mat.count.10']
    expect(rec.state).toBe('learning')
    expect(rec.attempts).toBe(2)
    expect(rec.pMastery).toBeGreaterThan(0.2) // not stuck at 0 after the counters-only record
  })

  it('check-mode items only mark the play day (applyMasteryCheck owns the mastery update)', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, true), { retry: false, mode: 'check' })
    const prog = await getProgress(p.id)
    expect(prog.skills['mat.count.10']).toBeUndefined()
    expect(prog.playDays).toHaveLength(1)
  })

  it('uses the option count: a 2-option choice is weaker evidence than a 4-option one', async () => {
    const p = await newProfile()
    const two = choiceItem('mat.count.10', 2)
    const four = choiceItem('mat.numrec.10', 4)
    await learnerService.recordItemResult(p.id, two, res(two, true), practiceMeta)
    await learnerService.recordItemResult(p.id, four, res(four, true), practiceMeta)
    const prog = await getProgress(p.id)
    expect(prog.skills['mat.numrec.10'].pMastery).toBeGreaterThan(prog.skills['mat.count.10'].pMastery)
  })

  it('serialises concurrent writes', async () => {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    await Promise.all(Array.from({ length: 6 }, () => learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)))
    expect((await getProgress(p.id)).skills['mat.count.10'].attempts).toBe(6)
  })
})

describe('mastery checks', () => {
  async function practisedProfile() {
    const p = await newProfile()
    const item = numItem('mat.count.10')
    for (let i = 0; i < 6; i++) await learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)
    return p
  }

  it('passing makes the skill mastered and clears checkFailedAt', async () => {
    const p = await practisedProfile()
    expect((await getProgress(p.id)).skills['mat.count.10'].state).toBe('practised')
    const out = await learnerService.applyMasteryCheck(p.id, 'mat.count.10', [true, true, true, true, true], 'number-input')
    expect(out.passed).toBe(true)
    const rec = (await getProgress(p.id)).skills['mat.count.10']
    expect(rec.state).toBe('mastered')
    expect(rec.checkFailedAt).toBeUndefined()
    expect(rec.stateChangedAt).toBe(MAR_20)
  })

  it('failing sets checkFailedAt and leaves the skill unmastered', async () => {
    const p = await practisedProfile()
    const out = await learnerService.applyMasteryCheck(p.id, 'mat.count.10', [false, true, false, true, false], 'number-input')
    expect(out.passed).toBe(false)
    const rec = (await getProgress(p.id)).skills['mat.count.10']
    expect(rec.state).not.toBe('mastered')
    expect(rec.checkFailedAt).toBe(MAR_20)
  })

  it('rejects unknown skills', async () => {
    const p = await newProfile()
    await expect(learnerService.applyMasteryCheck(p.id, 'nope', [true], 'number-input')).rejects.toThrow()
  })

  it('the planner does not offer a check again within 2 days of a failed one', async () => {
    const p = await newProfile()
    await runPlacement(p.id, () => true, MAR_20) // perfect child: everything mastered, nothing due
    const skill = 'mat.count.10'
    const ready: SkillProgress = { state: 'practised', pMastery: 0.92, attempts: 8, correct: 8, lastSeen: MAR_20 - DAY_MS, nextReview: MAR_20 + 5 * DAY_MS }
    const withFail = async (checkFailedAt?: number) => {
      const prog = await getProgress(p.id)
      prog.skills[skill] = { ...ready, ...(checkFailedAt !== undefined ? { checkFailedAt } : {}) }
      prog.missions = []
      await saveProgress(prog)
    }
    const checkSkills = async (now: number) =>
      (await learnerService.getTodayMission(p.id, 'mat', now))!.steps.filter((s) => s.kind === 'check').map((s) => s.skillId)

    await withFail()
    expect(await checkSkills(MAR_20)).toEqual([skill])

    await withFail(MAR_20 - DAY_MS) // failed yesterday
    expect(await checkSkills(MAR_20)).toEqual([])

    await withFail(MAR_20 - 3 * DAY_MS) // failed 3 days ago
    expect(await checkSkills(MAR_20)).toEqual([skill])

    // the cooled-down skill is practised instead
    await withFail(MAR_20 - DAY_MS)
    const steps = (await learnerService.getTodayMission(p.id, 'mat', MAR_20))!.steps
    expect(steps.find((s) => s.skillId === skill)?.kind).toBe('practice')
  })
})

describe('placement', () => {
  it('runs end to end on the real math graph and seeds progress', async () => {
    const p = await newProfile(2)
    // a child with some real practice before placement: must not be overwritten
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(p.id, item, res(item, false), practiceMeta)
    const practised = (await getProgress(p.id)).skills['mat.count.10']

    const done = (await runPlacement(p.id, grade0Only(), MAR_20)) as PlacementDone
    expect(done.done).toBe(true)
    const { summary } = done
    expect(summary.subject).toBe('mat')
    expect(summary.level).toEqual({ grade: 0, semester: 2 })
    expect(summary.missingCount).toBeGreaterThan(5)
    expect(summary.gaps).toHaveLength(summary.missingCount)
    expect(summary.estimatedWeeks).toBeGreaterThan(0)
    expect(summary.statement.ro).toContain('Matematică')
    expect(summary.statement.ro).toContain('clasa pregătitoare')
    expect(summary.statement.ro).toContain('Clasa reală: a II-a')
    expect(summary.statement.ro).not.toContain('nu e încă completă')
    expect(summary.statement.en).toContain('Math')
    expect(summary.statement.en).toContain('Actual grade: II')

    const prog = await getProgress(p.id)
    for (const gap of summary.gaps) expect(prog.skills[gap].state).toBe('gap')
    expect(Object.values(prog.skills).some((s) => s.state === 'mastered')).toBe(true)
    // a skill with real attempts keeps its record untouched
    expect(prog.skills['mat.count.10']).toEqual(practised)

    const rec = (await learnerService.getPlacement(p.id, 'mat'))!
    expect(rec.completedAt).toBe(MAR_20)
    expect(rec.summary).toEqual(summary)
    expect(rec.target).toEqual({ grade: 2, semester: 2 })

    const history = await learnerService.getLevelHistory(p.id, 'mat')
    expect(history).toEqual([{ at: MAR_20, level: summary.level, missingCount: summary.missingCount }])
  })

  it('a child who knows everything gets no gaps and an up-to-date level', async () => {
    const p = await newProfile(2)
    const done = (await runPlacement(p.id, () => true, MAR_20)) as PlacementDone
    expect(done.summary.missingCount).toBe(0)
    expect(done.summary.level).toEqual({ grade: 2, semester: 2 })
    expect(done.summary.statement.ro).toContain('Nu lipsește nicio competență')
  })

  it('is idempotent once finished (no second history entry, no re-seeding)', async () => {
    const p = await newProfile(2)
    const first = (await runPlacement(p.id, grade0Only(), MAR_20)) as PlacementDone
    const again = await learnerService.placementNext(p.id, 'mat', MAR_20 + DAY_MS)
    expect(again).toEqual({ done: true, summary: first.summary })
    expect(await learnerService.getLevelHistory(p.id, 'mat')).toHaveLength(1)
  })

  it('resumes from the stored state after a restart', async () => {
    const p = await newProfile(2)
    const knows = grade0Only()
    const a = await learnerService.placementNext(p.id, 'mat', MAR_20)
    if (a.done) throw new Error('expected a probe')
    await learnerService.placementRecord(p.id, 'mat', a.skillId, [knows(a.skillId), knows(a.skillId), knows(a.skillId)])
    const b = await learnerService.placementNext(p.id, 'mat', MAR_20)
    if (b.done) throw new Error('expected a probe')
    expect(b.skillId).not.toBe(a.skillId)

    // "restart": the app only has what is in storage. Asking again (even days later) yields the same probe.
    const stored = await learnerService.getPlacement(p.id, 'mat')
    expect((stored!.state as { history: unknown[] }).history).toHaveLength(1)
    const resumed = await learnerService.placementNext(p.id, 'mat', MAR_20 + 3 * DAY_MS)
    expect(resumed).toEqual(b)
    expect((await learnerService.getPlacement(p.id, 'mat'))!.target).toEqual({ grade: 2, semester: 2 })

    // and it can be finished from there
    const done = await runPlacement(p.id, knows, MAR_20 + 3 * DAY_MS)
    expect(done.done).toBe(true)
  })

  it('progress estimate grows while the placement runs', async () => {
    const p = await newProfile(2)
    const seen: number[] = []
    for (let i = 0; i < 40; i++) {
      const r = await learnerService.placementNext(p.id, 'mat', MAR_20)
      if (r.done) break
      seen.push(r.progress)
      await learnerService.placementRecord(p.id, 'mat', r.skillId, [true, true, true])
    }
    expect(seen[0]).toBe(0)
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[0])
  })

  it('resetPlacement removes the record but keeps the level history', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    await learnerService.resetPlacement(p.id, 'mat')
    expect(await learnerService.getPlacement(p.id, 'mat')).toBeUndefined()
    expect(await learnerService.getLevelHistory(p.id, 'mat')).toHaveLength(1)
    expect(await learnerService.getTodayMission(p.id, 'mat', MAR_20)).toBeUndefined()

    await runPlacement(p.id, () => true, MAR_20 + 40 * DAY_MS)
    const history = await learnerService.getLevelHistory(p.id, 'mat')
    expect(history).toHaveLength(2)
    expect(history[1].missingCount).toBe(0)
  })

  it('works for a grade above the available content (grade VI)', async () => {
    const p = await newProfile(6)
    const done = (await runPlacement(p.id, grade0Only(), MAR_20)) as PlacementDone
    expect(done.done).toBe(true)
    expect(done.summary.missingCount).toBeGreaterThan(0)
    expect(done.summary.statement.ro).toContain('Clasa reală: a VI-a')
    expect(done.summary.level.grade).toBeLessThanOrEqual(2)
  })

  it('recording a probe for a skill outside the placement is rejected', async () => {
    const p = await newProfile(2)
    await learnerService.placementNext(p.id, 'mat', MAR_20)
    await expect(learnerService.placementRecord(p.id, 'mat', 'mat.nope', [true])).rejects.toThrow()
    await expect(learnerService.placementRecord(p.id, 'rom', 'x', [true])).rejects.toThrow()
  })
})

describe('missions', () => {
  it('has no mission until the placement is complete', async () => {
    const p = await newProfile(2)
    expect(await learnerService.getTodayMission(p.id, 'mat', MAR_20)).toBeUndefined()
    await learnerService.placementNext(p.id, 'mat', MAR_20)
    expect(await learnerService.getTodayMission(p.id, 'mat', MAR_20)).toBeUndefined()
  })

  it('plans once per day, stores it and re-reads it unchanged', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    const m1 = (await learnerService.getTodayMission(p.id, 'mat', MAR_20))!
    expect(m1.day).toBe(toDayString(MAR_20))
    expect(m1.subject).toBe('mat')
    expect(m1.steps.length).toBeGreaterThan(0)
    expect(m1.steps.every((s) => !s.done)).toBe(true)
    expect(m1.estimatedSeconds).toBeGreaterThan(0)
    expect(m1.estimatedSeconds).toBeLessThanOrEqual(10 * 60 + 60)
    expect(m1.steps.some((s) => s.kind === 'new')).toBe(true)

    // progress changes in between must not reshuffle today's mission
    const item = numItem(m1.steps[0].skillId)
    await learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)
    const m2 = (await learnerService.getTodayMission(p.id, 'mat', MAR_20 + 3600_000))!
    expect(m2).toEqual(m1)
    expect((await getProgress(p.id)).missions).toHaveLength(1)

    const tomorrow = (await learnerService.getTodayMission(p.id, 'mat', MAR_20 + DAY_MS))!
    expect(tomorrow.day).toBe(toDayString(MAR_20 + DAY_MS))
    expect((await getProgress(p.id)).missions).toHaveLength(2)
  })

  it('completes steps and sets completedAt when all are done', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    const m = (await learnerService.getTodayMission(p.id, 'mat', MAR_20))!
    let last = m
    for (let i = 0; i < m.steps.length; i++) {
      expect(last.completedAt).toBeUndefined()
      last = await learnerService.completeMissionStep(p.id, 'mat', m.day, i, i === 0 ? 0.8 : 1.4)
    }
    expect(last.steps.every((s) => s.done)).toBe(true)
    expect(last.steps[0].accuracy).toBe(0.8)
    expect(last.steps[1]?.accuracy ?? 1).toBe(1) // clamped
    expect(last.completedAt).toBe(MAR_20)
    expect((await learnerService.getTodayMission(p.id, 'mat', MAR_20))!.completedAt).toBe(MAR_20)
    await expect(learnerService.completeMissionStep(p.id, 'mat', m.day, 99, 1)).rejects.toThrow()
    await expect(learnerService.completeMissionStep(p.id, 'mat', '1999-01-01', 0, 1)).rejects.toThrow()
  })

  it('keeps only the last 14 missions', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    for (let d = 0; d < 20; d++) await learnerService.getTodayMission(p.id, 'mat', MAR_20 + d * DAY_MS)
    const missions = (await getProgress(p.id)).missions!
    expect(missions).toHaveLength(14)
    expect(missions[13].day).toBe(toDayString(MAR_20 + 19 * DAY_MS))
  })

  it('never offers never-seen skills far above the child (ceiling = one semester above class level)', async () => {
    const p = await newProfile(0)
    await runPlacement(p.id, () => true, at(2026, 11, 20)) // grade 0, semester 1
    const m = (await learnerService.getTodayMission(p.id, 'mat', at(2026, 11, 20)))!
    const skills = new Map(getSkillsBySubject('mat').map((s) => [s.id, s]))
    for (const step of m.steps) {
      const s = skills.get(step.skillId)!
      expect(s.grade * 2 + s.semester).toBeLessThanOrEqual(2) // grade*2+semester of grade 0, semester 2
    }
  })
})

describe('read models', () => {
  it('skill map: states, unlocked and due for review', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    const map = await learnerService.getSkillMap(p.id, 'mat', MAR_20)
    expect(map.map((n) => n.skillId).sort()).toEqual(mathIds().sort())
    const by = new Map(map.map((n) => [n.skillId, n]))
    expect(by.get('mat.count.10')!.unlocked).toBe(true) // no prerequisites
    expect(by.get('mat.count.10')!.state).toBe('mastered')
    expect(by.get('mat.add.carry.100')!.unlocked).toBe(false)
    expect(by.get('mat.count.20')!.prerequisites).toEqual(['mat.count.10'])
    // seeded reviews come due within a week
    expect(by.get('mat.count.10')!.dueForReview).toBe(false)
    const later = new Map((await learnerService.getSkillMap(p.id, 'mat', MAR_20 + 30 * DAY_MS)).map((n) => [n.skillId, n]))
    expect(later.get('mat.count.10')!.dueForReview).toBe(true)
    // ordered by level
    expect(map[0].grade).toBe(0)
    expect(map[map.length - 1].grade).toBe(2)
  })

  it('parent summary: improved this week, play days, next up, tip', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    const skill = 'mat.count.20' // a gap after placement
    const item = numItem(skill)
    // gap -> learning -> practised on MAR_20 + 1 day
    vi.setSystemTime(MAR_20 + DAY_MS)
    for (let i = 0; i < 6; i++) await learnerService.recordItemResult(p.id, item, res(item, true), practiceMeta)
    vi.setSystemTime(MAR_20 + 3 * DAY_MS)
    const other = numItem('mat.compare.10')
    await learnerService.recordItemResult(p.id, other, res(other, true), practiceMeta)
    expect((await getProgress(p.id)).skills[skill].state).toBe('practised')

    const s = await learnerService.getParentSummary(p.id, MAR_20 + 4 * DAY_MS)
    expect(s.profileId).toBe(p.id)
    const mat = s.subjects.find((x) => x.subject === 'mat')!
    expect(mat.improved).toContain(skill)
    expect(mat.placement?.statement.ro).toContain('Matematică')
    expect(mat.totalSkills).toBe(mathIds().length)
    expect(mat.masteredCount).toBeGreaterThan(0)
    expect(mat.nextUp.length).toBeGreaterThan(0)
    expect(mat.nextUp.length).toBeLessThanOrEqual(3)
    // 3 distinct days in the last 7: day of placement (probes record no play days) + day 1 + day 3
    expect(s.playDaysThisWeek).toBe(2)
    expect(s.tip.ro.length).toBeGreaterThan(10)
    expect(s.tip.en.length).toBeGreaterThan(10)

    // 10 days later it no longer counts as improved this week, and play days have aged out
    const later = await learnerService.getParentSummary(p.id, MAR_20 + 14 * DAY_MS)
    expect(later.subjects.find((x) => x.subject === 'mat')!.improved).not.toContain(skill)
    expect(later.playDaysThisWeek).toBe(0)
  })

  it('seeding does not count as improvement; unfinished profiles get an empty summary', async () => {
    const p = await newProfile(2)
    const fresh = (await learnerService.getParentSummary(p.id, MAR_20)).subjects.find((x) => x.subject === 'mat')!
    expect(fresh).toMatchObject({ improved: [], nextUp: [], masteredCount: 0 })
    expect(fresh.placement).toBeUndefined()
    await runPlacement(p.id, () => true, MAR_20)
    const after = (await learnerService.getParentSummary(p.id, MAR_20)).subjects.find((x) => x.subject === 'mat')!
    expect(after.improved).toEqual([])
    expect(after.masteredCount).toBeGreaterThan(0)
  })

  it('does not create a stored mission when computing the summary', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    await learnerService.getParentSummary(p.id, MAR_20)
    expect((await getProgress(p.id)).missions ?? []).toHaveLength(0)
  })

  it('tip rotates weekly and is stable within a week', () => {
    const base = at(2027, 3, 8) // a Monday
    expect(tipForWeek(base)).toEqual(tipForWeek(base + 2 * DAY_MS))
    const seen = new Set(Array.from({ length: PARENT_TIPS.length }, (_, w) => tipForWeek(base + w * 7 * DAY_MS).ro))
    expect(seen.size).toBe(PARENT_TIPS.length)
  })
})

describe('backups', () => {
  const oldBackup = {
    app: 'ludiko',
    kind: 'profile-backup',
    version: 1,
    exportedAt: 1,
    profile: {
      id: 'old-1',
      nickname: 'Vechi',
      avatar: '🐼',
      grade: 2,
      language: 'ro',
      createdAt: 1,
      updatedAt: 1,
      recoveryCode: '',
    },
    progress: {
      profileId: 'old-1',
      skills: { 'mat.count.10': { state: 'unknown', pMastery: 0, attempts: 3, correct: 2, lastSeen: 5 } },
      stars: 4,
      stickers: ['🦊'],
      playDays: ['2026-01-05'],
    },
  }

  it('an old backup (no wave-3 fields) still imports and works with the learner service', async () => {
    const { generateRecoveryCode } = await import('@/profiles/profileService')
    const text = JSON.stringify({ ...oldBackup, profile: { ...oldBackup.profile, recoveryCode: generateRecoveryCode() } })
    const profile = await importProfile(text)
    const prog = await getProgress(profile.id)
    expect(prog.placements).toBeUndefined()
    expect(prog.missions).toBeUndefined()
    expect(prog.stars).toBe(4)
    expect(await learnerService.getPlacement(profile.id, 'mat')).toBeUndefined()
    expect(await learnerService.getLevelHistory(profile.id, 'mat')).toEqual([])
    expect(await learnerService.getTodayMission(profile.id, 'mat', MAR_20)).toBeUndefined()
    // legacy record (unknown, p = 0, attempts > 0) still updates sensibly
    const item = numItem('mat.count.10')
    await learnerService.recordItemResult(profile.id, item, res(item, true), practiceMeta)
    const rec = (await getProgress(profile.id)).skills['mat.count.10']
    expect(rec.state).toBe('learning')
    expect(rec.attempts).toBe(4)
    expect(rec.pMastery).toBeGreaterThan(0.2)
    await runPlacement(profile.id, grade0Only(), MAR_20)
    expect((await getProgress(profile.id)).skills['mat.count.10'].state).toBe('learning') // real mastery state kept
  })

  it('placements, history and missions survive export → import', async () => {
    const p = await newProfile(2)
    await runPlacement(p.id, grade0Only(), MAR_20)
    await learnerService.getTodayMission(p.id, 'mat', MAR_20)
    const text = JSON.stringify(await exportProfile(p.id))
    _resetMemoryForTests()
    await dbPut('profiles', { sentinel: true, id: 'x' })
    const imported = await importProfile(text)
    const prog: ProfileProgress = await getProgress(imported.id)
    expect(prog.placements?.mat?.summary?.missingCount).toBeGreaterThan(0)
    expect(prog.levelHistory?.mat).toHaveLength(1)
    expect(prog.missions).toHaveLength(1)
    expect((await learnerService.getTodayMission(imported.id, 'mat', MAR_20))!.steps.length).toBeGreaterThan(0)
  })
})
