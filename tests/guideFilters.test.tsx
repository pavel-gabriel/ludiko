import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { ChoiceItem, Item, Skill } from '@/engine/types'
import type { SkillMapNode } from '@/learner'
import type { ChildProfile, ProfileProgress } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { fakeLearner, resetFake, state, SUMMARY } from './helpers/fakeLearner'
import FilterChips from '@/ui/common/FilterChips'
import { PREF_PREFIX, resetPrefMemory } from '@/ui/common/devicePref'
import { filterCounts, type MapIsland } from '@/ui/learn/SkillMapView'
import { ITEM_GUIDE_TIMES } from '@/ui/guide/guideStore'
import ItemView from '@/ui/items/ItemView'
import HomePage from '@/components/lobby/HomePage'
import LearnHomePage from '@/ui/learn/LearnHomePage'
import PlacementPage from '@/ui/learn/PlacementPage'
import SkillMapPage from '@/ui/learn/SkillMapPage'

vi.mock('@/ui/learn/subjects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/ui/learn/subjects')>()),
  LEARN_SUBJECTS: ['mat', 'rom'],
}))

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

/* The landing card reads local progress directly (no learner service): script it */
const progress = vi.hoisted(() => ({ placements: {} as ProfileProgress['placements'] }))
vi.mock('@/profiles/profileService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/profiles/profileService')>()),
  getProgress: vi.fn(async (profileId: string) => ({
    profileId,
    skills: {},
    stars: 0,
    stickers: [],
    playDays: [],
    placements: progress.placements,
  })),
}))

vi.mock('@/ui/session/itemSource', () => ({
  getSessionItems: (skill: Skill, count: number): Item[] =>
    Array.from({ length: count }, (_, i): ChoiceItem => choice(`${skill.id}#${i + 1}`, skill.id)),
  skillHasItems: () => true,
}))

