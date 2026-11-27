import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSkillsBySubject } from '@/engine/content/registry'
import { levelKey } from '@/engine/diagnostic'
import { DAY_MS, type MasteryRecord } from '@/engine/mastery'
import { newCandidates, nextIsland, planMission, routeIndex, routeOrder } from '@/engine/planner'
import type { Skill, SkillState, SubjectId } from '@/engine/types'
import { learnerService } from '@/learner'
import { knownFromCheck } from '@/learner/readModels'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile } from '@/profiles/profileService'
import { knowsFn, mathSkills } from './helpers/engineSim'

const NOW = Date.UTC(2026, 10, 25, 15)

const sk = (id: string, grade: number, semester: 1 | 2, prerequisites: string[] = []): Skill =>
  ({ id, subject: 'mat', grade, semester, prerequisites, competences: [], title: { ro: id }, itemSources: [], masteryCheck: { items: 5, minCorrect: 4 } }) as unknown as Skill

const rec = (state: SkillState): MasteryRecord => ({
  state,
  pMastery: { unknown: 0.2, gap: 0.1, learning: 0.5, practised: 0.8, mastered: 0.95 }[state],
  attempts: state === 'unknown' ? 0 : 6,
  correct: 4,
  lastSeen: NOW - DAY_MS,
  nextReview: NOW + 5 * DAY_MS,
})

describe('routeOrder (the island route)', () => {
  it('puts every prerequisite before its dependants on every real subject', () => {
    const subjects = [...new Set(['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim'])] as SubjectId[]
    for (const subject of subjects) {
      const skills = getSkillsBySubject(subject)
      const order = routeOrder(skills)
      expect(order).toHaveLength(new Set(skills.map((s) => s.id)).size)
      const pos = routeIndex(skills)
      const ids = new Set(skills.map((s) => s.id))
      for (const s of skills) for (const p of s.prerequisites) if (ids.has(p)) expect(pos[p]).toBeLessThan(pos[s.id])
    }
  })

  it('follows grade and semester: the route never goes back to an earlier level', () => {
    const skills = getSkillsBySubject('mat')
    const by = new Map(skills.map((s) => [s.id, s]))
    const levels = routeOrder(skills).map((id) => levelKey(by.get(id)!))
    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })

  it('inside one level keeps the authored order unless a prerequisite says otherwise', () => {
    const skills = [sk('a', 1, 1), sk('c', 1, 1, ['b']), sk('b', 1, 1), sk('z', 0, 2), sk('d', 1, 1)]
    expect(routeOrder(skills)).toEqual(['z', 'a', 'b', 'c', 'd'])
  })

  it('ignores prerequisites outside the set and never loops on a cycle', () => {
    expect(routeOrder([sk('a', 0, 1, ['outside']), sk('b', 0, 1, ['a'])])).toEqual(['a', 'b'])
    expect(routeOrder([sk('a', 0, 1, ['b']), sk('b', 0, 1, ['a'])]).sort()).toEqual(['a', 'b'])
  })

  it('reads as a path on the math graph (grade 0 first, then grade I, …)', () => {
    const order = routeOrder(getSkillsBySubject('mat'))
    expect(order.slice(0, 2)).toEqual(['mat.count.10', 'mat.numrec.10'])
    // the old "shallowest depth first" order jumped to a grade I geometry skill before grade 0 addition
    expect(order.indexOf('mat.add.10')).toBeLessThan(order.indexOf('mat.geom.shapes'))
  })
})

