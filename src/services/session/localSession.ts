/**
 * In-memory game session for solo and two-on-one-phone games: the same operations and data shapes as the
 * RTDB one (services/gameSession.ts) but nothing leaves the device, so it works offline, on a build without
 * Firebase config, and never imports Firebase.
 */
import { buildGamePlan, planToGameState, type RTDBGameState } from '@/services/gameState';
import type { GameSettings } from '@/utils/types';
import type { GameSessionPort, GamePhase } from './types';

interface Session {
  state: RTDBGameState | null;
  listeners: Set<(s: RTDBGameState | null) => void>;
  /** A phase change that arrived before the game was generated (slow content pack): applied on init */
  pendingPhase: GamePhase | null;
}

const sessions = new Map<string, Session>();

function session(roomId: string): Session {
  let s = sessions.get(roomId);
  if (!s) {
    s = { state: null, listeners: new Set(), pendingPhase: null };
    sessions.set(roomId, s);
  }
  return s;
}

/** Replace the state with a fresh object (React compares by identity) and tell the listeners */
function publish(roomId: string, next: RTDBGameState | null): void {
  const s = session(roomId);
  s.state = next;
  for (const cb of [...s.listeners]) cb(next);
}

function patch(roomId: string, fn: (s: RTDBGameState) => RTDBGameState): void {
  const cur = session(roomId).state;
  if (cur) publish(roomId, fn(cur));
}

/** Current state of a local room (tests) */
export function getLocalGameState(roomId: string): RTDBGameState | null {
  return sessions.get(roomId)?.state ?? null;
}

export function createLocalPort(roomId: string): GameSessionPort {
  return {
    local: true,

    async initGame(settings: GameSettings, playerIds: string[]) {
      const s = session(roomId);
      /* A restart: drop the finished game now, so a phase change during generation is not applied to it */
      if (s.state) publish(roomId, null);
      const plan = await buildGamePlan(settings);
      const fresh = planToGameState(plan, playerIds);
      if (s.pendingPhase) {
        fresh.phase = s.pendingPhase;
        if (s.pendingPhase === 'playing') fresh.startedAt = Date.now();
        s.pendingPhase = null;
      }
      publish(roomId, fresh);
    },

    listenGame(cb) {
      const s = session(roomId);
      s.listeners.add(cb);
      cb(s.state);
      return () => {
        s.listeners.delete(cb);
      };
    },

    listenRoom() {
      return () => {};
    },

    async recordCorrectAnswer(playerId, count) {
      patch(roomId, (g) => ({ ...g, progress: { ...g.progress, [playerId]: count } }));
    },

    async recordPlayerFinished(playerId) {
      patch(roomId, (g) => ({ ...g, finishTimes: { ...g.finishTimes, [playerId]: Date.now() } }));
    },

    async setPhase(phase: GamePhase) {
      const s = session(roomId);
      if (!s.state) {
        s.pendingPhase = phase;
        return;
      }
      patch(roomId, (g) => ({ ...g, phase, ...(phase === 'playing' ? { startedAt: Date.now() } : {}) }));
    },

    async advanceQuestion(nextIndex) {
      patch(roomId, (g) => ({ ...g, currentIndex: nextIndex, questionStartedAt: Date.now() }));
    },

    async replay() {
      session(roomId).pendingPhase = null;
      publish(roomId, null);
    },

    async leave() {},

    async close() {
      const s = sessions.get(roomId);
      sessions.delete(roomId);
      s?.listeners.clear();
    },
  };
}
