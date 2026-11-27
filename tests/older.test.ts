import { beforeEach, describe, expect, it } from 'vitest'
import { ageBand, isBig } from '@/older/ageBand'
import { examGradeOf, formatMark, gradeLabel, markFromScore } from '@/older/marks'
import { pickChallengeSkills } from '@/older/challenge'
import {
  bitsThisWeek,
  getChallengeBest,
  getShowMascot,
  getWeeklyGoal,
  noteChallengeMark,
  recordBitDone,
  setShowMascot,
  setWeeklyGoal,
  weekKey,
} from '@/older/olderStore'
import { scoreExam } from '@/exam/scoring'
import type { AssembledTest } from '@/exam/types'
import type { Skill } from '@/engine/types'
import { levelStatement, type PlacementResult } from '@/engine/diagnostic'

describe('ageBand', () => {
  it('maps grades to bands', () => {
    for (const g of [0, 1, 2]) expect(ageBand(g)).toBe('small')
    for (const g of [3, 4]) expect(ageBand(g)).toBe('middle')
    for (const g of [5, 6, 7, 8]) expect(ageBand(g)).toBe('big')
    expect(ageBand(undefined)).toBe('small')
    expect(isBig(6)).toBe(true)
    expect(isBig(4)).toBe(false)
  })
})

describe('markFromScore', () => {
  it('runs from 1 to 10', () => {
    expect(markFromScore(0, 10)).toBe(1)
    expect(markFromScore(10, 10)).toBe(10)
    expect(markFromScore(5, 10)).toBe(5.5)
  })
  it('rounds to 2 decimals', () => {
    expect(markFromScore(1, 3)).toBe(4) // 1 + 3
    expect(markFromScore(2, 3)).toBe(7)
    expect(markFromScore(1, 7)).toBe(2.29) // 2.2857…
    expect(markFromScore(8, 9)).toBe(9)
    expect(markFromScore(7, 8)).toBe(8.88) // 8.875 -> 8.88
  })
  it('handles nothing asked and out-of-range input', () => {
    expect(markFromScore(0, 0)).toBeNull()
    expect(markFromScore(3, -1)).toBeNull()
    expect(markFromScore(15, 10)).toBe(10)
    expect(markFromScore(-2, 10)).toBe(1)
  })
  it('formats with a decimal comma in Romanian and a point in English', () => {
    expect(formatMark(8.5)).toBe('8,50')
    expect(formatMark(10, 'ro')).toBe('10,00')
    expect(formatMark(1, 'ro')).toBe('1,00')
    expect(formatMark(8.5, 'en')).toBe('8.50')
  })
})

describe('gradeLabel', () => {
  it('is a calificativ for grades 0-IV', () => {
    for (const g of [0, 1, 2, 3, 4]) {
      expect(gradeLabel(g, 0.95)).toEqual({ kind: 'calificativ', descriptor: 'fb' })
      expect(gradeLabel(g, 0.75)).toEqual({ kind: 'calificativ', descriptor: 'b' })
      expect(gradeLabel(g, 0.5)).toEqual({ kind: 'calificativ', descriptor: 's' })
      expect(gradeLabel(g, 0.2)).toEqual({ kind: 'calificativ', descriptor: 'i' })
    }
  })
  it('is an estimated notă for grades V-VIII', () => {
    for (const g of [5, 6, 7, 8]) {
      expect(gradeLabel(g, 0.5, 'ro')).toEqual({ kind: 'nota', mark: 5.5, text: '5,50' })
    }
    expect(gradeLabel(6, 1)).toMatchObject({ mark: 10 })
    expect(gradeLabel(6, 0)).toMatchObject({ mark: 1 })
    expect(gradeLabel(8, 0.5, 'en')).toMatchObject({ text: '5.50' })
  })
  it('reads the grade of an exam id', () => {
    expect(examGradeOf('en2')).toBe(2)
    expect(examGradeOf('en8')).toBe(8)
    expect(examGradeOf('x')).toBe(0)
  })
})

describe('exam scoring carries an estimated mark', () => {
  const item = (id: string) => ({ id, skillId: 's', type: 'choice' }) as unknown as AssembledTest['sections'][number]['items'][number]
  const test = {
    sections: [{ id: 'a', title: { ro: 'A' }, intro: { ro: '' }, items: [item('1'), item('2'), item('3'), item('4')] }],
  } as unknown as AssembledTest
  it('maps correct answers to 1-10', () => {
    expect(scoreExam(test, { '1': true, '2': true, '3': true, '4': true }).mark).toBe(10)
    expect(scoreExam(test, { '1': true, '2': false }).mark).toBe(3.25)
    expect(scoreExam(test, {}).mark).toBe(1)
  })
})

