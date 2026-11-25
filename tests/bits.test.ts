import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { learnerService } from '@/learner'
import type { Mission, MissionStep } from '@/learner'
import { BIT_MAX_ITEMS, BIT_MIN_ITEMS, deriveBits } from '@/learner/bitOps'
import { getSkillsBySubject } from '@/engine/content/registry'
import { DAY_MS } from '@/engine/mastery'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile, getProgress, saveProgress, toDayString } from '@/profiles/profileService'
import { knowsFn } from './helpers/engineSim'

const step = (kind: MissionStep['kind'], skillId: string, itemCount: number, done = false): MissionStep => ({
  kind,
  skillId,
  itemCount,
  done,
})
const mission = (steps: MissionStep[], day = '2026-11-25'): Mission => ({ day, subject: 'mat', steps, estimatedSeconds: 500 })

describe('deriveBits', () => {
  it('splits a full mission into warm-up, island of the day and challenge', () => {
    const bits = deriveBits(
      mission([
        step('review', 'r1', 3),
        step('check', 'c1', 5),
        step('new', 'n1', 7),
        step('practice', 'p1', 6),
        step('review', 'r2', 3),
        step('practice', 'p2', 5),
      ]),
    )
    expect(bits.map((b) => b.kind)).toEqual(['warmup', 'island', 'challenge'])
    expect(bits.map((b) => b.index)).toEqual([0, 1, 2])
    expect(bits[0].steps.map((s) => s.stepIndex)).toEqual([0, 3, 4, 5]) // reviews + the leftover practice steps
    expect(bits[1].steps.map((s) => [s.kind, s.stepIndex])).toEqual([['new', 2]])
    expect(bits[2].steps.map((s) => [s.kind, s.stepIndex])).toEqual([['check', 1]])
    expect(bits.every((b) => b.day === '2026-11-25')).toBe(true)
  })

  it('puts every mission step in exactly one bit', () => {
    const m = mission([step('review', 'r', 3), step('new', 'n', 6), step('practice', 'p1', 5), step('practice', 'p2', 5), step('review', 'r2', 3)])
    const all = deriveBits(m).flatMap((b) => b.steps.map((s) => s.stepIndex))
    expect([...all].sort()).toEqual(m.steps.map((_, i) => i))
  })

  it('keeps non-check bits within 4–6 items (shrinks long steps, tops up short ones)', () => {
    const bits = deriveBits(
      mission([step('review', 'r1', 3), step('review', 'r2', 3), step('new', 'n', 10), step('practice', 'p1', 10), step('practice', 'p2', 2)]),
    )
    for (const bit of bits) {
      expect(bit.itemCount).toBeGreaterThanOrEqual(BIT_MIN_ITEMS)
      expect(bit.itemCount).toBeLessThanOrEqual(BIT_MAX_ITEMS)
      expect(bit.itemCount).toBe(bit.steps.reduce((n, s) => n + s.itemCount, 0))
      expect(bit.steps.every((s) => s.itemCount >= 2)).toBe(true)
    }
    const short = deriveBits(mission([step('practice', 'p', 2)]))
    expect(short[0].itemCount).toBe(4)
  })

  it('never changes the item count of a mastery check', () => {
    const [bit] = deriveBits(mission([step('check', 'c', 5)]))
    expect(bit.kind).toBe('challenge')
    expect(bit.itemCount).toBe(5)
  })

  it('without a new step the main practice step is the island', () => {
    const bits = deriveBits(mission([step('review', 'r', 3), step('practice', 'p1', 5), step('practice', 'p2', 5)]))
    expect(bits.map((b) => b.kind)).toEqual(['warmup', 'island'])
    expect(bits[1].steps[0].skillId).toBe('p1')
    expect(bits[0].steps.map((s) => s.skillId)).toEqual(['r', 'p2'])
  })

  it('without a check, a spare practice step becomes the challenge', () => {
    const bits = deriveBits(mission([step('new', 'n', 6), step('practice', 'p1', 5), step('practice', 'p2', 5)]))
    expect(bits.map((b) => b.kind)).toEqual(['warmup', 'island', 'challenge'])
    expect(bits[0].steps.map((s) => s.skillId)).toEqual(['p2']) // the easy (last) one warms up
    expect(bits[2].steps.map((s) => s.skillId)).toEqual(['p1'])
  })

  it('skips bits with nothing in them and renumbers; an empty mission has no bits', () => {
    const bits = deriveBits(mission([step('new', 'n', 6), step('check', 'c', 5)]))
    expect(bits.map((b) => [b.index, b.kind])).toEqual([
      [0, 'island'],
      [1, 'challenge'],
    ])
    expect(deriveBits(mission([]))).toEqual([])
  })

  it('a bit is done when all its steps are done', () => {
    const bits = deriveBits(
      mission([step('review', 'r', 3, true), step('new', 'n', 6, true), step('practice', 'p', 5, false), step('check', 'c', 5, false)]),
    )
    expect(bits.map((b) => [b.kind, b.done])).toEqual([
      ['warmup', false],
      ['island', true],
      ['challenge', false],
    ])
  })
})

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
const MAR_20 = at(2027, 3, 20)

