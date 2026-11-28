import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../src/i18n/config'

/* Solo / duel games must not touch Firebase at all: loading any of these modules is a test failure. */
const boom = vi.hoisted(() => (name: string) => () => {
  throw new Error(`${name} was loaded by a local game`)
})
vi.mock('firebase/database', boom('firebase/database'))
vi.mock('firebase/firestore', boom('firebase/firestore'))
vi.mock('firebase/auth', boom('firebase/auth'))
vi.mock('firebase/app', boom('firebase/app'))
vi.mock('../src/services/firebase', boom('services/firebase'))
vi.mock('../src/services/roomManager', boom('services/roomManager'))
vi.mock('../src/services/gameSession', boom('services/gameSession'))

const packs = vi.hoisted(() => ({ fail: false }))
vi.mock('../src/engine/content/packs', async (orig) => {
  const m = await orig<typeof import('../src/engine/content/packs')>()
  return {
    ...m,
    ensureContentForSkills: (ids: string[]) => (packs.fail ? Promise.reject(new Error('offline')) : m.ensureContentForSkills(ids)),
  }
})

import GameRouter from '../src/components/games/GameRouter'
import InteractiveGamePage from '../src/components/games/InteractiveGame/InteractiveGamePage'
import { useRoomStore } from '../src/store/roomStore'
import { buildLocalPlayer, buildLocalRoom, localCoPlayerId } from '../src/services/session/localRoom'
import { getLocalGameState } from '../src/services/session/localSession'
import { DEFAULT_GAME_SETTINGS } from '../src/utils/constants'
import type { GameSettings, Room } from '../src/utils/types'

const settings = (over: Partial<GameSettings> = {}): GameSettings => ({
  ...DEFAULT_GAME_SETTINGS, gameType: 'mathRace', gameMode: 'raceToFinish', operations: ['+'], difficulty: 'easy',
  rounds: 2, timePerRound: 30, ...over,
})

function start(over: Partial<GameSettings> = {}, players = 1): Room {
  const p1 = buildLocalPlayer('Ana', 0, '🦊')
  const list = [p1]
  if (players === 2) list.push(buildLocalPlayer('Bob', 1, '🐸', localCoPlayerId(p1.id)))
  const room = buildLocalRoom(list, settings(over))
  useRoomStore.setState({ room, currentPlayer: p1 })
  return room
}

const flush = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

async function mount(ui = <GameRouter />) {
  await act(async () => {
    render(<MemoryRouter>{ui}</MemoryRouter>)
  })
  for (let i = 0; i < 5; i++) await flush(1000) // 3-2-1-Go!
}

beforeAll(async () => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as unknown as MediaQueryList)
  await i18n.changeLanguage('ro')
})
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  useRoomStore.setState({ room: null, currentPlayer: null })
})

describe('solo game, no Firebase (firebaseEnabled is false in tests)', () => {
  it('a math race starts, is answered correctly to the end and shows the results', async () => {
    const room = start()
    await mount()
    for (let i = 0; i < 2; i++) {
      const q = getLocalGameState(room.id)!.questions![i]
      fireEvent.click(screen.getByRole('button', { name: String(q.correctAnswer) }))
      await flush(1000)
    }
    expect(getLocalGameState(room.id)!.phase).toBe('finished')
    expect(getLocalGameState(room.id)!.progress[room.players[0].id]).toBe(2)
    expect(screen.getByText('Rezultate')).toBeInTheDocument()
  })

  it('Replay restarts in place with a fresh countdown and a fresh game; New game leaves', async () => {
    const room = start({ rounds: 1 })
    await mount()
    const q = getLocalGameState(room.id)!.questions![0]
    fireEvent.click(screen.getByRole('button', { name: String(q.correctAnswer) }))
    await flush(1000)
    expect(screen.getByText('Rezultate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Rejoacă' }))
    await flush(50)
    expect(getLocalGameState(room.id)!.phase).toBe('countdown')
    expect(getLocalGameState(room.id)!.progress[room.players[0].id]).toBe(0)
    for (let i = 0; i < 5; i++) await flush(1000)
    expect(getLocalGameState(room.id)!.phase).toBe('playing')
    const q2 = getLocalGameState(room.id)!.questions![0]
    fireEvent.click(screen.getByRole('button', { name: String(q2.correctAnswer) }))
    await flush(1000)
    expect(screen.getByText('Rezultate')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Închide' }))
    await flush(50)
    expect(useRoomStore.getState().room).toBeNull()
  })

  it('an item-based skill game loads its content pack and plays offline', async () => {
    const room = start({ skillIds: ['mat.add.nocarry.20'], rounds: 2 })
    await mount()
    const items = getLocalGameState(room.id)!.items!
    expect(items).toHaveLength(2)
    expect(getLocalGameState(room.id)!.phase).toBe('playing')
  })

  it('a skill whose content pack cannot be loaded (offline, never downloaded) says so instead of hanging', async () => {
    packs.fail = true
    try {
      start({ skillIds: ['mat.add.nocarry.20'], rounds: 2 })
      await mount()
      expect(screen.getByRole('alert')).toHaveTextContent('Nu am putut încărca exercițiile')
      expect(screen.getByRole('button', { name: 'Ieși' })).toBeInTheDocument()
    } finally {
      packs.fail = false
    }
  })

  it('memory plays (shared board is adopted from the local session)', async () => {
    const room = start({ gameType: 'memoryGame', rounds: 3 })
    await mount()
    expect(getLocalGameState(room.id)!.memoryCards).toHaveLength(6)
    expect(screen.getByText(/Potriviri/)).toBeInTheDocument()
  })

  it('shape match plays', async () => {
    const room = start({ gameType: 'shapeMatch', rounds: 2 })
    await mount()
    expect(getLocalGameState(room.id)!.shapeQuestions).toHaveLength(2)
    expect(getLocalGameState(room.id)!.phase).toBe('playing')
  })
})

describe('two on one phone, no Firebase', () => {
  it('starts, finishes when one player finishes, and Replay restarts', async () => {
    const room = start({ rounds: 1, skillIds: ['mat.add.nocarry.20'] }, 2)
    await mount(<InteractiveGamePage />)
    const g = getLocalGameState(room.id)!
    expect(g.phase).toBe('playing')
    expect(Object.keys(g.progress)).toHaveLength(2)
    // time runs out for a question: both players skip, the round counter ends the game
    await flush(31_000)
    await flush(1000)
    expect(getLocalGameState(room.id)!.phase).toBe('finished')
    expect(screen.getByText('Rezultate')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Rejoacă' }))
    await flush(50)
    expect(getLocalGameState(room.id)!.phase).toBe('countdown')
  })
})
