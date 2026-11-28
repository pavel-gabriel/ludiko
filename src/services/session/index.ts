/**
 * Picks the session implementation for a room: local (in memory) for solo / two-on-one-phone rooms
 * (`room.local`), RTDB for multiplayer rooms. The RTDB module (and Firebase with it) is imported lazily,
 * on first use, so a local game never loads it.
 */
import { useMemo } from 'react';
import { createLocalPort } from './localSession';
import type { GameSessionPort, Unsub } from './types';
import type { Room } from '@/utils/types';

export type { GameSessionPort, Unsub, GamePhase } from './types';

type Impl = GameSessionPort;
const load = (roomId: string): Promise<Impl> =>
  import('./rtdbPort').then((m) => m.createRtdbPort(roomId));

/** RTDB port whose Firebase code is fetched on first use */
function createLazyRtdbPort(roomId: string): GameSessionPort {
  let impl: Promise<Impl> | null = null;
  const get = () => (impl ??= load(roomId));
  const call =
    <A extends unknown[]>(fn: (p: Impl, ...a: A) => Promise<void>) =>
    async (...a: A) =>
      fn(await get(), ...a);
  const subscribe = (setup: (p: Impl) => Unsub): Unsub => {
    let off: Unsub | null = null;
    let dead = false;
    get().then(
      (p) => {
        if (!dead) off = setup(p);
      },
      () => {},
    );
    return () => {
      dead = true;
      off?.();
    };
  };
  return {
    local: false,
    initGame: call((p, s, ids) => p.initGame(s, ids)),
    listenGame: (cb) => subscribe((p) => p.listenGame(cb)),
    listenRoom: (cb) => subscribe((p) => p.listenRoom(cb)),
    recordCorrectAnswer: call((p, id, n) => p.recordCorrectAnswer(id, n)),
    recordPlayerFinished: call((p, id) => p.recordPlayerFinished(id)),
    setPhase: call((p, ph) => p.setPhase(ph)),
    advanceQuestion: call((p, i) => p.advanceQuestion(i)),
    replay: call((p) => p.replay()),
    leave: call((p, id) => p.leave(id)),
    close: call((p) => p.close()),
  };
}

export function getSessionPort(room: Pick<Room, 'id' | 'local'> | null | undefined): GameSessionPort {
  const id = room?.id ?? '';
  return room?.local || !room ? createLocalPort(id) : createLazyRtdbPort(id);
}

/** The port for the room in the store (stable per room id) */
export function useSessionPort(room: Pick<Room, 'id' | 'local'> | null | undefined): GameSessionPort {
  const id = room?.id;
  const local = room?.local;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getSessionPort(id === undefined ? null : { id, local }), [id, local]);
}
