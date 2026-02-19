import { create } from 'zustand';
import type { GameSession, Question } from '@/utils/types';

interface GameState {
  session: GameSession | null;
  startSession: (roomId: string, totalRounds: number) => void;
  setQuestion: (question: Question) => void;
  nextRound: () => void;
  updateScore: (playerId: string, points: number) => void;
  setStatus: (status: GameSession['status']) => void;
  setTimeRemaining: (time: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  session: null,
  startSession: (roomId, totalRounds) =>
    set({
      session: {
        roomId,
        currentRound: 1,
        totalRounds,
        currentQuestion: null,
        scores: {},
        status: 'countdown',
        timeRemaining: 0,
      },
    }),
  setQuestion: (question) =>
    set((state) =>
      state.session ? { session: { ...state.session, currentQuestion: question } } : state,
    ),
  nextRound: () =>
    set((state) =>
      state.session
        ? { session: { ...state.session, currentRound: state.session.currentRound + 1 } }
        : state,
    ),
  updateScore: (playerId, points) =>
    set((state) => {
      if (!state.session) return state;
      const scores = { ...state.session.scores };
      scores[playerId] = (scores[playerId] || 0) + points;
      return { session: { ...state.session, scores } };
    }),
  setStatus: (status) =>
    set((state) => (state.session ? { session: { ...state.session, status } } : state)),
  setTimeRemaining: (time) =>
    set((state) => (state.session ? { session: { ...state.session, timeRemaining: time } } : state)),
  reset: () => set({ session: null }),
}));
