/**
 * `word-problem` generator (params: max, ops, factorMax, groupsMax, remainder). Short ORIGINAL Romanian
 * word problems (with English translations) built from templates; one operation, or two at higher
 * difficulty when ops allows it. `ops` may contain "+", "-", "*" and "/" (multiplication / sharing /
 * grouping, see ./wordProblemMulDiv). All quantities are >= 2 so Romanian/English agreement never
 * needs singular forms. Above max=100 quantities scale up (grade III: 1 000, grade IV: 10 000).
 */
import type { ChoiceItem, Item, LocalizedText, NumberInputItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, numberOptions, optionCount, paramInt, paramStrings, pick, randInt, weighted } from './util';
import { THINGS, type Thing } from './things';
import { fmtCards, roNum } from './numfmt';
import { mulDivProblem } from './wordProblemMulDiv';
import { objectsSpec } from './visuals';

const NAMES = ['Ana', 'Maria', 'Ioana', 'Elena', 'Sofia', 'Daria', 'Andrei', 'Mihai', 'Tudor', 'Radu', 'Luca', 'Matei'];

interface Scene {
  n1: string;
  n2: string;
  t: Thing;
}

export interface Problem {
  text: LocalizedText;
  /** Ready-made picture (groups of objects); otherwise a picture of `start` may be added */
  visual?: VisualSpec;
  answer: number;
  /** Wrong answers a child plausibly gives */
  wrong: number[];
  /** Operands that sit in a group the picture may show (the starting amount) */
  start?: number;
  thing: Thing;
}

/** Smallest sensible starting amount: grows with the number range */
const floorFor = (max: number, small: number): number => (max > 100 ? Math.max(small, Math.round(max / 10)) : small);

type Template = (s: Scene, v: number[]) => LocalizedText;

const c = (n: number, t: Thing) => roNum(n, t.ro);

/* ---- one-step templates ------------------------------------------- */

const ADD_TEMPLATES: Template[] = [
  (s, [a, b]) => ({
    ro: `${s.n1} are ${c(a, s.t)}. Primește încă ${c(b, s.t)}. Câte ${s.t.ro} are ${s.n1} acum?`,
    en: `${s.n1} has ${a} ${s.t.en}. ${s.n1} gets ${b} more ${s.t.en}. How many ${s.t.en} does ${s.n1} have now?`,
  }),
  (s, [a, b]) => ({
    ro: `Într-un coș sunt ${c(a, s.t)}. Mai punem ${c(b, s.t)}. Câte ${s.t.ro} sunt acum în coș?`,
    en: `There are ${a} ${s.t.en} in a basket. We put in ${b} more. How many ${s.t.en} are in the basket now?`,
  }),
  (s, [a, b]) => ({
    ro: `${s.n1} are ${c(a, s.t)}, iar ${s.n2} are ${c(b, s.t)}. Câte ${s.t.ro} au împreună?`,
    en: `${s.n1} has ${a} ${s.t.en} and ${s.n2} has ${b} ${s.t.en}. How many ${s.t.en} do they have together?`,
  }),
  (s, [a, b]) => ({
    ro: `Pe masă sunt ${c(a, s.t)}. Mama mai aduce ${c(b, s.t)}. Câte ${s.t.ro} sunt acum pe masă?`,
    en: `There are ${a} ${s.t.en} on the table. Mum brings ${b} more. How many ${s.t.en} are on the table now?`,
  }),
];

