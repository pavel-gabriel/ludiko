import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/config';
import type { ChoiceItem, Item } from '../src/engine/types';
import type { Player, Room, Question } from '../src/utils/types';
import type { RTDBGameState } from '../src/services/gameSession';
import { useRoomStore } from '../src/store/roomStore';

/* ---- RTDB layer mocked: the page talks to these functions only ---- */
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
import InteractiveGamePage from '../src/components/games/InteractiveGame/InteractiveGamePage';
import GameRouter from '../src/components/games/GameRouter';
import MemoryBoard from '../src/components/games/MemoryGame/MemoryBoard';

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
const friend: Player = { id: 'p2', name: 'Bob', avatar: '🐸', score: 0, isHost: false, isReady: true };

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

async function mount(ui = <MathRacePage />) {
  await act(async () => {
    render(<MemoryRouter>{ui}</MemoryRouter>);
  });
  // the 3-2-1-Go! countdown, one second per tick
  for (let i = 0; i < 5; i++) await flush(1000);
}

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});
beforeEach(() => {
  vi.useFakeTimers();
  Object.values(svc).forEach((f) => typeof f === 'function' && 'mockClear' in f && (f as ReturnType<typeof vi.fn>).mockClear());
});
afterEach(() => {
  vi.useRealTimers();
  useRoomStore.setState({ room: null, currentPlayer: null });
});

describe('item-based race (MathRacePage)', () => {
  it('renders the shared ItemView and scores a correct answer through recordCorrectAnswer', async () => {
    seed(room({ skillIds: ['mat.add.nocarry.20'] }), { items: [choice(1), choice(2), choice(3)] });
    await mount();
    expect(screen.getByText('Cât face 1 + 1?')).toBeInTheDocument();
    expect(screen.getByText(/Întrebarea 1\/3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText(/Corect! Bravo!/)).toBeInTheDocument();
    await flush(600);

    expect(svc.recordCorrectAnswer).toHaveBeenCalledTimes(1);
    expect(svc.recordCorrectAnswer).toHaveBeenCalledWith('room1', 'p1', 1);
    // moved on to question 2
    expect(screen.getByText('Cât face 2 + 1?')).toBeInTheDocument();
  });

  it('a wrong answer scores nothing, shows the right answer, and moves on after "Mai departe"', async () => {
    seed(room({ skillIds: ['mat.add.nocarry.20'] }), { items: [choice(1), choice(2), choice(3)] });
    await mount();
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByText(/Răspunsul corect/)).toBeInTheDocument();
    await flush(2000);
    expect(screen.getByText('Cât face 1 + 1?')).toBeInTheDocument(); // waits for the child
    fireEvent.click(screen.getByRole('button', { name: 'Mai departe' }));
    await flush(50);
    expect(svc.recordCorrectAnswer).not.toHaveBeenCalled();
    expect(screen.getByText('Cât face 2 + 1?')).toBeInTheDocument();
  });

  it('progress counts on top of what the room already has', async () => {
    seed(room({ skillIds: ['x'] }), { items: [choice(1), choice(2), choice(3)], progress: { p1: 2 } });
    await mount();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await flush(600);
    expect(svc.recordCorrectAnswer).toHaveBeenCalledWith('room1', 'p1', 3);
  });

  it('finishing all items ends the race for everyone', async () => {
    seed(room({ skillIds: ['x'], rounds: 2 }), { items: [choice(1), choice(2), choice(3)] });
    await mount();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await flush(600);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    await flush(600);
    expect(svc.recordPlayerFinished).toHaveBeenCalledWith('room1', 'p1');
    expect(svc.setGamePhase).toHaveBeenCalledWith('room1', 'finished');
  });

  it('fewer items than rounds: the race is as long as the items', async () => {
    seed(room({ skillIds: ['x'], rounds: 10 }), { items: [choice(1), choice(2)] });
    await mount();
    expect(screen.getByText(/Întrebarea 1\/2/)).toBeInTheDocument();
  });

  it('the host generates items for its skills (and not v1 questions)', async () => {
    const host: Player = { ...me, isHost: true };
    const r = room({ skillIds: ['mat.add.nocarry.20', 'rom.syll.split.1'], rounds: 6 }, [host]);
    r.hostId = host.id;
    seed(r, { items: [choice(1)] }, host);
    await mount();
    expect(svc.initItemGameState).toHaveBeenCalledTimes(1);
    expect(svc.initMathGameState).not.toHaveBeenCalled();
    const [, items] = svc.initItemGameState.mock.calls[0] as unknown as [string, Item[]];
    expect(items).toHaveLength(6);
  });

  it('sprint shows the score, no per-question timer, and uses items', async () => {
    seed(room({ skillIds: ['x'], gameMode: 'timedSprint', rounds: 3, timePerRound: 60 }), { items: [choice(1), choice(2), choice(3)] });
    await mount();
    expect(screen.getByText('Cât face 1 + 1?')).toBeInTheDocument();
    expect(screen.getByText(/Scor/)).toBeInTheDocument();
  });
});

