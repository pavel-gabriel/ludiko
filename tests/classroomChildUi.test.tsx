import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import { setClassroomApi } from '@/classroom/api'
import { createFakeApi } from '@/classroom/dev/fakeApi'
import { ClassroomError, type ClassroomApi } from '@/classroom/types'
import type { ChoiceItem, Item, Skill } from '@/engine/types'
import type { AssignmentBit } from '@/learner'
import { deriveAssignmentBits } from '@/learner/assignmentOps'
import type { ChildProfile, ClassLink } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import ClassLinkSection from '@/components/profiles/ClassLinkSection'
import { fakeLearner, resetFake, state, SUMMARY } from './helpers/fakeLearner'
import ClassAssignmentPage from '@/ui/learn/ClassAssignmentPage'
import LearnHomePage from '@/ui/learn/LearnHomePage'

vi.mock('@/ui/learn/subjects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/learn/subjects')>()),
  LEARN_SUBJECTS: ['mat'],
}))
vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))
vi.mock('@/ui/session/itemSource', () => ({
  getSessionItems: (skill: Skill, count: number): Item[] =>
    Array.from({ length: count }, (_, i): ChoiceItem => ({
      id: `${skill.id}#${i + 1}`,
      skillId: skill.id,
      type: 'choice',
      difficulty: 1,
      reviewStatus: 'beta',
      provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
      prompt: { ro: `Întrebarea ${i + 1}` },
      options: [
        { id: 'ok', text: { ro: 'Bun' } },
        { id: 'no', text: { ro: 'Rău' } },
      ],
      correctId: 'ok',
    })),
  skillHasItems: () => true,
}))

