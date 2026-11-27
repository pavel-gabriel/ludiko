import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n/config'
import { assembleTest, contentKey, testItems } from '@/exam/assemble'
import {
  GIM_BLUEPRINTS,
  GIM_VARIANTS,
  getGimBlueprint,
  gimExamsForGrade,
  gimQuestionCount,
  hasEstimatedMark,
  maxPoints,
  recommendedGimExam,
} from '@/exam/gimBlueprints'
import { partialFraction, scoreGimExam } from '@/exam/gimScoring'
import { examForGrade } from '@/exam/blueprints'
import { markFromScore } from '@/older/marks'
import { getSkill } from '@/engine/content/registry'
import { validateItem } from '@/engine/content/validate'
import { checkResponse } from '@/engine/items/check'
import type { ReadAndAnswerItem } from '@/engine/types'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import ExamPickerPage from '@/ui/exam/ExamPickerPage'
import ExamEntryCard from '@/ui/exam/ExamEntryCard'
import ExamGimResults from '@/ui/exam/ExamGimResults'

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})

const assemble = (id: string) => {
  const bp = GIM_BLUEPRINTS.find((b) => b.id === id)!
  return { bp, test: assembleTest(bp, { seed: bp.seed }) }
}

describe('gimnaziu blueprints', () => {
  it('ship the requested number of tests per paper', () => {
    expect(GIM_VARIANTS.en8).toEqual({ 1: 4, 2: 4 })
    expect(GIM_VARIANTS.en6).toEqual({ 1: 3, 2: 3 })
    for (const exam of ['en6', 'en8'] as const) {
      for (const test of [1, 2] as const) {
        const n = GIM_BLUEPRINTS.filter((b) => b.exam === exam && b.test === test).length
        expect(n, `${exam} paper ${test}`).toBe(GIM_VARIANTS[exam][test])
        for (let v = 1; v <= n; v++) expect(getGimBlueprint(exam, test, v)).toBeDefined()
      }
    }
    expect(GIM_BLUEPRINTS).toHaveLength(14)
  })

  it('reference existing skills of grades V–VIII, unique ids, a fixed seed and a weight on every part', () => {
    const ids = new Set<string>()
    for (const bp of GIM_BLUEPRINTS) {
      expect(ids.has(bp.id)).toBe(false)
      ids.add(bp.id)
      expect(bp.seed).toBeTypeOf('number')
      expect(bp.timeLimitMin).toBeGreaterThanOrEqual(90)
      for (const s of bp.sections)
        for (const p of s.parts) {
          expect(p.points, `${bp.id}/${p.id}`).toBeGreaterThan(0)
          expect('ids' in p.skills).toBe(true)
          if ('ids' in p.skills) {
            for (const id of p.skills.ids) {
              const skill = getSkill(id)
              expect(skill, id).toBeDefined()
              expect(skill!.grade, id).toBeGreaterThanOrEqual(5)
            }
            // never asks for more items than it has distinct skills' worth of generators is checked by assembly below
            expect(p.count).toBeLessThanOrEqual(p.skills.ids.length)
          }
        }
    }
  })

  it('EN VIII Matematică follows the 3 x 30 point shape; EN VIII Română has 2 texts + language', () => {
    for (let v = 1; v <= 4; v++) {
      const m = getGimBlueprint('en8', 2, v)!
      expect(m.sections.map((s) => s.parts.reduce((n, p) => n + p.count * p.points!, 0))).toEqual([30, 30, 30])
      expect(m.timeLimitMin).toBe(120)
      const r = getGimBlueprint('en8', 1, v)!
      expect(r.sections.map((s) => s.parts.reduce((n, p) => n + p.count * p.points!, 0))).toEqual([20, 20, 30])
      expect(maxPoints(r)).toBe(70)
    }
  })
})

