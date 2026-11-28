import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import { EMOJI_OPTIONS } from '@/components/ui/EmojiPicker'
import AnimalNamePicker from '@/components/ui/AnimalNamePicker'
import {
  ADJECTIVES,
  ANIMALS,
  PLAYER_NAME_MAX,
  identityAvatar,
  identityName,
  identityWithAvatar,
  randomIdentity,
  shuffleIdentity,
  type AnimalIdentity,
} from '@/utils/animalNames'

const rm = vi.hoisted(() => ({
  buildRoom: vi.fn((name: string, settings: object, avatar: string) => ({
    id: 'room1', code: 'ABC234', hostId: 'u1', status: 'waiting', createdAt: Date.now(), settings,
    players: [{ id: 'u1', name, avatar, score: 0, isHost: true, isReady: true }],
  })),
  buildPlayer: vi.fn(),
  coPlayerId: (id: string) => `${id}_2`,
  createRoomInDB: vi.fn(async () => {}),
  registerDisconnectCleanup: vi.fn(),
  lookupRoomByCode: vi.fn(),
  joinRoomByCode: vi.fn(),
}))
vi.mock('@/services/roomManager', () => rm)
vi.mock('@/services/authService', () => ({ ensureAnonymousAuth: vi.fn(async () => null), getCurrentUid: () => 'u1' }))
const ts = vi.hoisted(() => ({ isStudentCodeValid: vi.fn(async () => true) }))
vi.mock('@/services/teacherService', () => ts)

import CreateRoom from '@/components/lobby/CreateRoom'
import JoinRoom from '@/components/lobby/JoinRoom'
import SinglePlayerPage from '@/components/lobby/SinglePlayerPage'
import InteractiveSetupPage from '@/components/lobby/InteractiveSetupPage'

beforeAll(async () => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  await i18n.changeLanguage('ro')
})
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear() /* the setup wizard remembers its last choices */
})

describe('animal name list', () => {
  it('uses the same 16 emojis as the avatar picker, each exactly once', () => {
    expect(ANIMALS.map((a) => a.emoji)).toEqual(EMOJI_OPTIONS)
    expect(new Set(ANIMALS.map((a) => a.emoji)).size).toBe(ANIMALS.length)
  })

  it('every combination is a valid, short, two-word name in both languages', () => {
    for (let a = 0; a < ANIMALS.length; a++) {
      for (let j = 0; j < ADJECTIVES.length; j++) {
        for (const lang of ['ro', 'en']) {
          const n = identityName({ animal: a, adjective: j }, lang)
          expect(n.split(' ')).toHaveLength(2)
          expect(n.length).toBeLessThanOrEqual(PLAYER_NAME_MAX)
        }
      }
    }
  })

  it('agrees the Romanian adjective with the animal (feminine / masculine)', () => {
    const fox = ANIMALS.findIndex((a) => a.ro === 'Vulpea')
    const lion = ANIMALS.findIndex((a) => a.ro === 'Leul')
    const happy = ADJECTIVES.findIndex((a) => a.roM === 'Vesel')
    expect(identityName({ animal: fox, adjective: happy }, 'ro')).toBe('Vulpea Veselă')
    expect(identityName({ animal: lion, adjective: happy }, 'ro')).toBe('Leul Vesel')
    expect(identityName({ animal: fox, adjective: happy }, 'en')).toBe('Happy Fox')
  })

  it('the avatar is the animal; picking another avatar changes the noun, keeps the adjective', () => {
    const id: AnimalIdentity = { animal: 0, adjective: 3 }
    expect(identityAvatar(id)).toBe('🦊')
    const next = identityWithAvatar(id, '🦁')
    expect(identityAvatar(next)).toBe('🦁')
    expect(next.adjective).toBe(3)
  })

  it('random and shuffle avoid taken animals and always change', () => {
    const taken = ANIMALS.slice(0, 15).map((a) => a.emoji)
    for (let i = 0; i < 20; i++) expect(identityAvatar(randomIdentity(taken))).toBe(ANIMALS[15].emoji)
    const cur = { animal: 2, adjective: 2 }
    for (let i = 0; i < 20; i++) expect(shuffleIdentity(cur)).not.toEqual(cur)
    expect(shuffleIdentity(cur, [], () => 0.1)).not.toEqual(cur) /* even with a stuck random source */
  })
})

describe('AnimalNamePicker', () => {
  function Harness() {
    const [id, setId] = useState<AnimalIdentity>({ animal: 0, adjective: 0 })
    return <AnimalNamePicker value={id} onChange={setId} />
  }

  it('shows the name, has a shuffle button and NO text input', () => {
    const { container } = render(<Harness />)
    expect(screen.getByTestId('animal-name').textContent).toBe('Vulpea Veselă')
    expect(container.querySelectorAll('input, textarea, [contenteditable]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Alt nume' }))
    expect(screen.getByTestId('animal-name').textContent).not.toBe('Vulpea Veselă')
  })

  it('choosing an avatar changes the animal in the name', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /Selected avatar|Avatar ales/ }))
    fireEvent.click(screen.getByRole('option', { name: '🦁' }))
    expect(screen.getByTestId('animal-name').textContent).toBe('Leul Vesel')
  })
})

const noTextName = (container: HTMLElement) => {
  /* the only text inputs left on these screens are numbers (rounds, time) and the room code */
  const inputs = Array.from(container.querySelectorAll('input[type="text"]')) as HTMLInputElement[]
  return inputs.filter((i) => i.inputMode !== 'numeric' && !i.className.includes('tracking-widest'))
}

