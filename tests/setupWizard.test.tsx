import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { ChildProfile } from '@/profiles/types'
import type { Grade } from '@/engine/types'
import { useProfileStore } from '@/store/profileStore'
import { PLAY_PRESETS } from '@/components/play/presets'
import { ANIMALS } from '@/utils/animalNames'

const rm = vi.hoisted(() => ({
  buildRoom: vi.fn((name: string, settings: object, avatar: string) => ({
    id: 'room1', code: 'ABC234', hostId: 'u1', status: 'waiting', createdAt: Date.now(), settings,
    players: [{ id: 'u1', name, avatar, score: 0, isHost: true, isReady: true }],
  })),
  buildPlayer: vi.fn((name: string, _n: number, avatar: string, id: string) => ({ id, name, avatar, score: 0, isHost: false, isReady: false })),
  coPlayerId: (id: string) => `${id}_2`,
  createRoomInDB: vi.fn(async () => {}),
  registerDisconnectCleanup: vi.fn(),
  lookupRoomByCode: vi.fn(),
  joinRoomByCode: vi.fn(),
}))
vi.mock('@/services/roomManager', () => rm)
vi.mock('@/services/authService', () => ({ ensureAnonymousAuth: vi.fn(async () => null), getCurrentUid: () => 'u1' }))

import CreateRoom from '@/components/lobby/CreateRoom'
import SinglePlayerPage from '@/components/lobby/SinglePlayerPage'
import InteractiveSetupPage from '@/components/lobby/InteractiveSetupPage'
import MultiplayerPage from '@/components/lobby/MultiplayerPage'
import HomePage from '@/components/lobby/HomePage'
import {
  defaultChoices,
  firstBlockedStep,
  loadChoices,
  modesFor,
  stepsFor,
  practiceIssue,
  presetGrades,
  presetsForGrade,
  saveChoices,
  toRoomSettings,
  whoIssue,
  type SetupChoices,
} from '@/components/setup/setupModel'

const profile = (grade: Grade): ChildProfile => ({
  id: 'p1', nickname: 'Matei', avatar: '🦊', grade, language: 'ro', createdAt: 1, updatedAt: 1, recoveryCode: 'AAAA-BBBB',
})

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderPage = (ui: ReactElement, path = '/setup') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/setup" element={ui} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )

const heading = () => screen.getByRole('heading', { level: 2 }).textContent
const next = () => fireEvent.click(screen.getByTestId('setup-next'))
const back = () => fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }))
const nextBtn = () => screen.getByTestId('setup-next') as HTMLButtonElement
const preset = (name: RegExp) => screen.getByRole('button', { name })
const pickPreset = (name: RegExp) => {
  const b = preset(name)
  if (b.getAttribute('aria-pressed') !== 'true') fireEvent.click(b)
}

beforeAll(async () => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  await i18n.changeLanguage('ro')
})
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useProfileStore.setState({ profiles: [], activeProfile: null, loaded: true })
})
afterEach(() => cleanup())

/* ------------------------------------------------------------------ */
/*  Pure model                                                        */
/* ------------------------------------------------------------------ */

const id1 = { animal: 0, adjective: 0 }
const id2 = { animal: 1, adjective: 1 }
const base = (over: Partial<SetupChoices> = {}): SetupChoices => ({ ...defaultChoices(id1, id2), ...over })

