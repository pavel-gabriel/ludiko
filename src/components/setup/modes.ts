import type { SetupMode } from './setupModel';

export const MODE_EMOJI: Record<SetupMode, string> = { race: '🏎️', sprint: '⏱️', memory: '🃏' };
export const MODE_TONE: Record<SetupMode, 'pink' | 'blue' | 'green'> = { race: 'pink', sprint: 'blue', memory: 'green' };