/** Walk a setup wizard to "Cine ești?": mode -> pick the first quick preset -> who */
function toWhoStep() {
  fireEvent.click(screen.getByTestId('setup-next'))
  const preset = screen.getByRole('button', { name: /Adunare până la 20/ })
  if (preset.getAttribute('aria-pressed') !== 'true') fireEvent.click(preset) /* remembered from an earlier round */
  fireEvent.click(screen.getByTestId('setup-next'))
}

describe('no free-text name for kids', () => {
  it('create room: animal name picker, room is created with that name and avatar', async () => {
    const { container } = render(<MemoryRouter><CreateRoom /></MemoryRouter>)
    toWhoStep()
    expect(noTextName(container)).toHaveLength(0)
    const shown = screen.getByTestId('animal-name').textContent!
    fireEvent.click(screen.getByTestId('setup-next')) /* -> Gata? */
    fireEvent.click(screen.getByRole('button', { name: /Creează|Create/ }))
    await waitFor(() => expect(rm.createRoomInDB).toHaveBeenCalled())
    expect(rm.buildRoom.mock.calls[0][0]).toBe(shown)
    expect(ANIMALS.map((a) => a.emoji)).toContain(rm.buildRoom.mock.calls[0][2])
    expect(rm.registerDisconnectCleanup).toHaveBeenCalledWith('room1', true, undefined, 'ABC234')
  })

  it('single player and duel setup have no name inputs either', () => {
    const a = render(<MemoryRouter><SinglePlayerPage /></MemoryRouter>)
    toWhoStep()
    expect(noTextName(a.container)).toHaveLength(0)
    expect(a.container.querySelectorAll('[data-testid="animal-name"]')).toHaveLength(1)
    a.unmount()
    const b = render(<MemoryRouter><InteractiveSetupPage /></MemoryRouter>)
    toWhoStep()
    expect(noTextName(b.container)).toHaveLength(0)
    const names = b.container.querySelectorAll('[data-testid="animal-name"]')
    expect(names).toHaveLength(2)
    expect(names[0].textContent).not.toBe(names[1].textContent)
  })

  it('duel players start with different animals', () => {
    for (let i = 0; i < 15; i++) {
      const { unmount, container } = render(<MemoryRouter><InteractiveSetupPage /></MemoryRouter>)
      toWhoStep()
      const triggers = Array.from(container.querySelectorAll('button[aria-expanded][aria-label*="vatar"]')).map((b) => b.textContent)
      expect(new Set(triggers.map((t) => t?.replace(/[▴▾]/g, '').trim())).size).toBe(2)
      unmount()
    }
  })

  it('join room (normal): picker, no name input; joins with the picked animal name', async () => {
    rm.lookupRoomByCode.mockResolvedValue({ id: 'room1', code: 'ABC234', players: [], status: 'waiting' })
    rm.joinRoomByCode.mockResolvedValue({
      room: { id: 'room1', players: [] }, player: { id: 'u2', name: 'x', avatar: '🐸', isHost: false },
    })
    const { container } = render(<MemoryRouter><JoinRoom /></MemoryRouter>)
    expect(noTextName(container)).toHaveLength(0)
    const shown = screen.getByTestId('animal-name').textContent!
    fireEvent.change(container.querySelector('input.tracking-widest')!, { target: { value: 'abc234' } })
    await waitFor(() => expect(rm.lookupRoomByCode).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: /Intră|Join/, hidden: false }))
    await waitFor(() => expect(rm.joinRoomByCode).toHaveBeenCalled())
    expect(rm.joinRoomByCode.mock.calls[0][0]).toBe('ABC234')
    expect(rm.joinRoomByCode.mock.calls[0][1]).toBe(shown)
    expect(rm.registerDisconnectCleanup).toHaveBeenCalledWith('room1', false, 'u2')
  })

  it('join a classroom room: the code is checked against the teacher\'s index and becomes the player name', async () => {
    rm.lookupRoomByCode.mockResolvedValue({ id: 'room1', code: 'ABC234', players: [], status: 'waiting', classroomSessionId: 'sess1' })
    rm.joinRoomByCode.mockResolvedValue({ room: { id: 'room1', players: [] }, player: { id: 'u2', name: 'x', avatar: '🐸', isHost: false } })
    const { container } = render(<MemoryRouter><JoinRoom /></MemoryRouter>)
    fireEvent.change(container.querySelector('input.tracking-widest')!, { target: { value: 'ABC234' } })
    const studentInput = await waitFor(() => {
      const el = container.querySelector('input.uppercase:not(.tracking-widest)') as HTMLInputElement
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.change(studentInput, { target: { value: 'lion-42' } })
    fireEvent.click(screen.getByRole('button', { name: /Intră|Join/ }))
    await waitFor(() => expect(rm.joinRoomByCode).toHaveBeenCalled())
    expect(ts.isStudentCodeValid).toHaveBeenCalledWith('sess1', 'LION-42')
    expect(rm.joinRoomByCode.mock.calls[0][1]).toBe('LION-42')
  })

  it('join a classroom room with a code the teacher never issued: refused, nothing joined', async () => {
    ts.isStudentCodeValid.mockResolvedValueOnce(false)
    rm.lookupRoomByCode.mockResolvedValue({ id: 'room1', code: 'ABC234', players: [], status: 'waiting', classroomSessionId: 'sess1' })
    const { container } = render(<MemoryRouter><JoinRoom /></MemoryRouter>)
    fireEvent.change(container.querySelector('input.tracking-widest')!, { target: { value: 'ABC234' } })
    const studentInput = await waitFor(() => {
      const el = container.querySelector('input.uppercase:not(.tracking-widest)') as HTMLInputElement
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.change(studentInput, { target: { value: 'Maria Popescu' } })
    fireEvent.click(screen.getByRole('button', { name: /Intră|Join/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(rm.joinRoomByCode).not.toHaveBeenCalled()
  })
})
