/**
 * Logic puzzles: patterns (subject 'logic', own framework LUDIKO-LOGIC).
 *   `logic-pattern`         params: { units?: string[] }  (AB, AAB, ABB, ABC, AABB) emoji strip: what comes next /
 *                           what is missing in the middle (difficulty >= 3)
 *   `logic-number-pattern`  params: { level?: 3 | 4 }     growing number sequences, answer typed
 * All answers are computed by code; every strip shows at least two full cycles, so the rule is unique.
 */
import type { ChoiceItem, Item, NumberInputItem, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, paramInt, paramStrings, pick, randInt, shuffle } from './util';

export const PATTERN_UNITS: Record<string, number[]> = {
  AB: [0, 1],
  AAB: [0, 0, 1],
  ABB: [0, 1, 1],
  ABC: [0, 1, 2],
  AABB: [0, 0, 1, 1],
};

export const PATTERN_SYMBOLS = ['🍎', '🍌', '🍇', '🍓', '🐶', '🐱', '🐸', '🐟', '⭐', '🌙', '🔴', '🔵', '🟢', '🟡', '🟥', '🟦', '🌸', '🎈'];

const strip = (cells: (string | null)[], highlight: number): VisualSpec => ({ kind: 'grid', rows: 1, cols: cells.length, cells, highlight });

export interface PatternPuzzle {
  /** full sequence (the hidden cell included) */
  full: string[];
  /** index of the hidden cell */
  hidden: number;
  unit: string[];
}

/** Pure builder (also used by tests). `mid` hides a cell inside the strip instead of the last one. */
export function buildPattern(rng: () => number, unitName: string, mid: boolean): PatternPuzzle {
  const shape = PATTERN_UNITS[unitName];
  const len = shape.length;
  const symbols = shuffle(rng, PATTERN_SYMBOLS).slice(0, 3);
  const unit = shape.map((i) => symbols[i]);
  // total cells incl. the hidden one; >= 2 full cycles are visible besides it
  const total = Math.min(9, 2 * len + 1 + randInt(rng, 0, len - 1));
  const full = Array.from({ length: total }, (_, i) => unit[i % len]);
  const hidden = mid ? randInt(rng, 1, total - 2) : total - 1;
  return { full, hidden, unit };
}

export const logicPattern: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const units = paramStrings(params, 'units', ['AB']).filter((u) => u in PATTERN_UNITS);
  const unitName = pick(rng, units.length ? units : ['AB']);
  const mid = d >= 3 && rng() < 0.6;
  const p = buildPattern(rng, unitName, mid);
  const answer = p.full[p.hidden];
  const cells = p.full.map((c, i) => (i === p.hidden ? null : c));
  const wanted = d <= 1 ? 3 : 4;
  const others = [...p.unit.filter((s) => s !== answer), ...shuffle(rng, PATTERN_SYMBOLS.filter((s) => !p.unit.includes(s)))];
  const wrong = [...new Set(others)].slice(0, wanted - 1);
  const opts = shuffle(rng, [answer, ...wrong]);
  const item: ChoiceItem = {
    ...baseFields(
      ctx,
      mid
        ? { ro: 'Ghicitoarea lui Ludi: ce desen lipsește din șir?', en: "Ludi's riddle: which picture is missing in the row?" }
        : { ro: 'Ghicitoarea lui Ludi: ce desen urmează în șir?', en: "Ludi's riddle: which picture comes next in the row?" },
      strip(cells, p.hidden),
    ),
    type: 'choice',
    options: opts.map((s, i) => ({ id: `o${i}`, text: { ro: s } })),
    correctId: `o${opts.indexOf(answer)}`,
  };
  return item;
};

/* ---- number patterns ---------------------------------------------- */

export type NumberRule = 'add' | 'sub' | 'alt' | 'mul' | 'growing';

export function buildNumberSequence(rng: () => number, rule: NumberRule, level: number): { shown: number[]; next: number } {
  const seq: number[] = [];
  const push = (n: number) => seq.push(n);
  let shownCount = 4;
  switch (rule) {
    case 'add': {
      const step = pick(rng, level >= 4 ? [3, 4, 6, 7, 8, 9, 12, 25, 50, 100] : [2, 3, 4, 5, 10]);
      const start = randInt(rng, 1, level >= 4 ? 120 : 30);
      for (let i = 0; i < 6; i++) push(start + step * i);
      break;
    }
    case 'sub': {
      const step = pick(rng, level >= 4 ? [3, 4, 6, 7, 9, 12, 25] : [2, 3, 4, 5, 10]);
      const start = step * 6 + randInt(rng, 0, level >= 4 ? 100 : 40);
      for (let i = 0; i < 6; i++) push(start - step * i);
      break;
    }
    case 'alt': {
      const a = randInt(rng, 1, level >= 4 ? 9 : 5);
      const b = a + randInt(rng, 1, 4);
      let v = randInt(rng, 1, 20);
      push(v);
      for (let i = 0; i < 5; i++) push((v += i % 2 === 0 ? a : b));
      shownCount = 5;
      break;
    }
    case 'mul': {
      const k = pick(rng, level >= 4 ? [2, 3, 3] : [2, 2, 3]);
      const start = k === 2 ? randInt(rng, 1, 5) : randInt(rng, 1, 3);
      for (let i = 0; i < 6; i++) push(start * k ** i);
      break;
    }
    case 'growing': {
      let v = randInt(rng, 1, 10);
      push(v);
      for (let i = 1; i < 7; i++) push((v += i));
      shownCount = 5;
      break;
    }
  }
  return { shown: seq.slice(0, shownCount), next: seq[shownCount] };
}

export const logicNumberPattern: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const level = paramInt(params, 'level', 3) >= 4 ? 4 : 3;
  const rules: NumberRule[] =
    level >= 4
      ? d <= 1 ? ['add', 'sub'] : d === 2 ? ['add', 'sub', 'mul'] : ['mul', 'growing', 'alt', 'add', 'sub', 'growing']
      : d <= 1 ? ['add'] : d === 2 ? ['add', 'sub'] : ['add', 'sub', 'alt'];
  const { shown, next } = buildNumberSequence(rng, pick(rng, rules), level);
  const item: NumberInputItem = {
    ...baseFields(
      ctx,
      { ro: 'Ghicitoarea lui Ludi: ce număr urmează în șir?', en: "Ludi's riddle: which number comes next in the row?" },
      strip([...shown.map(String), null], shown.length),
    ),
    type: 'number-input',
    correct: next,
  };
  return item;
};

registerGenerator('logic-pattern', logicPattern);
registerGenerator('logic-number-pattern', logicNumberPattern);
