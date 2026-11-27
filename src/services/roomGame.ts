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
  generateMemoryCards,
  generateNumericQuestion,
  generateShapeQuestion,
} from '@/services/gameEngine';
import {
  initItemGameState,
  initMathGameState,
  initMemoryGameState,
  initShapeGameState,
} from '@/services/gameSession';
import { ensureContentForSkills } from '@/engine/content/packs';
import { buildGameItems, gameKind, isItemGame, ITEM_SPRINT_POOL } from '@/services/itemGame';
import type { GameSettings, MemoryCard, Question, ShapeQuestion } from '@/utils/types';

/** v1 question pool for a timed sprint, so players don't run out */
export const V1_SPRINT_POOL = 100;

/**
 * Memory board for the room: always classic picture pairs (v1 emoji cards), whatever the settings say.
 * An old memory room that still carries `skillIds` (text cards were once built from items) plays with pictures.
 */
export function buildRoomMemoryCards(settings: GameSettings): MemoryCard[] {
  return generateMemoryCards(settings.rounds);
}

export async function initRoomGame(roomId: string, settings: GameSettings, playerIds: string[]): Promise<void> {
  const sprint = settings.gameMode === 'timedSprint';

  if (settings.gameType === 'memoryGame') {
    await initMemoryGameState(roomId, buildRoomMemoryCards(settings), playerIds);
    return;
  }

  if (isItemGame(settings)) {
    // The host generates the items: load the chosen skills' content packs first (docs/ENGINE.md "Content packs")
    await ensureContentForSkills(settings.skillIds!);
    const items = buildGameItems(settings.skillIds!, {
      count: sprint ? ITEM_SPRINT_POOL : settings.rounds,
      kind: gameKind(settings),
      difficulty: settings.difficulty,
    });
    if (items.length > 0) {
      await initItemGameState(roomId, items, playerIds, settings.gameType);
      return;
    }
    /* unplayable selection: fall through to the v1 generators */
  }

  if (settings.gameType === 'shapeMatch') {
    const count = sprint ? V1_SPRINT_POOL : settings.rounds;
    const questions: ShapeQuestion[] = [];
    for (let i = 0; i < count; i++) questions.push(generateShapeQuestion(settings.difficulty));
    await initShapeGameState(roomId, questions, playerIds);
  } else {
    /* Numeric games: mathRace, equations, countingGame, numberSequence */
    const count = sprint ? V1_SPRINT_POOL : settings.rounds;
    const questions: Question[] = [];
    for (let i = 0; i < count; i++) {
      questions.push(generateNumericQuestion(settings.gameType, settings.difficulty, settings.operations));
    }
    await initMathGameState(roomId, questions, playerIds, settings.gameType);
  }
}
