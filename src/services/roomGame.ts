/**
 * The one place that turns a room's `GameSettings` into the RTDB game state (host side).
 * Used by Race/Sprint, Memory, Duel and the teacher's live session, so every mode agrees on how
 * v1 settings (no `skillIds`) and v2 settings (`skillIds`) are handled:
 *
 *   memoryGame                        -> classic picture pairs (generateMemoryCards), skillIds ignored
 *   skillIds present                  -> item model (itemGame.ts)
 *   skillIds absent (every old room)  -> the v1 generators in gameEngine.ts, unchanged
 *
 * If a skill selection cannot be played (too few usable items) the host falls back to the v1 generators
 * for the chosen game type rather than leaving the room stuck on "get ready".
 */
import {
  initItemGameState,
  initMathGameState,
  initMemoryGameState,
  initShapeGameState,
} from '@/services/gameSession';
import { buildGamePlan } from '@/services/gameState';
import type { GameSettings } from '@/utils/types';

export { V1_SPRINT_POOL, buildRoomMemoryCards } from '@/services/gameState';

/** RTDB host side: generate the game (see `buildGamePlan`) and write it under rooms/{roomId}/game */
export async function initRoomGame(roomId: string, settings: GameSettings, playerIds: string[]): Promise<void> {
  const plan = await buildGamePlan(settings);
  switch (plan.kind) {
    case 'memory':
      return initMemoryGameState(roomId, plan.cards, playerIds);
    case 'item':
      return initItemGameState(roomId, plan.items, playerIds, plan.gameType);
    case 'shape':
      return initShapeGameState(roomId, plan.questions, playerIds);
    default:
      return initMathGameState(roomId, plan.questions, playerIds, plan.gameType);
  }
}
