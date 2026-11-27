import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { ChoiceItem, Item, Skill } from '@/engine/types'
import type { PlanBit } from '@/learner'
import { useProfileStore } from '@/store/profileStore'
import type { ChildProfile } from '@/profiles/types'
import LearnHomeView from '@/ui/learn/LearnHomeView'
import SessionResults from '@/ui/session/SessionResults'
import ChallengePage from '@/ui/older/ChallengePage'
import ChoosePanel from '@/ui/older/ChoosePanel'
import PracticePage from '@/ui/session/PracticePage'
import { buildSummary } from '@/ui/session/sessionLogic'
import { getChallengeBest, getWeeklyGoal, recordBitDone } from '@/older/olderStore'
import { resetFake } from './helpers/fakeLearner'

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

/* Two-option choice items, answerable without knowing the generators */
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

const mk = (grade: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, id = `p${grade}`): ChildProfile => ({
  id,
  nickname: 'Ana',
  avatar: '🦊',
  grade,
  language: 'ro',
  createdAt: 1,
  updatedAt: 1,
  recoveryCode: 'AAAA-BBBB',
})

const planBits: PlanBit[] = [
  { index: 0, kind: 'warmup', day: '2026-11-25', steps: [], itemCount: 4, done: false, subject: 'mat', source: 'mission', bitIndex: 0 } as unknown as PlanBit,
  { index: 1, kind: 'island', day: '2026-11-25', steps: [], itemCount: 4, done: false, subject: 'rom', source: 'mission', bitIndex: 0 } as unknown as PlanBit,
]

const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

/** Tap an answer; after a wrong one, the "Mai departe" button moves on */
async function answer(right: boolean) {
  fireEvent.click(screen.getByRole('button', { name: right ? /^Bun/ : /^Rău/ }))
  await settle(1500)
  const next = screen.queryByRole('button', { name: 'Mai departe' })
  if (next) {
    fireEvent.click(next)
    await settle(1500)
  }
}

function Where() {
  return <div data-testid="where">{useLocation().pathname + useLocation().search}</div>
}

