import {
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  onDisconnect,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '@/services/firebase';
import { getCurrentUid } from '@/services/authService';
import type { Room, Player, GameSettings } from '@/utils/types';
import { ROOM_CODE_LENGTH, DEFAULT_GAME_SETTINGS, AVATARS } from '@/utils/constants';

/*
 * RTDB layout (docs/PRIVACY_DATA_MAP.md F2; rules in database.rules.json):
 *
 *   roomCodes/{CODE}            { roomId, hostId, createdAt }   exact-key index, never listed
 *   rooms/{roomId}              code, hostId, status, settings, createdAt, game, ...
 *   rooms/{roomId}/players/{id} one entry per player; id = the player's Firebase uid
 *                               (a second local player on the same device, e.g. the duel, is `{uid}_2`)
 *
 * The client keeps `Room.players` as an array (ordered host first, then by join time); in RTDB it is a map
 * keyed by player id so that a player can only ever write their own entry.
 */

/** A room can only be joined during this time after it was created (also enforced by the RTDB rules) */
export const ROOM_JOIN_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Local key remembering the room this device created last (so an abandoned one is deleted next time) */
const MY_ROOM_KEY = 'ludiko-my-room';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Generate a random 6-char room code (no ambiguous chars like 0/O/1/I) */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Unguessable id (a room is readable by whoever knows its id): 20 random base-36 characters */
function generateRoomId(): string {
  const bytes = new Uint8Array(20);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/** Short random id; only used when there is no Firebase session (offline / not configured) */
function generateLocalId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** The id of the player on this device: the Firebase uid (that is what the RTDB rules compare) */
function currentPlayerId(): string {
  return getCurrentUid() ?? generateLocalId();
}

/** Id of the second local player (duel) on the same device */
export function coPlayerId(hostId: string): string {
  return `${hostId}_2`;
}

/** Pick an avatar based on current player count */
function pickAvatar(playerCount: number): string {
  return AVATARS[playerCount % AVATARS.length];
}

/** True when the room is too old to be joined */
export function isRoomExpired(room: Pick<Room, 'createdAt'>, now: number = Date.now()): boolean {
  return typeof room.createdAt !== 'number' || now - room.createdAt > ROOM_JOIN_MAX_AGE_MS;
}

/** Rooms and codes are removed on cleanup; a code is the 6-character join key, uppercase */
function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Local room builders (used before pushing to RTDB)                 */
/* ------------------------------------------------------------------ */

/** Build a new Room object with the host as the first player */
export function buildRoom(hostName: string, settings?: Partial<GameSettings>, avatar?: string): Room {
  const hostId = currentPlayerId();
  return {
    id: generateRoomId(),
    code: generateRoomCode(),
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        avatar: avatar || pickAvatar(0),
        score: 0,
        isHost: true,
        isReady: true,
      },
    ],
    status: 'waiting',
    settings: { ...DEFAULT_GAME_SETTINGS, ...settings },
    createdAt: Date.now(),
  };
}

/** Build a Player object for someone joining an existing room (`id` defaults to this device's uid) */
export function buildPlayer(name: string, playerCount: number, avatar?: string, id?: string): Player {
  return {
    id: id ?? currentPlayerId(),
    name,
    avatar: avatar || pickAvatar(playerCount),
    score: 0,
    isHost: false,
    isReady: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Serialisation: array in the client, map in RTDB                   */
/* ------------------------------------------------------------------ */

/** Room as stored in RTDB: players keyed by id, no `undefined` (RTDB rejects it), `id` not duplicated */
export function toRtdbRoom(room: Room): Record<string, unknown> {
  const { id: _id, players, ...rest } = room;
  void _id;
  const map: Record<string, unknown> = {};
  players.forEach((p, i) => {
    map[p.id] = { ...p, joinedAt: i };
  });
  return JSON.parse(JSON.stringify({ ...rest, players: map }));
}

/** Players from RTDB (map, or the legacy array) as an ordered array: host first, then join order */
export function playersFromRtdb(raw: unknown): Player[] {
  if (!raw || typeof raw !== 'object') return [];
  const list = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>)) as (
    | (Player & { joinedAt?: number })
    | null
    | undefined
  )[];
  return cleanPlayers(list)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      if (a.p.isHost !== b.p.isHost) return a.p.isHost ? -1 : 1;
      const ja = (a.p as { joinedAt?: number }).joinedAt ?? a.i;
      const jb = (b.p as { joinedAt?: number }).joinedAt ?? b.i;
      return ja - jb || a.p.id.localeCompare(b.p.id);
    })
    .map(({ p }) => {
      const { joinedAt: _j, ...player } = p as Player & { joinedAt?: number };
      void _j;
      return player;
    });
}