const SUB_TEMPLATES: { food: boolean; fn: Template }[] = [
  {
    food: true,
    fn: (s, [a, b]) => ({
      ro: `${s.n1} are ${c(a, s.t)}. Mănâncă ${c(b, s.t)}. Câte ${s.t.ro} îi rămân?`,
      en: `${s.n1} has ${a} ${s.t.en}. ${s.n1} eats ${b}. How many ${s.t.en} are left?`,
    }),
  },
  {
    food: false,
    fn: (s, [a, b]) => ({
      ro: `${s.n1} are ${c(a, s.t)}. Dăruiește ${c(b, s.t)} unui prieten. Câte ${s.t.ro} îi rămân?`,
      en: `${s.n1} has ${a} ${s.t.en}. ${s.n1} gives ${b} ${s.t.en} to a friend. How many ${s.t.en} are left?`,
    }),
  },
  {
    food: false,
    fn: (s, [a, b]) => ({
      ro: `Într-o cutie sunt ${c(a, s.t)}. ${s.n1} ia ${c(b, s.t)} din cutie. Câte ${s.t.ro} mai sunt în cutie?`,
      en: `There are ${a} ${s.t.en} in a box. ${s.n1} takes ${b} ${s.t.en} out. How many ${s.t.en} are left in the box?`,
    }),
  },
  {
    food: false,
    fn: (s, [a, b]) => ({
      ro: `${s.n1} are ${c(a, s.t)}, iar ${s.n2} are ${c(b, s.t)}. Cu câte ${s.t.ro} are ${s.n1} mai multe decât ${s.n2}?`,
      en: `${s.n1} has ${a} ${s.t.en} and ${s.n2} has ${b} ${s.t.en}. How many more ${s.t.en} does ${s.n1} have than ${s.n2}?`,
    }),
  },
];

/* ---- two-step templates ------------------------------------------- */

const ADD_SUB: Template = (s, [a, b, x]) => ({
  ro: `${s.n1} are ${c(a, s.t)}. Primește ${c(b, s.t)}, apoi dăruiește ${c(x, s.t)} unui prieten. Câte ${s.t.ro} are ${s.n1} acum?`,
  en: `${s.n1} has ${a} ${s.t.en}. ${s.n1} gets ${b} more, then gives ${x} to a friend. How many ${s.t.en} does ${s.n1} have now?`,
});
const SUB_ADD: Template = (s, [a, b, x]) => ({
  ro: `${s.n1} are ${c(a, s.t)}. Dăruiește ${c(b, s.t)} unui prieten, apoi primește ${c(x, s.t)}. Câte ${s.t.ro} are ${s.n1} acum?`,
  en: `${s.n1} has ${a} ${s.t.en}. ${s.n1} gives ${b} to a friend, then gets ${x} more. How many ${s.t.en} does ${s.n1} have now?`,
});
const ADD_ADD: Template = (s, [a, b, x]) => ({
  ro: `${s.n1} are ${c(a, s.t)}. Luni mai primește ${c(b, s.t)}, iar marți încă ${c(x, s.t)}. Câte ${s.t.ro} are ${s.n1} acum?`,
  en: `${s.n1} has ${a} ${s.t.en}. On Monday ${s.n1} gets ${b} more, and on Tuesday ${x} more. How many ${s.t.en} does ${s.n1} have now?`,
});

function scene(rng: Rng, needFood = false): Scene {
  const n1 = pick(rng, NAMES);
  let n2 = pick(rng, NAMES);
  while (n2 === n1) n2 = pick(rng, NAMES);
  const pool = needFood ? THINGS.filter((t) => t.food) : THINGS;
  return { n1, n2, t: pick(rng, pool) };
}

function oneStep(rng: Rng, max: number, d: number, op: '+' | '-'): Problem {
  const lim = Math.max(6, Math.round(max * (0.4 + 0.13 * d)));
  if (op === '+') {
    const total = randInt(rng, floorFor(max, 5), Math.min(max, lim));
    const a = randInt(rng, 2, total - 2);
    const b = total - a;
    const s = scene(rng);
    return {
      text: pick(rng, ADD_TEMPLATES)(s, [a, b]),
      answer: total,
      wrong: [total + 1, total - 1, Math.abs(a - b), total + 10, total - 10, a, b],
      start: a,
      thing: s.t,
    };
  }
  const a = randInt(rng, floorFor(max, 5), Math.min(max, lim));
  const b = randInt(rng, floorFor(max / 5, 2), a - 2);
  const tpl = pick(rng, SUB_TEMPLATES);
  const s = scene(rng, tpl.food);
  return {
    text: tpl.fn(s, [a, b]),
    answer: a - b,
    wrong: [a - b + 1, a - b - 1, a + b, a - b + 10, a - b - 10, a, b],
    start: a,
    thing: s.t,
  };
}