describe('setup model', () => {
  it('offers the sprint only for online rooms', () => {
    expect(modesFor('room')).toEqual(['race', 'sprint', 'memory'])
    expect(modesFor('single')).toEqual(['race', 'memory'])
    expect(modesFor('duel')).toEqual(['race', 'memory'])
  })

  it('memory skips the practice step and never blocks on it', () => {
    expect(stepsFor('race')).toEqual(['mode', 'practice', 'who', 'ready'])
    expect(stepsFor('sprint')).toEqual(['mode', 'practice', 'who', 'ready'])
    expect(stepsFor('memory')).toEqual(['mode', 'who', 'ready'])
    expect(practiceIssue(base({ mode: 'memory' }))).toBeNull()
    expect(firstBlockedStep('single', base({ mode: 'memory' }))).toBeNull()
  })

  it('presets are filtered to the grade +-1, closest first, and fall back to all', () => {
    const ids = (g: Grade | null) => presetsForGrade(g).map((p) => p.id)
    expect(ids(null)).toHaveLength(PLAY_PRESETS.length)
    const g4 = ids(4)
    expect(g4).toContain('mulTable') /* grade 3 */
    expect(g4).toContain('mulBig') /* grade 4 */
    expect(g4).not.toContain('addTo20') /* grade 1 */
    expect(g4).not.toContain('syllables')
    expect(ids(1)).toContain('addTo20')
    expect(ids(1)).not.toContain('mulBig')
    /* a preset covering the grade comes before one that is only next to it */
    const g2 = ids(2)
    expect(g2.indexOf('addTo100')).toBeLessThan(g2.indexOf('addTo1000'))
    /* nothing for this grade: all presets, so there is always something to tap */
    expect(ids(8)).toHaveLength(PLAY_PRESETS.length)
    for (const p of presetsForGrade(3)) {
      const g = presetGrades(p)!
      expect(g.min).toBeLessThanOrEqual(4)
      expect(g.max).toBeGreaterThanOrEqual(2)
    }
  })

  it('needs skills or the classic game, and an operation for classic math', () => {
    expect(practiceIssue(base())).toBe('none')
    expect(practiceIssue(base({ skillIds: ['mat.add.nocarry.20'] }))).toBeNull()
    expect(practiceIssue(base({ classic: true }))).toBeNull()
    expect(practiceIssue(base({ classic: true, operations: [] }))).toBe('operations')
    expect(practiceIssue(base({ classic: true, classicType: 'countingGame', operations: [] }))).toBeNull()
    expect(practiceIssue(base({ classic: true, mode: 'memory', operations: [] }))).toBeNull()
    /* text comprehension cannot be raced */
    expect(practiceIssue(base({ skillIds: ['rom.text.literal.1'] }))).toBe('unplayable')
  })

  it('a duel needs two different animals', () => {
    expect(whoIssue('duel', { identity: id1, identity2: id1 })).toBe('sameAvatar')
    expect(whoIssue('duel', { identity: id1, identity2: id2 })).toBeNull()
    expect(whoIssue('single', { identity: id1, identity2: id1 })).toBeNull()
    expect(firstBlockedStep('duel', base({ classic: true, identity2: id1 }))).toBe('who')
    expect(firstBlockedStep('duel', base())).toBe('practice')
    expect(firstBlockedStep('single', base({ classic: true }))).toBeNull()
  })

  it('builds the same room settings the old forms did', () => {
    expect(toRoomSettings('single', base({ classic: true }))).toEqual({
      gameType: 'mathRace', gameMode: 'raceToFinish', difficulty: 'easy', operations: ['+', '-'], rounds: 10, timePerRound: 15,
    })
    expect(toRoomSettings('room', base({ classic: true, mode: 'sprint', classicType: 'equations', operations: ['×'] }))).toMatchObject({
      gameType: 'equations', gameMode: 'timedSprint', operations: ['×'],
    })
    expect(toRoomSettings('single', base({ classic: true, classicType: 'shapeMatch', shapeMode: 'word' }))).toMatchObject({
      gameType: 'shapeMatch', shapeMode: 'word', operations: ['+'],
    })
    expect(toRoomSettings('single', base({ classic: true, classicType: 'countingGame' }))).not.toHaveProperty('shapeMode')
    const skills = toRoomSettings('single', base({ skillIds: ['rom.syll.count.0', 'rom.syll.split.1'], classicType: 'equations' }))
    expect(skills).toMatchObject({ gameType: 'mathRace', skillIds: ['rom.syll.count.0', 'rom.syll.split.1'], subject: 'rom', operations: ['+'] })
    /* memory = pictures: skills never reach the room settings */
    const mem = toRoomSettings('single', base({ skillIds: ['mat.add.nocarry.20'], mode: 'memory' }))
    expect(mem.gameType).toBe('memoryGame')
    expect(mem).not.toHaveProperty('skillIds')
    expect(mem).not.toHaveProperty('subject')
    for (const ctx of ['room', 'duel'] as const) {
      const m = toRoomSettings(ctx, base({ skillIds: ['mat.add.nocarry.20'], mode: 'memory' }))
      expect(m.gameType).toBe('memoryGame')
      expect(m).not.toHaveProperty('skillIds')
    }
    expect(toRoomSettings('single', base({ classic: true })).skillIds).toBeUndefined()
  })

  it('clamps rounds and time like the old inputs (memory pairs differ for rooms)', () => {
    expect(toRoomSettings('single', base({ classic: true, rounds: 0, timePerRound: 999 }))).toMatchObject({ rounds: 5, timePerRound: 60 })
    expect(toRoomSettings('single', base({ classic: true, mode: 'memory', rounds: 1, timePerRound: 999 }))).toMatchObject({ rounds: 3, timePerRound: 300 })
    expect(toRoomSettings('room', base({ classic: true, mode: 'memory', rounds: 1 })).rounds).toBe(2)
    expect(toRoomSettings('room', base({ classic: true, mode: 'sprint', timePerRound: 200 })).timePerRound).toBe(200)
  })

  it('remembers choices, checks them on load, and survives broken storage', () => {
    const mine = base({ mode: 'memory', rounds: 8 })
    saveChoices('single', mine)
    expect(loadChoices('single', base())).toMatchObject({ mode: 'memory', skillIds: [], rounds: 8 })
    /* skills remembered from before memory became pictures-only are dropped */
    localStorage.setItem('ludiko.setup.v1.single', JSON.stringify({ mode: 'memory', skillIds: ['mat.add.nocarry.20'] }))
    expect(loadChoices('single', base()).skillIds).toEqual([])
    /* per screen */
    expect(loadChoices('room', base()).mode).toBe('race')
    /* sprint is not allowed for single player; unknown skills and wild numbers are dropped */
    localStorage.setItem('ludiko.setup.v1.single', JSON.stringify({ mode: 'sprint', skillIds: ['nope.x', 'mat.add.nocarry.20'], rounds: 9999, identity: { animal: 99, adjective: 0 } }))
    const l = loadChoices('single', base())
    expect(l.mode).toBe('race')
    expect(l.skillIds).toEqual(['mat.add.nocarry.20'])
    expect(l.rounds).toBe(30)
    expect(l.identity).toEqual(id1)
    localStorage.setItem('ludiko.setup.v1.single', '{not json')
    expect(loadChoices('single', base())).toEqual(base())
    /* storage that throws */
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveChoices('single', mine)).not.toThrow()
    spy.mockRestore()
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadChoices('single', base())).toEqual(base())
    get.mockRestore()
  })
})

