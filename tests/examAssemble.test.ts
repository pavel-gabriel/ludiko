import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assembleTest, contentKey, resolveSkills, testItems } from '@/exam/assemble'
import { BLUEPRINTS, EN4_MATH, examForGrade, getBlueprint, requiredQuestionCount } from '@/exam/blueprints'
import { descriptorFor, DESCRIPTOR_THRESHOLDS, scoreExam } from '@/exam/scoring'
import type { AssembledTest, ExamBlueprint } from '@/exam/types'
import { getSkill } from '@/engine/content/registry'
import type { ChoiceItem, Item } from '@/engine/types'
import { learnerService } from '@/learner'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile, getProgress } from '@/profiles/profileService'

const SEEDS = Array.from({ length: 20 }, (_, i) => i * 7919 + 3)

describe('blueprints', () => {
  it('describe two papers per exam with the official working time', () => {
    for (const exam of ['en2', 'en4'] as const) {
      expect(getBlueprint(exam, 1)).toBeDefined()
      expect(getBlueprint(exam, 2)).toBeDefined()
    }
    expect(BLUEPRINTS.filter((b) => b.exam === 'en2').every((b) => b.timeLimitMin === 45)).toBe(true)
    expect(BLUEPRINTS.filter((b) => b.exam === 'en4').every((b) => b.timeLimitMin === 60)).toBe(true)
  })

  it('only reference existing skills (math + Romanian) by id, with unique part ids', () => {
    const partIds = new Set<string>()
    for (const bp of BLUEPRINTS) {
      for (const section of bp.sections) {
        for (const part of section.parts) {
          expect(partIds.has(`${bp.id}/${part.id}`)).toBe(false)
          partIds.add(`${bp.id}/${part.id}`)
          expect(part.count).toBeGreaterThan(0)
          if ('ids' in part.skills) {
            for (const id of part.skills.ids) {
              const skill = getSkill(id)
              expect(skill, id).toBeDefined()
              expect(['mat', 'rom']).toContain(skill!.subject)
            }
          } else {
            // pattern selectors are only for content another wave may still be writing
            expect(section.optional).toBe(true)
            expect(part.skills.subject).toBe('stiinte')
          }
        }
      }
    }
  })

  it('maps grade to exam: II -> EN II, III-IV -> EN IV, others none', () => {
    expect([0, 1, 2, 3, 4, 5].map(examForGrade)).toEqual([null, null, 'en2', 'en4', 'en4', null])
  })
})

