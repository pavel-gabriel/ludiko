/**
 * Logic puzzles: who-lives-where (`logic-where`, own framework LUDIKO-LOGIC).
 *   params: { people?: 3 | 4 }  children living in a row of houses; 2-5 clues, then "who lives in house N?"
 * Clues are added only while they remove at least one arrangement and the process stops when exactly one
 * arrangement is left, so the answer is unique (checked by brute force over all arrangements).
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, paramInt, pick, randInt, shuffle } from './util';

export const NAMES = ['Ana', 'Ion', 'Maria', 'Dan', 'Elena', 'Radu', 'Sara', 'Matei'];

export type Clue =
  | { type: 'at'; a: number; pos: number }
  | { type: 'notAt'; a: number; pos: number }
  | { type: 'next'; a: number; b: number }
  | { type: 'notNext'; a: number; b: number }
  | { type: 'left'; a: number; b: number };

/** An arrangement: arr[position] = person index */
export function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (!rest.length) return void out.push(cur);
    rest.forEach((x, i) => rec([...cur, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
}

export function satisfies(arr: readonly number[], clue: Clue): boolean {
  const where = (p: number) => arr.indexOf(p);
  switch (clue.type) {
    case 'at': return where(clue.a) === clue.pos;
    case 'notAt': return where(clue.a) !== clue.pos;
    case 'next': return Math.abs(where(clue.a) - where(clue.b)) === 1;
    case 'notNext': return Math.abs(where(clue.a) - where(clue.b)) > 1;
    case 'left': return where(clue.a) < where(clue.b);
  }
}

const ORD_RO = ['prima casă', 'a doua casă', 'a treia casă', 'a patra casă'];
const ORD_EN = ['the first house', 'the second house', 'the third house', 'the fourth house'];

function clueText(c: Clue, names: string[], n: number): { ro: string; en: string } {
  const A = names[c.a];
  const B = 'b' in c ? names[c.b] : '';
  switch (c.type) {
    case 'at':
      return c.pos === n - 1 && n > 2
        ? { ro: `${A} stă în ultima casă.`, en: `${A} lives in the last house.` }
        : { ro: `${A} stă în ${ORD_RO[c.pos]}.`, en: `${A} lives in ${ORD_EN[c.pos]}.` };
    case 'notAt':
      return { ro: `${A} nu stă în ${ORD_RO[c.pos]}.`, en: `${A} does not live in ${ORD_EN[c.pos]}.` };
    case 'next':
      return { ro: `${A} stă lângă ${B}.`, en: `${A} lives next to ${B}.` };
    case 'notNext':
      return { ro: `${A} nu stă lângă ${B}.`, en: `${A} does not live next to ${B}.` };
    case 'left':
      return { ro: `${A} stă mai în stânga decât ${B}.`, en: `${A} lives to the left of ${B}.` };
  }
}

export interface WherePuzzle {
  names: string[];
  clues: Clue[];
  /** house index asked about */
  asked: number;
  /** person index living there in the (unique) solution */
  answer: number;
  /** arrangements that satisfy all clues (length 1) */
  solutions: number[][];
}

function randomClue(rng: () => number, truth: readonly number[], n: number): Clue {
  const a = randInt(rng, 0, n - 1);
  let b = randInt(rng, 0, n - 1);
  while (b === a) b = randInt(rng, 0, n - 1);
  const type = pick(rng, ['at', 'notAt', 'next', 'notNext', 'left', 'left'] as const);
  if (type === 'at') return { type, a, pos: truth.indexOf(a) };
  if (type === 'notAt') {
    const options = Array.from({ length: n }, (_, i) => i).filter((i) => i !== truth.indexOf(a));
    return { type, a, pos: pick(rng, options) };
  }
  return { type, a, b };
}

export function buildWhere(rng: () => number, n: number): WherePuzzle {
  const names = shuffle(rng, NAMES).slice(0, n);
  const all = permutations(n);
  const maxClues = n === 3 ? 3 : 5;
  for (;;) {
    const truth = pick(rng, all);
    const clues: Clue[] = [];
    let alive = all;
    for (let guard = 0; guard < 80 && alive.length > 1 && clues.length < maxClues; guard++) {
      const c = randomClue(rng, truth, n);
      if (!satisfies(truth, c)) continue;
      const next = alive.filter((p) => satisfies(p, c));
      if (next.length < alive.length) {
        clues.push(c);
        alive = next;
      }
    }
    if (alive.length === 1 && clues.length >= 2) {
      // never ask about a house that a clue simply names ("X lives in the third house")
      const named = new Set(clues.flatMap((c) => (c.type === 'at' ? [c.pos] : [])));
      const free = Array.from({ length: n }, (_, i) => i).filter((i) => !named.has(i));
      if (!free.length) continue;
      const asked = pick(rng, free);
      return { names, clues, asked, answer: alive[0][asked], solutions: alive };
    }
  }
}

export const logicWhere: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const n = paramInt(params, 'people', 3) >= 4 ? 4 : 3;
  const p = buildWhere(rng, n);
  const list = p.names.join(', ');
  const clues = p.clues.map((c) => clueText(c, p.names, n));
  const house = p.asked;
  const item: ChoiceItem = {
    ...baseFields(
      ctx,
      {
        ro: `Ghicitoarea lui Ludi: ${list} stau în ${n} case, una lângă alta, de la stânga la dreapta. ${clues.map((c) => c.ro).join(' ')} Cine stă în ${ORD_RO[house]}?`,
        en: `Ludi's riddle: ${list} live in ${n} houses in a row, from left to right. ${clues.map((c) => c.en).join(' ')} Who lives in ${ORD_EN[house]}?`,
      },
      { kind: 'grid', rows: 1, cols: n, cells: Array.from({ length: n }, () => '🏠'), highlight: house },
    ),
    type: 'choice',
    options: shuffle(rng, p.names.map((name, i) => ({ id: `p${i}`, text: { ro: name } }))),
    correctId: `p${p.answer}`,
  };
  return item;
};

registerGenerator('logic-where', logicWhere);