/** A snapshot value of rooms/{roomId} as a client Room */
export function roomFromRtdb(raw: unknown, roomId: string): Room {
  const data = raw as Omit<Room, 'players' | 'id'> & { players?: unknown };
  return { ...data, id: roomId, players: playersFromRtdb(data.players) } as Room;
}

/* ------------------------------------------------------------------ */
/*  RTDB operations                                                   */
/* ------------------------------------------------------------------ */

/** Remember (or forget) the room this device created */
function rememberMyRoom(info: { roomId: string; code: string } | null): void {
  try {
    if (info) localStorage.setItem(MY_ROOM_KEY, JSON.stringify(info));
    else localStorage.removeItem(MY_ROOM_KEY);
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

/** Delete the room this device created earlier and never closed (best effort: it is ours, the rules allow it) */
export async function cleanupPreviousOwnRoom(): Promise<void> {
  let info: { roomId?: string; code?: string } | null = null;
  try {
    info = JSON.parse(localStorage.getItem(MY_ROOM_KEY) ?? 'null');
  } catch {
    info = null;
  }
  if (!info?.roomId) return;
  try {
    await remove(ref(rtdb, `rooms/${info.roomId}`));
    if (info.code) await remove(ref(rtdb, `roomCodes/${info.code}`));
  } catch {
    /* not ours any more, or already gone */
  }
  rememberMyRoom(null);
}

/**
 * Reserve a join code in the exact-key index. A code that is taken by a live room is skipped.
 * Returns the code that was reserved (it may differ from `room.code`).
 */
async function claimRoomCode(room: Room): Promise<string> {
  let code = room.code;
  for (let attempt = 0; attempt < 8; attempt++) {
    const result = await runTransaction(ref(rtdb, `roomCodes/${code}`), (current: { createdAt?: number } | null) => {
      if (current && !isRoomExpired({ createdAt: current.createdAt as number })) return undefined; /* taken: abort */
      return { roomId: room.id, hostId: room.hostId, createdAt: room.createdAt };
    });
    if (result.committed) return code;
    code = generateRoomCode();
  }
  throw new Error('No free room code');
}

/** Write a newly created room to RTDB (and its join code to the index; `room.code` is updated on a clash) */
export async function createRoomInDB(room: Room): Promise<void> {
  await cleanupPreviousOwnRoom();
  room.code = await claimRoomCode(room);
  try {
    await set(ref(rtdb, `rooms/${room.id}`), toRtdbRoom(room));
  } catch (err) {
    await remove(ref(rtdb, `roomCodes/${room.code}`)).catch(() => {});
    throw err;
  }
  rememberMyRoom({ roomId: room.id, code: room.code });
}

/** The room id behind a join code, or null (exact-key read: codes cannot be listed) */
export async function resolveRoomCode(code: string): Promise<string | null> {
  const key = normalizeCode(code);
  if (key.length !== ROOM_CODE_LENGTH) return null;
  const snap = await get(ref(rtdb, `roomCodes/${key}`));
  if (!snap.exists()) return null;
  const entry = snap.val() as { roomId?: unknown; createdAt?: unknown };
  if (typeof entry.roomId !== 'string') return null;
  if (typeof entry.createdAt === 'number' && isRoomExpired({ createdAt: entry.createdAt })) return null;
  return entry.roomId;
}

/** Look up a joinable room by code (read-only): it must exist, be waiting, and be younger than 6 hours */
export async function lookupRoomByCode(code: string): Promise<Room | null> {
  const roomId = await resolveRoomCode(code);
  if (!roomId) return null;
  const snap = await get(ref(rtdb, `rooms/${roomId}`));
  if (!snap.exists()) return null;
  const room = roomFromRtdb(snap.val(), roomId);
  if (room.status !== 'waiting' || isRoomExpired(room)) return null;
  return room;
}

/** Look up a room by its 6-character code and add this device's player to it */
export async function joinRoomByCode(
  code: string,
  playerName: string,
  avatar?: string,
): Promise<{ room: Room; player: Player } | null> {
  const room = await lookupRoomByCode(code);
  if (!room) return null;

  const player = buildPlayer(playerName, room.players.length, avatar);
  /* Each player writes only their own entry (key = uid): concurrent joins cannot overwrite each other */
  await set(ref(rtdb, `rooms/${room.id}/players/${player.id}`), { ...player, joinedAt: room.players.length });

  const players = room.players.some((p) => p.id === player.id)
    ? room.players.map((p) => (p.id === player.id ? player : p))
    : [...room.players, player];
  return { room: { ...room, players }, player };
}

/**
 * Subscribe to real-time updates for a room.
 * Returns an unsubscribe function.
 */
export function listenToRoom(
  roomId: string,
  callback: (room: Room | null) => void,
): Unsubscribe {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  return onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) { callback(null); return; }
    callback(roomFromRtdb(snapshot.val(), roomId));
  });
}