describe('assembleTest', () => {
  it('respects the blueprint: counts per section, no shortfalls, paper-style item types only', () => {
    for (const bp of BLUEPRINTS) {
      const test = assembleTest(bp, { seed: 11 })
      expect(test.shortfalls).toEqual([])
      expect(test.timeLimitMin).toBe(bp.timeLimitMin)
      expect(test.blueprintId).toBe(bp.id)
      for (const section of test.sections) {
        const spec = bp.sections.find((s) => s.id === section.id)!
        const expected = spec.parts
          .filter((p) => resolveSkills(p.skills).length > 0)
          .reduce((n, p) => n + p.count, 0)
        expect(section.items).toHaveLength(expected)
      }
      expect(testItems(test).length).toBeGreaterThanOrEqual(requiredQuestionCount(bp))
      for (const item of testItems(test)) expect(bp.allowedTypes).toContain(item.type)
    }
  })

  it('draws each part from the skills the blueprint names', () => {
    const test = assembleTest(getBlueprint('en2', 2)!, { seed: 4 })
    const calc = test.sections.find((s) => s.id === 'calc')!
    const bySkill = (id: string) => calc.items.filter((i) => i.skillId === id).length
    expect(bySkill('mat.add.nocarry.100')).toBe(1)
    expect(bySkill('mat.sub.noborrow.100')).toBe(1)
    expect(bySkill('mat.add.carry.100')).toBe(2)
    expect(bySkill('mat.sub.borrow.100')).toBe(2)
  })

  it('orders every section from easy to hard', () => {
    for (const bp of BLUEPRINTS) {
      for (const seed of SEEDS.slice(0, 5)) {
        for (const section of assembleTest(bp, { seed }).sections) {
          const d = section.items.map((i) => i.difficulty)
          expect(d).toEqual([...d].sort((a, b) => a - b))
        }
      }
    }
  })

  it('is reproducible by seed (and different seeds give different tests)', () => {
    for (const bp of BLUEPRINTS) {
      const a = assembleTest(bp, { seed: 99 })
      const b = assembleTest(bp, { seed: 99 })
      expect(b).toEqual(a)
    }
    const math = getBlueprint('en4', 2)!
    expect(assembleTest(math, { seed: 1 })).not.toEqual(assembleTest(math, { seed: 2 }))
  })

  it('never repeats an item inside a test (by id or by content)', () => {
    for (const bp of BLUEPRINTS) {
      for (const seed of SEEDS) {
        const items = testItems(assembleTest(bp, { seed }))
        expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
        expect(new Set(items.map(contentKey)).size, `${bp.id} seed ${seed}`).toBe(items.length)
      }
    }
  })

  it('skips an optional section gracefully when no skill with items exists for it', () => {
    const bp: ExamBlueprint = {
      ...getBlueprint('en4', 2)!,
      id: 'test.missing',
      sections: [
        ...getBlueprint('en4', 2)!.sections.slice(0, 1),
        {
          id: 'ghost',
          title: { ro: 'Fantomă' },
          intro: { ro: '-' },
          optional: true,
          parts: [{ id: 'g', competence: '-', skills: { subject: 'stiinte', grades: [3, 4], idPrefix: 'stiinte.does-not-exist.' }, count: 4, difficulty: 2 }],
        },
      ],
    }
    const test = assembleTest(bp, { seed: 5 })
    expect(test.skippedSections).toEqual(['ghost'])
    expect(test.sections.map((s) => s.id)).toEqual(['numbers'])
    expect(test.shortfalls).toEqual([])
  })

  it('includes the real science section exactly when science skills with items exist', () => {
    const part = EN4_MATH.sections.find((s) => s.id === 'nature')!.parts[0]
    const available = resolveSkills(part.skills).length > 0
    const test = assembleTest(EN4_MATH, { seed: 8 })
    if (available) {
      expect(test.skippedSections).toEqual([])
      const nature = test.sections.find((s) => s.id === 'nature')!
      expect(nature.items).toHaveLength(part.count)
      expect(nature.items.every((i) => getSkill(i.skillId)?.subject === 'stiinte')).toBe(true)
    } else {
      expect(test.skippedSections).toEqual(['nature'])
      expect(test.sections.some((s) => s.id === 'nature')).toBe(false)
    }
  })
})

/* ------------------------------------------------------------------ */