describe('learnerService.getTodayBits', () => {
  beforeEach(() => {
    _resetMemoryForTests()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MAR_20)
  })
  afterEach(() => vi.useRealTimers())

  async function placed() {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 2, language: 'ro' })
    const skills = getSkillsBySubject('mat')
    const knows = knowsFn(skills, new Set(skills.filter((s) => s.grade >= 1).map((s) => s.id)))
    for (let i = 0; i < 40; i++) {
      const r = await learnerService.placementNext(p.id, 'mat', MAR_20)
      if (r.done) return p
      await learnerService.placementRecord(p.id, 'mat', r.skillId, Array(r.itemCount).fill(knows(r.skillId)))
    }
    throw new Error('placement did not finish')
  }

  it('is undefined before the placement is done', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 2, language: 'ro' })
    expect(await learnerService.getTodayBits(p.id, 'mat', MAR_20)).toBeUndefined()
  })

  it('derives stable bits from the stored mission and persists completion through mission steps', async () => {
    const p = await placed()
    // store a rich mission for today (the planner of a fresh profile offers only one step)
    const progress = await getProgress(p.id)
    progress.missions = [
      mission([step('review', 'mat.count.10', 3), step('check', 'mat.count.20', 5), step('new', 'mat.add.10', 6), step('practice', 'mat.count.20', 5)], toDayString(MAR_20)),
    ]
    await saveProgress(progress)
    const bits = (await learnerService.getTodayBits(p.id, 'mat', MAR_20))!
    expect(bits.map((b) => b.kind)).toEqual(['warmup', 'island', 'challenge'])
    expect(bits.every((b) => !b.done && b.day === toDayString(MAR_20))).toBe(true)

    // same bits again, even after other writes, and offline of any planner input
    expect(await learnerService.getTodayBits(p.id, 'mat', MAR_20 + 3600_000)).toEqual(bits)

    // finishing the first bit = completing its mission steps
    for (const s of bits[0].steps) await learnerService.completeMissionStep(p.id, 'mat', bits[0].day, s.stepIndex, 0.9)
    const after = (await learnerService.getTodayBits(p.id, 'mat', MAR_20))!
    expect(after[0].done).toBe(true)
    expect(after.slice(1).every((b) => !b.done)).toBe(true)
    expect((await getProgress(p.id)).missions![0].completedAt).toBeUndefined()

    // finishing the rest completes the whole mission
    for (const b of after.slice(1)) {
      for (const s of b.steps) await learnerService.completeMissionStep(p.id, 'mat', b.day, s.stepIndex, 1)
    }
    expect((await learnerService.getTodayBits(p.id, 'mat', MAR_20))!.every((b) => b.done)).toBe(true)
    expect((await learnerService.getTodayMission(p.id, 'mat', MAR_20))!.completedAt).toBeDefined()

    // a new day has fresh bits
    const tomorrow = (await learnerService.getTodayBits(p.id, 'mat', MAR_20 + DAY_MS))!
    expect(tomorrow.every((b) => !b.done && b.day === toDayString(MAR_20 + DAY_MS))).toBe(true)
  })
})
