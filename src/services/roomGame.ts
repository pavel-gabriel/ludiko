/**
 * The one place that turns a room's `GameSettings` into the RTDB game state (host side).
 * Used by Race/Sprint, Memory, Duel and the teacher's live session, so every mode agrees on how
 * v1 settings (no `skillIds`) and v2 settings (`skillIds`) are handled:
 *
 *   skillIds present                  -> item model (itemGame.ts); memoryGame builds pairs from items
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
import { buildGameItems, buildItemMemoryCards, gameKind, isItemGame, ITEM_SPRINT_POOL } from '@/services/itemGame';
import type { GameSettings, MemoryCard, Question, ShapeQuestion } from '@/utils/types';

/** v1 question pool for a timed sprint, so players don't run out */
export const V1_SPRINT_POOL = 100;

/** Current UI language for card text (the host's language fixes the text of a memory board) */
function uiLang(): string {
  try {
    return (typeof document !== 'undefined' && document.documentElement.lang) || 'ro';
  } catch {
    return 'ro';
  }
}

/**
 * Memory board for the room: from items when skills were chosen (and enough pairs exist), else the v1 emoji board.
 * Pages use `cards.length / 2` as the real number of pairs.
 */
export function buildRoomMemoryCards(settings: GameSettings): MemoryCard[] {
  if (isItemGame(settings)) {
    const cards = buildItemMemoryCards(settings.skillIds!, settings.rounds, {
      difficulty: settings.difficulty,
      lang: uiLang(),
    });
    if (cards) return cards;
  }
  return generateMemoryCards(settings.rounds);
}

export async function initRoomGame(roomId: string, settings: GameSettings, playerIds: string[]): Promise<void> {
  const kind = gameKind(settings);
  const sprint = settings.gameMode === 'timedSprint';

  if (isItemGame(settings)) {
    const skillIds = settings.skillIds!;
    if (kind === 'memory') {
      await initMemoryGameState(roomId, buildRoomMemoryCards(settings), playerIds);
      return;
    } else {
      const items = buildGameItems(skillIds, {
        count: sprint ? ITEM_SPRINT_POOL : settings.rounds,
        kind,
        difficulty: settings.difficulty,
      });
      if (items.length > 0) {
        await initItemGameState(roomId, items, playerIds, settings.gameType);
        return;
      }
    }
    /* unplayable selection: fall through to the v1 generators */
  }

  if (settings.gameType === 'shapeMatch') {
    const count = sprint ? V1_SPRINT_POOL : settings.rounds;
    const questions: ShapeQuestion[] = [];
    for (let i = 0; i < count; i++) questions.push(generateShapeQuestion(settings.difficulty));
    await initShapeGameState(roomId, questions, playerIds);
  } else if (settings.gameType === 'memoryGame') {
    await initMemoryGameState(roomId, generateMemoryCards(settings.rounds), playerIds);
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
