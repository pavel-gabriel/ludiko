import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { Item, ChoiceItem, Skill } from '@/engine/types'
import type { Mission, SkillMapNode } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { fakeLearner, resetFake, state, SUMMARY } from './helpers/fakeLearner'
import LearnHomePage from '@/ui/learn/LearnHomePage'
import PlacementPage from '@/ui/learn/PlacementPage'
import MissionPage from '@/ui/learn/MissionPage'
import SkillMapPage from '@/ui/learn/SkillMapPage'
import ParentPage from '@/ui/learn/ParentPage'
import HomePage from '@/components/lobby/HomePage'

/* These tests exercise one subject; the fake learner returns the same placement for any subject */
vi.mock('@/ui/learn/subjects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/learn/subjects')>()),
  LEARN_SUBJECTS: ['mat'],
}))

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

/* Sessions get simple two-option choice items so tests can answer them without knowing the generators */
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
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearnHomePage />} />
        <Route path="/learn/check/:subject" element={<PlacementPage />} />
        <Route path="/learn/mission/:subject" element={<MissionPage />} />
        <Route path="/learn/map/:subject" element={<SkillMapPage />} />
        <Route path="/learn/parent" element={<ParentPage />} />
        <Route path="/profiles" element={<p>profile picker</p>} />
        <Route path="/practice/:skillId" element={<p>practice page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

/** Let promises settle and timers (feedback delays) run */
const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

/** Answer the current question correctly and wait out the feedback delay */
async function answerCorrect() {
  fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
  await settle(1500)
}
const answerAll = async (n: number) => {
  for (let i = 0; i < n; i++) await answerCorrect()
}

const mission = (over: Partial<Mission> = {}): Mission => ({
  day: '2026-11-25',
  subject: 'mat',
  estimatedSeconds: 540,
  steps: [
    { kind: 'new', skillId: 'mat.count.10', itemCount: 2, done: false },
    { kind: 'check', skillId: 'mat.numrec.10', itemCount: 2, done: false },
  ],
  ...over,
})

const probe = (skillId: string, progress: number) => ({ done: false as const, skillId, itemCount: 2, progress })

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  // jsdom has no matchMedia (Confetti asks for reduced motion)
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

describe('/learn home', () => {
  it('without a placement the plan offers a short check, and "Toate materiile" has "Verifică-te!" and the map', async () => {
    renderAt('/learn')
    await settle()
    expect(screen.getByText('Salut, Matei!')).toBeInTheDocument()
    const chunk = screen.getByTestId('plan-bit-0')
    expect(chunk).toHaveAttribute('data-source', 'placement')
    expect(chunk).toHaveTextContent('Ce știi?')
    expect(chunk).toHaveAttribute('href', '/learn/check/mat?plan=1')
    // the per-subject cards live under "Toate materiile", collapsed until asked for
    expect(screen.queryByTestId('card-check')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-subjects'))
    const check = screen.getByTestId('card-check')
    expect(check).toHaveTextContent('Verifică-te!')
    expect(check).toHaveAttribute('href', '/learn/check/mat')
    expect(screen.queryByTestId('card-mission')).toBeNull()
    expect(screen.getByTestId('card-map')).toHaveAttribute('href', '/learn/map/mat')
    expect(screen.queryByText(/test|eșec|rămas în urmă/i)).toBeNull()
  })

  it('offers to continue a started check', async () => {
    state.placement = { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1 }
    renderAt('/learn')
    await settle()
    fireEvent.click(screen.getByTestId('toggle-subjects'))
    expect(screen.getByTestId('card-check')).toHaveTextContent('Continuăm aventura')
  })

  it("with a placement shows today's plan, the mission under \"Toate materiile\", stars and the gentle streak", async () => {
    state.placement = { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1, completedAt: 2, summary: SUMMARY }
    state.mission = mission({ steps: [{ ...mission().steps[0], done: true }, mission().steps[1]] })
    state.summary.playDaysThisWeek = 3
    renderAt('/learn')
    await settle()
    const card = screen.getByTestId('card-plan')
    expect(card).toHaveTextContent('Biții de azi')
    expect(screen.getByTestId('plan-bit-0')).toHaveAttribute('href', '/learn/bit/mat/0?plan=1')
    expect(screen.queryByTestId('card-check')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-subjects'))
    expect(screen.getByTestId('card-mission')).toHaveAttribute('href', '/learn/mission/mat')
    expect(screen.queryByTestId('card-check')).toBeNull()
    expect(screen.getByTestId('streak')).toHaveTextContent('3 zile de joacă')
    expect(screen.getByTestId('link-parents')).toHaveAttribute('href', '/learn/parent')
  })

  it('never shows a reset message when there were no play days', async () => {
    renderAt('/learn')
    await settle()
    expect(screen.getByTestId('streak')).toHaveTextContent('Hai să ne jucăm azi!')
  })

  it('sends a visitor without an active profile to the profile picker', async () => {
    useProfileStore.setState({ activeProfile: null })
    renderAt('/learn')
    await settle()
    expect(screen.getByText('profile picker')).toBeInTheDocument()
  })

  it('is reachable from the main home page', async () => {
    renderAt('/')
    await settle()
    fireEvent.click(screen.getByTestId('learn-entry'))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
  })
})

describe('/learn/check/:subject (placement)', () => {
  it('runs the probes, records each one, advances, and ends in a child-safe celebration', async () => {
    state.probes = [probe('mat.count.10', 0.2), probe('mat.add.10', 0.6)]
    renderAt('/learn/check/mat')
    await settle()
    expect(screen.getByRole('heading', { name: 'Hai să vedem ce știi deja!' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByRole('heading', { name: 'Întrebarea 1' })).toBeInTheDocument()

    await answerAll(2)
    expect(fakeLearner.placementRecord).toHaveBeenCalledWith('p1', 'mat', 'mat.count.10', [true, true])
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
    expect(screen.getByRole('heading', { name: 'Întrebarea 1' })).toBeInTheDocument()

    await answerAll(2)
    expect(fakeLearner.placementRecord).toHaveBeenLastCalledWith('p1', 'mat', 'mat.add.10', [true, true])

    // celebration: no level statement, no score
    expect(screen.getByRole('heading', { name: 'Bravo, exploratorule!' })).toBeInTheDocument()
    expect(screen.getByText('Ți-am pregătit insulele de explorat!')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/nivel|clasa|competen/i)
    expect(screen.getByTestId('sticker-unlock')).toBeInTheDocument()

    // every answer was recorded as a placement attempt, none as a retry
    expect(fakeLearner.recordItemResult).toHaveBeenCalledTimes(4)
    expect(fakeLearner.recordItemResult).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ skillId: 'mat.count.10' }),
      expect.objectContaining({ correct: true }),
      { retry: false, mode: 'placement' },
    )

    fireEvent.click(screen.getByRole('button', { name: /Pentru părinți/ }))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/parent')
  })

  it('resumes: a started check says "Continuăm aventura!" and picks up where the service says', async () => {
    state.placement = { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1 }
    state.probes = [probe('mat.add.10', 0.5)]
    renderAt('/learn/check/mat')
    await settle()
    expect(screen.getByRole('heading', { name: 'Continuăm aventura!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuăm' }))
    await settle()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('leaving mid-probe goes home without recording a half probe (so it resumes)', async () => {
    state.probes = [probe('mat.count.10', 0.2)]
    renderAt('/learn/check/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Ieși din exercițiu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gata pe azi' }))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
    expect(fakeLearner.placementRecord).not.toHaveBeenCalled()
  })

  it('offers a rest after about three minutes, and the child may carry on', async () => {
    state.probes = [probe('mat.count.10', 0.2), probe('mat.add.10', 0.6)]
    renderAt('/learn/check/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    await answerCorrect()
    act(() => void vi.setSystemTime(Date.now() + 4 * 60 * 1000))
    await answerCorrect()

    expect(screen.getByRole('heading', { name: 'Gata pentru azi?' })).toBeInTheDocument()
    expect(screen.getByText(/Ai făcut o treabă grozavă/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mai vreau puțin' }))
    await settle()
    expect(screen.getByRole('heading', { name: 'Întrebarea 1' })).toBeInTheDocument()
    expect(fakeLearner.placementNext).toHaveBeenCalledTimes(2)
  })

  it('"Gata pentru azi" on the break leaves to home', async () => {
    state.probes = [probe('mat.count.10', 0.2), probe('mat.add.10', 0.6)]
    renderAt('/learn/check/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    act(() => void vi.setSystemTime(Date.now() + 4 * 60 * 1000))
    await answerAll(2)
    fireEvent.click(screen.getByRole('button', { name: /Gata pentru azi\. Continuăm mâine/ }))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
  })
})

describe('/learn/check/:subject?plan=1 (a placement chunk as a bit of the plan)', () => {
  it('is introduced as "Hai să vedem ce știi la Matematică!" and ends in a bit celebration with the next plan bit', async () => {
    state.probes = [probe('mat.count.10', 0.2), probe('mat.add.10', 0.6)]
    state.plan = {
      day: '2026-11-25',
      bits: [
        { index: 0, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: true, subject: 'mat', source: 'placement' },
        { index: 1, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: false, subject: 'rom', source: 'placement' },
      ],
    }
    renderAt('/learn/check/mat?plan=1')
    await settle()
    expect(screen.getByRole('heading', { name: 'Hai să vedem ce știi la Matematică!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    await answerAll(2)
    // the chunk is done: recorded, celebrated, and the next bit of the plan is offered (not the whole placement)
    expect(fakeLearner.placementRecord).toHaveBeenCalledWith('p1', 'mat', 'mat.count.10', [true, true])
    expect(screen.getByTestId('bit-done')).toBeInTheDocument()
    expect(fakeLearner.placementNext).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('bit-another'))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/check/rom')
  })

  it('keeps asking until the chunk is done', async () => {
    state.probes = [probe('mat.count.10', 0.2), probe('mat.add.10', 0.6), probe('mat.sub.10', 0.8)]
    state.plan = {
      day: '2026-11-25',
      bits: [{ index: 0, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: false, subject: 'mat', source: 'placement' }],
    }
    renderAt('/learn/check/mat?plan=1')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    await answerAll(2)
    expect(screen.queryByTestId('bit-done')).toBeNull()
    expect(fakeLearner.placementNext).toHaveBeenCalledTimes(2)
  })
})

describe('/learn/mission/:subject', () => {
  it('sends a child without a placement to the check', async () => {
    renderAt('/learn/mission/mat')
    await settle()
    expect(screen.getByRole('heading', { name: 'Mai întâi, hai să vedem ce știi!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verifică-te!' })).toHaveAttribute('href', '/learn/check/mat')
  })

  it('shows kid-friendly step labels and only lets the next step be tapped', async () => {
    state.mission = mission({
      steps: [
        { kind: 'review', skillId: 'mat.count.10', itemCount: 2, done: true },
        { kind: 'new', skillId: 'mat.add.10', itemCount: 2, done: false },
        { kind: 'practice', skillId: 'mat.sub.10', itemCount: 2, done: false },
        { kind: 'check', skillId: 'mat.numrec.10', itemCount: 2, done: false },
      ],
    })
    renderAt('/learn/mission/mat')
    await settle()
    const path = screen.getByTestId('treasure-path')
    for (const label of ['Ne amintim', 'Insulă nouă', 'Antrenament', 'Provocarea']) {
      expect(within(path).getByText(label)).toBeInTheDocument()
    }
    const buttons = within(path).getAllByRole('button')
    expect(buttons.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false, true, true])
  })

  it('completes a practice step with its accuracy, records attempts with mode and retry, and moves on', async () => {
    state.mission = mission()
    renderAt('/learn/mission/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Pornește: Insulă nouă/ }))
    await settle()
    await answerAll(2)

    expect(fakeLearner.recordItemResult).toHaveBeenCalledTimes(2)
    expect(fakeLearner.recordItemResult).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ skillId: 'mat.count.10' }),
      expect.objectContaining({ correct: true }),
      { retry: false, mode: 'practice' },
    )
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledWith('p1', 'mat', '2026-11-25', 0, 1)
    expect(fakeLearner.applyMasteryCheck).not.toHaveBeenCalled()

    expect(screen.getByRole('heading', { name: 'Pas terminat!' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }))
    await settle()
    const next = screen.getByTestId('step-1').querySelector('button')!
    expect(next).not.toBeDisabled()
  })

  it('applies the mastery check for the challenge step, then completes it, then the mission', async () => {
    state.mission = mission({ steps: [{ kind: 'check', skillId: 'mat.numrec.10', itemCount: 2, done: false }] })
    renderAt('/learn/mission/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Pornește: Provocarea/ }))
    await settle()
    await answerAll(2)

    expect(fakeLearner.recordItemResult).toHaveBeenCalledWith(
      'p1',
      expect.anything(),
      expect.anything(),
      { retry: false, mode: 'check' },
    )
    expect(fakeLearner.applyMasteryCheck).toHaveBeenCalledWith('p1', 'mat.numrec.10', [true, true], 'choice')
    expect(fakeLearner.completeMissionStep).toHaveBeenCalledWith('p1', 'mat', '2026-11-25', 0, 1)
    expect(screen.getByText('Ai cucerit insula! Felicitări!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }))
    await settle()
    expect(screen.getByRole('heading', { name: 'Misiune îndeplinită!' })).toBeInTheDocument()
  })

  it('stays kind when a mastery check is not passed yet', async () => {
    state.checkPassed = false
    state.mission = mission({ steps: [{ kind: 'check', skillId: 'mat.numrec.10', itemCount: 2, done: false }] })
    renderAt('/learn/mission/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Pornește: Provocarea/ }))
    await settle()
    await answerAll(2)
    expect(screen.getByText('Aproape! Mai exersăm împreună și o cucerești.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/ratat|eșuat|greșit/i)
  })

  it('a finished mission opens on the "mission accomplished" screen', async () => {
    state.mission = mission({
      completedAt: 5,
      steps: mission().steps.map((s) => ({ ...s, done: true })),
    })
    renderAt('/learn/mission/mat')
    await settle()
    expect(screen.getByRole('heading', { name: 'Misiune îndeplinită!' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mai explorez harta/ })).toBeInTheDocument()
  })
})

describe('/learn/map/:subject', () => {
  const node = (skillId: string, over: Partial<SkillMapNode>): SkillMapNode => ({
    skillId,
    grade: 0,
    semester: 1,
    state: 'unknown',
    pMastery: 0,
    prerequisites: [],
    unlocked: true,
    dueForReview: false,
    ...over,
  })

  it('renders every state with icon and label, and only unlocked islands are links', async () => {
    state.map = [
      node('mat.count.10', { state: 'mastered' }),
      node('mat.numrec.10', { state: 'practised' }),
      node('mat.compare.10', { state: 'learning' }),
      node('mat.add.10', { state: 'gap' }),
      node('mat.sub.10', { state: 'practised', dueForReview: true }),
      node('mat.count.20', { grade: 1, unlocked: false }),
    ]
    renderAt('/learn/map/mat')
    await settle()
    // hidden (locked) islands stay out of the route until asked for
    expect(screen.queryByTestId('island-mat.count.20')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-locked'))

    const expected: Record<string, string> = {
      'mat.count.10': 'mastered',
      'mat.numrec.10': 'practised',
      'mat.compare.10': 'learning',
      'mat.add.10': 'new',
      'mat.sub.10': 'review',
      'mat.count.20': 'locked',
    }
    for (const [id, st] of Object.entries(expected)) {
      expect(screen.getByTestId(`island-${id}`)).toHaveAttribute('data-state', st)
    }

    const open = screen.getByTestId('island-mat.add.10')
    expect(open.tagName).toBe('A')
    expect(open).toHaveAttribute('href', '/practice/mat.add.10')
    expect(open).toHaveTextContent('Insulă nouă')

    const locked = screen.getByTestId('island-mat.count.20')
    expect(locked.tagName).not.toBe('A')
    expect(locked.closest('a')).toBeNull()
    expect(locked).toHaveAttribute('aria-disabled', 'true')
    expect(locked).toHaveTextContent('Ascunsă încă')

    // grouped by grade
    expect(screen.getByRole('heading', { name: /Clasa pregătitoare/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Clasa I$/ })).toBeInTheDocument()

    fireEvent.click(open)
    await settle()
    expect(screen.getByText('practice page')).toBeInTheDocument()
  })

  it('has a friendly message for an empty map', async () => {
    renderAt('/learn/map/mat')
    await settle()
    expect(screen.getByText('Harta se pregătește. Revino curând!')).toBeInTheDocument()
  })
})

describe('/learn/parent', () => {
  beforeEach(() => {
    state.summary = {
      profileId: 'p1',
      subjects: [
        {
          subject: 'mat',
          placement: SUMMARY,
          improved: ['mat.count.20'],
          nextUp: ['mat.add.carry.20'],
          masteredCount: 7,
          totalSkills: 18,
        },
      ],
      playDaysThisWeek: 4,
      tip: { ro: 'Numărați banii la cumpărături.', en: 'Count the money when shopping.' },
    }
  })

  it('shows the level statement, progress, next steps, play days and the tip in plain language', async () => {
    renderAt('/learn/parent')
    await settle()
    expect(screen.getByTestId('level-statement')).toHaveTextContent(SUMMARY.statement.ro)
    expect(screen.getByTestId('improved')).toHaveTextContent('Numărarea până la 20')
    expect(screen.getByTestId('next-up')).toHaveTextContent('Adunarea până la 20, cu trecere peste ordin')
    expect(screen.getByText('Insule cucerite: 7 din 18')).toBeInTheDocument()
    expect(screen.getByTestId('play-days')).toHaveTextContent('4 din 7')
    expect(screen.getByTestId('tip')).toHaveTextContent('Numărați banii la cumpărături.')
  })

  it('shows the English statement when the app is in English', async () => {
    await i18n.changeLanguage('en')
    try {
      renderAt('/learn/parent')
      await settle()
      expect(screen.getByTestId('level-statement')).toHaveTextContent(SUMMARY.statement.en)
    } finally {
      cleanup()
      await i18n.changeLanguage('ro')
    }
  })

  it('invites to the check when none was done', async () => {
    state.summary.subjects[0].placement = undefined
    renderAt('/learn/parent')
    await settle()
    expect(screen.queryByTestId('level-statement')).toBeNull()
    expect(screen.getByRole('link', { name: 'Începe verificarea' })).toHaveAttribute('href', '/learn/check/mat')
  })

  it('redoing the check asks first, then resets and starts it again', async () => {
    renderAt('/learn/parent')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Refă verificarea/ }))
    const dialog = screen.getByRole('dialog')
    // "no" keeps everything
    fireEvent.click(within(dialog).getByRole('button', { name: 'Nu, las-o așa' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fakeLearner.resetPlacement).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Refă verificarea/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Da, o refacem' }))
    await settle()
    expect(fakeLearner.resetPlacement).toHaveBeenCalledWith('p1', 'mat')
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/check/mat')
  })
})
