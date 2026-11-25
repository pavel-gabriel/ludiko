import type { Difficulty, GameCategory, GameSettings, GameType } from './types';

export const APP_NAME = 'Ludiko';

export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS = 30;
export const MIN_PLAYERS = 1;

export const AVATARS = ['🦊', '🐸', '🐱', '🐶', '🐰', '🦁', '🐼', '🐨'];

export const DIFFICULTY_RANGES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 1, max: 10 },
  medium: { min: 1, max: 50 },
  hard: { min: 1, max: 100 },
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  gameType: 'mathRace',
  gameMode: 'raceToFinish',
  difficulty: 'easy',
  operations: ['+', '-'],
  rounds: 10,
  timePerRound: 15,
};

export const COUNTDOWN_SECONDS = 3;

/** Available game types with their emoji, i18n key and picker category */
export const GAME_TYPES: {
  type: GameType;
  emoji: string;
  labelKey: string;
  category: GameCategory;
}[] = [
  { type: 'mathRace', emoji: '🏎️', labelKey: 'create.gameTypeMathRace', category: 'math' },
  { type: 'equations', emoji: '🧮', labelKey: 'create.gameTypeEquations', category: 'math' },
  { type: 'countingGame', emoji: '🍎', labelKey: 'create.gameTypeCountingGame', category: 'math' },
  { type: 'numberSequence', emoji: '🔢', labelKey: 'create.gameTypeNumberSequence', category: 'math' },
  { type: 'shapeMatch', emoji: '🔷', labelKey: 'create.gameTypeShapeMatch', category: 'other' },
  { type: 'memoryGame', emoji: '🃏', labelKey: 'create.gameTypeMemoryGame', category: 'other' },
];

/** Game categories in display order, with i18n keys */
export const GAME_CATEGORIES: { category: GameCategory; labelKey: string }[] = [
  { category: 'math', labelKey: 'create.categoryMath' },
  { category: 'other', labelKey: 'create.categoryOther' },
];

/** True for game types where the +, −, ×, ÷ operations setting applies */
export function usesOperations(gameType: GameType): boolean {
  return gameType === 'mathRace' || gameType === 'equations';
}

/** Letter shown for the unknown number in equation questions (e.g. "a + 7 = 15") */
export const EQUATION_VARIABLE = 'a';

/** Countable emojis for the Counting game (single-codepoint, kid-friendly) */
export const COUNTING_EMOJIS = ['🍎', '⭐', '🎈', '🐟', '🌸', '🦆', '🍪', '🐞', '🍄', '🐢'];

/** Shapes used in Shape Match game — SVG path names + i18n keys */
export const SHAPES = [
  { name: 'circle', labelKey: 'shapes.circle', color: '#A78BFA' },
  { name: 'square', labelKey: 'shapes.square', color: '#60A5FA' },
  { name: 'triangle', labelKey: 'shapes.triangle', color: '#34D399' },
  { name: 'star', labelKey: 'shapes.star', color: '#FBBF24' },
  { name: 'heart', labelKey: 'shapes.heart', color: '#F472B6' },
  { name: 'diamond', labelKey: 'shapes.diamond', color: '#FB923C' },
  { name: 'hexagon', labelKey: 'shapes.hexagon', color: '#2DD4BF' },
  { name: 'oval', labelKey: 'shapes.oval', color: '#C084FC' },
];

/** Emoji pairs for the Memory game */
export const MEMORY_EMOJIS = [
  '🍎', '🍌', '🍇', '🍓', '🌟', '🌈', '🦋', '🐙',
  '🎨', '🎵', '🚀', '🌻', '🐝', '🍕', '🎪', '🏰',
  '🎯', '🎲', '🧩', '🎸', '⚽', '🏀', '🎳', '🎭',
  '🦄', '🐳', '🐘', '🦜', '🌮', '🧁', '🍩', '🎂',
  '🔮', '💎', '🪐', '🌙', '⛄', '🎃', '🎄', '🌺',
  '🍉', '🥝', '🫐', '🍑', '🥥', '🌽', '🧀', '🍔',
  '🚗', '✈️', '🚢', '🏠',
];

/** Timed Sprint total duration in seconds */
export const TIMED_SPRINT_DURATION = 60;

/**
 * Public contact for copyright / rights-holder requests, shown on /credits.
 * Consider a dedicated address before public launch (docs/LEGAL_CONTENT_POLICY.md §9).
 */
export const RIGHTS_CONTACT = 'pavel.gabriell@yahoo.com';
