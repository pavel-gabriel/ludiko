import type { GameSettings, Room } from '@/utils/types';
import type { RTDBGameState } from '@/services/gameState';

export type Unsub = () => void;
export type GamePhase = RTDBGameState['phase'];

/**
 * Everything a game page does with its room's shared state. Two implementations:
 *  - local (services/session/localSession.ts): solo and two-on-one-phone, in memory, no Firebase, no network;
 *  - RTDB (services/session/rtdbPort.ts): rooms with a code on several phones, loaded lazily.
 * Both use the RTDB game-state shape, so the pages do not care which one they talk to.
 */
export interface GameSessionPort {
  /** True when nothing leaves this device */
  readonly local: boolean;
  /** Generate the game for `settings` (v1 generators / items / memory) and publish it, phase `countdown` */
  initGame(settings: GameSettings, playerIds: string[]): Promise<void>;
  /** Subscribe to the game state (called with the current value, then on every change; null = none yet) */
  listenGame(cb: (state: RTDBGameState | null) => void): Unsub;
  /** Subscribe to the room (null = it was deleted). Local rooms never change under the page: no-op. */
  listenRoom(cb: (room: Room | null) => void): Unsub;
  recordCorrectAnswer(playerId: string, count: number): Promise<void>;
  recordPlayerFinished(playerId: string): Promise<void>;
  setPhase(phase: GamePhase): Promise<void>;
  advanceQuestion(nextIndex: number): Promise<void>;
  /** Back to the waiting room (RTDB) / drop the game so a new one can be initialised (local) */
  replay(): Promise<void>;
  /** This player leaves the room */
  leave(playerId: string): Promise<void>;
  /** The host ends the room */
  close(): Promise<void>;
}
