/**
 * Game state shape and the firebase-free "plan" builder shared by both session implementations
 * (the RTDB one for rooms on several phones, the in-memory one for solo / two-on-one-phone).
 * Nothing here imports Firebase, so a solo game never pulls it in.
 */
import {
  generateMemoryCards,
  generateNumericQuestion,
  generateShapeQuestion,
} from '@/services/gameEngine';
import { ensureContentForSkills } from '@/engine/content/packs';
import { buildGameItems, gameKind, isItemGame, ITEM_SPRINT_POOL } from '@/services/itemGame';
import type { Item } from '@/engine/types';
import type { GameSettings, GameType, MemoryCard, Question, ShapeQuestion } from '@/utils/types';

/** Shape of the game state stored in RTDB under rooms/{roomId}/game (and held in memory for local games) */
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

/** v1 question pool for a timed sprint, so players don't run out */
export const V1_SPRINT_POOL = 100;

/**
 * Memory board for the room: always classic picture pairs (v1 emoji cards), whatever the settings say.
 * An old memory room that still carries `skillIds` (text cards were once built from items) plays with pictures.
 */
export function buildRoomMemoryCards(settings: GameSettings): MemoryCard[] {
  return generateMemoryCards(settings.rounds);
}

/** What a game will be played with: generated once by the host (or the only device) */
export type GamePlan =
  | { kind: 'memory'; cards: MemoryCard[] }
  | { kind: 'item'; items: Item[]; gameType: GameType }
  | { kind: 'shape'; questions: ShapeQuestion[] }
  | { kind: 'math'; questions: Question[]; gameType: GameType };

/**
 * Turn a room's `GameSettings` into the content to play (rules: see roomGame.ts):
 * memory -> picture pairs; skillIds -> items (content packs loaded first); else the v1 generators.
 * An unplayable skill selection falls back to the v1 generators.
 */
export async function buildGamePlan(settings: GameSettings): Promise<GamePlan> {
  const sprint = settings.gameMode === 'timedSprint';

  if (settings.gameType === 'memoryGame') {
    return { kind: 'memory', cards: buildRoomMemoryCards(settings) };
  }

  if (isItemGame(settings)) {
    await ensureContentForSkills(settings.skillIds!);
    const items = buildGameItems(settings.skillIds!, {
      count: sprint ? ITEM_SPRINT_POOL : settings.rounds,
      kind: gameKind(settings),
      difficulty: settings.difficulty,
    });
    if (items.length > 0) return { kind: 'item', items, gameType: settings.gameType };
    /* unplayable selection: fall through to the v1 generators */
  }

  const count = sprint ? V1_SPRINT_POOL : settings.rounds;
  if (settings.gameType === 'shapeMatch') {
    const questions: ShapeQuestion[] = [];
    for (let i = 0; i < count; i++) questions.push(generateShapeQuestion(settings.difficulty));
    return { kind: 'shape', questions };
  }
  /* Numeric games: mathRace, equations, countingGame, numberSequence */
  const questions: Question[] = [];
  for (let i = 0; i < count; i++) {
    questions.push(generateNumericQuestion(settings.gameType, settings.difficulty, settings.operations));
  }
  return { kind: 'math', questions, gameType: settings.gameType };
}

/** The initial game state for a plan (countdown phase, everybody at 0) */
export function planToGameState(plan: GamePlan, playerIds: string[]): RTDBGameState {
  const progress: Record<string, number> = {};
  for (const id of playerIds) progress[id] = 0;
  const base = { currentIndex: 0, progress, phase: 'countdown' as const, questionStartedAt: 0 };
  switch (plan.kind) {
    case 'memory':
      return { gameType: 'memoryGame', memoryCards: plan.cards, ...base };
    case 'item':
      return { gameType: plan.gameType, items: plan.items, ...base };
    case 'shape':
      return { gameType: 'shapeMatch', shapeQuestions: plan.questions, ...base };
    default:
      return { gameType: plan.gameType, questions: plan.questions, ...base };
  }
}