function home(grade: 2 | 6) {
  return render(
    <MemoryRouter>
      <LearnHomeView
        profile={{ id: `p${grade}`, nickname: 'Ana', avatar: '🦊', grade }}
        stars={3}
        playDays={2}
        plan={planBits}
        subjects={[
          { subject: 'mat', placement: 'done' },
          { subject: 'rom', placement: 'done' },
        ]}
      />
    </MemoryRouter>,
  )
}

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  localStorage.clear()
  resetFake()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('age-band copy on /learn', () => {
  it('grade VI: calm copy, mission names and the older tools; Ludi is optional', () => {
    home(6)
    expect(screen.getByText('Salut, Ana')).toBeInTheDocument()
    expect(screen.queryByText('Salut, Ana!')).toBeNull()
    expect(screen.getByText('Planul de azi')).toBeInTheDocument()
    expect(screen.getByTestId('plan-bit-0')).toHaveTextContent('Recapitulare')
    expect(screen.getByTestId('plan-bit-1')).toHaveTextContent('Capitol nou')
    expect(screen.getByText('Alege-ți singur')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-goal')).toBeInTheDocument()
    expect(screen.getByTestId('card-challenge')).toHaveAttribute('href', '/learn/challenge')
    // the mascot is off until the child turns it on
    expect(document.querySelector('header svg')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-mascot'))
    expect(document.querySelector('header svg')).not.toBeNull()
    expect(localStorage.getItem('ludiko-older-mascot-p6')).toBe('1')
  })

  it('grade II: the playful copy and none of the older tools', () => {
    home(2)
    expect(screen.getByText('Salut, Ana!')).toBeInTheDocument()
    expect(screen.getByText('Biții de azi')).toBeInTheDocument()
    expect(screen.getByTestId('plan-bit-1')).toHaveTextContent('Insula zilei')
    expect(screen.queryByText('Alege-ți singur')).toBeNull()
    expect(screen.queryByTestId('weekly-goal')).toBeNull()
    expect(screen.queryByTestId('card-challenge')).toBeNull()
    expect(document.querySelector('header svg')).not.toBeNull()
  })
})

describe('"Alege-ți singur"', () => {
  it('subject -> chapter -> Exersează / Testează-te, reusing /practice', () => {
    render(
      <MemoryRouter>
        <ChoosePanel subjects={['mat']} grade={6} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('pick-subject-mat')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-choose'))
    fireEvent.click(screen.getByTestId('pick-subject-mat'))
    const select = screen.getByTestId('pick-chapter') as HTMLSelectElement
    // chapters are grouped by grade and semester
    expect(select.querySelectorAll('optgroup').length).toBeGreaterThan(0)
    const first = select.querySelector('option[value]:not([value=""])') as HTMLOptionElement
    fireEvent.change(select, { target: { value: first.value } })
    expect(screen.getByTestId('pick-practice')).toHaveAttribute('href', `/practice/${first.value}?mode=practice`)
    expect(screen.getByTestId('pick-test')).toHaveAttribute('href', `/practice/${first.value}?mode=check&n=10`)
    expect(screen.getByTestId('pick-test')).toHaveTextContent('Testează-te')
  })

  it('a 10-item test ends with the estimated mark; practice shows stars only', async () => {
    vi.useFakeTimers()
    const p = mk(6)
    useProfileStore.setState({ profiles: [p], activeProfile: p, loaded: true })
    const skillId = (await import('@/engine/content/registry')).getAllSkills().find((s) => s.subject === 'mat')!.id
    render(
      <MemoryRouter initialEntries={[`/practice/${skillId}?mode=check&n=10`]}>
        <Routes>
          <Route path="/practice/:skillId" element={<PracticePage />} />
          <Route path="/learn" element={<p>learn home</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await settle()
    for (let i = 0; i < 10; i++) {
      // 8 right, 2 wrong
      await answer(i < 8)
    }
    expect(screen.getByTestId('estimated-mark')).toHaveTextContent('Nota estimată: 8,20')
    expect(screen.getByTestId('estimated-mark')).toHaveTextContent('Estimativă — nu e notă oficială.')
    expect(screen.getByRole('img', { name: /stele|stea/i })).toBeInTheDocument()
    // finishing counts towards the weekly goal
    expect(JSON.parse(localStorage.getItem('ludiko-older-bits-p6')!).n).toBe(1)
  })
})

describe('session results', () => {
  const summary = (mode: 'practice' | 'check') =>
    buildSummary({
      mode,
      completed: true,
      durationMs: 1000,
      itemsById: new Map(),
      attempts: [
        { itemId: 'a', skillId: 's', correct: true, timeMs: 1, retry: false },
        { itemId: 'b', skillId: 's', correct: true, timeMs: 1, retry: false },
        { itemId: 'c', skillId: 's', correct: false, timeMs: 1, retry: false },
        { itemId: 'd', skillId: 's', correct: true, timeMs: 1, retry: false },
      ],
    })
  const show = (mode: 'practice' | 'check', grade: number) =>
    render(
      <MemoryRouter>
        <SessionResults summary={summary(mode)} reward={null} profile={{ id: 'x', grade }} onAgain={() => {}} onDone={() => {}} />
      </MemoryRouter>,
    )
  it('grade VI check mode: mark, never practice', () => {
    show('check', 6)
    expect(screen.getByTestId('estimated-mark')).toHaveTextContent('Nota estimată: 7,75')
    cleanup()
    show('practice', 6)
    expect(screen.queryByTestId('estimated-mark')).toBeNull()
    expect(screen.getByText('Rezultat bun')).toBeInTheDocument() // calm tier copy, still stars
  })
  it('grade I: no mark, the playful copy', () => {
    show('check', 1)
    expect(screen.queryByTestId('estimated-mark')).toBeNull()
    expect(screen.queryByText('Rezultat bun')).toBeNull()
    expect(document.querySelector('main svg')).not.toBeNull() // Ludi is part of the younger band's results
  })
})

describe('weekly goal', () => {
  it('the child sets 3/5/7 and sees progress that only goes up', () => {
    recordBitDone('p6')
    recordBitDone('p6')
    home(6)
    fireEvent.click(screen.getByTestId('goal-5'))
    expect(getWeeklyGoal('p6')).toBe(5)
    expect(screen.getByTestId('goal-progress')).toHaveTextContent('2 din 5 sesiuni săptămâna asta')
    expect(screen.queryByTestId('goal-reached')).toBeNull()
  })
  it('reaching the goal is celebrated calmly', () => {
    localStorage.setItem('ludiko-older-goal-p6', '3')
    for (let i = 0; i < 3; i++) recordBitDone('p6')
    home(6)
    expect(screen.getByTestId('goal-reached')).toHaveTextContent('Obiectiv atins')
  })
})

describe('Provocarea zilei', () => {
  it('5 mixed items, a mark, best of the week kept locally', async () => {
    vi.useFakeTimers()
    const p = mk(6)
    useProfileStore.setState({ profiles: [p], activeProfile: p, loaded: true })
    render(
      <MemoryRouter initialEntries={['/learn/challenge']}>
        <Routes>
          <Route path="/learn/challenge" element={<ChallengePage />} />
          <Route path="/learn" element={<p>learn home</p>} />
        </Routes>
        <Where />
      </MemoryRouter>,
    )
    await settle()
    expect(screen.getByTestId('challenge-intro')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('challenge-timer-toggle'))
    fireEvent.click(screen.getByTestId('challenge-start'))
    await settle()
    expect(screen.getByTestId('challenge-chrono')).toBeInTheDocument()
    for (let i = 0; i < 5; i++) {
      await answer(i < 4)
    }
    expect(screen.getByTestId('challenge-done')).toBeInTheDocument()
    expect(screen.getByTestId('estimated-mark')).toHaveTextContent('Nota estimată: 8,20')
    expect(screen.getByTestId('challenge-time')).toBeInTheDocument()
    expect(screen.getByTestId('challenge-newbest')).toBeInTheDocument()
    expect(getChallengeBest('p6')).toBe(8.2)
  })
})
