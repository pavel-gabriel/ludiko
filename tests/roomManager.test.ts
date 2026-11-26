import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeRtdb } from './helpers/fakeRtdb'

const h = vi.hoisted(() => ({ uid: 'host-uid' as string | null, db: null as unknown as ReturnType<typeof createFakeRtdb> }))
vi.mock('firebase/database', async () => {
  const { createFakeRtdb: make } = await import('./helpers/fakeRtdb')
  h.db = make()
  return h.db.module
})
vi.mock('../src/services/firebase', () => ({ rtdb: {}, db: {}, firebaseEnabled: true }))
vi.mock('../src/services/authService', () => ({ getCurrentUid: () => h.uid }))

import {
  ROOM_JOIN_MAX_AGE_MS,
  buildPlayer,
  buildRoom,
  coPlayerId,
  createRoomInDB,
  deleteRoom,
  isRoomExpired,
  joinRoomByCode,
  lookupRoomByCode,
  playersFromRtdb,
  registerDisconnectCleanup,
  removePlayer,
  replayRoom,
  resolveRoomCode,
  setPlayerReady,
  toRtdbRoom,
} from '../src/services/roomManager'

let db: ReturnType<typeof createFakeRtdb>
beforeEach(() => {
  db = h.db
  db.write('', {})
  db.disconnects.length = 0
  localStorage.clear()
  h.uid = 'host-uid'
})

async function hostRoom() {
  const room = buildRoom('Vulpea Veselă', { gameType: 'mathRace' }, '🦊')
  await createRoomInDB(room)
  return room
}

describe('room ids and players', () => {
  it('the host player id and hostId are the Firebase uid; room ids are long and random', () => {
    const a = buildRoom('A', {}, '🦊')
    const b = buildRoom('B', {}, '🦊')
    expect(a.hostId).toBe('host-uid')
    expect(a.players[0].id).toBe('host-uid')
    expect(a.id).toMatch(/^[a-z0-9]{20}$/)
    expect(a.id).not.toBe(b.id)
  })

  it('a second local player (duel) gets `{uid}_2`, which the RTDB rules accept as the host\'s own', () => {
    expect(coPlayerId('host-uid')).toBe('host-uid_2')
    expect(buildPlayer('Leul Curajos', 1, '🦁', coPlayerId('host-uid')).id).toBe('host-uid_2')
  })

  it('stores players as a map keyed by id and reads them back host first, then in join order', () => {
    const room = buildRoom('Host', {}, '🦊')
    room.players.push({ ...buildPlayer('G1', 1, '🐸', 'g1'), isReady: true })
    room.players.push(buildPlayer('G2', 2, '🐱', 'g2'))
    const stored = toRtdbRoom(room) as { players: Record<string, unknown>; id?: string }
    expect(Object.keys(stored.players).sort()).toEqual(['g1', 'g2', 'host-uid'])
    expect(stored.id).toBeUndefined()
    const back = playersFromRtdb({ g2: stored.players.g2, 'host-uid': stored.players['host-uid'], g1: stored.players.g1 })
    expect(back.map((p) => p.id)).toEqual(['host-uid', 'g1', 'g2'])
    expect(back[0]).not.toHaveProperty('joinedAt')
  })

  it('still reads a legacy players array with holes', () => {
    expect(playersFromRtdb([null, { id: 'a', name: 'A', avatar: '🦊', score: 0, isHost: true, isReady: true }]).map((p) => p.id)).toEqual(['a'])
  })
})

describe('creating a room', () => {
  it('writes the room and the exact-key code index', async () => {
    const room = await hostRoom()
    expect(db.read(`rooms/${room.id}/code`)).toBe(room.code)
    expect(db.read(`rooms/${room.id}/hostId`)).toBe('host-uid')
    expect(db.read(`roomCodes/${room.code}`)).toMatchObject({ roomId: room.id, hostId: 'host-uid' })
  })

  it('picks another code when the first one is taken by a live room', async () => {
    const first = await hostRoom()
    const second = buildRoom('B', {}, '🐸')
    second.code = first.code
    localStorage.clear()
    await createRoomInDB(second)
    expect(second.code).not.toBe(first.code)
    expect(db.read(`roomCodes/${first.code}`)).toMatchObject({ roomId: first.id })
    expect(db.read(`roomCodes/${second.code}`)).toMatchObject({ roomId: second.id })
  })

  it('deletes the room this device left behind last time', async () => {
    const old = await hostRoom()
    const next = buildRoom('B', {}, '🐸')
    await createRoomInDB(next)
    expect(db.read(`rooms/${old.id}`)).toBeNull()
    expect(db.read(`roomCodes/${old.code}`)).toBeNull()
    expect(db.read(`rooms/${next.id}`)).not.toBeNull()
  })

  it('deleteRoom removes the room and its code', async () => {
    const room = await hostRoom()
    await deleteRoom(room.id)
    expect(db.read(`rooms/${room.id}`)).toBeNull()
    expect(db.read(`roomCodes/${room.code}`)).toBeNull()
  })

  it('registers onDisconnect for the room and its code (host) or for the player entry (guest)', () => {
    registerDisconnectCleanup('r1', true, undefined, 'ABC234')
    registerDisconnectCleanup('r1', false, 'guest')
    expect(db.disconnects).toEqual(['rooms/r1', 'roomCodes/ABC234', 'rooms/r1/players/guest'])
  })
})