function choice(id: string, skillId = 'mat.count.10'): ChoiceItem {
  return {
    id,
    skillId,
    type: 'choice',
    difficulty: 1,
    reviewStatus: 'beta',
    provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
    prompt: { ro: `Întrebarea ${id}` },
    options: [
      { id: 'ok', text: { ro: 'Bun' } },
      { id: 'no', text: { ro: 'Rău' } },
    ],
    correctId: 'ok',
  } as ChoiceItem
}

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
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learn" element={<LearnHomePage />} />
        <Route path="/learn/check/:subject" element={<PlacementPage />} />
        <Route path="/learn/map/:subject" element={<SkillMapPage />} />
        <Route path="/profiles" element={<p>profile picker</p>} />
        <Route path="/practice/:skillId" element={<p>practice page</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

const settle = (ms = 0) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

/** Lazy chunks resolve on real promises: let fake time run until the element shows up */
async function waitForTestId(id: string) {
  for (let i = 0; i < 40 && !screen.queryByTestId(id); i++) await settle(50)
  return screen.getByTestId(id)
}

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

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  await import('@/ui/learn/LevelCheckCta') // warm the lazy chunk: fake timers cannot wait for a module load
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetPrefMemory()
  resetFake()
  progress.placements = {}
  useProfileStore.setState({ profiles: [profile], activeProfile: profile, loaded: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Close the first-run coach marks if they are up */
function skipGuide() {
  const skip = screen.queryByTestId('coach-skip')
  if (skip) fireEvent.click(skip)
}

describe('FilterChips', () => {
  it('is a group of toggle buttons with counts; one is pressed', () => {
    const onChange = vi.fn()
    render(
      <FilterChips
        label="Arată"
        value="b"
        onChange={onChange}
        testId="f"
        options={[
          { value: 'a', label: 'Toate', count: 5 },
          { value: 'b', label: 'Gata', count: 2 },
        ]}
      />,
    )
    const group = screen.getByRole('group', { name: 'Arată' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(screen.getByTestId('f-a')).toHaveTextContent('Toate5')
    expect(screen.getByTestId('f-a').className).toMatch(/min-h-\[44px\]/)
    fireEvent.click(screen.getByTestId('f-a'))
    expect(onChange).toHaveBeenCalledWith('a')
  })
})

describe('island map: route, filters and the locked toggle', () => {
  const islands = (): SkillMapNode[] => [
    node('mat.count.10', { state: 'mastered', known: true, route: 0 }),
    node('mat.numrec.10', { state: 'mastered', route: 1 }),
    node('mat.compare.10', { state: 'learning', route: 2 }),
    node('mat.add.10', { state: 'unknown', route: 3, next: true }),
    node('mat.sub.10', { state: 'gap', route: 4, next: false }),
    node('mat.count.20', { grade: 1, unlocked: false, route: 5, next: false }),
    node('mat.add.nocarry.20', { grade: 1, unlocked: false, route: 6, next: false }),
  ]

  it('counts islands per filter (locked only under "Toate" when shown)', () => {
    const list = islands().map((n) => ({ ...n, title: n.skillId })) as MapIsland[]
    expect(filterCounts(list, false)).toEqual({ all: 5, todo: 2, doing: 1, done: 2, locked: 2 })
    expect(filterCounts(list, true).all).toBe(7)
  })

  it('shows the next island, numbered stops, "Știi deja" for checked ones, and filters by state', async () => {
    state.map = islands()
    renderAt('/learn/map/mat')
    await settle()
    skipGuide()

    const next = screen.getByTestId('next-island')
    expect(next).toHaveAttribute('href', '/practice/mat.add.10')
    expect(next).toHaveTextContent('Următoarea insulă')
    expect(screen.getByTestId('island-mat.add.10')).toHaveAttribute('data-next', 'true')
    expect(screen.getByTestId('island-mat.count.10')).toHaveAttribute('data-state', 'known')
    expect(screen.getByTestId('island-mat.count.10')).toHaveTextContent('Știi deja')
    expect(screen.getByTestId('island-mat.numrec.10')).toHaveAttribute('data-state', 'mastered')
    expect(screen.getByTestId('island-mat.add.10')).toHaveAccessibleName(/^Oprirea 4:/)

    expect(screen.getByTestId('map-filter-all')).toHaveTextContent('5')
    expect(screen.getByTestId('map-filter-done')).toHaveTextContent('2')
    fireEvent.click(screen.getByTestId('map-filter-done'))
    expect(screen.getByTestId('map-filter-done')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('island-mat.add.10')).toBeNull()
    expect(screen.getByTestId('island-mat.count.10')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('map-filter-locked'))
    expect(screen.getByTestId('island-mat.count.20')).toHaveAttribute('data-state', 'locked')
    expect(screen.queryByTestId('island-mat.count.10')).toBeNull()
  })

  it('remembers "show hidden islands" on this device', async () => {
    state.map = islands()
    renderAt('/learn/map/mat')
    await settle()
    skipGuide()
    expect(screen.queryByTestId('island-mat.count.20')).toBeNull()
    fireEvent.click(screen.getByTestId('toggle-locked'))
    expect(screen.getByTestId('island-mat.count.20')).toBeInTheDocument()
    expect(localStorage.getItem(`${PREF_PREFIX}filters.map.showLocked`)).toBe('1')

    cleanup()
    resetPrefMemory()
    renderAt('/learn/map/mat')
    await settle()
    expect(screen.getByTestId('toggle-locked')).toBeChecked()
    expect(screen.getByTestId('island-mat.count.20')).toBeInTheDocument()
  })

  it('still works when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const spySet = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    try {
      state.map = islands()
      renderAt('/learn/map/mat')
      await settle()
      skipGuide()
      fireEvent.click(screen.getByTestId('toggle-locked'))
      expect(screen.getByTestId('island-mat.count.20')).toBeInTheDocument()
    } finally {
      spy.mockRestore()
      spySet.mockRestore()
    }
  })

  it('asks for the level check first when the subject was not checked', async () => {
    state.map = islands()
    renderAt('/learn/map/mat')
    await settle()
    skipGuide()
    expect(screen.getByTestId('map-check-first')).toHaveAttribute('href', '/learn/check/mat')
  })
})

describe('first-run guide (coach marks)', () => {
  it('shows once per profile on /learn, can be skipped, and "?" shows it again', async () => {
    renderAt('/learn')
    await settle()
    const bubble = screen.getByTestId('coach-bubble')
    expect(bubble).toHaveAttribute('data-step', 'check-cta')
    expect(within(bubble).getByText(/Începe de aici/)).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('coach-next'))
    expect(screen.getByTestId('coach-bubble')).toHaveAttribute('data-step', 'plan')
    fireEvent.click(screen.getByTestId('coach-skip'))
    expect(screen.queryByTestId('coach-marks')).toBeNull()

    cleanup()
    renderAt('/learn')
    await settle()
    expect(screen.queryByTestId('coach-marks')).toBeNull()
    fireEvent.click(screen.getByTestId('guide-help'))
    expect(screen.getByTestId('coach-marks')).toBeInTheDocument()
    // walking to the end closes it
    for (let i = 0; i < 6 && screen.queryByTestId('coach-next'); i++) fireEvent.click(screen.getByTestId('coach-next'))
    expect(screen.queryByTestId('coach-marks')).toBeNull()
  })

  it('is per profile: another child sees it too', async () => {
    renderAt('/learn')
    await settle()
    skipGuide()
    cleanup()
    const other = { ...profile, id: 'p2', nickname: 'Ana' }
    useProfileStore.setState({ profiles: [profile, other], activeProfile: other, loaded: true })
    renderAt('/learn')
    await settle()
    expect(screen.getByTestId('coach-marks')).toBeInTheDocument()
  })

  it('the map has its own guide pointing at the next island', async () => {
    state.map = [node('mat.count.10', { route: 0, next: true })]
    renderAt('/learn/map/mat')
    await settle()
    expect(screen.getByTestId('coach-bubble')).toHaveAttribute('data-step', 'next-island')
    expect(screen.getByTestId('coach-bubble')).toHaveTextContent('Apasă pe o insulă ca să te joci')
  })
})

describe('item type how-to line', () => {
  it(`shows under the prompt the first ${ITEM_GUIDE_TIMES} times a type is seen, then gets out of the way`, () => {
    for (let i = 0; i < ITEM_GUIDE_TIMES + 1; i++) {
      render(<ItemView item={choice(`c${i}`)} onAnswer={() => {}} />)
      if (i < ITEM_GUIDE_TIMES) expect(screen.getByTestId('item-guide')).toHaveTextContent('Apasă pe răspunsul bun.')
      else expect(screen.queryByTestId('item-guide')).toBeNull()
      cleanup()
    }
  })

  it('uses shorter text for older kids', () => {
    useProfileStore.setState({ activeProfile: { ...profile, id: 'big', grade: 7 } })
    render(<ItemView item={choice('b1')} onAnswer={() => {}} />)
    expect(screen.getByTestId('item-guide')).toHaveTextContent('Alege răspunsul corect.')
  })
})

describe('landing page: the level check is the obvious first step', () => {
  it('a profile without finished checks gets "Hai să vedem ce știi!" with progress per subject', async () => {
    progress.placements = {
      mat: { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1, completedAt: 2, summary: SUMMARY },
    }
    renderAt('/')
    await settle()
    const card = await waitForTestId('landing-check')
    expect(card).toHaveTextContent('Hai să vedem ce știi!')
    expect(screen.getByTestId('landing-check-count')).toHaveTextContent('Verificate: 1 din 2')
    expect(screen.getByTestId('landing-check-mat')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('landing-check-rom')).toHaveAttribute('data-state', 'none')
    const go = screen.getByTestId('landing-check-go')
    expect(go).toHaveAttribute('href', '/learn/check/rom')
    expect(go).toHaveTextContent('Începe cu Limba română')
    // no wall: free play stays right there
    expect(screen.getByTestId('play-solo')).toBeInTheDocument()
  })

  it('resumes a started check first', async () => {
    progress.placements = { rom: { subject: 'rom', target: { grade: 2, semester: 1 }, state: {}, startedAt: 1, updatedAt: 1 } }
    renderAt('/')
    await settle()
    expect(await waitForTestId('landing-check-go')).toHaveTextContent('Continuă la Limba română')
  })

  it('disappears once every subject is checked', async () => {
    const done = (subject: 'mat' | 'rom') => ({ subject, target: { grade: 2 as const, semester: 1 as const }, state: {}, startedAt: 1, updatedAt: 1, completedAt: 2, summary: SUMMARY })
    progress.placements = { mat: done('mat'), rom: done('rom') }
    renderAt('/')
    for (let i = 0; i < 20; i++) await settle(50)
    expect(screen.queryByTestId('landing-check')).toBeNull()
    expect(screen.getByTestId('learn-entry')).toBeInTheDocument()
  })

  it('a first visit without any profile is invited to make one', async () => {
    useProfileStore.setState({ profiles: [], activeProfile: null, loaded: true })
    renderAt('/')
    await settle()
    expect(screen.getByTestId('landing-welcome')).toHaveTextContent('Bun venit la Ludiko!')
    fireEvent.click(screen.getByTestId('landing-welcome-go'))
    expect(screen.getByTestId('where')).toHaveTextContent('/profiles')
  })

  it('/learn shows the same check progress above the plan', async () => {
    renderAt('/learn')
    await settle()
    skipGuide()
    expect(screen.getByTestId('check-progress')).toHaveTextContent('Verificate: 0 din 2')
    expect(screen.getByTestId('check-progress-go')).toHaveAttribute('href', '/learn/check/mat')
  })
})

describe('after a check: straight into the plan, or the next subject', () => {
  it('offers "Vezi planul de azi" and "Acum hai la Limba română"', async () => {
    // mat finishes now; rom has no check yet
    fakeLearner.getPlacement.mockImplementation(async (_p: string, subject: string) =>
      subject === 'rom' ? undefined : state.placement ? JSON.parse(JSON.stringify(state.placement)) : undefined,
    )
    state.probes = [{ done: false, skillId: 'mat.count.10', itemCount: 1, progress: 0.5 }]
    renderAt('/learn/check/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /^Bun/ }))
    await settle(1500)
    expect(screen.getByTestId('after-check-plan')).toHaveTextContent('Vezi planul de azi')
    expect(screen.getByTestId('after-check-next')).toHaveTextContent('Acum hai la Limba română')
    fireEvent.click(screen.getByTestId('after-check-next'))
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/check/rom')
  })
})
