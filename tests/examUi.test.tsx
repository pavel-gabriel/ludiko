import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { AssembledTest } from '@/exam/types'
import type { ChoiceItem, Item } from '@/engine/types'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { fakeLearner, resetFake } from './helpers/fakeLearner'
import ExamPickerPage from '@/ui/exam/ExamPickerPage'
import ExamRunPage from '@/ui/exam/ExamRunPage'
import ExamEntryCard from '@/ui/exam/ExamEntryCard'
import ExamResults from '@/ui/exam/ExamResults'
import LearnHomeView from '@/ui/learn/LearnHomeView'
import ParentView from '@/ui/learn/ParentView'

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

const prov = { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' } as ChoiceItem['provenance']
const choice = (id: string, skillId: string): Item => ({
  id,
  skillId,
  type: 'choice',
  difficulty: 1,
  reviewStatus: 'beta',
  provenance: prov,
  prompt: { ro: `Întrebarea ${id}` },
  options: [
    { id: 'ok', text: { ro: 'Bun' } },
    { id: 'no', text: { ro: 'Rău' } },
  ],
  correctId: 'ok',
})

/* The runner is tested with a tiny hand-made paper; assembly itself is covered in examAssemble.test.ts */
vi.mock('@/exam/assemble', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/exam/assemble')>()),
  assembleTest: (): AssembledTest => ({
    blueprintId: 'en2.t1',
    exam: 'en2',
    test: 1,
    seed: 1,
    title: { ro: 'Comunicare în limba română' },
    timeLimitMin: 45,
    skippedSections: [],
    shortfalls: [],
    sections: [
      { id: 'sentences', title: { ro: 'Propoziții și cuvinte' }, intro: { ro: 'Punem cuvintele în ordine.' }, items: [choice('i1', 'skill.x'), choice('i2', 'skill.y')] },
      { id: 'texts', title: { ro: 'Citim texte' }, intro: { ro: 'Citim cu atenție.' }, items: [choice('i3', 'skill.x')] },
    ],
  }),
}))

