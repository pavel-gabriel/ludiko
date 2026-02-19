import { create } from 'zustand';
import type { Room, Player } from '@/utils/types';

interface RoomState {
  room: Room | null;
  currentPlayer: Player | null;
  setRoom: (room: Room | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  updatePlayers: (players: Player[]) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  currentPlayer: null,
  setRoom: (room) => set({ room }),
  setCurrentPlayer: (currentPlayer) => set({ currentPlayer }),
  updatePlayers: (players) =>
    set((state) => (state.room ? { room: { ...state.room, players } } : state)),
  reset: () => set({ room: null, currentPlayer: null }),
}));