describe('assembly', () => {
  it.each(GIM_BLUEPRINTS.map((b) => b.id))('%s assembles deterministically with the right counts and points', (id) => {
    const { bp, test } = assemble(id)
    expect(test.shortfalls).toEqual([])
    expect(test.skippedSections).toEqual([])
    expect(test.variant).toBe(bp.variant)
    expect(testItems(test).length).toBe(gimQuestionCount(bp))
    // per-section counts and the points sum match the definition
    bp.sections.forEach((s, i) => expect(test.sections[i].items.length).toBe(s.parts.reduce((n, p) => n + p.count, 0)))
    const total = testItems(test).reduce((n, it) => n + test.itemMeta![it.id].points, 0)
    expect(total).toBe(maxPoints(bp))
    // same seed -> identical paper
    const again = assembleTest(bp, { seed: bp.seed })
    expect(testItems(again).map(contentKey)).toEqual(testItems(test).map(contentKey))
    // no duplicate content
    const keys = testItems(test).map(contentKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each(GIM_BLUEPRINTS.map((b) => b.id))('%s has only valid, paper-style, provenance-tagged items', (id) => {
    const { bp, test } = assemble(id)
    for (const item of testItems(test)) {
      expect(bp.allowedTypes).toContain(item.type)
      expect(validateItem(item, getSkill(item.skillId)), item.id).toEqual([])
      expect(item.provenance, item.id).toBeDefined()
      if (item.type === 'read-and-answer') {
        // a reading text is worth partial points: answering every question right gives the full share
        expect(item.questions.length).toBeGreaterThan(0)
      }
    }
  })

  it('tests of the same paper differ from each other', () => {
    for (const exam of ['en6', 'en8'] as const) {
      for (const test of [1, 2] as const) {
        const sigs = GIM_BLUEPRINTS.filter((b) => b.exam === exam && b.test === test).map((b) =>
          testItems(assembleTest(b, { seed: b.seed })).map(contentKey).join('\n'),
        )
        expect(new Set(sigs).size, `${exam} paper ${test}`).toBe(sigs.length)
      }
    }
  })

  it('EN VIII Română uses reading passages from the grade VII–VIII text banks', () => {
    for (let v = 1; v <= 4; v++) {
      const { test } = assemble(`en8.t1.v${v}`)
      const reads = testItems(test).filter((i): i is ReadAndAnswerItem => i.type === 'read-and-answer')
      expect(reads).toHaveLength(2)
      expect(reads.every((r) => r.provenance.licence === 'OWN')).toBe(true)
    }
  })
})

describe('scoring', () => {
  const perfect = (id: string) => {
    const { test } = assemble(id)
    return { test, answers: Object.fromEntries(testItems(test).map((i) => [i.id, true])) }
  }

  it('all right on EN VIII gives mark 10,00; nothing answered gives 1,00', () => {
    const { test, answers } = perfect('en8.t2.v1')
    const full = scoreGimExam(test, answers)
    expect(full.points).toBe(90)
    expect(full.maxPoints).toBe(90)
    expect(full.mark).toBe(10)
    expect(full.percent).toBe(100)
    const none = scoreGimExam(test, {})
    expect(none.points).toBe(0)
    expect(none.mark).toBe(1)
    expect(none.stars).toBe(0)
  })

  it('weights points per item and maps points to a mark with markFromScore', () => {
    const { test } = assemble('en8.t2.v2')
    const items = testItems(test)
    // only the 5-point items of part I right: 6 x 5 = 30 of 90
    const part1 = test.sections[0].items
    const s = scoreGimExam(test, Object.fromEntries(items.map((i) => [i.id, part1.includes(i)])))
    expect(s.points).toBe(30)
    expect(s.mark).toBe(markFromScore(30, 90))
    expect(s.mark).toBe(4)
    expect(s.sectionPoints.map((x) => x.points)).toEqual([30, 0, 0])
    const calc = s.competences.find((c) => c.competence === 'calc')!
    expect(calc).toMatchObject({ points: 30, max: 30, ratio: 1 })
    expect(s.competences.find((c) => c.competence === 'geom')!.points).toBe(0)
  })

  it('gives partial points for a reading text', () => {
    const { test } = assemble('en8.t1.v1')
    const text = testItems(test)[0] as ReadAndAnswerItem
    expect(text.type).toBe('read-and-answer')
    const answers = Object.fromEntries(testItems(test).map((i) => [i.id, false]))
    const s = scoreGimExam(test, answers, { [text.id]: 0.75 })
    expect(s.points).toBe(15)
    expect(s.mark).toBe(markFromScore(15, 70))

    // partialFraction from a real response: 3 of 4 questions right
    const answersMap: Record<string, any> = {}
    text.questions.forEach((q, i) => {
      answersMap[q.id] =
        q.type === 'choice'
          ? { type: 'choice', selectedId: i < 3 ? q.correctId : q.options.find((o) => o.id !== q.correctId)!.id }
          : { type: 'true-false', value: i < 3 ? q.correct : !q.correct }
    })
    const resp = { type: 'read-and-answer', answers: answersMap } as const
    expect(checkResponse(text, resp)).toBe(false)
    expect(partialFraction(text, resp)).toBeCloseTo(0.75)
  })

  it('EN VI has no mark: percentage and competences only', () => {
    expect(hasEstimatedMark('en6')).toBe(false)
    expect(hasEstimatedMark('en8')).toBe(true)
    const { test, answers } = perfect('en6.t2.v1')
    const s = scoreGimExam(test, answers)
    expect(s.markApplies).toBe(false)
    expect(s.mark).toBeNull()
    expect(s.percent).toBe(100)
    expect(s.maxPoints).toBe(64)
    expect(s.competences.map((c) => c.competence).sort()).toEqual(['alg', 'bio', 'calc', 'fiz', 'geo', 'geom'])
  })
})

describe('availability by grade', () => {
  it('EN VI from grade VI, EN VIII from grade VII; none for V and for the small grades', () => {
    expect([5, 6, 7, 8].map(gimExamsForGrade)).toEqual([[], ['en6'], ['en8', 'en6'], ['en8', 'en6']])
    expect([0, 1, 2, 3, 4, 5, 9].map(gimExamsForGrade)).toEqual([[], [], [], [], [], [], []])
    expect([6, 7, 8].map(recommendedGimExam)).toEqual(['en6', 'en8', 'en8'])
    // existing II / IV mapping is untouched
    expect([0, 1, 2, 3, 4, 5].map(examForGrade)).toEqual([null, null, 'en2', 'en4', 'en4', null])
  })

  it('the entry card shows for grades VI–VIII and links to the picker', () => {
    for (const [grade, shown] of [[5, false], [6, true], [7, true], [8, true]] as const) {
      const { unmount } = render(
        <MemoryRouter>
          <ExamEntryCard grade={grade} />
        </MemoryRouter>,
      )
      expect(screen.queryByTestId('card-exam') !== null, `grade ${grade}`).toBe(shown)
      if (shown) expect(screen.getByTestId('card-exam')).toHaveAttribute('href', '/learn/exam')
      unmount()
    }
    render(
      <MemoryRouter>
        <ExamEntryCard grade={8} />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('card-exam')).toHaveTextContent('clasa a VIII-a')
  })
})

describe('UI', () => {
  const profile = (grade: number): ChildProfile =>
    ({ id: 'p8', nickname: 'Ioana', avatar: '🦊', grade, createdAt: 0, stars: 0 }) as unknown as ChildProfile

  beforeEach(() => {
    useProfileStore.setState({ profiles: [profile(8)], activeProfile: profile(8), loaded: true })
  })
  afterEach(cleanup)

  const renderPicker = () =>
    render(
      <MemoryRouter initialEntries={['/learn/exam']}>
        <Routes>
          <Route path="/learn/exam" element={<ExamPickerPage />} />
        </Routes>
      </MemoryRouter>,
    )

  it('the picker for a grade VIII profile lists EN VIII tests with links, counts and the honest note', async () => {
    renderPicker()
    expect(await screen.findByTestId('tab-en8')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('tab-en6')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-en2')).toBeNull()
    for (let v = 1; v <= 4; v++) {
      expect(screen.getByTestId(`test-en8.t1.v${v}`)).toHaveAttribute('href', `/learn/exam/en8/1/${v}`)
      expect(screen.getByTestId(`test-en8.t2.v${v}`)).toHaveAttribute('href', `/learn/exam/en8/2/${v}`)
    }
    expect(screen.getByTestId('test-en8.t2.v1')).toHaveTextContent('15 cerințe · 90 puncte · 120 minute')
    expect(screen.getByTestId('exam-parent-note')).toHaveTextContent('aproximare')
    expect(screen.getByTestId('exam-parent-note')).toHaveTextContent('limbă modernă')
    fireEvent.click(screen.getByTestId('tab-en6'))
    expect(screen.getByTestId('gim-mark-note')).toHaveTextContent('Fără notă oficială')
    expect(screen.getByTestId('test-en6.t2.v3')).toHaveAttribute('href', '/learn/exam/en6/2/3')
  })

  it('a grade VI profile gets EN VI only; a grade II profile still gets the old picker', async () => {
    useProfileStore.setState({ activeProfile: profile(6) })
    const view = renderPicker()
    expect(await screen.findByTestId('tab-en6')).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('tab-en8')).toBeNull()
    view.unmount()
    useProfileStore.setState({ activeProfile: profile(2) })
    renderPicker()
    expect(await screen.findByTestId('tab-en2')).toBeInTheDocument()
  })

  it('results: EN VIII shows the estimated mark with Romanian comma and the disclaimer; EN VI shows the percentage', async () => {
    const { bp, test } = assemble('en8.t2.v1')
    const items = testItems(test)
    const answers = Object.fromEntries(items.map((i, idx) => [i.id, idx % 2 === 0]))
    const score = scoreGimExam(test, answers)
    const props = { reward: null, overtime: false, titleOf: (id: string) => id, onAgain: () => {}, onHome: () => {} }
    const view = render(
      <MemoryRouter>
        <ExamGimResults test={test} score={score} {...props} />
      </MemoryRouter>,
    )
    const mark = screen.getByTestId('gim-mark')
    expect(mark).toHaveTextContent(/Nota estimată: \d+,\d{2}/)
    expect(mark).toHaveTextContent('nu e notă oficială')
    expect(screen.getByTestId('gim-competences')).toBeInTheDocument()
    expect(bp.exam).toBe('en8')
    view.unmount()

    const six = assemble('en6.t1.v1')
    const s6 = scoreGimExam(six.test, Object.fromEntries(testItems(six.test).map((i) => [i.id, true])))
    render(
      <MemoryRouter>
        <ExamGimResults test={six.test} score={s6} {...props} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('gim-mark')).toBeNull()
    expect(screen.getByTestId('gim-percent')).toHaveTextContent('Rezultat: 100%')
    expect(screen.getByTestId('gim-comp-lectura')).toBeInTheDocument()
  })
})
