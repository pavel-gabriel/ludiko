import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeRtdb } from './helpers/fakeRtdb'

/* The RTDB side runs on the in-memory fake; the local side is the code under test. Same operations, same state. */
const h = vi.hoisted(() => ({ db: null as unknown as ReturnType<typeof createFakeRtdb> }))
vi.mock('firebase/database', async () => {
  const { createFakeRtdb: make } = await import('./helpers/fakeRtdb')
  h.db = make()
  return h.db.module
})
vi.mock('../src/services/firebase', () => ({ rtdb: {}, db: {}, firebaseEnabled: false }))
vi.mock('../src/services/authService', () => ({ getCurrentUid: () => 'u1' }))

import { createLocalPort, getLocalGameState } from '../src/services/session/localSession'
import { createRtdbPort } from '../src/services/session/rtdbPort'
import { getSessionPort } from '../src/services/session'
import { buildLocalPlayer, buildLocalRoom, localCoPlayerId } from '../src/services/session/localRoom'
import type { GameSessionPort } from '../src/services/session/types'
import type { GameSettings } from '../src/utils/types'
import { DEFAULT_GAME_SETTINGS } from '../src/utils/constants'
import type { RTDBGameState } from '../src/services/gameState'

const settings = (over: Partial<GameSettings> = {}): GameSettings => ({
  ...DEFAULT_GAME_SETTINGS, gameType: 'mathRace', gameMode: 'raceToFinish', rounds: 4, ...over,
})

beforeEach(() => {
  h.db.write('', {})
})

/** The state through the public listener, whichever implementation */
function current(port: GameSessionPort): RTDBGameState | null {
  let s: RTDBGameState | null = null
  port.listenGame((x) => { s = x })()
  return s
}

const impls: [string, (id: string) => GameSessionPort][] = [
  ['local', (id) => createLocalPort(id)],
  ['rtdb', (id) => createRtdbPort(id)],
]

describe.each(impls)('session port (%s): same behaviour', (_name, make) => {
  it('initGame publishes a countdown state with everyone at 0 and the generated questions', async () => {
    const port = make('r-init')
    expect(current(port)).toBeNull()
    await port.initGame(settings(), ['a', 'b'])
    const s = current(port)!
    expect(s.phase).toBe('countdown')
    expect(s.progress).toEqual({ a: 0, b: 0 })
    expect(s.questions).toHaveLength(4)
    expect(s.currentIndex).toBe(0)
  })

  it('memory and shape games publish their own content; sprint gets a large pool', async () => {
    const mem = make('r-mem')
    await mem.initGame(settings({ gameType: 'memoryGame', rounds: 6 }), ['a'])
    expect(current(mem)!.memoryCards).toHaveLength(12)
    const shape = make('r-shape')
    await shape.initGame(settings({ gameType: 'shapeMatch', gameMode: 'timedSprint' }), ['a'])
    expect(current(shape)!.shapeQuestions!.length).toBe(100)
  })

  it('records scores, finish times and phases', async () => {
    const port = make('r-play')
    await port.initGame(settings(), ['a', 'b'])
    await port.setPhase('playing')
    await port.recordCorrectAnswer('a', 1)
    await port.recordCorrectAnswer('a', 2)
    await port.recordPlayerFinished('b')
    await port.advanceQuestion(1)
    let s = current(port)!
    expect(s.phase).toBe('playing')
    expect(typeof s.startedAt).toBe('number')
    expect(s.progress).toEqual({ a: 2, b: 0 })
    expect(Object.keys(s.finishTimes!)).toEqual(['b'])
    expect(s.currentIndex).toBe(1)
    await port.setPhase('finished')
    s = current(port)!
    expect(s.phase).toBe('finished')
  })

  it('a new initGame after a game restarts from the countdown', async () => {
    const port = make('r-again')
    await port.initGame(settings(), ['a'])
    await port.setPhase('playing')
    await port.recordCorrectAnswer('a', 3)
    await port.setPhase('finished')
    await port.initGame(settings(), ['a'])
    const s = current(port)!
    expect(s.phase).toBe('countdown')
    expect(s.progress).toEqual({ a: 0 })
    expect(s.finishTimes).toBeUndefined()
  })
})

describe('local session specifics', () => {
  it('notifies listeners on every change, with a fresh object each time, and stops after unsubscribe', async () => {
    const port = createLocalPort('r-listen')
    const seen: (RTDBGameState | null)[] = []
    const off = port.listenGame((s) => seen.push(s))
    expect(seen).toEqual([null])
    await port.initGame(settings(), ['a'])
    await port.recordCorrectAnswer('a', 1)
    expect(seen).toHaveLength(3)
    expect(seen[1]).not.toBe(seen[2])
    off()
    await port.recordCorrectAnswer('a', 2)
    expect(seen).toHaveLength(3)
  })

  it('a phase change that arrives before the game is generated is applied when it is', async () => {
    const port = createLocalPort('r-early')
    await port.setPhase('playing')
    expect(getLocalGameState('r-early')).toBeNull()
    await port.initGame(settings(), ['a'])
    expect(getLocalGameState('r-early')!.phase).toBe('playing')
  })

  it('restart drops the finished game first (a late "playing" is not applied to it)', async () => {
    const port = createLocalPort('r-restart')
    await port.initGame(settings(), ['a'])
    await port.setPhase('finished')
    const pending = port.initGame(settings(), ['a'])
    expect(getLocalGameState('r-restart')).toBeNull()
    await pending
    expect(getLocalGameState('r-restart')!.phase).toBe('countdown')
  })

  it('item games work offline: skills are loaded from the content packs, no Firebase', async () => {
    const port = createLocalPort('r-items')
    await port.initGame(settings({ skillIds: ['mat.add.nocarry.20'], rounds: 5 }), ['a'])
    const s = getLocalGameState('r-items')!
    expect(s.items!.length).toBe(5)
    expect(s.questions).toBeUndefined()
  })

  it('close forgets the session; replay clears the game; rooms never change under the page', async () => {
    const port = createLocalPort('r-close')
    await port.initGame(settings(), ['a'])
    const room = vi.fn()
    port.listenRoom(room)()
    expect(room).not.toHaveBeenCalled()
    await port.replay()
    expect(getLocalGameState('r-close')).toBeNull()
    await port.initGame(settings(), ['a'])
    await port.close()
    expect(getLocalGameState('r-close')).toBeNull()
    await expect(port.leave('a')).resolves.toBeUndefined()
  })
})

describe('choosing the implementation', () => {
  it('local rooms use the in-memory port; rooms without the flag use RTDB', () => {
    expect(getSessionPort({ id: 'x', local: true }).local).toBe(true)
    expect(getSessionPort({ id: 'x' }).local).toBe(false)
  })

  it('local rooms need no Firebase: ids, players and a playing room', () => {
    const p1 = buildLocalPlayer('Ana', 0, '🦊')
    const p2 = buildLocalPlayer('Bob', 1, '🐸', localCoPlayerId(p1.id))
    const room = buildLocalRoom([p1, p2], { rounds: 7 })
    expect(room).toMatchObject({ local: true, status: 'playing', hostId: p1.id })
    expect(room.settings.rounds).toBe(7)
    expect(room.players.map((p) => p.isHost)).toEqual([true, false])
    expect(p2.id).toBe(`${p1.id}_2`)
  })
})