/** Update the room status (host only: e.g. 'waiting' -> 'playing') */
export async function updateRoomStatus(
  roomId: string,
  status: Room['status'],
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}`), { status });
}

/** Mark a specific player as ready in the room (a player writes only their own entry) */
export async function setPlayerReady(
  roomId: string,
  playerId: string,
  ready: boolean,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/players/${playerId}`), {
    isReady: ready,
  });
}

/**
 * Reset the room for a replay: status back to waiting and the game cleared.
 * The host also resets everyone's ready flag and score; a guest can only do the first part (each guest
 * resets their own ready flag when the lobby opens, see LobbyPage).
 */
export async function replayRoom(roomId: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;
  const room = roomFromRtdb(snapshot.val(), roomId);

  if (room.hostId === getCurrentUid()) {
    const players: Record<string, unknown> = {};
    room.players.forEach((p, i) => {
      players[p.id] = { ...p, score: 0, isReady: p.isHost, joinedAt: i };
    });
    await update(roomRef, { status: 'waiting', players, game: null });
    return;
  }
  await remove(ref(rtdb, `rooms/${roomId}/game`));
  await set(ref(rtdb, `rooms/${roomId}/status`), 'waiting');
}

/** Remove the room and its join code from RTDB (host cleanup) */
export async function deleteRoom(roomId: string): Promise<void> {
  let code: string | null = null;
  try {
    const snap = await get(ref(rtdb, `rooms/${roomId}/code`));
    code = snap.exists() ? (snap.val() as string) : null;
  } catch {
    code = null;
  }
  await remove(ref(rtdb, `rooms/${roomId}`));
  if (code) await remove(ref(rtdb, `roomCodes/${code}`)).catch(() => {});
  rememberMyRoom(null);
}

/** Remove a specific player from the room by their player ID (their own entry; the host may remove any) */
export async function removePlayer(roomId: string, playerId: string): Promise<void> {
  await remove(ref(rtdb, `rooms/${roomId}/players/${playerId}`));
}

/**
 * Register an onDisconnect handler so that if a player's browser closes,
 * the room knows. For the host, the entire room (and its join code) is deleted.
 * For a guest, their player entry is removed.
 */
export function registerDisconnectCleanup(
  roomId: string,
  isHost: boolean,
  playerId?: string,
  code?: string,
): void {
  if (isHost) {
    onDisconnect(ref(rtdb, `rooms/${roomId}`)).remove();
    if (code) onDisconnect(ref(rtdb, `roomCodes/${code}`)).remove();
  } else if (playerId) {
    onDisconnect(ref(rtdb, `rooms/${roomId}/players/${playerId}`)).remove();
  }
}

/** Remove null/undefined holes from a players array (left by disconnects) */
export function cleanPlayers(players: (Player | null | undefined)[]): Player[] {
  return players.filter((p): p is Player => p != null);
}