function twoStep(rng: Rng, max: number, d: number, ops: string[]): Problem {
  const lim = Math.max(10, Math.round(max * (0.5 + 0.1 * d)));
  const forms: ['+-' | '-+' | '++', number][] = [];
  if (ops.includes('+') && ops.includes('-')) forms.push(['+-', 40], ['-+', 40]);
  if (ops.includes('+')) forms.push(['++', 20]);
  const form = weighted(rng, forms);
  const s = scene(rng);
  if (form === '++') {
    const total = randInt(rng, floorFor(max, 8), Math.min(max, lim));
    const a = randInt(rng, 2, total - 4);
    const b = randInt(rng, 2, total - a - 2);
    const x = total - a - b;
    return { text: ADD_ADD(s, [a, b, x]), answer: total, wrong: [total + 1, total - 1, a + b, total + 10, total - 10, a + x], start: a, thing: s.t };
  }
  if (form === '+-') {
    const a = randInt(rng, 2, Math.min(max - 4, Math.round(lim / 2)));
    const b = randInt(rng, 2, Math.min(max - a, Math.round(lim / 2)));
    const x = randInt(rng, 2, a + b - 1);
    const answer = a + b - x;
    return { text: ADD_SUB(s, [a, b, x]), answer, wrong: [answer + 1, answer - 1, a + b, a + b + x, Math.abs(a - b), answer + 10], start: a, thing: s.t };
  }
  const a = randInt(rng, floorFor(max, 5), Math.min(max - 2, lim));
  const b = randInt(rng, 2, a - 2);
  const x = randInt(rng, 2, Math.max(2, Math.min(max - (a - b), lim)));
  const answer = a - b + x;
  return { text: SUB_ADD(s, [a, b, x]), answer, wrong: [answer + 1, answer - 1, a - b, a + b + x, a - b - x, answer + 10], start: a, thing: s.t };
}

export const wordProblem: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(12, paramInt(params, 'max', 20));
  const allOps = paramStrings(params, 'ops', ['+', '-']).filter((o) => ['+', '-', '*', '/'].includes(o));
  const ops = allOps.filter((o) => o === '+' || o === '-');
  const mulDiv = allOps.filter((o) => o === '*' || o === '/');
  const allowed = ops.length ? ops : ['+'];
  const twoOps = d >= 3 && chance(rng, d >= 4 ? 0.7 : 0.4);

  const useMulDiv = mulDiv.length > 0 && (ops.length === 0 || chance(rng, 0.55));
  const problem = useMulDiv
    ? mulDivProblem(rng, params, d, mulDiv as ('*' | '/')[], ops, ops.length > 0 && twoOps, max)
    : twoOps
      ? twoStep(rng, max, d, allowed)
      : oneStep(rng, max, d, allowed.length === 1 ? (allowed[0] as '+' | '-') : pick(rng, ['+', '-'] as const));
  const prompt = problem.text;
  const visual =
    problem.visual ??
    (problem.start !== undefined && problem.start <= 20 && chance(rng, 0.4) ? objectsSpec(problem.thing.icon, problem.start) : undefined);

  if (chance(rng, 0.25)) {
    const item: NumberInputItem = { ...baseFields(ctx, prompt, visual), type: 'number-input', correct: problem.answer };
    return item;
  }
  const values = numberOptions(rng, problem.answer, problem.wrong, optionCount(d), 0, Math.max(max, problem.answer));
  const item: ChoiceItem = {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: fmtCards(values),
    correctId: `n${problem.answer}`,
  };
  return item;
};