describe('planner: the new step is the next island on the route', () => {
  const skills = mathSkills()

  it('picks the first unlocked never-seen island in route order, not the shallowest one', () => {
    // grade 0 known, the whole grade I/1 known: next on the route is the first grade I/2 island
    const p: Record<string, MasteryRecord> = {}
    for (const s of skills) if (levelKey(s) <= 2) p[s.id] = rec('mastered')
    const route = routeOrder(skills)
    const expected = route.find((id) => !p[id] && skills.find((s) => s.id === id)!.prerequisites.every((q) => p[q]))
    const m = planMission(skills, p, { now: NOW })
    expect(m.steps.find((s) => s.kind === 'new')?.skillId).toBe(expected)
    expect(nextIsland(skills, p)).toBe(expected)
  })

  it('gap repair comes before the next new island', () => {
    const p: Record<string, MasteryRecord> = { 'mat.count.10': rec('mastered'), 'mat.numrec.10': rec('mastered'), 'mat.compare.10': rec('gap') }
    expect(newCandidates(skills, p)[0]).toBe('mat.compare.10')
    expect(planMission(skills, p, { now: NOW }).steps.find((s) => s.kind === 'new')?.skillId).toBe('mat.compare.10')
  })

  it('a due review still comes first in the mission; the new step is the next island', () => {
    const p: Record<string, MasteryRecord> = {
      'mat.count.10': { ...rec('mastered'), nextReview: NOW - DAY_MS },
      'mat.numrec.10': rec('mastered'),
    }
    const m = planMission(skills, p, { now: NOW })
    expect(m.steps[0]).toMatchObject({ kind: 'review', skillId: 'mat.count.10' })
    expect(m.steps.find((s) => s.kind === 'new')?.skillId).toBe(nextIsland(skills, p))
  })

  it('islands after the next one follow in order as the child practises', () => {
    const p: Record<string, MasteryRecord> = {}
    const seen: string[] = []
    for (let day = 0; day < 6; day++) {
      const next = nextIsland(skills, p)!
      seen.push(next)
      p[next] = rec('practised')
    }
    const route = routeOrder(skills)
    expect(seen).toEqual(route.slice(0, 6))
  })

  it('respects the ceiling for never-seen islands', () => {
    const p: Record<string, MasteryRecord> = {}
    for (const s of skills) if (s.grade === 0) p[s.id] = rec('mastered')
    expect(nextIsland(skills, p, { ceiling: { grade: 0, semester: 2 } })).toBeUndefined()
    expect(nextIsland(skills, p, { ceiling: { grade: 1, semester: 1 } })).toBe('mat.count.20')
  })
})

describe('skill map read model: route order, next island, already known', () => {
  const MAR_20 = new Date(2027, 2, 20, 10).getTime()
  beforeEach(() => {
    _resetMemoryForTests()
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(MAR_20)
  })
  afterEach(() => vi.useRealTimers())

  it('after a level check the map is the route, known islands are skipped and one island is next', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 2, language: 'ro' })
    const all = getSkillsBySubject('mat')
    const knows = knowsFn(all, new Set(all.filter((s) => s.grade >= 1).map((s) => s.id)))
    for (let i = 0; i < 40; i++) {
      const r = await learnerService.placementNext(p.id, 'mat', MAR_20)
      if (r.done) break
      if ('unavailable' in r) throw new Error('unavailable')
      await learnerService.placementRecord(p.id, 'mat', r.skillId, Array(r.itemCount).fill(knows(r.skillId)))
    }
    const map = await learnerService.getSkillMap(p.id, 'mat', MAR_20)
    expect(map.map((n) => n.skillId)).toEqual(routeOrder(all))
    expect(map.map((n) => n.route)).toEqual(map.map((_, i) => i))
    // grade 0 was found known by the check: "already known", not a fresh achievement
    expect(map.filter((n) => n.grade === 0).every((n) => n.known)).toBe(true)
    const next = map.filter((n) => n.next)
    expect(next).toHaveLength(1)
    expect(next[0].unlocked).toBe(true)
    // the next island is what today's mission introduces
    const mission = await learnerService.getTodayMission(p.id, 'mat', MAR_20)
    expect(mission!.steps.find((s) => s.kind === 'new')?.skillId).toBe(next[0].skillId)
  })

  it('knownFromCheck: only mastered records the engine never moved', () => {
    expect(knownFromCheck({ state: 'mastered', pMastery: 0.9, attempts: 0, correct: 0, lastSeen: 1 })).toBe(true)
    expect(knownFromCheck({ state: 'mastered', pMastery: 0.95, attempts: 9, correct: 9, lastSeen: 1, stateChangedAt: 5 })).toBe(false)
    expect(knownFromCheck({ state: 'learning', pMastery: 0.5, attempts: 2, correct: 1, lastSeen: 1 })).toBe(false)
    expect(knownFromCheck(undefined)).toBe(false)
  })
})
