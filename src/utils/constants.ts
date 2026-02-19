import type { Difficulty, GameSettings } from './types';

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
  difficulty: 'easy',
  operations: ['+', '-'],
  rounds: 10,
  timePerRound: 15,
};

export const COUNTDOWN_SECONDS = 3;