const prov = { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' } as ChoiceItem['provenance']
const mk = (id: string, skillId: string): Item => ({
  id,
  skillId,
  type: 'choice',
  difficulty: 1,
  reviewStatus: 'beta',
  provenance: prov,
  prompt: { ro: id },
  options: [{ id: 'ok', text: { ro: 'a' } }, { id: 'no', text: { ro: 'b' } }],
  correctId: 'ok',
})
const fixture = (): AssembledTest => ({
  blueprintId: 'fx',
  exam: 'en2',
  test: 1,
  seed: 1,
  title: { ro: 'x' },
  timeLimitMin: 45,
  skippedSections: [],
  shortfalls: [],
  sections: [
    { id: 'a', title: { ro: 'A' }, intro: { ro: '' }, items: [mk('a1', 'skill.x'), mk('a2', 'skill.x'), mk('a3', 'skill.y'), mk('a4', 'skill.y')] },
    { id: 'b', title: { ro: 'B' }, intro: { ro: '' }, items: [mk('b1', 'skill.z'), mk('b2', 'skill.z'), mk('b3', 'skill.z'), mk('b4', 'skill.z'), mk('b5', 'skill.y'), mk('b6', 'skill.y')] },
  ],
})

describe('scoring (Ludiko practice estimate, not official grading)', () => {
  it('documents its thresholds: 90 / 70 / 50 percent', () => {
    expect(DESCRIPTOR_THRESHOLDS).toEqual({ fb: 0.9, b: 0.7, s: 0.5 })
  })

  it('maps ratios to Foarte bine / Bine / Suficient / Insuficient at the boundaries', () => {
    expect(descriptorFor(1)).toBe('fb')
    expect(descriptorFor(0.9)).toBe('fb')
    expect(descriptorFor(0.8999)).toBe('b')
    expect(descriptorFor(0.7)).toBe('b')
    expect(descriptorFor(0.6999)).toBe('s')
    expect(descriptorFor(0.5)).toBe('s')
    expect(descriptorFor(0.4999)).toBe('i')
    expect(descriptorFor(0)).toBe('i')
  })

  it('scores overall and per section, counting unanswered items as not correct', () => {
    const test = fixture()
    const answers = { a1: true, a2: true, a3: true, a4: false, b1: true, b2: true, b3: true, b4: true, b5: true } // b6 unanswered
    const score = scoreExam(test, answers)
    expect(score.total).toBe(10)
    expect(score.correct).toBe(8)
    expect(score.answered).toBe(9)
    expect(score.ratio).toBeCloseTo(0.8)
    expect(score.descriptor).toBe('b')
    expect(score.sections.map((s) => [s.sectionId, s.correct, s.total, s.descriptor])).toEqual([
      ['a', 3, 4, 'b'],
      ['b', 5, 6, 'b'],
    ])
  })

  it('builds the "ce exersăm" list from wrong and unanswered items, most first', () => {
    const test = fixture()
    const answers = { a1: false, a2: false, a3: true, a4: false, b1: true, b2: true, b3: true, b4: true, b5: false } // b6 unanswered
    const { practice } = scoreExam(test, answers)
    expect(practice).toEqual([
      { skillId: 'skill.y', wrong: 3, total: 4 },
      { skillId: 'skill.x', wrong: 2, total: 2 },
    ])
  })

  it('has an empty practice list for a perfect paper and never gives a child zero stars for trying', () => {
    const test = fixture()
    const all = Object.fromEntries(testItems(test).map((i) => [i.id, true]))
    const perfect = scoreExam(test, all)
    expect(perfect.practice).toEqual([])
    expect(perfect.descriptor).toBe('fb')
    expect(perfect.stars).toBe(3)
    const none = scoreExam(test, Object.fromEntries(testItems(test).map((i) => [i.id, false])))
    expect(none.descriptor).toBe('i')
    expect(none.stars).toBe(1)
    expect(scoreExam(test, {}).stars).toBe(0)
  })
})

describe('learnerService.recordExamResults', () => {
  beforeEach(() => {
    _resetMemoryForTests()
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('feeds every answered item into mastery in one write and marks the play day', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 2, language: 'ro' })
    const item = mk('x1', 'mat.add.carry.100')
    await learnerService.recordExamResults(p.id, [
      { item, correct: true },
      { item: mk('x2', 'mat.add.carry.100'), correct: true },
      { item: mk('x3', 'mat.sub.borrow.100'), correct: false },
    ])
    const progress = await getProgress(p.id)
    expect(progress.skills['mat.add.carry.100'].attempts).toBe(2)
    expect(progress.skills['mat.add.carry.100'].correct).toBe(2)
    expect(progress.skills['mat.sub.borrow.100'].attempts).toBe(1)
    expect(progress.skills['mat.sub.borrow.100'].correct).toBe(0)
    expect(progress.playDays.length).toBe(1)
  })

  it('does nothing for an empty paper', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 2, language: 'ro' })
    await learnerService.recordExamResults(p.id, [])
    expect((await getProgress(p.id)).playDays).toEqual([])
  })
})