/* ------------------------------------------------------------------ */
/*  Wizard UI                                                         */
/* ------------------------------------------------------------------ */

describe('setup wizard navigation', () => {
  it('goes through the four steps with progress dots, and Back returns', () => {
    renderPage(<SinglePlayerPage />)
    expect(heading()).toBe('Ce jucăm?')
    expect(screen.getAllByTestId('step-dot')).toHaveLength(4)
    expect(screen.getByText('Pasul 1 din 4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Înapoi/ })).toBeNull() /* nothing to go back to on the first step */

    next()
    expect(heading()).toBe('Ce exersăm?')
    expect(screen.getByText('Pasul 2 din 4')).toBeInTheDocument()
    pickPreset(/Adunare până la 20/)
    next()
    expect(heading()).toBe('Cine ești?')
    next()
    expect(heading()).toBe('Gata?')
    expect(screen.getByText('Pasul 4 din 4')).toBeInTheDocument()
    expect(screen.getAllByTestId('step-dot').map((d) => d.getAttribute('data-state'))).toEqual(['done', 'done', 'done', 'current'])
    expect(screen.queryByTestId('setup-next')).toBeNull()
    expect(screen.getByTestId('setup-start')).toBeEnabled()

    back()
    expect(heading()).toBe('Cine ești?')
    back(); back()
    expect(heading()).toBe('Ce jucăm?')
  })

  it('the first step offers only the modes of the screen (sprint: rooms only)', () => {
    const single = renderPage(<SinglePlayerPage />)
    expect(screen.getByRole('button', { name: /Cursă/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Memorie/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sprint/ })).toBeNull()
    single.unmount()
    renderPage(<CreateRoom />)
    expect(screen.getByRole('button', { name: /Sprint/ })).toBeInTheDocument()
  })

  it('the Ready step summarises the choices and each row jumps back to its step', () => {
    renderPage(<SinglePlayerPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cursă/ }))
    next()
    pickPreset(/Silabe/)
    next(); next()
    const summary = screen.getByRole('list', { name: 'Gata?' })
    expect(within(summary).getByText(/Cursă/)).toBeInTheDocument()
    expect(within(summary).getByText('Silabe')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Schimbă: Exersăm/ }))
    expect(heading()).toBe('Ce exersăm?')
  })

  it('memory goes mode -> who -> ready: no "Ce exersăm?" step, no skills in the summary', () => {
    renderPage(<SinglePlayerPage />)
    fireEvent.click(screen.getByRole('button', { name: /Memorie/ }))
    next()
    expect(heading()).toBe('Cine ești?')
    expect(screen.getAllByTestId('step-dot')).toHaveLength(3)
    expect(screen.getByText('Pasul 2 din 3')).toBeInTheDocument()
    next()
    expect(heading()).toBe('Gata?')
    const summary = screen.getByRole('list', { name: 'Gata?' })
    expect(within(summary).getByText(/Memorie/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Schimbă: Exersăm/ })).toBeNull()
    expect(screen.getByTestId('setup-start')).toBeEnabled()
    /* advanced: pairs + total time only (no difficulty) */
    fireEvent.click(screen.getByRole('button', { name: /Setări avansate/ }))
    expect(screen.getByText('Perechi')).toBeInTheDocument()
    expect(screen.queryByText('Dificultate')).toBeNull()
    back(); back()
    expect(heading()).toBe('Ce jucăm?')
  })

  it('memory single player starts a picture room (no skillIds)', async () => {
    renderPage(<SinglePlayerPage />)
    fireEvent.click(screen.getByRole('button', { name: /Memorie/ }))
    next(); next()
    fireEvent.click(screen.getByTestId('setup-start'))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    const settings = rm.buildRoom.mock.calls.at(-1)![1] as Record<string, unknown>
    expect(settings.gameType).toBe('memoryGame')
    expect(settings).not.toHaveProperty('skillIds')
  })

  it('advanced settings are collapsed until asked for', () => {
    renderPage(<CreateRoom />)
    fireEvent.click(screen.getByRole('button', { name: /Sprint/ }))
    next(); pickPreset(/Silabe/); next(); next()
    expect(screen.queryByText('Dificultate')).toBeNull()
    const adv = screen.getByRole('button', { name: /Setări avansate/ })
    expect(adv).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(adv)
    expect(screen.getByText('Dificultate')).toBeInTheDocument()
    expect(screen.getByText('Runde')).toBeInTheDocument()
    expect(screen.getByText('Timp total (sec)')).toBeInTheDocument() /* sprint: total time */
  })
})