const profile: ChildProfile = {
  id: 'p1',
  nickname: 'Matei',
  avatar: '🦊',
  grade: 2,
  language: 'ro',
  createdAt: 1,
  updatedAt: 1,
  recoveryCode: 'AAAA-BBBB',
}

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<p>learn home</p>} />
        <Route path="/learn/exam" element={<ExamPickerPage />} />
        <Route path="/learn/exam/:exam/:test" element={<ExamRunPage />} />
        <Route path="/practice/:skillId" element={<p>practice page</p>} />
        <Route path="/profiles" element={<p>profile picker</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const click = async (name: string | RegExp) => {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle()
}

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  vi.useFakeTimers()
  resetFake()
  useProfileStore.setState({ profiles: [profile], activeProfile: profile, loaded: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function startPaper() {
  renderAt('/learn/exam/en2/1')
  await settle()
  await click('Începem!')
}

describe('exam picker', () => {
  it('offers EN II and EN IV, Test 1/2 per exam, and the parents note', async () => {
    renderAt('/learn/exam')
    await settle()
    expect(screen.getByTestId('tab-en2')).toHaveAttribute('aria-selected', 'true') // grade 2 profile
    expect(screen.getByTestId('test-en2.t1')).toHaveAttribute('href', '/learn/exam/en2/1')
    expect(screen.getByTestId('test-en2.t2')).toHaveAttribute('href', '/learn/exam/en2/2')
    expect(screen.getByTestId('exam-parent-note')).toHaveTextContent('simulare de antrenament, nu o notă oficială')
    fireEvent.click(screen.getByTestId('tab-en4'))
    expect(screen.getByTestId('test-en4.t1')).toHaveAttribute('href', '/learn/exam/en4/1')
    expect(screen.getByTestId('test-en4.t2')).toHaveAttribute('href', '/learn/exam/en4/2')
  })

  it('recommends EN IV for a grade 4 profile', async () => {
    useProfileStore.setState({ activeProfile: { ...profile, grade: 4 } })
    renderAt('/learn/exam')
    await settle()
    expect(screen.getByTestId('tab-en4')).toHaveAttribute('aria-selected', 'true')
  })

  it('sends an unknown exam id back to the picker', async () => {
    renderAt('/learn/exam/en9/1')
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/exam')
  })
})

describe('entry cards', () => {
  const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

  it('show only for grades II–IV (2 -> EN II, 3–4 -> EN IV)', () => {
    for (const [grade, shown] of [[0, false], [1, false], [2, true], [3, true], [4, true], [5, false]] as const) {
      const { unmount } = wrap(<ExamEntryCard grade={grade} />)
      expect(screen.queryByTestId('card-exam') !== null, `grade ${grade}`).toBe(shown)
      unmount()
    }
    wrap(<ExamEntryCard grade={2} />)
    expect(screen.getByTestId('card-exam')).toHaveTextContent('clasa a II-a')
    expect(screen.getByTestId('card-exam')).toHaveAttribute('href', '/learn/exam')
  })

  it('are on the learner home for grade III and not for grade I', () => {
    const view = (grade: number) => (
      <LearnHomeView profile={{ nickname: 'Ana', avatar: '🦊', grade }} stars={0} playDays={0} subjects={[]} />
    )
    const { unmount } = wrap(view(3))
    expect(screen.getByTestId('card-exam')).toHaveTextContent('clasa a IV-a')
    unmount()
    wrap(view(1))
    expect(screen.queryByTestId('card-exam')).toBeNull()
  })

  it('are in the parent view for grades II–IV', () => {
    const summary = { profileId: 'p1', subjects: [], playDaysThisWeek: 0, tip: { ro: 'sfat', en: 'tip' } }
    const { unmount } = wrap(<ParentView profileName="Ana" profileGrade={2} summary={summary} titleOf={(id) => id} onRedo={() => {}} />)
    expect(screen.getByTestId('card-exam')).toBeInTheDocument()
    unmount()
    wrap(<ParentView profileName="Ana" profileGrade={1} summary={summary} titleOf={(id) => id} onRedo={() => {}} />)
    expect(screen.queryByTestId('card-exam')).toBeNull()
  })
})

describe('exam flow: start -> answer -> results', () => {
  it('runs a paper with section intros, no verdicts, then shows the child celebration and the parent panel', async () => {
    renderAt('/learn/exam/en2/1')
    await settle()
    expect(screen.getByTestId('exam-start')).toHaveTextContent('Comunicare în limba română')
    await click('Începem!')

    // section 1 intro, then its questions
    expect(screen.getByTestId('section-intro')).toHaveTextContent('Propoziții și cuvinte')
    await click('Începem partea')
    expect(screen.getByText('Întrebarea i1')).toBeInTheDocument()
    expect(screen.getByText(/Întrebarea 1 din 3/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()
    // no verdict, no explanation, no right answer: straight to the next question
    expect(screen.queryByText(/Corect|Hai să vedem|Răspunsul corect/)).toBeNull()
    expect(screen.getByText('Întrebarea i2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Rău/ })) // a wrong answer
    await settle()
    expect(screen.queryByText(/Corect|Hai să vedem|Răspunsul corect/)).toBeNull()

    // section 2
    expect(screen.getByTestId('section-intro')).toHaveTextContent('Citim texte')
    await click('Începem partea')
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()

    // results: the child sees a celebration only
    const results = screen.getByTestId('exam-results')
    expect(within(results).getByText('Ai terminat testul!')).toBeInTheDocument()
    expect(screen.getByTestId('exam-stars')).toBeInTheDocument()
    expect(screen.queryByText(/Insuficient|Suficient|Foarte bine|greșit|eșec/i)).toBeNull()
    expect(screen.getByTestId('exam-parent-toggle')).toHaveAttribute('aria-expanded', 'false')

    // answers reached the learner: every answered item, once, for mastery
    const attemptModes = fakeLearner.recordItemResult.mock.calls.map((c) => (c as unknown[])[3])
    expect(attemptModes.length).toBe(3)
    expect(attemptModes.every((m) => (m as { mode: string }).mode === 'check')).toBe(true)
    expect(fakeLearner.recordExamResults).toHaveBeenCalledTimes(1)
    const [pid, entries] = fakeLearner.recordExamResults.mock.calls[0] as unknown as [string, { item: Item; correct: boolean }[]]
    expect(pid).toBe('p1')
    expect(entries.map((e) => [e.item.id, e.correct])).toEqual([['i1', true], ['i2', false], ['i3', true]])

    // parents: descriptor, sections, practice list with links
    fireEvent.click(screen.getByTestId('exam-parent-toggle'))
    const panel = screen.getByTestId('exam-parent-panel')
    expect(panel).toHaveTextContent('nu notă oficială')
    expect(screen.getByTestId('exam-descriptor')).toHaveTextContent('Suficient') // 2 of 3 = 67%
    expect(screen.getByTestId('exam-descriptor')).toHaveTextContent('2 din 3')
    expect(screen.getByTestId('exam-section-sentences')).toHaveTextContent('1/2')
    expect(screen.getByTestId('exam-section-texts')).toHaveTextContent('1/1')
    const link = within(screen.getByTestId('exam-practice')).getByRole('link')
    expect(link).toHaveAttribute('href', '/practice/skill.y')
    expect(panel).toHaveTextContent('Foarte bine de la 90%')
  })

  it('has a pause that stops the clock and hides the question, and a clock that can be hidden', async () => {
    await startPaper()
    await click('Începem partea')
    const clock = screen.getByTestId('exam-clock')
    expect(clock).toHaveTextContent('45:00')
    await settle(10_000)
    expect(screen.getByTestId('exam-clock')).toHaveTextContent('44:50')

    await click(/Pauză/)
    expect(screen.getByRole('dialog')).toHaveTextContent('Ceasul stă pe loc')
    await settle(60_000)
    await click('Continuăm')
    expect(screen.getByTestId('exam-clock')).toHaveTextContent('44:50')
    expect(screen.getByText('Întrebarea i1')).toBeInTheDocument()

    await click('Ascunde ceasul')
    expect(screen.queryByTestId('exam-clock')).toBeNull()
    await click('Arată ceasul')
    expect(screen.getByTestId('exam-clock')).toBeInTheDocument()
  })

  it('can start with the clock hidden', async () => {
    renderAt('/learn/exam/en2/1')
    await settle()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arată ceasul' }))
    await click('Începem!')
    await click('Începem partea')
    expect(screen.queryByTestId('exam-clock')).toBeNull()
  })

  it('never cuts the child off when time runs out: keep working or see results', async () => {
    await startPaper()
    await click('Începem partea')
    await settle(45 * 60_000 + 1000)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Timpul simulării a trecut')
    expect(dialog).toHaveTextContent('Nicio grabă')
    await click('Mai lucrez puțin')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Întrebarea i1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()
    await click('Începem partea')
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()
    fireEvent.click(screen.getByTestId('exam-parent-toggle'))
    expect(screen.getByTestId('exam-parent-panel')).toHaveTextContent('depășit timpul')
  })

  it('finishing from the time-up dialog scores unanswered items as not correct', async () => {
    await startPaper()
    await click('Începem partea')
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle()
    await settle(45 * 60_000 + 1000)
    await click('Vreau să văd rezultatele')
    fireEvent.click(screen.getByTestId('exam-parent-toggle'))
    expect(screen.getByTestId('exam-descriptor')).toHaveTextContent('1 din 3')
    expect(screen.getByTestId('exam-descriptor')).toHaveTextContent('2 întrebări au rămas fără răspuns')
    const [, entries] = fakeLearner.recordExamResults.mock.calls[0] as unknown as [string, unknown[]]
    expect(entries).toHaveLength(1)
  })

  it('leaving asks first and saves nothing', async () => {
    await startPaper()
    await click('Începem partea')
    await click('Ieși din test')
    expect(screen.getByRole('dialog')).toHaveTextContent('Ieșim din test?')
    await click('Rămân în test')
    expect(screen.queryByRole('dialog')).toBeNull()
    await click('Ieși din test')
    await click('Ies')
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/exam')
    expect(fakeLearner.recordExamResults).not.toHaveBeenCalled()
  })
})

describe('results panel', () => {
  const longScore = {
    correct: 0, total: 8, answered: 8, ratio: 0, descriptor: 'i' as const, stars: 1 as const,
    sections: [{ sectionId: 'a', correct: 0, total: 8, ratio: 0, descriptor: 'i' as const }],
    practice: Array.from({ length: 8 }, (_, i) => ({ skillId: `skill.${i}`, wrong: 1, total: 1 })),
  }
  const test: AssembledTest = {
    blueprintId: 'x', exam: 'en2', test: 1, seed: 1, title: { ro: 'x' }, timeLimitMin: 45, shortfalls: [],
    skippedSections: ['environment'],
    sections: [{ id: 'a', title: { ro: 'Partea A' }, intro: { ro: '' }, items: [] }],
  }
  const view = () =>
    render(
      <MemoryRouter>
        <ExamResults test={test} score={longScore} reward={null} overtime={false} guest titleOf={(id) => id} onAgain={() => {}} onHome={() => {}} />
      </MemoryRouter>,
    )

  it('keeps the parent details out of sight (and out of the DOM text) until asked', () => {
    view()
    expect(screen.getByTestId('exam-parent-panel')).not.toBeVisible()
    expect(screen.queryByText('Insuficient')).toBeNull()
    fireEvent.click(screen.getByTestId('exam-parent-toggle'))
    expect(screen.getByTestId('exam-parent-panel')).toBeVisible()
    expect(screen.getByText('Insuficient')).toBeInTheDocument()
  })

  it('caps a long practice list, with a button for the rest; notes skipped science and guests', () => {
    view()
    fireEvent.click(screen.getByTestId('exam-parent-toggle'))
    expect(within(screen.getByTestId('exam-practice')).getAllByRole('link')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Arată toate cele 8 teme' }))
    expect(within(screen.getByTestId('exam-practice')).getAllByRole('link')).toHaveLength(8)
    expect(screen.getByTestId('exam-parent-panel')).toHaveTextContent('lecțiile nu sunt încă disponibile')
    expect(screen.getByTestId('exam-parent-panel')).toHaveTextContent('nu se salvează')
  })
})
