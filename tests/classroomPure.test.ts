import { beforeEach, describe, expect, it } from 'vitest'
import {
  assignmentCompletion,
  classCounts,
  csvField,
  deepestGap,
  groupByGrade,
  groupSuggestions,
  heatmapColumns,
  heatmapCsv,
  skillStateOf,
  sortSeats,
  topGaps,
  type HeatSkill,
  type ProgressBySeat,
} from '@/classroom/heatmap'
import { formatJoinCode, generateJoinCode, isValidJoinCode, normalizeJoinCode } from '@/classroom/joinCode'
import { buildClassProgress } from '@/classroom/progressSummary'
import type { SeatProgressDoc } from '@/classroom/types'
import type { SkillState } from '@/engine/types'
import { ASSIGNMENT_GRACE_DAYS, daysUntil, deriveAssignmentBits } from '@/learner/assignmentOps'
import { emptyProgress } from '@/profiles/profileService'

/* A small made-up skill graph: a -> b -> c (grade 1..2), d (grade 2) independent, e needs c (grade 3) */
const sk = (id: string, grade: number, semester: 1 | 2, prerequisites: string[] = []): HeatSkill => ({
  id,
  grade: grade as HeatSkill['grade'],
  semester,
  prerequisites,
})
const SKILLS: HeatSkill[] = [sk('a', 1, 1), sk('b', 1, 2, ['a']), sk('c', 2, 1, ['b']), sk('d', 2, 2), sk('e', 3, 1, ['c'])]

const doc = (states: Record<string, SkillState>): SeatProgressDoc => ({
  subjects: { mat: { skills: states } },
  playDaysThisWeek: 1,
  updatedAt: 1,
})

const seats = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' }]
const progress: ProgressBySeat = {
  s1: doc({ a: 'mastered', b: 'gap', c: 'gap', e: 'gap' }), // deepest gap: b
  s2: doc({ a: 'practised', b: 'gap', d: 'gap' }), // deepest gap: b
  s3: doc({ a: 'mastered', b: 'mastered', c: 'gap' }), // deepest gap: c
  s4: doc({ a: 'mastered', b: 'mastered', c: 'mastered' }), // no gaps
  // s5 has not sent a summary
}