describe('older store', () => {
  beforeEach(() => localStorage.clear())
  it('keeps the mascot setting per profile (off by default)', () => {
    expect(getShowMascot('a')).toBe(false)
    setShowMascot('a', true)
    expect(getShowMascot('a')).toBe(true)
    expect(getShowMascot('b')).toBe(false)
  })
  it('weekly goal accepts 3, 5 or 7 and counts bits per ISO week', () => {
    expect(getWeeklyGoal('a')).toBeNull()
    setWeeklyGoal('a', 5)
    expect(getWeeklyGoal('a')).toBe(5)
    setWeeklyGoal('a', 4)
    expect(getWeeklyGoal('a')).toBeNull()
    const monday = new Date(2026, 10, 23, 10).getTime() // Mon 23 Nov 2026
    const nextMonday = new Date(2026, 10, 30, 10).getTime()
    expect(weekKey(monday)).toBe(weekKey(new Date(2026, 10, 29, 20).getTime())) // Sunday is the same ISO week
    expect(weekKey(nextMonday)).not.toBe(weekKey(monday))
    recordBitDone('a', monday)
    recordBitDone('a', monday)
    expect(bitsThisWeek('a', monday)).toBe(2)
    expect(bitsThisWeek('a', nextMonday)).toBe(0) // a new week starts fresh: nothing lost, nothing carried
  })
  it('keeps the best challenge mark of the week only', () => {
    const now = new Date(2026, 10, 25, 10).getTime()
    expect(getChallengeBest('a', now)).toBeNull()
    expect(noteChallengeMark('a', 6, now)).toBe(true)
    expect(noteChallengeMark('a', 4, now)).toBe(false)
    expect(getChallengeBest('a', now)).toBe(6)
    expect(noteChallengeMark('a', 8.5, now)).toBe(true)
    expect(getChallengeBest('a', now + 7 * 86400000)).toBeNull()
  })
})

describe('pickChallengeSkills', () => {
  const sk = (id: string, subject: string, grade: number) => ({ id, subject, grade }) as unknown as Skill
  const skills = [sk('m1', 'mat', 5), sk('m2', 'mat', 5), sk('r1', 'rom', 5), sk('r2', 'rom', 6), sk('i1', 'ist', 4), sk('hi', 'mat', 8)]
  it('mixes subjects, prefers practised/mastered skills and respects the grade', () => {
    const pick = pickChallengeSkills(skills, { m2: 'mastered', r2: 'practised' }, 6, 3, () => 0.5)
    expect(new Set(pick.map((s) => s.subject)).size).toBe(3)
    expect(pick.find((s) => s.subject === 'mat')?.id).toBe('m2')
    expect(pick.find((s) => s.subject === 'rom')?.id).toBe('r2')
    expect(pickChallengeSkills(skills, {}, 6, 10).every((s) => s.grade <= 6)).toBe(true)
  })
  it('returns fewer when there are not enough skills', () => {
    expect(pickChallengeSkills(skills.slice(0, 1), {}, 6, 5)).toHaveLength(1)
    expect(pickChallengeSkills([], {}, 6, 5)).toEqual([])
  })
})

describe('level statement for gimnaziu', () => {
  const result = (grade: number) =>
    ({
      subject: 'mat',
      declared: { grade, semester: 1 },
      skillStates: { a: {}, b: {}, c: {}, d: {} },
      gaps: ['d'],
      unknown: [],
      level: { grade: 5, semester: 1 },
      missingCount: 1,
      estimatedWeeks: 1,
      complete: true,
    }) as unknown as PlacementResult
  it('adds a clearly estimated mark from grade V up, nothing below', () => {
    expect(levelStatement(result(6), 'ro')).toContain('Nota estimată: 7,75 (estimativă — nu e notă oficială).')
    expect(levelStatement(result(6), 'en')).toContain('Estimated mark: 7.75 (an estimate — not an official mark).')
    expect(levelStatement(result(3), 'ro')).not.toContain('Nota estimată')
  })
})

describe('daily rotation for older kids', () => {
  it('keeps primary-only subjects (Științe) out of the rotation from grade V', async () => {
    const { isSubjectCurrent } = await import('@/learner/availability');
    expect(isSubjectCurrent('stiinte', 4)).toBe(true);
    expect(isSubjectCurrent('stiinte', 8)).toBe(false);
    expect(isSubjectCurrent('bio', 8)).toBe(true);
    expect(isSubjectCurrent('fiz', 5)).toBe(false);
  });
});
