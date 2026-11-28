/**
 * Rooms for games played on this device only (solo, two on one phone). No Firebase: ids are random,
 * there is no join code, and `local: true` makes the game pages use the in-memory session.
 */
import { DEFAULT_GAME_SETTINGS, AVATARS } from '@/utils/constants';
import type { GameSettings, Player, Room } from '@/utils/types';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Id of the second local player (duel); mirrors roomManager.coPlayerId without importing it */
export function localCoPlayerId(hostId: string): string {
  return `${hostId}_2`;
}

export function buildLocalPlayer(name: string, index: number, avatar?: string, id?: string): Player {
  return {
    id: id ?? randomId(),
    name,
    avatar: avatar || AVATARS[index % AVATARS.length],
    score: 0,
    isHost: index === 0,
    isReady: true,
  };
}

/** A room that is already playing, with `players` (the first is the host) */
export function buildLocalRoom(players: Player[], settings?: Partial<GameSettings>): Room {
  const host = players[0];
  return {
    id: `local-${randomId()}`,
    code: '',
    hostId: host.id,
    players,
    status: 'playing',
    settings: { ...DEFAULT_GAME_SETTINGS, ...settings },
    createdAt: Date.now(),
    local: true,
  };
}
