export type Difficulty = 'easy' | 'medium' | 'hard';
export type Operation = '+' | '-' | '×' | '÷';
export type Language = 'ro' | 'en';
export type GameType = 'mathRace' | 'shapeMatch' | 'memoryGame';
export type GameMode = 'raceToFinish' | 'timedSprint';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  settings: GameSettings;
  createdAt: number;
}

export interface GameSettings {
  gameType: GameType;
  gameMode: GameMode;
  difficulty: Difficulty;
  operations: Operation[];
  rounds: number;
  timePerRound: number;
}

/** Math question (used by Math Race and Timed Sprint) */
export interface Question {
  id: string;
  a: number;
  b: number;
  operation: Operation;
  correctAnswer: number;
  options: number[];
}

/** Shape question (used by Shape Match) */
export interface ShapeQuestion {
  id: string;
  targetShape: string;
  targetLabel: string;
  options: ShapeOption[];
  correctIndex: number;
}

export interface ShapeOption {
  shape: string;
  color: string;
  label: string;
}

/** Memory card (used by Card Flip Memory game) */
export interface MemoryCard {
  id: string;
  pairId: string;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

export interface GameSession {
  roomId: string;
  currentRound: number;
  totalRounds: number;
  currentQuestion: Question | null;
  scores: Record<string, number>;
  status: 'countdown' | 'question' | 'result' | 'finished';
  timeRemaining: number;
}

export interface UserPreferences {
  language: Language;
  dyslexicFont: boolean;
  soundEnabled: boolean;
}
