/**
 * Logic puzzles: coding-style robot path (`logic-robot`, own framework LUDIKO-LOGIC).
 *   params: { size?: 3 | 4 }  grid is size x size (default 3)
 * Every cell shows a different picture, the robot starts on its own cell (🤖) and follows arrow steps.
 * The child picks the picture of the cell where it ends. The path never leaves the grid and never ends on the start.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, paramInt, pick, randInt, shuffle } from './util';

export const ROBOT = '🤖';
export const ROBOT_PICTURES = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐', '🍒', '🍉', '🐶', '🐱', '🐸', '🐟', '⭐', '🌙', '🌸', '🎈'];

export type Move = 'up' | 'down' | 'left' | 'right';
export const MOVE_ARROWS: Record<Move, string> = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
export const MOVE_DELTA: Record<Move, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

/** Follow `moves` from `start` (index); returns the end index, or null if a move leaves the grid. */
export function followMoves(size: number, start: number, moves: readonly Move[]): number | null {
  let r = Math.floor(start / size);
  let c = start % size;
  for (const m of moves) {
    r += MOVE_DELTA[m][0];
    c += MOVE_DELTA[m][1];
    if (r < 0 || c < 0 || r >= size || c >= size) return null;
  }
  return r * size + c;
}

export interface RobotPuzzle {
  size: number;
  cells: string[];
  start: number;
  moves: Move[];
  end: number;
}

export function buildRobot(rng: () => number, size: number, steps: number): RobotPuzzle {
  const cells = shuffle(rng, ROBOT_PICTURES).slice(0, size * size);
  for (;;) {
    const start = randInt(rng, 0, size * size - 1);
    const moves: Move[] = [];
    let at = start;
    for (let i = 0; i < steps; i++) {
      const legal = (['up', 'down', 'left', 'right'] as Move[]).filter((m) => followMoves(size, at, [m]) !== null);
      // no immediate step back, so the route looks like a route
      const back: Record<Move, Move> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      const forward = legal.filter((m) => m !== back[moves[moves.length - 1]]);
      const m = pick(rng, forward.length ? forward : legal);
      moves.push(m);
      at = followMoves(size, at, [m]) as number;
    }
    if (at !== start) {
      const shown = cells.map((c, i) => (i === start ? ROBOT : c));
      return { size, cells: shown, start, moves, end: at };
    }
  }
}

export const logicRobot: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const size = paramInt(params, 'size', 3) >= 4 ? 4 : 3;
  const steps = Math.min(size === 3 ? 4 : 6, d <= 2 ? 2 : d === 3 ? 3 : d === 4 ? 4 : 5);
  const p = buildRobot(rng, size, Math.max(2, steps));
  const answer = p.cells[p.end];
  const wrong = shuffle(rng, p.cells.filter((_, i) => i !== p.end && i !== p.start)).slice(0, d <= 1 ? 2 : 3);
  const opts = shuffle(rng, [answer, ...wrong]);
  const arrows = p.moves.map((m) => MOVE_ARROWS[m]).join(' ');
  const item: ChoiceItem = {
    ...baseFields(
      ctx,
      {
        ro: `Ghicitoarea lui Ludi: robotul ${ROBOT} pornește din căsuța lui și face pașii ${arrows}. Pe ce desen ajunge?`,
        en: `Ludi's riddle: the robot ${ROBOT} starts on its own square and takes the steps ${arrows}. Which picture does it land on?`,
      },
      { kind: 'grid', rows: size, cols: size, cells: p.cells },
    ),
    type: 'choice',
    options: opts.map((s, i) => ({ id: `o${i}`, text: { ro: s } })),
    correctId: `o${opts.indexOf(answer)}`,
  };
  return item;
};

registerGenerator('logic-robot', logicRobot);