describe('old room state (questions only) keeps working', () => {
  const q: Question = { id: 'q1', a: 3, b: 4, operation: '+', correctAnswer: 7, options: [5, 6, 7, 9] };

  it('renders the v1 QuestionCard and scores through recordCorrectAnswer', async () => {
    seed(room(), { questions: [q, { ...q, id: 'q2' }, { ...q, id: 'q3' }] });
    await mount();
    expect(screen.getByText('3 + 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    await flush(800);
    expect(svc.recordCorrectAnswer).toHaveBeenCalledWith('room1', 'p1', 1);
  });

  it('GameRouter sends v1 rooms to the v1 page and skill rooms to the item race', async () => {
    seed(room(), { questions: [q, q, q] });
    await mount(<GameRouter />);
    expect(screen.getByText('3 + 4')).toBeInTheDocument();
  });

  it('GameRouter: a skill room with a shape game type still runs the item race', async () => {
    seed(room({ gameType: 'shapeMatch', skillIds: ['x'] }), { items: [choice(1), choice(2), choice(3)] });
    await mount(<GameRouter />);
    expect(screen.getByText('Cât face 1 + 1?')).toBeInTheDocument();
  });
});

describe('duel on items (InteractiveGamePage)', () => {
  it('both players get the same items and score independently', async () => {
    const r = room({ skillIds: ['x'], rounds: 3 }, [me, friend]);
    seed(r, { items: [choice(1), choice(2), choice(3)] });
    await mount(<InteractiveGamePage />);
    expect(screen.getAllByText('Cât face 1 + 1?')).toHaveLength(2);

    // the first "2" button belongs to player 1, the second to player 2
    const twos = screen.getAllByRole('button', { name: '2' });
    expect(twos).toHaveLength(2);
    fireEvent.click(twos[0]);
    await flush(600);
    expect(svc.recordCorrectAnswer).toHaveBeenCalledWith('room1', 'p1', 1);
    // player 1 moved on, player 2 still on item 1
    expect(screen.getAllByText('Cât face 1 + 1?')).toHaveLength(1);
    expect(screen.getAllByText('Cât face 2 + 1?')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await flush(600);
    expect(svc.recordCorrectAnswer).toHaveBeenCalledWith('room1', 'p2', 1);
  });

  it('old duel state (questions) still renders the v1 panels', async () => {
    const q: Question = { id: 'q1', a: 3, b: 4, operation: '+', correctAnswer: 7, options: [5, 6, 7, 9] };
    seed(room({}, [me, friend]), { questions: [q, q, q] });
    await mount(<InteractiveGamePage />);
    expect(screen.getAllByText('3 + 4')).toHaveLength(2);
  });
});

describe('memory board with text faces', () => {
  it('shows text faces (item pairs) and emoji faces side by side', () => {
    const cards = [
      { id: 'a', pairId: 'p0', emoji: '3 + 4', isText: true, flipped: false, matched: false },
      { id: 'b', pairId: 'p0', emoji: '7', isText: true, flipped: false, matched: false },
      { id: 'c', pairId: 'p1', emoji: 'pară', isText: true, flipped: false, matched: false },
      { id: 'd', pairId: 'p1', emoji: '🍐', flipped: false, matched: false },
    ];
    render(<MemoryBoard cards={cards} flippedIndices={[0, 1, 2, 3]} matchedIndices={new Set()} onFlip={() => {}} disabled={false} />);
    expect(screen.getByText('3 + 4').className).toMatch(/text-/);
    expect(screen.getByText('pară')).toBeInTheDocument();
    expect(screen.getByText('🍐')).toBeInTheDocument();
  });
});