describe('setup wizard: what to practise', () => {
  it('cannot go on without a choice; a preset or the classic game unlocks it', () => {
    renderPage(<SinglePlayerPage />)
    next()
    expect(nextBtn()).toBeDisabled()
    expect(screen.getByText(/Alege ce exersăm/)).toBeInTheDocument()
    fireEvent.click(preset(/Silabe/))
    expect(nextBtn()).toBeEnabled()
    fireEvent.click(preset(/Silabe/)) /* tap again: off */
    expect(nextBtn()).toBeDisabled()
    fireEvent.click(preset(/Jocul clasic/))
    expect(nextBtn()).toBeEnabled()
  })

  it('shows every preset without a profile (a short list first), the grade\'s with one', () => {
    const none = renderPage(<SinglePlayerPage />)
    next()
    const group = () => within(screen.getByRole('group', { name: 'Alegeri rapide' })).getAllByRole('button')
    expect(group().length).toBeLessThan(PLAY_PRESETS.length)
    fireEvent.click(screen.getByRole('button', { name: 'Arată toate' }))
    expect(group()).toHaveLength(PLAY_PRESETS.length)
    none.unmount()

    useProfileStore.setState({ profiles: [profile(4)], activeProfile: profile(4), loaded: true })
    renderPage(<SinglePlayerPage />)
    next()
    expect(screen.getByText('Potrivite pentru: Clasa a IV-a')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tabla înmulțirii/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Înmulțiri cu 1 și 2 cifre/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Adunare până la 20/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Silabe/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Arată toate' }))
    expect(screen.getByRole('button', { name: /Adunare până la 20/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Doar pentru clasa mea' }))
    expect(screen.queryByRole('button', { name: /Adunare până la 20/ })).toBeNull()
  })

  it('a first-grader sees the first-grade presets', () => {
    useProfileStore.setState({ profiles: [profile(1)], activeProfile: profile(1), loaded: true })
    renderPage(<SinglePlayerPage />)
    next()
    expect(screen.getByRole('button', { name: /Adunare până la 20/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ceasul/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tabla înmulțirii/ })).toBeNull()
  })

  it('"Alege singur" opens the skill picker (no presets inside); chosen skills unlock Next', () => {
    renderPage(<SinglePlayerPage />)
    next()
    fireEvent.click(screen.getByRole('button', { name: /Alege singur/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Matematică' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pregătitoare' }))
    fireEvent.click(screen.getByRole('button', { name: /Adunarea în limitele 0–10/ }))
    expect(screen.getByText('Alese: 1/5')).toBeInTheDocument()
    expect(nextBtn()).toBeEnabled()
  })

  it('the classic game needs an operation for the math games; shapes do not', () => {
    renderPage(<SinglePlayerPage />)
    next()
    fireEvent.click(preset(/Jocul clasic/))
    const ops = screen.getByRole('group', { name: 'Operații' })
    for (const op of ['+', '-']) fireEvent.click(within(ops).getByRole('button', { name: op }))
    expect(nextBtn()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Alege cel puțin o operație')
    fireEvent.click(within(ops).getByRole('button', { name: '×' }))
    expect(nextBtn()).toBeEnabled()
    fireEvent.click(within(ops).getByRole('button', { name: '×' }))
    fireEvent.click(screen.getByRole('button', { name: /Potrivește Formele/ }))
    expect(screen.queryByRole('group', { name: 'Operații' })).toBeNull()
    expect(nextBtn()).toBeEnabled()
  })

  it('skills that do not work in the chosen mode block Next with a reason', () => {
    localStorage.setItem('ludiko.setup.v1.single', JSON.stringify({ mode: 'race', skillIds: ['rom.text.literal.1'] }))
    renderPage(<SinglePlayerPage />)
    next()
    expect(nextBtn()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/Nu merg în acest joc/)
  })
})

describe('setup wizard: remembering', () => {
  it('opens with the last choices of that screen', () => {
    const first = renderPage(<CreateRoom />)
    fireEvent.click(screen.getByRole('button', { name: /Sprint/ }))
    next(); pickPreset(/Silabe/); next()
    const name = screen.getByTestId('animal-name').textContent
    first.unmount()

    renderPage(<CreateRoom />)
    expect(screen.getByRole('button', { name: /Sprint/ })).toHaveAttribute('aria-pressed', 'true')
    next()
    expect(preset(/Silabe/)).toHaveAttribute('aria-pressed', 'true')
    expect(nextBtn()).toBeEnabled()
    next()
    expect(screen.getByTestId('animal-name').textContent).toBe(name)
  })

  it('works when storage is blocked', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    renderPage(<SinglePlayerPage />)
    next(); pickPreset(/Silabe/); next()
    expect(heading()).toBe('Cine ești?')
    get.mockRestore(); set.mockRestore()
  })
})

describe('setup wizard: starting', () => {
  it('single player: creates a playing room with the chosen skills and goes to the game', async () => {
    renderPage(<SinglePlayerPage />)
    next(); pickPreset(/Silabe/); next()
    const shown = screen.getByTestId('animal-name').textContent
    next()
    fireEvent.click(screen.getByTestId('setup-start'))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    const [name, settings] = rm.buildRoom.mock.calls[0]
    expect(name).toBe(shown)
    expect(settings).toMatchObject({ gameType: 'mathRace', gameMode: 'raceToFinish', skillIds: ['rom.syll.count.0', 'rom.syll.split.1'], subject: 'rom' })
    expect((rm.createRoomInDB.mock.calls[0] as unknown[])[0]).toMatchObject({ status: 'playing' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/game'))
  })

  it('room: sprint with the classic game keeps its operations; the room opens in the lobby', async () => {
    renderPage(<CreateRoom />)
    fireEvent.click(screen.getByRole('button', { name: /Sprint/ }))
    next()
    fireEvent.click(preset(/Jocul clasic/))
    fireEvent.click(within(screen.getByRole('group', { name: 'Operații' })).getByRole('button', { name: '×' }))
    next(); next()
    fireEvent.click(screen.getByRole('button', { name: /Creează/ }))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    expect(rm.buildRoom.mock.calls[0][1]).toMatchObject({
      gameType: 'mathRace', gameMode: 'timedSprint', operations: ['+', '-', '×'], timePerRound: 60,
    })
    expect((rm.createRoomInDB.mock.calls[0] as unknown[])[0]).toMatchObject({ status: 'waiting' })
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/lobby'))
  })

  it('advanced settings reach the room (difficulty, rounds)', async () => {
    renderPage(<SinglePlayerPage />)
    next(); pickPreset(/Silabe/); next(); next()
    fireEvent.click(screen.getByRole('button', { name: /Setări avansate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Greu' }))
    fireEvent.change(screen.getByLabelText('Runde'), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('setup-start'))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    expect(rm.buildRoom.mock.calls[0][1]).toMatchObject({ difficulty: 'hard', rounds: 12 })
  })

  it('shape mode lives in the advanced settings of the classic shape game', async () => {
    renderPage(<SinglePlayerPage />)
    next(); fireEvent.click(preset(/Jocul clasic/))
    fireEvent.click(screen.getByRole('button', { name: /Potrivește Formele/ }))
    next(); next()
    fireEvent.click(screen.getByRole('button', { name: /Setări avansate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Găsește cuvântul' }))
    fireEvent.click(screen.getByTestId('setup-start'))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    expect(rm.buildRoom.mock.calls[0][1]).toMatchObject({ gameType: 'shapeMatch', shapeMode: 'word' })
  })
})

describe('setup wizard: duel (two on one phone)', () => {
  const toWho = () => {
    next(); pickPreset(/Adunare până la 20/); next()
  }

  it('asks for both players on one step, with different animals', () => {
    renderPage(<InteractiveSetupPage />)
    toWho()
    expect(heading()).toBe('Cine joacă?')
    expect(screen.getByRole('group', { name: 'Jucătorul 1' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Jucătorul 2' })).toBeInTheDocument()
    const names = screen.getAllByTestId('animal-name').map((n) => n.textContent)
    expect(names).toHaveLength(2)
    expect(names[0]).not.toBe(names[1])
  })

  it('the same animal for both is refused (Next stays off), also from remembered choices', () => {
    localStorage.setItem('ludiko.setup.v1.duel', JSON.stringify({ identity: { animal: 0, adjective: 0 }, identity2: { animal: 0, adjective: 1 } }))
    for (let i = 0; i < 5; i++) {
      const r = renderPage(<InteractiveSetupPage />)
      toWho()
      const avatars = Array.from(document.querySelectorAll('button[aria-expanded][aria-label*="vatar"]')).map((b) => b.textContent?.replace(/[▴▾]/g, '').trim())
      expect(new Set(avatars).size).toBe(2)
      r.unmount()
    }
  })

  it('starts a two-player room that is already playing', async () => {
    renderPage(<InteractiveSetupPage />)
    toWho(); next()
    fireEvent.click(screen.getByTestId('setup-start'))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    expect(rm.buildRoom.mock.calls[0][1]).toMatchObject({ gameMode: 'raceToFinish', skillIds: ['mat.add.nocarry.20', 'mat.add.carry.20'] })
    const room = (rm.createRoomInDB.mock.calls[0] as unknown[])[0] as { status: string; players: { avatar: string; name: string }[] }
    expect(room.status).toBe('playing')
    expect(room.players).toHaveLength(2)
    expect(room.players[0].avatar).not.toBe(room.players[1].avatar)
    expect(ANIMALS.map((a) => a.emoji)).toEqual(expect.arrayContaining(room.players.map((p) => p.avatar)))
    expect(room.players[0].name).not.toBe(room.players[1].name)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/game/interactive'))
  })

  it('the duel has no sprint mode', () => {
    renderPage(<InteractiveSetupPage />)
    expect(screen.queryByRole('button', { name: /Sprint/ })).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  Home and multiplayer menus                                        */
/* ------------------------------------------------------------------ */

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/multiplayer" element={<MultiplayerPage />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}
const where = () => screen.getByTestId('where').textContent

describe('home menu', () => {
  it('groups the entries: learn (primary), play (3 cards), adults (3 small buttons)', () => {
    renderHome()
    expect(screen.getByTestId('learn-entry')).toHaveTextContent('Învață cu Ludiko')
    const play = screen.getByRole('region', { name: 'Joacă' })
    expect(within(play).getAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual(['play-solo', 'play-friends', 'play-duel'])
    expect(within(play).getByText('Singur')).toBeInTheDocument()
    expect(within(play).getByText('Cu prietenii')).toBeInTheDocument()
    expect(within(play).getByText('Doi pe același telefon')).toBeInTheDocument()
    const adults = screen.getByRole('region', { name: 'Pentru adulți' })
    expect(within(adults).getAllByRole('button').map((b) => b.textContent)).toEqual([expect.stringContaining('Profesor'), expect.stringContaining('Părinți'), expect.stringContaining('Setări')])
    expect(screen.getByRole('button', { name: /Alege jucătorul/ })).toBeInTheDocument()
  })

  it.each([
    ['learn-entry', '/learn'],
    ['play-solo', '/singleplayer'],
    ['play-friends', '/multiplayer'],
    ['play-duel', '/interactive'],
    ['adult-teacher', '/teacher/login'],
    ['adult-parents', '/learn/parent'],
    ['adult-settings', '/settings'],
  ])('%s opens %s', (testId, path) => {
    renderHome()
    fireEvent.click(screen.getByTestId(testId))
    expect(where()).toBe(path)
  })

  it('the profile chip shows the active player and opens the picker', () => {
    useProfileStore.setState({ profiles: [profile(2)], activeProfile: profile(2), loaded: true })
    renderHome()
    fireEvent.click(screen.getByRole('button', { name: /Matei/ }))
    expect(where()).toBe('/profiles')
  })
})

describe('multiplayer menu', () => {
  it('two big cards: create a room, join with a code', () => {
    renderHome()
    fireEvent.click(screen.getByTestId('play-friends'))
    expect(screen.getAllByRole('button').filter((b) => b.getAttribute('data-testid')?.startsWith('multi-'))).toHaveLength(2)
    expect(screen.getByTestId('multi-create')).toHaveTextContent('Creează camera')
    expect(screen.getByTestId('multi-join')).toHaveTextContent('Intră cu un cod')
    fireEvent.click(screen.getByTestId('multi-join'))
    expect(where()).toBe('/join')
  })

  it('create goes to the room setup wizard route', () => {
    renderHome()
    fireEvent.click(screen.getByTestId('play-friends'))
    fireEvent.click(screen.getByTestId('multi-create'))
    expect(where()).toBe('/create')
  })
})