const LINK: ClassLink = { classId: 'c1', seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' }
const base: ChildProfile = {
  id: 'p1',
  nickname: 'Matei',
  avatar: '🦊',
  grade: 3,
  language: 'ro',
  createdAt: 1,
  updatedAt: 1,
  recoveryCode: 'AAAA-BBBB-CCCC',
}
const linked: ChildProfile = { ...base, classLink: LINK }

const NOW = new Date(2026, 10, 25, 9).getTime()
const day = (n: number) => {
  const d = new Date(2026, 10, 25 + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const bits = (states: Record<string, 'practised' | 'gap' | 'learning'>): AssignmentBit[] =>
  deriveAssignmentBits(
    [
      { id: 'a1', subject: 'mat', skillIds: ['mat.sub.borrow.100', 'mat.add.carry.100'], title: 'Scăderea cu împrumut', dueDay: day(2) },
      { id: 'a2', subject: 'mat', skillIds: ['mat.count.20'], title: 'Numărăm până la 20', dueDay: day(0) },
    ],
    (id) => states[id],
    NOW,
  )

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}
const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  resetFake({
    placement: { subject: 'mat', target: { grade: 3, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1, completedAt: 2, summary: SUMMARY },
  })
  localStorage.clear()
  useProfileStore.setState({ profiles: [linked], activeProfile: linked, loaded: true })
})
afterEach(() => {
  cleanup()
  setClassroomApi(null)
  vi.useRealTimers()
})

describe('/learn: "Tema de la clasă"', () => {
  function renderHome() {
    return render(
      <MemoryRouter initialEntries={['/learn']}>
        <Routes>
          <Route path="/learn" element={<LearnHomePage />} />
          <Route path="/learn/class/:assignmentId" element={<p>assignment page</p>} />
          <Route path="/learn/check/:subject" element={<p>check page</p>} />
        </Routes>
        <Where />
      </MemoryRouter>,
    )
  }

  it('shows nothing without assignments', async () => {
    renderHome()
    await settle()
    expect(screen.getByText('Salut, Matei!')).toBeInTheDocument()
    expect(screen.queryByTestId('card-class-assignments')).toBeNull()
  })

  it('lists the open assignments with the due day and progress from the skill states', async () => {
    state.assignments = bits({ 'mat.add.carry.100': 'practised', 'mat.sub.borrow.100': 'gap' })
    renderHome()
    await settle()
    const card = screen.getByTestId('card-class-assignments')
    expect(card).toHaveTextContent('Tema de la clasă')
    const first = within(card).getByTestId('assignment-a2') // due today comes first
    expect(first).toHaveTextContent('Numărăm până la 20')
    expect(first).toHaveTextContent('Până azi')
    expect(first).toHaveTextContent('0 din 1')
    const second = within(card).getByTestId('assignment-a1')
    expect(second).toHaveTextContent('Mai sunt 2 zile')
    expect(second).toHaveTextContent('1 din 2')
    expect(second).toHaveAttribute('data-done', 'false')
    expect(second).toHaveAttribute('href', '/learn/class/a1')
    expect(within(card).queryByTestId('assignment-a1-tick')).toBeNull()
    // the daily bits stay where they are: the assignment is an extra card, not a replacement
    expect(screen.getByTestId('card-map')).toBeInTheDocument()
  })

  it('when everything is done it shows the finished one with a tick and a friendly line', async () => {
    state.assignments = bits({ 'mat.add.carry.100': 'practised', 'mat.sub.borrow.100': 'practised', 'mat.count.20': 'practised' })
    renderHome()
    await settle()
    const done = screen.getByTestId('card-class-assignments').querySelector('[data-done="true"]')!
    expect(done).toBeInTheDocument()
    expect(done).toHaveTextContent('Gata, bravo!')
    expect(within(done as HTMLElement).getByTestId(/-tick$/)).toBeInTheDocument()
  })

  it('a late assignment is never a failure: "Mai poți face tema"', async () => {
    state.assignments = deriveAssignmentBits(
      [{ id: 'late', subject: 'mat', skillIds: ['mat.count.20'], title: 'Veche', dueDay: day(-3) }],
      () => undefined,
      NOW,
    )
    renderHome()
    await settle()
    expect(screen.getByTestId('assignment-late')).toHaveTextContent('Mai poți face tema')
    expect(screen.queryByText(/întârziat|ratat|pierdut/i)).toBeNull()
  })

  it('plays the assignment round by round until each skill is practised, then celebrates', async () => {
    const states: Record<string, 'practised' | 'gap' | 'learning'> = { 'mat.sub.borrow.100': 'gap', 'mat.add.carry.100': 'practised' }
    state.assignments = bits(states)
    // answering items moves the skill, the way the engine's mastery update would
    fakeLearner.recordItemResult.mockImplementation(async (_p: string, item: Item) => {
      states[item.skillId] = 'practised'
      state.assignments = bits(states)
    })
    render(
      <MemoryRouter initialEntries={['/learn/class/a1']}>
        <Routes>
          <Route path="/learn" element={<p>learn home</p>} />
          <Route path="/learn/class/:assignmentId" element={<ClassAssignmentPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await settle()
    const overview = screen.getByTestId('assignment-overview')
    expect(overview).toHaveTextContent('Scăderea cu împrumut')
    expect(within(overview).getAllByRole('listitem').map((li) => li.getAttribute('data-done'))).toEqual(['false', 'true'])

    fireEvent.click(screen.getByTestId('assignment-start'))
    await settle()
    // the first open skill is played: 6 items
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
      await settle(1500)
    }
    await settle(2000)
    expect(fakeLearner.recordItemResult).toHaveBeenCalled()
    expect(fakeLearner.recordItemResult.mock.calls.every((c) => c[1].skillId === 'mat.sub.borrow.100')).toBe(true)
    expect(screen.getByTestId('assignment-done')).toHaveTextContent('Tema e gata!')
  })

  it('an unknown assignment id shows a gentle way back', async () => {
    render(
      <MemoryRouter initialEntries={['/learn/class/missing']}>
        <Routes>
          <Route path="/learn/class/:assignmentId" element={<ClassAssignmentPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await settle()
    expect(screen.getByTestId('assignment-not-found')).toBeInTheDocument()
  })
})

describe('profile settings: "Clasa mea"', () => {
  function api(over: Partial<ClassroomApi> = {}): ClassroomApi {
    const a = { ...createFakeApi(), ...over }
    setClassroomApi(a)
    return a
  }
  const load = vi.fn(async () => {})
  beforeEach(() => {
    vi.useRealTimers()
    load.mockClear()
    useProfileStore.setState({ load })
  })

  it('shows the code field; the button stays off until the code has 6 characters', () => {
    api()
    render(<ClassLinkSection profile={base} />)
    const input = screen.getByTestId('class-code')
    const join = screen.getByTestId('class-join')
    expect(join).toBeDisabled()
    fireEvent.change(input, { target: { value: 'abc 23' } })
    expect(join).toBeDisabled()
    fireEvent.change(input, { target: { value: 'abc 234' } })
    expect(input).toHaveValue('ABC 234')
    expect(join).toBeEnabled()
  })

  it('joins with the typed code and then shows the class name', async () => {
    const joinClass = vi.fn(async () => LINK)
    api({ joinClass })
    const { rerender } = render(<ClassLinkSection profile={base} />)
    fireEvent.change(screen.getByTestId('class-code'), { target: { value: 'abc 234' } })
    fireEvent.click(screen.getByTestId('class-join'))
    await waitFor(() => expect(joinClass).toHaveBeenCalledWith('p1', 'ABC 234'))
    await waitFor(() => expect(load).toHaveBeenCalled()) // the store re-reads the profile, which now carries the link
    rerender(<ClassLinkSection profile={linked} />)
    expect(screen.getByTestId('class-link-name')).toHaveTextContent('Ești în clasa „Clasa a III-a B”')
    expect(screen.queryByTestId('class-code')).toBeNull()
    // tells the child what is shared
    expect(screen.getByText(/nu numele tău, avatarul sau răspunsurile/)).toBeInTheDocument()
  })

  it.each([
    ['invalid-code', /Codul nu există/],
    ['already-used', /deja folosit/],
    ['offline', /Nu avem internet/],
  ] as const)('explains a "%s" failure kindly', async (code, text) => {
    api({ joinClass: vi.fn(async () => Promise.reject(new ClassroomError(code))) })
    render(<ClassLinkSection profile={base} />)
    fireEvent.change(screen.getByTestId('class-code'), { target: { value: 'ABC234' } })
    fireEvent.click(screen.getByTestId('class-join'))
    expect(await screen.findByTestId('class-error')).toHaveTextContent(text)
    expect(screen.getByTestId('class-code')).toBeInTheDocument() // can try again
  })

  it('leaving asks for confirmation first', async () => {
    const leaveClass = vi.fn(async () => {})
    api({ leaveClass })
    render(<ClassLinkSection profile={linked} />)
    fireEvent.click(screen.getByTestId('class-leave'))
    expect(leaveClass).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('class-leave-yes'))
    await waitFor(() => expect(leaveClass).toHaveBeenCalledWith('p1'))
    await waitFor(() => expect(load).toHaveBeenCalled())
  })
})
