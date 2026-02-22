import {
  ref,
  set,
  get,
  onValue,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
  onDisconnect,
  type Unsubscribe,
} from 'firebase/database';
import { rtdb } from '@/services/firebase';
import type { Room, Player, GameSettings } from '@/utils/types';
import { ROOM_CODE_LENGTH, DEFAULT_GAME_SETTINGS, AVATARS } from '@/utils/constants';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Generate a random 6-char room code (no ambiguous chars like 0/O/1/I) */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Generate a short unique player ID */
function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Pick an avatar based on current player count */
function pickAvatar(playerCount: number): string {
  return AVATARS[playerCount % AVATARS.length];
}

/* ------------------------------------------------------------------ */
/*  Local room builders (used before pushing to RTDB)                 */
/* ------------------------------------------------------------------ */

/** Build a new Room object with the host as the first player */
export function buildRoom(hostName: string, settings?: Partial<GameSettings>, avatar?: string): Room {
  const hostId = generatePlayerId();
  return {
    id: generatePlayerId(),
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

/** Build a Player object for someone joining an existing room */
export function buildPlayer(name: string, playerCount: number, avatar?: string): Player {
  return {
    id: generatePlayerId(),
    name,
    avatar: avatar || pickAvatar(playerCount),
    score: 0,
    isHost: false,
    isReady: false,
  };
}

/* ------------------------------------------------------------------ */
/*  RTDB operations                                                   */
/* ------------------------------------------------------------------ */

/** Write a newly created room to RTDB */
export async function createRoomInDB(room: Room): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${room.id}`);
  await set(roomRef, room);
}

/** Look up a room by code (read-only, no side effects) */
export async function lookupRoomByCode(code: string): Promise<Room | null> {
  const roomsRef = ref(rtdb, 'rooms');
  const q = query(roomsRef, orderByChild('code'), equalTo(code.toUpperCase()));
  const snapshot = await get(q);
  if (!snapshot.exists()) return null;
  let roomData: Room | null = null;
  let roomId = '';
  snapshot.forEach((child) => {
    roomId = child.key!;
    roomData = child.val() as Room;
  });
  if (!roomData || (roomData as Room).status !== 'waiting') return null;
  return { ...(roomData as Room), id: roomId };
}

/** Look up a room by its 6-digit code and add the player */
export async function joinRoomByCode(
  code: string,
  playerName: string,
  avatar?: string,
): Promise<{ room: Room; player: Player } | null> {
  /* Query RTDB for a room with this code */
  const roomsRef = ref(rtdb, 'rooms');
  const q = query(roomsRef, orderByChild('code'), equalTo(code.toUpperCase()));
  const snapshot = await get(q);

  if (!snapshot.exists()) return null;

  /* There should be exactly one room per code */
  let roomId = '';
  let roomData: Room | null = null;
  snapshot.forEach((child) => {
    roomId = child.key!;
    roomData = child.val() as Room;
  });

  if (!roomData || (roomData as Room).status !== 'waiting') return null;

  const room = roomData as Room;
  const players: Player[] = room.players ?? [];
  const player = buildPlayer(playerName, players.length, avatar);
  players.push(player);

  /* Push the updated players list back to RTDB */
  await update(ref(rtdb, `rooms/${roomId}`), { players });

  return { room: { ...room, id: roomId, players }, player };
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
    const room = snapshot.val() as Room;
    /* Clean up null slots left by onDisconnect.remove() on player refs */
    room.players = cleanPlayers(room.players);
    callback(room);
  });
}

/** Update the room status (e.g. 'waiting' -> 'playing' -> 'finished') */
export async function updateRoomStatus(
  roomId: string,
  status: Room['status'],
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}`), { status });
}

/** Mark a specific player as ready in the room */
export async function setPlayerReady(
  roomId: string,
  playerIndex: number,
  ready: boolean,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/players/${playerIndex}`), {
    isReady: ready,
  });
}

/** Reset room for replay: set status to waiting, reset all players' ready + scores, clear game */
export async function replayRoom(roomId: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;
  const room = snapshot.val() as Room;

  const players = (room.players ?? []).map((p: Player) => ({
    ...p,
    score: 0,
    isReady: p.isHost,
  }));

  await update(roomRef, {
    status: 'waiting',
    players,
    game: null,
  });
}

/** Remove the room from RTDB (host cleanup) */
export async function deleteRoom(roomId: string): Promise<void> {
  await remove(ref(rtdb, `rooms/${roomId}`));
}

/** Remove a specific player from the room by their player ID */
export async function removePlayer(roomId: string, playerId: string): Promise<void> {
  const roomRef = ref(rtdb, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return;
  const room = snapshot.val() as Room;
  const players = (room.players ?? []).filter((p: Player) => p.id !== playerId);
  await update(roomRef, { players });
}

/**
 * Register an onDisconnect handler so that if a player's browser closes,
 * the room knows. For the host, the entire room is deleted.
 * For non-host, the player slot is nullified (cleaned up on next read).
 */
export function registerDisconnectCleanup(
  roomId: string,
  isHost: boolean,
  playerIndex?: number,
): void {
  if (isHost) {
    const roomRef = ref(rtdb, `rooms/${roomId}`);
    onDisconnect(roomRef).remove();
  } else if (playerIndex != null) {
    const playerRef = ref(rtdb, `rooms/${roomId}/players/${playerIndex}`);
    onDisconnect(playerRef).remove();
  }
}

/** Remove null/undefined holes from a players array (left by disconnects) */
export function cleanPlayers(players: (Player | null | undefined)[]): Player[] {
  return players.filter((p): p is Player => p != null);
}
