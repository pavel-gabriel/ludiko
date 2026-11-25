import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { ChoiceItem, Item, Skill } from '@/engine/types'
import type { Mission } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { PUSH_STATE_KEY } from '@/services/pushAvailability'
import { useProfileStore } from '@/store/profileStore'
import { fakeLearner, resetFake, state, SUMMARY } from './helpers/fakeLearner'
import BitPage from '@/ui/learn/BitPage'
import LearnHomePage from '@/ui/learn/LearnHomePage'

/* The fake learner answers the same for every subject; pin the home to math so each tile appears once */
vi.mock('@/ui/learn/subjects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/learn/subjects')>()),
  LEARN_SUBJECTS: ['mat'],
}))

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

const markPlayedToday = vi.fn(async () => {})
vi.mock('@/services/pushService', () => ({ markPlayedToday: () => markPlayedToday() }))

/* Simple two-option choice items so tests can answer without knowing the generators */
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
        <Route path="/learn" element={<LearnHomePage />} />
        <Route path="/learn/bit/:subject/:index" element={<BitPage />} />
        <Route path="/learn/mission/:subject" element={<p>mission page</p>} />
        <Route path="/learn/check/:subject" element={<p>check page</p>} />
        <Route path="/profiles" element={<p>profile picker</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
async function answerCorrect() {
  fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
  await settle(1500)
}
const answerAll = async (n: number) => {
  for (let i = 0; i < n; i++) await answerCorrect()
}

/** review(3) + practice(5) warm up, new(6) is the island, check(5) the challenge */
const mission = (over: Partial<Mission> = {}): Mission => ({
  day: '2026-11-25',
  subject: 'mat',
  estimatedSeconds: 540,
  steps: [
    { kind: 'review', skillId: 'mat.count.10', itemCount: 3, done: false },
    { kind: 'check', skillId: 'mat.numrec.10', itemCount: 5, done: false },
    { kind: 'new', skillId: 'mat.add.10', itemCount: 6, done: false },
    { kind: 'practice', skillId: 'mat.sub.10', itemCount: 5, done: false },
  ],
  ...over,
})

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  vi.useFakeTimers()
  resetFake({
    placement: { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1, completedAt: 2, summary: SUMMARY },
    mission: mission(),
  })
  markPlayedToday.mockClear()
  localStorage.clear()
  useProfileStore.setState({ profiles: [profile], activeProfile: profile, loaded: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('/learn: Biții de azi', () => {
  it('shows a tile per bit with the kind name, "~3 min" and a tick on the finished ones', async () => {
    state.mission = mission({
      steps: mission().steps.map((s) => (s.kind === 'review' || s.kind === 'practice' ? { ...s, done: true } : s)),
    })
    renderAt('/learn')
    await settle()
    const card = screen.getByTestId('card-bits')
    expect(card).toHaveTextContent('Biții de azi')
    expect(screen.queryByTestId('card-mission')).toBeNull()

    const tiles = [0, 1, 2].map((i) => screen.getByTestId(`bit-${i}`))
    expect(tiles.map((t) => t.textContent)).toEqual([
      expect.stringContaining('Încălzirea'),
      expect.stringContaining('Insula zilei'),
      expect.stringContaining('Provocarea'),
    ])
    tiles.forEach((t, i) => {
      expect(t).toHaveTextContent('~3 min')
      expect(t).toHaveAttribute('href', `/learn/bit/mat/${i}`)
    })
    expect(screen.getByTestId('bit-0-tick')).toBeInTheDocument() // warm-up done
    expect(screen.queryByTestId('bit-1-tick')).toBeNull()
    expect(screen.queryByTestId('bit-2-tick')).toBeNull()
    expect(tiles[0]).toHaveAccessibleName(/Încălzirea, Gata/)
    expect(tiles[1]).toHaveAccessibleName(/Insula zilei, De făcut/)
    // the full mission path stays reachable
    expect(within(card).getByTestId('link-mission')).toHaveAttribute('href', '/learn/mission/mat')
  })

  it('shows only the bits there are (2 tiles) and celebrates when all are done', async () => {
    state.mission = mission({
      steps: [
        { kind: 'new', skillId: 'mat.add.10', itemCount: 6, done: true },
        { kind: 'check', skillId: 'mat.numrec.10', itemCount: 5, done: true },
      ],
      completedAt: 3,
    })
    renderAt('/learn')
    await settle()
    expect(screen.getByTestId('card-bits')).toHaveTextContent('Biții de azi sunt gata! Bravo!')
    expect(screen.getAllByTestId(/^bit-\d$/)).toHaveLength(2)
    expect(screen.getByTestId('bit-0-tick')).toBeInTheDocument()
    expect(screen.getByTestId('bit-1-tick')).toBeInTheDocument()
  })
})

describe('/learn/bit/:subject/:index', () => {
  it('runs the island bit in practice mode and records the mission step', async () => {
    renderAt('/learn/bit/mat/1')
    await settle()
    expect(screen.getByRole('heading', { name: 'Întrebarea 1' })).toBeInTheDocument()
    await answerAll(6)

    expect(fakeLearner.recordItemResult).toHaveBeenCalledTimes(6)
    expect(fakeLearner.recordItemResult).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ skillId: 'mat.add.10' }),
      expect.objectContaining({ correct: true }),
      { retry: false, mode: 'practice' },
    )
    expect(fakeLearner.applyMasteryCheck).not.toHaveBeenCalled()
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledTimes(1)
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledWith('p1', 'mat', '2026-11-25', 2, 1)

    expect(screen.getByRole('heading', { name: 'Bit terminat!' })).toBeInTheDocument()
    expect(screen.getByText('Încă un bit?')).toBeInTheDocument()
    // no subscription on this device: the push service is not even loaded
    expect(markPlayedToday).not.toHaveBeenCalled()
  })

  it('"Încă un bit?" goes to the next unfinished bit; "Gata pe azi" goes home', async () => {
    renderAt('/learn/bit/mat/1')
    await settle()
    await answerAll(6)
    fireEvent.click(screen.getByTestId('bit-another'))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/bit/mat/2')
    expect(screen.getByRole('heading', { name: 'Întrebarea 1' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gata pe azi' }))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledTimes(1) // leaving early saved nothing

    renderAt('/learn/bit/mat/1')
    await settle()
    await answerAll(6)
    fireEvent.click(screen.getByTestId('bit-stop'))
    await settle()
    expect(screen.getAllByTestId('where').at(-1)).toHaveTextContent('/learn')
  })

  it('runs a mastery check bit in check mode and applies the check before completing the step', async () => {
    state.checkPassed = true
    renderAt('/learn/bit/mat/2')
    await settle()
    await answerAll(5)

    expect(fakeLearner.recordItemResult).toHaveBeenCalledWith(
      'p1',
      expect.anything(),
      expect.anything(),
      { retry: false, mode: 'check' },
    )
    expect(fakeLearner.applyMasteryCheck).toHaveBeenCalledWith('p1', 'mat.numrec.10', [true, true, true, true, true], 'choice')
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledWith('p1', 'mat', '2026-11-25', 1, 1)
    expect(screen.getByText('Ai cucerit insula! Felicitări!')).toBeInTheDocument()
  })

  it('a bit with two mission steps plays both and completes each', async () => {
    renderAt('/learn/bit/mat/0')
    await settle()
    // review (3) + practice (5) are trimmed to 6 items in total: 3 + 3
    await answerAll(6)
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledTimes(2)
    expect(fakeLearner.completeMissionStep).toHaveBeenNthCalledWith(1, 'p1', 'mat', '2026-11-25', 0, 1)
    expect(fakeLearner.completeMissionStep).toHaveBeenNthCalledWith(2, 'p1', 'mat', '2026-11-25', 3, 1)
    expect(screen.getByRole('heading', { name: 'Bit terminat!' })).toBeInTheDocument()
  })

  it('finishing the last bit says so and offers only "Gata pe azi"', async () => {
    state.mission = mission({
      steps: [
        { kind: 'new', skillId: 'mat.add.10', itemCount: 6, done: false },
        { kind: 'check', skillId: 'mat.numrec.10', itemCount: 5, done: true },
      ],
    })
    renderAt('/learn/bit/mat/0')
    await settle()
    await answerAll(6)
    expect(screen.getByText('Ai făcut toți biții de azi. Ne vedem mâine!')).toBeInTheDocument()
    expect(screen.queryByTestId('bit-another')).toBeNull()
    expect(screen.getByTestId('bit-stop')).toBeInTheDocument()
  })

  it('tells the push service a bit was played, but only on a device with a subscription', async () => {
    localStorage.setItem(PUSH_STATE_KEY, JSON.stringify({ id: 'abc', hour: 17, lang: 'ro', active: true }))
    renderAt('/learn/bit/mat/1')
    await settle()
    await answerAll(6)
    await settle()
    expect(markPlayedToday).toHaveBeenCalledTimes(1)
  })

  it('sends a child without a placement to the check, and an unknown bit back to the bits', async () => {
    state.mission = undefined
    renderAt('/learn/bit/mat/0')
    await settle()
    expect(screen.getByRole('link', { name: 'Verifică-te!' })).toHaveAttribute('href', '/learn/check/mat')
    cleanup()

    state.mission = mission()
    renderAt('/learn/bit/mat/7')
    await settle()
    expect(screen.getByText(/Nu am găsit acest bit/)).toBeInTheDocument()
  })

  it('redirects a bad index or subject to /learn', async () => {
    renderAt('/learn/bit/mat/abc')
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
    cleanup()
    renderAt('/learn/bit/rom/0')
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
  })
})
