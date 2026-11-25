import type { ReactElement } from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/config';
import type { ChoiceItem } from '../src/engine/types';
import type { Player, Room } from '../src/utils/types';
import type { RTDBGameState } from '../src/services/gameSession';
import { useRoomStore } from '../src/store/roomStore';
import { StrictMode } from 'react';

/* ---- RTDB layer mocked: the pages talk to these functions only ---- */
const svc = vi.hoisted(() => ({
  state: null as unknown,
  recordCorrectAnswer: vi.fn(async () => {}),
  recordPlayerFinished: vi.fn(async () => {}),
  setGamePhase: vi.fn(async () => {}),
  initItemGameState: vi.fn(async () => {}),
  initMathGameState: vi.fn(async () => {}),
  initShapeGameState: vi.fn(async () => {}),
  initMemoryGameState: vi.fn(async () => {}),
}));
vi.mock('../src/services/gameSession', () => ({
  listenToGameState: (_id: string, cb: (s: unknown) => void) => {
    cb(svc.state);
    return () => {};
  },
  recordCorrectAnswer: svc.recordCorrectAnswer,
  recordPlayerFinished: svc.recordPlayerFinished,
  setGamePhase: svc.setGamePhase,
  initItemGameState: svc.initItemGameState,
  initMathGameState: svc.initMathGameState,
  initShapeGameState: svc.initShapeGameState,
  initMemoryGameState: svc.initMemoryGameState,
}));
vi.mock('../src/services/roomManager', () => ({
  replayRoom: vi.fn(async () => {}),
  deleteRoom: vi.fn(async () => {}),
  removePlayer: vi.fn(async () => {}),
  listenToRoom: () => () => {},
}));
vi.mock('../src/components/leaderboard/GameResults', () => ({
  default: ({ scores }: { scores: Record<string, number> }) => <div data-testid="results">{JSON.stringify(scores)}</div>,
}));

import MathRacePage from '../src/components/games/MathRace/MathRacePage';
import MemoryGamePage from '../src/components/games/MemoryGame/MemoryGamePage';

const prov = { id: 'p', kind: 'item' as const, title: 't', author: 'Ludiko', source: 'own' as const, licence: 'OWN' as const };
const base = { skillId: 'mat.add.nocarry.20', difficulty: 1 as const, reviewStatus: 'beta' as const, provenance: prov };

const choice = (n: number): ChoiceItem => ({
  ...base,
  id: `gen.item${n}`,
  type: 'choice',
  prompt: { ro: `Cât face ${n} + 1?` },
  options: [
    { id: 'right', text: { ro: String(n + 1) } },
    { id: 'wrong', text: { ro: String(n + 7) } },
  ],
  correctId: 'right',
});

const me: Player = { id: 'p1', name: 'Ana', avatar: '🦊', score: 0, isHost: false, isReady: true };

function room(over: Partial<Room['settings']> = {}, players: Player[] = [me]): Room {
  return {
    id: 'room1',
    code: 'ABC234',
    hostId: 'someone-else',
    players,
    status: 'playing',
    createdAt: 0,
    settings: {
      gameType: 'mathRace',
      gameMode: 'raceToFinish',
      difficulty: 'easy',
      operations: ['+'],
      rounds: 3,
      timePerRound: 30,
      ...over,
    },
  };
}

function seed(r: Room, state: Partial<RTDBGameState>, who: Player = me) {
  useRoomStore.setState({ room: r, currentPlayer: who });
  svc.state = {
    gameType: r.settings.gameType,
    currentIndex: 0,
    progress: Object.fromEntries(r.players.map((p) => [p.id, 0])),
    phase: 'playing',
    questionStartedAt: 0,
    ...state,
  };
}

const flush = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

async function mount(ui: ReactElement) {
  await act(async () => {
    render(<StrictMode><MemoryRouter>{ui}</MemoryRouter></StrictMode>);
  });
  // the 3-2-1-Go! countdown, one second per tick
  for (let i = 0; i < 5; i++) await flush(1000);
}

const callsWith = (fn: { mock: { calls: unknown[][] } }, arg: string) =>
  fn.mock.calls.filter((c) => c.includes(arg)).length;

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});
beforeEach(() => {
  vi.useFakeTimers();
  Object.values(svc).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as ReturnType<typeof vi.fn>).mockClear());
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  vi.useRealTimers();
  useRoomStore.setState({ room: null, currentPlayer: null });
});

/** Every console.error text, flattened, so React's format-string warnings are matched too */
const errorTexts = () => errorSpy.mock.calls.map((c) => c.map(String).join(' '));

describe('timers never call other setters from inside a state updater', () => {
  it('(a) a timed race run logs no "Cannot update a component" warning', async () => {
    seed(room({ skillIds: ['x'], rounds: 3, timePerRound: 2 }), { items: [choice(1), choice(2), choice(3)] });
    await mount(<MathRacePage />);
    // every question times out in turn, then the race is over for this player
    for (let i = 0; i < 12; i++) await flush(1000);

    expect(svc.recordPlayerFinished).toHaveBeenCalledTimes(1);
    expect(errorTexts().filter((t) => t.includes('Cannot update a component'))).toEqual([]);
  });

  it('(a) a timed memory run logs no "Cannot update a component" warning', async () => {
    const host: Player = { ...me, isHost: true };
    const r = room({ skillIds: ['x'], rounds: 2, timePerRound: 4 }, [host]);
    r.hostId = host.id;
    const cards = [
      { id: 'a', pairId: 'p0', emoji: '🍎', flipped: false, matched: false },
      { id: 'b', pairId: 'p0', emoji: '🍎', flipped: false, matched: false },
    ];
    seed(r, { memoryCards: cards }, host);
    await mount(<MemoryGamePage />);
    for (let i = 0; i < 8; i++) await flush(1000);

    expect(svc.setGamePhase).toHaveBeenCalledWith('room1', 'finished');
    expect(errorTexts().filter((t) => t.includes('Cannot update a component'))).toEqual([]);
  });

  it('(b) a time-out advances exactly one question', async () => {
    seed(room({ skillIds: ['x'], rounds: 3, timePerRound: 10 }), { items: [choice(1), choice(2), choice(3)] });
    await mount(<MathRacePage />); // t = 5s, the first question's clock started at t = 0
    expect(screen.getByText('Cât face 1 + 1?')).toBeInTheDocument();

    await flush(5000); // t = 10s: the clock runs out
    expect(screen.getByText('Cât face 2 + 1?')).toBeInTheDocument();
    expect(screen.getByText(/Întrebarea 2\/3/)).toBeInTheDocument();

    await flush(1000); // t = 11s: the next question's clock has only just started
    expect(screen.getByText(/Întrebarea 2\/3/)).toBeInTheDocument();
    expect(svc.recordCorrectAnswer).not.toHaveBeenCalled();
  });

  it('(c) the sprint clock ends the game exactly once', async () => {
    const host: Player = { ...me, isHost: true };
    const r = room({ skillIds: ['x'], gameMode: 'timedSprint', rounds: 3, timePerRound: 8 }, [host]);
    r.hostId = host.id;
    seed(r, { items: [choice(1), choice(2), choice(3)] }, host);
    await mount(<MathRacePage />); // t = 5s
    await flush(3000); // t = 8s: the global clock expires
    await flush(5000); // and nothing ends it a second time

    expect(callsWith(svc.setGamePhase, 'finished')).toBe(1);
    expect(errorTexts().filter((t) => t.includes('Cannot update a component'))).toEqual([]);
  });
});