describe('heatmap aggregation', () => {
  it('skillStateOf: unknown when absent', () => {
    expect(skillStateOf(progress.s1, 'mat', 'b')).toBe('gap')
    expect(skillStateOf(progress.s1, 'mat', 'd')).toBe('unknown')
    expect(skillStateOf(undefined, 'mat', 'b')).toBe('unknown')
    expect(skillStateOf(progress.s1, 'rom', 'b')).toBe('unknown')
  })

  it('columns: up to the class grade, ordered by level then id, grouped by grade', () => {
    const cols = heatmapColumns('mat', 2, [...SKILLS].reverse())
    expect(cols.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(groupByGrade(cols).map((g) => [g.grade, g.skills.map((s) => s.id)])).toEqual([
      [1, ['a', 'b']],
      [2, ['c', 'd']],
    ])
  })

  it('top gaps: most seats first, then the deeper skill', () => {
    const gaps = topGaps(seats, progress, 'mat', SKILLS)
    expect(gaps.map((g) => [g.skillId, g.count])).toEqual([
      ['b', 2],
      ['c', 2],
      ['d', 1],
      ['e', 1],
    ])
    expect(gaps[0].seatIds).toEqual(['s1', 's2'])
    expect(topGaps(seats, progress, 'mat', SKILLS, 2)).toHaveLength(2)
    expect(topGaps(seats, {}, 'mat', SKILLS)).toEqual([])
  })

  it('deepest gap: the lowest level among a seat\'s gaps', () => {
    expect(deepestGap(progress.s1, 'mat', SKILLS)).toBe('b')
    expect(deepestGap(progress.s2, 'mat', SKILLS)).toBe('b')
    expect(deepestGap(progress.s3, 'mat', SKILLS)).toBe('c')
    expect(deepestGap(progress.s4, 'mat', SKILLS)).toBeUndefined()
    expect(deepestGap(undefined, 'mat', SKILLS)).toBeUndefined()
  })

  it('group suggestions: seats sharing the same deepest gap, only groups of 2+', () => {
    const groups = groupSuggestions(seats, progress, 'mat', SKILLS)
    expect(groups).toEqual([{ skillId: 'b', seatIds: ['s1', 's2'] }]) // s3 is alone on c
    expect(groupSuggestions(seats, progress, 'mat', SKILLS, 1).map((g) => g.skillId)).toEqual(['b', 'c'])
  })

  it('within a level, the skill with fewer prerequisites below it is the deeper gap', () => {
    const skills = [sk('x', 1, 1), sk('y', 1, 1, ['x']), sk('z', 1, 1, ['y'])]
    const p = doc({ y: 'gap', z: 'gap' })
    expect(deepestGap(p, 'mat', skills)).toBe('y')
  })

  it('counts', () => {
    const withLinks = [
      { id: 's1', linked: true },
      { id: 's2', linked: true },
      { id: 's3', linked: true },
      { id: 's4', linked: true },
      { id: 's5', linked: false },
    ]
    expect(classCounts(withLinks, progress, 'mat')).toEqual({ seats: 5, linked: 4, withSummary: 4, withGaps: 3 })
  })

  it('assignment completion: practised or mastered per assigned skill', () => {
    const a = { subject: 'mat' as const, skillIds: ['a', 'b'] }
    expect(assignmentCompletion(a, progress.s2)).toEqual({ done: 1, total: 2, complete: false })
    expect(assignmentCompletion(a, progress.s3)).toEqual({ done: 2, total: 2, complete: true })
    expect(assignmentCompletion(a, undefined)).toEqual({ done: 0, total: 2, complete: false })
    expect(assignmentCompletion({ subject: 'mat', skillIds: [] }, progress.s3).complete).toBe(false)
  })

  it('sorts seats by label with numbers in natural order', () => {
    expect(sortSeats([{ label: '10' }, { label: 'B.C.' }, { label: '2' }, { label: 'A.M.' }]).map((s) => s.label)).toEqual(['2', '10', 'A.M.', 'B.C.'])
  })
})

describe('CSV export', () => {
  it('labels only, one row per seat, state names in the given language', () => {
    const cols = [
      { ...SKILLS[0], title: 'Skill A' },
      { ...SKILLS[1], title: 'Skill, B' },
    ]
    const csv = heatmapCsv(
      [{ id: 's1', label: 'A.M.' }, { id: 's5', label: '=SUM(1)' }],
      progress,
      'mat',
      cols,
      (s) => s.toUpperCase(),
      'Pupil',
    )
    expect(csv.split('\n')).toEqual([
      'Pupil,Skill A [a],"Skill, B [b]"',
      'A.M.,MASTERED,GAP',
      "'=SUM(1),UNKNOWN,UNKNOWN",
    ])
  })

  it('neutralises formula characters and quotes', () => {
    expect(csvField('@x')).toBe("'@x")
    expect(csvField('a"b')).toBe('"a""b"')
    expect(csvField(3)).toBe('3')
  })
})

describe('join codes', () => {
  it('generates 6 unambiguous characters', () => {
    for (let i = 0; i < 300; i++) {
      const c = generateJoinCode()
      expect(c).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
      expect(c).not.toMatch(/[01OIL]/)
      expect(isValidJoinCode(c)).toBe(true)
    }
  })

  it('normalises typed input and formats for reading aloud', () => {
    expect(normalizeJoinCode(' abc-234 ')).toBe('ABC234')
    expect(formatJoinCode('ABC234')).toBe('ABC 234')
    expect(isValidJoinCode('ABC23')).toBe(false)
    expect(isValidJoinCode('ABCDE1')).toBe(false)
  })
})

describe('buildClassProgress: the summary leaves nothing personal behind', () => {
  const now = new Date(2026, 10, 25, 12).getTime()
  const mk = () => {
    const p = emptyProgress('p1')
    p.skills['mat.count.10'] = { state: 'mastered', pMastery: 0.9, attempts: 9, correct: 9, lastSeen: now, nextReview: now + 5 }
    p.skills['mat.add.10'] = { state: 'unknown', pMastery: 0, attempts: 0, correct: 0, lastSeen: now }
    p.skills['rom.unknown.skill'] = { state: 'gap', pMastery: 0, attempts: 1, correct: 0, lastSeen: now }
    p.stars = 99
    p.stickers = ['🦄']
    p.playDays = ['2026-11-25', '2026-11-20', '2026-11-18', '2026-01-01']
    return p
  }

  it('keeps only states, level, missing count, play days and updatedAt', () => {
    const doc = buildClassProgress(mk(), now)
    expect(doc).toEqual({
      subjects: { mat: { skills: { 'mat.count.10': 'mastered' } } },
      playDaysThisWeek: 2, // 25 and 20 Nov are within 7 days; 18 Nov is not
      updatedAt: now,
    })
  })

  it('adds level and missing count after a finished placement only', () => {
    const p = mk()
    p.placements = {
      mat: {
        subject: 'mat',
        target: { grade: 3, semester: 1 },
        state: {},
        startedAt: 1,
        updatedAt: 1,
        summary: { subject: 'mat', level: { grade: 2, semester: 1 }, gaps: [], missingCount: 3, estimatedWeeks: 2, statement: { ro: 'r', en: 'e' } },
      },
    }
    expect(buildClassProgress(p, now).subjects.mat).not.toHaveProperty('level') // not completed
    p.placements.mat!.completedAt = 5
    expect(buildClassProgress(p, now).subjects.mat).toMatchObject({ level: { grade: 2, semester: 1 }, missingCount: 3 })
  })
})

describe('assignment bits (child side)', () => {
  const now = new Date(2026, 10, 25, 9).getTime() // Wed 25 Nov 2026
  const day = (n: number) => {
    const d = new Date(2026, 10, 25 + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const A = (id: string, skillIds: string[], dueDay: string) => ({ id, subject: 'mat' as const, skillIds, title: id, dueDay })

  it('daysUntil counts whole local days', () => {
    expect(daysUntil(day(0), now)).toBe(0)
    expect(daysUntil(day(1), now)).toBe(1)
    expect(daysUntil(day(-3), now)).toBe(-3)
    expect(daysUntil('nope', now)).toBeNaN()
  })

  it('done state comes from the skill states: all practised or mastered', () => {
    const states: Record<string, SkillState> = { 'mat.count.10': 'mastered', 'mat.add.10': 'learning', 'mat.sub.10': 'practised' }
    const [open] = deriveAssignmentBits([A('t1', ['mat.count.10', 'mat.add.10'], day(2))], (id) => states[id], now)
    expect(open).toMatchObject({ kind: 'assignment', assignmentId: 't1', doneCount: 1, total: 2, done: false, overdue: false, daysLeft: 2 })
    expect(open.skills.map((s) => [s.skillId, s.state, s.done])).toEqual([
      ['mat.count.10', 'mastered', true],
      ['mat.add.10', 'learning', false],
    ])
    states['mat.add.10'] = 'practised'
    const [done] = deriveAssignmentBits([A('t1', ['mat.count.10', 'mat.add.10'], day(2))], (id) => states[id], now)
    expect(done).toMatchObject({ done: true, doneCount: 2 })
  })

  it('a skill the child never met is "unknown", not done', () => {
    const [bit] = deriveAssignmentBits([A('t1', ['mat.count.10'], day(1))], () => undefined, now)
    expect(bit.skills[0]).toEqual({ skillId: 'mat.count.10', state: 'unknown', done: false })
  })

  it('open ones first, soonest due first; finished last; late ones stay for the grace period only', () => {
    const states: Record<string, SkillState> = { 'mat.count.10': 'mastered' }
    const bits = deriveAssignmentBits(
      [
        A('finished', ['mat.count.10'], day(0)),
        A('later', ['mat.add.10'], day(5)),
        A('late', ['mat.sub.10'], day(-2)),
        A('soon', ['mat.add.10'], day(1)),
        A('ancient', ['mat.add.10'], day(-ASSIGNMENT_GRACE_DAYS - 1)),
      ],
      (id) => states[id],
      now,
    )
    expect(bits.map((b) => b.assignmentId)).toEqual(['late', 'soon', 'later', 'finished'])
    expect(bits[0]).toMatchObject({ overdue: true, daysLeft: -2 })
  })

  it('drops skills of the wrong subject or unknown to the content, and assignments left empty', () => {
    const bits = deriveAssignmentBits(
      [A('mixed', ['mat.count.10', 'no.such.skill', 'rom.whatever'], day(1)), A('empty', ['no.such.skill'], day(1))],
      () => undefined,
      now,
    )
    expect(bits).toHaveLength(1)
    expect(bits[0].skills.map((s) => s.skillId)).toEqual(['mat.count.10'])
  })
})

beforeEach(() => localStorage.clear())