describe('join by code (no listing of rooms)', () => {
  it('reads roomCodes/{code} then rooms/{id}; never queries /rooms', async () => {
    const room = await hostRoom()
    expect(await resolveRoomCode(room.code.toLowerCase())).toBe(room.id)
    const found = await lookupRoomByCode(room.code)
    expect(found?.id).toBe(room.id)
    expect(found?.players).toHaveLength(1)
    /* the fake has no query()/orderByChild(): importing them would have failed the module mock */
    expect(Object.keys(db.module)).not.toContain('query')
  })

  it('adds the guest under their own uid and returns the updated room', async () => {
    const room = await hostRoom()
    h.uid = 'guest-uid'
    const result = await joinRoomByCode(room.code, 'Broscuța Curajoasă', '🐸')
    expect(result?.player.id).toBe('guest-uid')
    expect(result?.room.players.map((p) => p.id)).toEqual(['host-uid', 'guest-uid'])
    expect(db.read(`rooms/${room.id}/players/guest-uid`)).toMatchObject({ name: 'Broscuța Curajoasă', isHost: false, isReady: false })
  })

  it('two guests joining do not overwrite each other', async () => {
    const room = await hostRoom()
    h.uid = 'g1'
    await joinRoomByCode(room.code, 'A', '🐸')
    h.uid = 'g2'
    const r2 = await joinRoomByCode(room.code, 'B', '🐱')
    expect(r2?.room.players.map((p) => p.id)).toEqual(['host-uid', 'g1', 'g2'])
  })

  it('returns null for an unknown code, a malformed code, a started room', async () => {
    const room = await hostRoom()
    expect(await lookupRoomByCode('ZZZZZZ')).toBeNull()
    expect(await lookupRoomByCode('AB')).toBeNull()
    db.write(`rooms/${room.id}/status`, 'playing')
    expect(await lookupRoomByCode(room.code)).toBeNull()
    expect(await joinRoomByCode(room.code, 'A', '🐸')).toBeNull()
  })

  it('a code whose room is gone resolves to nothing', async () => {
    const room = await hostRoom()
    db.write(`rooms/${room.id}`, null)
    expect(await lookupRoomByCode(room.code)).toBeNull()
  })
})

describe('room expiry (6 hours)', () => {
  it('isRoomExpired', () => {
    const now = 1_000_000_000_000
    expect(isRoomExpired({ createdAt: now - 1000 }, now)).toBe(false)
    expect(isRoomExpired({ createdAt: now - ROOM_JOIN_MAX_AGE_MS - 1 }, now)).toBe(true)
    expect(isRoomExpired({ createdAt: undefined as unknown as number }, now)).toBe(true)
  })

  it('refuses to join a room older than 6 hours, via the room or via the code entry', async () => {
    const room = await hostRoom()
    db.write(`rooms/${room.id}/createdAt`, Date.now() - ROOM_JOIN_MAX_AGE_MS - 5000)
    expect(await lookupRoomByCode(room.code)).toBeNull()
    db.write(`rooms/${room.id}/createdAt`, Date.now())
    db.write(`roomCodes/${room.code}/createdAt`, Date.now() - ROOM_JOIN_MAX_AGE_MS - 5000)
    expect(await lookupRoomByCode(room.code)).toBeNull()
  })

  it('an expired code can be claimed again by a new room', async () => {
    const old = await hostRoom()
    db.write(`roomCodes/${old.code}/createdAt`, Date.now() - ROOM_JOIN_MAX_AGE_MS - 5000)
    localStorage.clear()
    const fresh = buildRoom('B', {}, '🐸')
    fresh.code = old.code
    await createRoomInDB(fresh)
    expect(fresh.code).toBe(old.code)
    expect(db.read(`roomCodes/${old.code}/roomId`)).toBe(fresh.id)
  })
})

describe('lobby and replay', () => {
  it('ready flag and leaving touch only the player\'s own entry', async () => {
    const room = await hostRoom()
    h.uid = 'g1'
    await joinRoomByCode(room.code, 'A', '🐸')
    await setPlayerReady(room.id, 'g1', true)
    expect(db.read(`rooms/${room.id}/players/g1/isReady`)).toBe(true)
    await removePlayer(room.id, 'g1')
    expect(db.read(`rooms/${room.id}/players/g1`)).toBeNull()
  })

  it('the host resets everyone on replay; a guest only sets the room back to waiting and clears the game', async () => {
    const room = await hostRoom()
    h.uid = 'g1'
    await joinRoomByCode(room.code, 'A', '🐸')
    await setPlayerReady(room.id, 'g1', true)
    db.write(`rooms/${room.id}/status`, 'playing')
    db.write(`rooms/${room.id}/game`, { phase: 'finished' })

    await replayRoom(room.id) /* guest */
    expect(db.read(`rooms/${room.id}/status`)).toBe('waiting')
    expect(db.read(`rooms/${room.id}/game`)).toBeNull()
    expect(db.read(`rooms/${room.id}/players/g1/isReady`)).toBe(true)

    h.uid = 'host-uid'
    await replayRoom(room.id) /* host */
    expect(db.read(`rooms/${room.id}/players/g1/isReady`)).toBe(false)
    expect(db.read(`rooms/${room.id}/players/host-uid/isReady`)).toBe(true)
  })
})
