import { ref, update, onValue, type Unsubscribe } from 'firebase/database';
import { rtdb } from '@/services/firebase';
import type { Item } from '@/engine/types';
import type { Question, ShapeQuestion, MemoryCard, GameType } from '@/utils/types';
import { normalizeItems, sanitizeForRtdb } from '@/services/rtdbSafe';

/** Shape of the game state stored in RTDB under rooms/{roomId}/game */
export interface RTDBGameState {
  /** Which game is being played */
  gameType: GameType;
  /** Math questions (Math Race / Timed Sprint), v1 rooms */
  questions?: Question[];
  /**
   * v2: shared-model items (any skill) for Race / Sprint / Duel. Present instead of `questions` when the
   * room was created with `settings.skillIds`. RTDB-safe (see `sanitizeForRtdb`).
   */
  items?: Item[];
  /** Shape questions (Shape Match) */
  shapeQuestions?: ShapeQuestion[];
  /** Memory cards layout (Memory Game) — shared board for all players */
  memoryCards?: MemoryCard[];
  /** Index of the current question (host advances this; not used for Memory) */
  currentIndex: number;
  /** Per-player progress: playerId -> score (correct answers or matched pairs) */
  progress: Record<string, number>;
  /** Game phase: countdown, playing, finished */
  phase: 'countdown' | 'playing' | 'finished';
  /** Timestamp when the current question started (for timer sync) */
  questionStartedAt: number;
  /** Timestamp (ms) when game started playing (set by host) */
  startedAt?: number;
  /** Per-player finish timestamps (ms) — set when a player completes all rounds */
  finishTimes?: Record<string, number>;
}

/** Build the initial progress map for all players */
function buildProgress(playerIds: string[]): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const id of playerIds) {
    progress[id] = 0;
  }
  return progress;
}

/** Write the initial game state for numeric games (Math Race, Counting, Sequence) */
export async function initMathGameState(
  roomId: string,
  questions: Question[],
  playerIds: string[],
  gameType: GameType = 'mathRace',
): Promise<void> {
  const gameState: RTDBGameState = {
    gameType,
    questions,
    currentIndex: 0,
    progress: buildProgress(playerIds),
    phase: 'countdown',
    questionStartedAt: 0,
  };
  await update(ref(rtdb, `rooms/${roomId}`), { game: gameState });
}

/** Write the initial game state for item-based Race / Sprint / Duel (v2): items of any skill */
export async function initItemGameState(
  roomId: string,
  items: Item[],
  playerIds: string[],
  gameType: GameType = 'mathRace',
): Promise<void> {
  const gameState: RTDBGameState = {
    gameType,
    items: sanitizeForRtdb(items),
    currentIndex: 0,
    progress: buildProgress(playerIds),
    phase: 'countdown',
    questionStartedAt: 0,
  };
  await update(ref(rtdb, `rooms/${roomId}`), { game: gameState });
}

/** Write the initial game state for Shape Match */
export async function initShapeGameState(
  roomId: string,
  shapeQuestions: ShapeQuestion[],
  playerIds: string[],
): Promise<void> {
  const gameState: RTDBGameState = {
    gameType: 'shapeMatch',
    shapeQuestions,
    currentIndex: 0,
    progress: buildProgress(playerIds),
    phase: 'countdown',
    questionStartedAt: 0,
  };
  await update(ref(rtdb, `rooms/${roomId}`), { game: gameState });
}

/** Write the initial game state for Memory Game */
export async function initMemoryGameState(
  roomId: string,
  memoryCards: MemoryCard[],
  playerIds: string[],
): Promise<void> {
  const gameState: RTDBGameState = {
    gameType: 'memoryGame',
    memoryCards,
    currentIndex: 0,
    progress: buildProgress(playerIds),
    phase: 'countdown',
    questionStartedAt: 0,
  };
  await update(ref(rtdb, `rooms/${roomId}`), { game: gameState });
}

/** @deprecated Use initMathGameState instead */
export async function initGameState(
  roomId: string,
  questions: Question[],
  playerIds: string[],
): Promise<void> {
  return initMathGameState(roomId, questions, playerIds);
}

/** Subscribe to game state changes for a room */
export function listenToGameState(
  roomId: string,
  callback: (state: RTDBGameState | null) => void,
): Unsubscribe {
  const gameRef = ref(rtdb, `rooms/${roomId}/game`);
  return onValue(gameRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    const state = snapshot.val() as RTDBGameState;
    if (state.items) state.items = normalizeItems(state.items);
    callback(state);
  });
}

/** Record a correct answer for a player (increment progress) */
export async function recordCorrectAnswer(
  roomId: string,
  playerId: string,
  newCount: number,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/game/progress`), {
    [playerId]: newCount,
  });
}

/** Host advances to the next question */
export async function advanceQuestion(
  roomId: string,
  nextIndex: number,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/game`), {
    currentIndex: nextIndex,
    questionStartedAt: Date.now(),
  });
}

/** Set the game phase (countdown -> playing -> finished) */
export async function setGamePhase(
  roomId: string,
  phase: RTDBGameState['phase'],
): Promise<void> {
  const updates: Record<string, unknown> = { phase };
  if (phase === 'playing') updates.startedAt = Date.now();
  await update(ref(rtdb, `rooms/${roomId}/game`), updates);
}

/** Record that a player finished all rounds (stores timestamp for ranking) */
export async function recordPlayerFinished(
  roomId: string,
  playerId: string,
): Promise<void> {
  await update(ref(rtdb, `rooms/${roomId}/game/finishTimes`), {
    [playerId]: Date.now(),
  });
}
