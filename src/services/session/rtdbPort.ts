/**
 * The RTDB implementation of the session port (rooms with a code, several phones).
 * Only ever loaded through `import('./rtdbPort')` from session/index.ts, so Firebase stays out of every
 * chunk that only plays solo / duel games.
 */
import {
  advanceQuestion,
  listenToGameState,
  recordCorrectAnswer,
  recordPlayerFinished,
  setGamePhase,
} from '@/services/gameSession';
import { deleteRoom, listenToRoom, removePlayer, replayRoom } from '@/services/roomManager';
import { initRoomGame } from '@/services/roomGame';
import type { GameSessionPort } from './types';

export function createRtdbPort(roomId: string): GameSessionPort {
  return {
    local: false,
    initGame: (settings, playerIds) => initRoomGame(roomId, settings, playerIds),
    listenGame: (cb) => listenToGameState(roomId, cb),
    listenRoom: (cb) => listenToRoom(roomId, cb),
    recordCorrectAnswer: (playerId, count) => recordCorrectAnswer(roomId, playerId, count),
    recordPlayerFinished: (playerId) => recordPlayerFinished(roomId, playerId),
    setPhase: (phase) => setGamePhase(roomId, phase),
    advanceQuestion: (nextIndex) => advanceQuestion(roomId, nextIndex),
    replay: () => replayRoom(roomId),
    leave: (playerId) => removePlayer(roomId, playerId),
    close: () => deleteRoom(roomId),
  };
}
