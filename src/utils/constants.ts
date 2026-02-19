import type { Difficulty, GameSettings, GameType } from './types';

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

/** Available game types with their emoji + i18n keys */
export const GAME_TYPES: { type: GameType; emoji: string; labelKey: string }[] = [
  { type: 'mathRace', emoji: '🏎️', labelKey: 'create.gameTypeMathRace' },
  { type: 'shapeMatch', emoji: '🔷', labelKey: 'create.gameTypeShapeMatch' },
  { type: 'memoryGame', emoji: '🃏', labelKey: 'create.gameTypeMemoryGame' },
];

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
];

/** Timed Sprint total duration in seconds */
export const TIMED_SPRINT_DURATION = 60;
