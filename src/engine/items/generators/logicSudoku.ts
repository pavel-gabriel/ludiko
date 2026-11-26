/**
 * Logic puzzles: mini-sudoku 4x4 (`logic-sudoku4`, own framework LUDIKO-LOGIC).
 *   params: { empty?: 1 | 2 }  number of empty cells in the grid (default 1)
 * A valid grid (every row, column and 2x2 box holds 1-4 once) is built from a base grid by symmetry-preserving
 * shuffles. The asked cell is only used when EVERY completion of the empty cells gives it the same digit.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, paramInt, pick, randInt, shuffle } from './util';

const BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];

/** A random valid 4x4 sudoku solution, row-major, 16 digits 1-4. */
export function randomSolution(rng: () => number): number[] {
  const digits = shuffle(rng, [1, 2, 3, 4]);
  const bandRows = (b: number) => shuffle(rng, [b * 2, b * 2 + 1]);
  const rowOrder = shuffle(rng, [0, 1]).flatMap(bandRows);
  const colOrder = shuffle(rng, [0, 1]).flatMap(bandRows);
  const transpose = rng() < 0.5;
  const out: number[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const [rr, cc] = transpose ? [colOrder[c], rowOrder[r]] : [rowOrder[r], colOrder[c]];
      out.push(digits[BASE[rr][cc] - 1]);
    }
  }
  return out;
}

export function isValidSudoku4(cells: readonly number[]): boolean {
  const ok = (idx: number[]) => new Set(idx.map((i) => cells[i])).size === 4 && idx.every((i) => cells[i] >= 1 && cells[i] <= 4);
  for (let k = 0; k < 4; k++) {
    if (!ok([0, 1, 2, 3].map((c) => k * 4 + c))) return false;
    if (!ok([0, 1, 2, 3].map((r) => r * 4 + k))) return false;
    const br = Math.floor(k / 2) * 2;
    const bc = (k % 2) * 2;
    if (!ok([0, 1, 4, 5].map((o) => br * 4 + bc + o))) return false;
  }
  return true;
}

/** Digits the cell `target` can take over all valid completions of a grid whose empties are `null`. */
export function possibleDigits(cells: readonly (number | null)[], target: number): Set<number> {
  const empties = cells.flatMap((c, i) => (c === null ? [i] : []));
  const work = cells.map((c) => c ?? 0);
  const found = new Set<number>();
  const conflicts = (i: number, v: number): boolean => {
    const r = Math.floor(i / 4);
    const c = i % 4;
    for (let k = 0; k < 4; k++) {
      if (work[r * 4 + k] === v || work[k * 4 + c] === v) return true;
    }
    const br = Math.floor(r / 2) * 2;
    const bc = Math.floor(c / 2) * 2;
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) if (work[(br + dr) * 4 + bc + dc] === v) return true;
    return false;
  };
  const go = (n: number): void => {
    if (n === empties.length) {
      found.add(work[target]);
      return;
    }
    const i = empties[n];
    for (let v = 1; v <= 4; v++) {
      if (conflicts(i, v)) continue;
      work[i] = v;
      go(n + 1);
      work[i] = 0;
    }
  };
  go(0);
  return found;
}

export interface SudokuPuzzle {
  solution: number[];
  /** grid shown, null = empty (the asked cell included) */
  cells: (number | null)[];
  asked: number;
}

export function buildSudoku(rng: () => number, empty: number): SudokuPuzzle {
  for (let tries = 0; tries < 200; tries++) {
    const solution = randomSolution(rng);
    const holes = shuffle(rng, Array.from({ length: 16 }, (_, i) => i)).slice(0, empty);
    const cells = solution.map((v, i) => (holes.includes(i) ? null : v));
    const asked = pick(rng, holes);
    const possible = possibleDigits(cells, asked);
    if (possible.size === 1 && possible.has(solution[asked])) return { solution, cells, asked };
  }
  // k = 1 is always unique, so this is only reachable if the retry budget runs out for k = 2
  const solution = randomSolution(rng);
  const asked = randInt(rng, 0, 15);
  return { solution, cells: solution.map((v, i) => (i === asked ? null : v)), asked };
}

export const logicSudoku4: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const empty = paramInt(params, 'empty', 1) >= 2 ? 2 : 1;
  const p = buildSudoku(rng, empty);
  const answer = p.solution[p.asked];
  const item: ChoiceItem = {
    ...baseFields(
      ctx,
      {
        ro: 'Ghicitoarea lui Ludi: în fiecare rând, coloană și pătrat mare apar numerele 1, 2, 3 și 4, o singură dată. Ce număr se potrivește în căsuța aurie?',
        en: "Ludi's riddle: every row, column and big square holds the numbers 1, 2, 3 and 4 exactly once. Which number fits the golden square?",
      },
      { kind: 'grid', rows: 4, cols: 4, cells: p.cells.map((c) => (c === null ? null : String(c))), highlight: p.asked },
    ),
    type: 'choice',
    options: [1, 2, 3, 4].map((n) => ({ id: `n${n}`, text: { ro: String(n) } })),
    correctId: `n${answer}`,
  };
  return item;
};

registerGenerator('logic-sudoku4', logicSudoku4);
