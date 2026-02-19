export type Difficulty = 'easy' | 'medium' | 'hard';
export type Operation = '+' | '-' | '×' | '÷';
export type Language = 'ro' | 'en';

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
  difficulty: Difficulty;
  operations: Operation[];
  rounds: number;
  timePerRound: number;
}

export interface Question {
  id: string;
  a: number;
  b: number;
  operation: Operation;
  correctAnswer: number;
  options: number[];
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
