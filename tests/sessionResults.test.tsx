import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import SessionResults from '@/ui/session/SessionResults'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import { getSessionItems } from '@/ui/session/itemSource'
import { pickSticker, STICKERS } from '@/ui/session/stickers'
import { getAllSkills } from '@/engine/content/registry'
import { useProfileStore } from '@/store/profileStore'
import type { ChoiceItem, ItemResult } from '@/engine/types'
import type { SessionReward, SessionSummary } from '@/ui/session/types'

vi.mock('@/profiles/profileService', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/profiles/profileService')>()
  return {
    ...real,
    recordAttempt: vi.fn(async () => ({})),
    addStars: vi.fn(async () => ({})),
    addSticker: vi.fn(async () => ({})),
    getProgress: vi.fn(async () => ({ profileId: 'p1', skills: {}, stars: 0, stickers: ['🦊'], playDays: [] })),
  }
})
import * as svc from '@/profiles/profileService'

beforeAll(async () => {
  // jsdom has no matchMedia (Confetti reads prefers-reduced-motion)
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  await i18n.changeLanguage('ro')
})

const summary = (over: Partial<SessionSummary> = {}): SessionSummary => ({
  mode: 'practice',
  completed: true,
  total: 5,
  correct: 4,
  accuracy: 0.8,
  stars: 2,
  review: [{ itemId: 'q1', skillId: 's', prompt: { ro: 'Cât face 2 + 3?' } }],
  attempts: [],
  durationMs: 1000,
  ...over,
})

function renderResults(props: Partial<React.ComponentProps<typeof SessionResults>> = {}) {
  const onAgain = vi.fn()
  const onDone = vi.fn()
  render(
    <MemoryRouter>
      <SessionResults summary={summary()} reward={null} onAgain={onAgain} onDone={onDone} {...props} />
    </MemoryRouter>,
  )
  return { onAgain, onDone }
}

describe('<SessionResults />', () => {
  it('shows stars, the first-try score and the items to review', () => {
    renderResults()
    expect(screen.getByRole('img', { name: '2 din 3 stele' })).toBeInTheDocument()
    expect(screen.getByText('Foarte bine!')).toBeInTheDocument()
    expect(screen.getByText('Corecte din prima: 4 din 5')).toBeInTheDocument()
    expect(screen.getByText('Cât face 2 + 3?')).toBeInTheDocument()
  })

  it('is encouraging even with a low score (1 star, no shaming)', () => {
    renderResults({ summary: summary({ correct: 0, accuracy: 0, stars: 1 }) })
    expect(screen.getByText('Bravo că ai încercat!')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '1 din 3 stele' })).toBeInTheDocument()
  })

  it('shows the sticker moment and the two buttons', () => {
    const reward: SessionReward = { stars: 2, sticker: '🐼', newSticker: true, saved: true }
    const { onAgain, onDone } = renderResults({ reward })
    expect(screen.getByTestId('sticker-unlock')).toHaveTextContent('🐼')
    expect(screen.getByText('Ai deblocat un autocolant!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Încă o dată' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gata pe azi' }))
    expect(onAgain).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('tells a guest that nothing is saved and links to the profile picker', () => {
    renderResults({ isGuest: true })
    expect(screen.getByText(/stelele nu se salvează/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Alege un profil' })).toHaveAttribute('href', '/profiles')
  })
})

describe('useSessionProgress', () => {
  const item = {
    id: 'q1',
    type: 'choice',
    skillId: 'skill.a',
    difficulty: 1,
    prompt: { ro: 'x' },
    reviewStatus: 'beta',
    provenance: { id: 'p', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
    options: [],
    correctId: 'a',
  } as ChoiceItem
  const result = (correct: boolean): ItemResult => ({ itemId: 'q1', correct, response: { type: 'choice', selectedId: 'a' }, timeMs: 10 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const withProfile = () =>
    useProfileStore.setState({
      loaded: true,
      profiles: [],
      activeProfile: { id: 'p1', nickname: 'Ana', avatar: '🦊', grade: 1, language: 'ro', createdAt: 0, updatedAt: 0, recoveryCode: 'X' },
    })

  it('records attempts and saves stars and a new sticker for the active profile', async () => {
    withProfile()
    const { result: hook } = renderHook(() => useSessionProgress())
    act(() => {
      hook.current.onAttempt(result(true), item, { retry: false })
      hook.current.onAttempt(result(false), item, { retry: true })
    })
    await waitFor(() => expect(svc.recordAttempt).toHaveBeenCalledTimes(2))
    expect(svc.recordAttempt).toHaveBeenNthCalledWith(1, 'p1', 'skill.a', true)
    expect(svc.recordAttempt).toHaveBeenNthCalledWith(2, 'p1', 'skill.a', false)

    act(() => hook.current.onFinish(summary({ stars: 3 })))
    await waitFor(() => expect(hook.current.reward).not.toBeNull())
    expect(svc.addStars).toHaveBeenCalledWith('p1', 3)
    const reward = hook.current.reward!
    expect(reward.saved).toBe(true)
    expect(reward.sticker).toBeTruthy()
    expect(reward.sticker).not.toBe('🦊') // already owned
    expect(svc.addSticker).toHaveBeenCalledWith('p1', reward.sticker)
  })

  it('does not reward an abandoned session, and gives no sticker below two stars', async () => {
    withProfile()
    const { result: hook } = renderHook(() => useSessionProgress())
    act(() => hook.current.onFinish(summary({ completed: false })))
    await waitFor(() => expect(hook.current.reward).not.toBeNull())
    expect(svc.addStars).not.toHaveBeenCalled()
    expect(hook.current.reward).toMatchObject({ stars: 0, saved: false })

    act(() => hook.current.reset())
    act(() => hook.current.onFinish(summary({ stars: 1 })))
    await waitFor(() => expect(hook.current.reward).not.toBeNull())
    expect(svc.addStars).toHaveBeenCalledWith('p1', 1)
    expect(hook.current.reward?.sticker).toBeUndefined()
  })

  it('lets a guest play without saving anything', async () => {
    useProfileStore.setState({ loaded: true, profiles: [], activeProfile: null })
    const { result: hook } = renderHook(() => useSessionProgress())
    expect(hook.current.isGuest).toBe(true)
    act(() => hook.current.onAttempt(result(true), item, { retry: false }))
    act(() => hook.current.onFinish(summary({ stars: 3 })))
    await waitFor(() => expect(hook.current.reward).not.toBeNull())
    expect(svc.recordAttempt).not.toHaveBeenCalled()
    expect(svc.addStars).not.toHaveBeenCalled()
    expect(svc.addSticker).not.toHaveBeenCalled()
    expect(hook.current.reward).toMatchObject({ saved: false, stars: 3 })
    expect(hook.current.reward?.sticker).toBeTruthy()
  })
})

describe('stickers and itemSource', () => {
  it('picks an unowned sticker, and none when the set is complete', () => {
    expect(pickSticker([STICKERS[0]], 0)).toBe(STICKERS[1])
    expect(pickSticker([...STICKERS], 3)).toBeUndefined()
  })

  it('pads a small bank by repeating items with unique ids, and returns [] for an empty bank', () => {
    const skills = getAllSkills()
    const withItems = skills.find((s) => getSessionItems(s, 1).length > 0)
    expect(withItems).toBeDefined()
    const items = getSessionItems(withItems!, 8)
    expect(items).toHaveLength(8)
    expect(new Set(items.map((i) => i.id)).size).toBe(8)
    expect(getSessionItems({ ...withItems!, id: 'skill.without.items' }, 8)).toEqual([])
  })
})
