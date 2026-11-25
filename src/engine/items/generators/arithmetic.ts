/**
 * `addition` (params: max, carry?) and `subtraction` (params: max, borrow?) generators.
 *
 * Up to max=100 the operand pairs are enumerated once per (max, flag) and the flag is about the ones digits:
 *  - carry:false  => ones digits sum to < 10;   carry:true  => ones digits sum to >= 10
 *  - borrow:false => ones(a) >= ones(b);        borrow:true => ones(a) < ones(b)
 * Above 100 (grades III-IV, up to 1 000 000) pairs are SAMPLED column by column (no enumeration), with the
 * exact multi-digit semantics:
 *  - carry:false => no column sums to >= 10;    carry:true => at least one column does
 *  - borrow:false => every digit of a >= the digit of b;  borrow:true => at least one digit of a < that of b
 * The result always stays within [0, max].
 *
 * Item types: choice, number-input, fill-gap (3 gap positions), true-false, and "read the jumps"
 * (choice among calculations). Number-line scaffolds never reveal the answer.
 */
import type { ChoiceItem, FillGapItem, Item, LocalizedText, NumberInputItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn, GeneratorContext } from './registry';
import {
  baseFields, ceilTen, chance, floorTen, numberOptions, optionCount, paramBool, paramInt, pick,
  randInt, shuffle, weighted, type Rng,
} from './util';
import { digitAt, fmt, fmtCards, numDigits, pow10 } from './numfmt';

interface Pair {
  a: number;
  b: number;
}

interface Op {
  /** Symbol shown to the child */
  sym: '+' | '−';
  result: (a: number, b: number) => number;
  pairs: (max: number, flag: boolean | undefined) => Pair[];
  /** Multi-digit sampler (max > ENUMERATE_MAX) */
  sample: (rng: Rng, max: number, d: number, flag: boolean | undefined) => Pair;
  /** Does (a, b) satisfy the skill's constraints? (distractor expressions must obey them too) */
  allows: (max: number, flag: boolean | undefined, a: number, b: number) => boolean;
  /** Size used to pick easier pairs at low difficulty */
  size: (p: Pair) => number;
  /** Plausible wrong results */
  wrongResults: (a: number, b: number, flagged: boolean) => number[];
  /** Multi-digit wrong results (max > ENUMERATE_MAX) */
  wrongBig: (a: number, b: number, flagged: boolean) => number[];
}

const cache = new Map<string, Pair[]>();

function memo(key: string, build: () => Pair[]): Pair[] {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = build()));
  return v;
}

export const addCarries = (a: number, b: number): boolean => (a % 10) + (b % 10) >= 10;
export const subBorrows = (a: number, b: number): boolean => a % 10 < b % 10;

/** Multi-digit: does ANY column of a + b carry? (the first column with digit sum >= 10 carries) */
export function addCarriesAny(a: number, b: number): boolean {
  for (; a > 0 || b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) if ((a % 10) + (b % 10) >= 10) return true;
  return false;
}
/** Multi-digit (a >= b): does ANY column of a - b borrow? (the first column with a digit < b digit borrows) */
export function subBorrowsAny(a: number, b: number): boolean {
  for (; b > 0; a = Math.floor(a / 10), b = Math.floor(b / 10)) if (a % 10 < b % 10) return true;
  return false;
}

/** Above this max operands are sampled instead of enumerated */
export const ENUMERATE_MAX = 100;
const RETRIES = 80;

/** Share of the range used at a difficulty (same curve as the enumerated path) */
const limitFor = (max: number, d: number): number => Math.max(20, Math.min(max, Math.floor(max * (0.35 + 0.13 * d))));

/** Digit count for an operand: usually the full width of `top`, sometimes a bit narrower. */
function widthFor(rng: Rng, top: number, minW = 1): number {
  const full = numDigits(top);
  const lo = Math.max(minW, full - 3);
  return rng() < 0.8 ? full : randInt(rng, Math.min(lo, full), full);
}

/** a random number with exactly w digits, not above `top` */
function withDigits(rng: Rng, w: number, top: number): number {
  const lo = w === 1 ? 1 : pow10(w - 1);
  const hi = Math.min(pow10(w) - 1, top);
  return hi < lo ? lo : randInt(rng, lo, hi);
}

/** Addends a, b >= 1 with a + b <= max (soft bound `limit`), honouring the multi-digit carry flag. */
export function sampleAddPair(rng: Rng, max: number, d: number, carry: boolean | undefined): Pair {
  const limit = limitFor(max, d);
  for (let t = 0; t < RETRIES; t++) {
    const bound = t < RETRIES / 2 ? limit : max;
    const wa = widthFor(rng, bound - 1, 2);
    const a = withDigits(rng, wa, bound - 1);
    const wbMax = Math.min(wa, numDigits(bound - a));
    const wb = rng() < 0.6 ? Math.max(1, wbMax - randInt(rng, 0, 1)) : randInt(rng, 1, wbMax);
    const forced = carry === true ? randInt(rng, 0, wb - 1) : -1;
    let b = 0;
    for (let i = 0; i < wb; i++) {
      const ai = digitAt(a, i);
      let lo = i === wb - 1 && wb > 1 ? 1 : 0;
      let hi = 9;
      if (carry === false) hi = 9 - ai;
      if (i === forced) lo = Math.max(lo, 10 - ai);
      if (hi < lo) {
        b = -1;
        break;
      }
      b += randInt(rng, lo, hi) * pow10(i);
    }
    if (b < 1 || a + b > bound) continue;
    if (carry !== undefined && addCarriesAny(a, b) !== carry) continue;
    return { a, b };
  }
  return carry ? { a: 9, b: 2 } : { a: 1, b: 1 };
}

/** Minuend a and subtrahend 1 <= b < a (a <= max, soft bound `limit`), honouring the multi-digit borrow flag. */
export function sampleSubPair(rng: Rng, max: number, d: number, borrow: boolean | undefined): Pair {
  const limit = limitFor(max, d);
  for (let t = 0; t < RETRIES; t++) {
    const bound = t < RETRIES / 2 ? limit : max;
    const wa = widthFor(rng, bound, 2);
    const a = withDigits(rng, Math.max(2, wa), bound);
    const wb = rng() < 0.6 ? Math.max(1, numDigits(a) - randInt(rng, 0, 1)) : randInt(rng, 1, numDigits(a));
    const forced = borrow === true ? randInt(rng, 0, wb - 1) : -1;
    let b = 0;
    for (let i = 0; i < wb; i++) {
      const ai = digitAt(a, i);
      let lo = i === wb - 1 && wb > 1 ? 1 : 0;
      let hi = i < forced ? 9 : ai; // below the forced column anything goes; elsewhere never above a's digit
      if (borrow === true && i === forced) {
        lo = Math.max(lo, ai + 1);
        hi = 9;
      }
      if (hi < lo) {
        b = -1;
        break;
      }
      b += randInt(rng, lo, hi) * pow10(i);
    }
    if (b < 1 || b >= a) continue;
    if (borrow !== undefined && subBorrowsAny(a, b) !== borrow) continue;
    return { a, b };
  }
  return borrow ? { a: 21, b: 9 } : { a: 25, b: 13 };
}

/** Digit-column slips for wrong answers: "no carry" and "smaller digit from larger" results */
const noCarrySum = (a: number, b: number): number => {
  let r = 0;
  for (let i = 0; a > 0 || b > 0; i++, a = Math.floor(a / 10), b = Math.floor(b / 10)) r += (((a % 10) + (b % 10)) % 10) * pow10(i);
  return r;
};
const smallerFromLarger = (a: number, b: number): number => {
  let r = 0;
  for (let i = 0; a > 0 || b > 0; i++, a = Math.floor(a / 10), b = Math.floor(b / 10)) r += Math.abs((a % 10) - (b % 10)) * pow10(i);
  return r;
};
const slips = (r: number): number[] => [r + 1, r - 1, r + 10, r - 10, r + 100, r - 100, r + 1000, r - 1000];

const ADD: Op = {
  sym: '+',
  result: (a, b) => a + b,
  pairs: (max, carry) =>
    memo(`add|${max}|${carry}`, () => {
      const out: Pair[] = [];
      for (let a = 1; a < max; a++)
        for (let b = 1; a + b <= max; b++) if (carry === undefined || addCarries(a, b) === carry) out.push({ a, b });
      return out;
    }),
  sample: sampleAddPair,
  allows: (max, flag, a, b) =>
    a >= 1 && b >= 1 && a + b <= max && (flag === undefined || (max > ENUMERATE_MAX ? addCarriesAny(a, b) : addCarries(a, b)) === flag),
  wrongBig: (a, b, carry) => {
    const r = a + b;
    return [...slips(r), Math.abs(a - b), carry ? noCarrySum(a, b) : r + 10, r + (a % 10)];
  },
  size: (p) => p.a + p.b,
  wrongResults: (a, b, carry) => {
    const r = a + b;
    return [r + 1, r - 1, r + 10, r - 10, r + 2, r - 2, Math.abs(a - b), carry ? r - 10 : r + 10];
  },
};

const SUB: Op = {
  sym: '−',
  result: (a, b) => a - b,
  pairs: (max, borrow) =>
    memo(`sub|${max}|${borrow}`, () => {
      const out: Pair[] = [];
      for (let a = 2; a <= max; a++)
        for (let b = 1; b <= a; b++) if (borrow === undefined || subBorrows(a, b) === borrow) out.push({ a, b });
      return out;
    }),
  sample: sampleSubPair,
  allows: (max, flag, a, b) =>
    a >= 2 && b >= 1 && b <= a && a <= max && (flag === undefined || (max > ENUMERATE_MAX ? subBorrowsAny(a, b) : subBorrows(a, b)) === flag),
  wrongBig: (a, b, borrow) => {
    const r = a - b;
    return [...slips(r), a + b, borrow ? smallerFromLarger(a, b) : r + 2];
  },
  size: (p) => p.a,
  wrongResults: (a, b, borrow) => {
    const r = a - b;
    // classic borrow slip: subtract the smaller ones digit from the larger
    const slip = floorTen(a) - floorTen(b) + Math.abs((a % 10) - (b % 10));
    return [r + 1, r - 1, r + 10, r - 10, a + b, borrow ? slip : r + 2, r - 2];
  },
};

function choosePair(ctx: GeneratorContext, flag: boolean | undefined, op: Op, max: number): Pair {
  if (max > ENUMERATE_MAX) return op.sample(ctx.rng, max, ctx.difficulty, flag);
  const pairs = op.pairs(max, flag);
  if (pairs.length === 0) throw new Error(`${op.sym}: no operand pair fits max=${max} with the requested flag`);
  const limit = max * (0.35 + 0.13 * ctx.difficulty);
  let pool = pairs.filter((p) => op.size(p) <= limit);
  if (pool.length < 8) pool = pairs;
  return pool[Math.floor(ctx.rng() * pool.length)];
}

const expr = (op: Op, a: number, b: number): string => `${fmt(a)} ${op.sym} ${fmt(b)}`;

/** Number-line window around the calculation (never wider than 30), or undefined when it would be unreadable. */
function lineWindow(max: number, a: number, r: number): { from: number; to: number } | undefined {
  if (max <= 20) return { from: 0, to: Math.max(10, max) };
  const lo = Math.min(a, r);
  const hi = Math.max(a, r);
  const from = floorTen(lo);
  const to = ceilTen(hi);
  return to - from <= 30 && to > from ? { from, to } : undefined;
}

/** The "make a ten" first hop (a -> next/previous ten) when the calculation crosses a ten. */
function tenHop(op: Op, a: number, r: number): { from: number; to: number } | undefined {
  if (a % 10 === 0) return undefined;
  const ten = op.sym === '+' ? ceilTen(a) : floorTen(a);
  const crosses = op.sym === '+' ? ten < r : ten > r;
  return crosses ? { from: a, to: ten } : undefined;
}

/** Scaffold: start point plus (when crossing a ten) the first hop; the answer is never drawn. */
function scaffold(op: Op, max: number, a: number, r: number): VisualSpec | undefined {
  const w = lineWindow(max, a, r);
  if (!w) return undefined;
  const hop = tenHop(op, a, r);
  return { kind: 'number-line', from: w.from, to: w.to, step: 1, marks: [a], ...(hop ? { jumps: [hop] } : {}) };
}

/** Full jump picture of the calculation (used only for "which calculation do the arrows show?"). */
function fullJumps(op: Op, max: number, a: number, b: number): VisualSpec | undefined {
  const r = op.result(a, b);
  const w = lineWindow(max, a, r);
  if (!w) return undefined;
  const hop = tenHop(op, a, r);
  const jumps = hop ? [hop, { from: hop.to, to: r }] : [{ from: a, to: r }];
  return { kind: 'number-line', from: w.from, to: w.to, step: 1, marks: [a], jumps };
}

type Kind = 'choice' | 'input' | 'gap' | 'trueFalse' | 'jumps';

function build(op: Op, name: 'addition' | 'subtraction'): GeneratorFn {
  return (params, ctx): Item => {
    const { rng, difficulty: d } = ctx;
    const max = Math.max(4, paramInt(params, 'max', 10));
    const flag = paramBool(params, name === 'addition' ? 'carry' : 'borrow');
    const { a, b } = choosePair(ctx, flag, op, max);
    const r = op.result(a, b);
    const big = max > ENUMERATE_MAX;
    const flagged = name === 'addition' ? (big ? addCarriesAny(a, b) : addCarries(a, b)) : big ? subBorrowsAny(a, b) : subBorrows(a, b);
    const wrong = big ? op.wrongBig(a, b, flagged) : op.wrongResults(a, b, flagged);
    const total = optionCount(d);

    const canJumps = fullJumps(op, max, a, b) !== undefined && d >= 2;
    const kind = weighted<Kind>(rng, [['choice', 22], ['input', 20], ['gap', 28], ['trueFalse', 10], ['jumps', canJumps ? 12 : 0]]);
    const useScaffold = d <= 3 && chance(rng, 0.7);

    switch (kind) {
      case 'choice': {
        const values = numberOptions(rng, r, wrong, total, 0, max);
        const item: ChoiceItem = {
          ...baseFields(
            ctx,
            { ro: `Cât face ${expr(op, a, b)}?`, en: `What is ${expr(op, a, b)}?` },
            useScaffold ? scaffold(op, max, a, r) : undefined,
          ),
          type: 'choice',
          options: fmtCards(values),
          correctId: `n${r}`,
        };
        return item;
      }
      case 'input': {
        const item: NumberInputItem = {
          ...baseFields(
            ctx,
            { ro: `Cât face ${expr(op, a, b)}?`, en: `What is ${expr(op, a, b)}?` },
            useScaffold ? scaffold(op, max, a, r) : undefined,
          ),
          type: 'number-input',
          correct: r,
        };
        return item;
      }
      case 'gap': {
        const pos = weighted<'result' | 'second' | 'first'>(rng, [['result', 30], ['second', 40], ['first', 30]]);
        const sym = op.sym;
        const gapValue = pos === 'result' ? r : pos === 'second' ? b : a;
        const template =
          pos === 'result' ? `${fmt(a)} ${sym} ${fmt(b)} = {{gap}}`
          : pos === 'second' ? `${fmt(a)} ${sym} {{gap}} = ${fmt(r)}`
          : `{{gap}} ${sym} ${fmt(b)} = ${fmt(r)}`;
        const cands =
          pos === 'result'
            ? wrong
            : pos === 'second'
              ? [b + 1, b - 1, b + 2, b - 2, r, a, b + 10, b - 10]
              : [a + 1, a - 1, a + 2, a - 2, r, b, a + 10, a - 10];
        const prompt: LocalizedText = { ro: 'Completează cu numărul care lipsește.', en: 'Fill in the missing number.' };
        const typed = chance(rng, 0.35) || max >= 10000;
        const item: FillGapItem = {
          ...baseFields(ctx, prompt, pos === 'second' && useScaffold ? scaffold(op, max, a, r) : undefined),
          type: 'fill-gap',
          template: { ro: template, en: template },
          ...(typed ? {} : { options: numberOptions(rng, gapValue, cands, total, 0, max).map(String) }),
          correct: String(gapValue),
        };
        return item;
      }
      case 'trueFalse': {
        const truth = chance(rng, 0.5);
        const shown = truth ? r : pick(rng, wrong.filter((v) => v >= 0 && v !== r));
        const stmt = `${fmt(a)} ${op.sym} ${fmt(b)} = ${fmt(shown)}`;
        const item: TrueFalseItem = {
          ...baseFields(ctx, { ro: `Adevărat sau fals: ${stmt}`, en: `True or false: ${stmt}` }),
          type: 'true-false',
          correct: truth,
        };
        return item;
      }
      case 'jumps': {
        // distractors: same operation with a nearby operand (only pairs that obey the skill's flag), or the other operation
        const exprs = new Set<string>();
        for (const [x, y] of [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]]) {
          if (op.allows(max, flag, x, y)) exprs.add(expr(op, x, y));
        }
        exprs.add(op === ADD ? expr(SUB, Math.max(a, b), Math.min(a, b)) : expr(ADD, a, b));
        const distractors = shuffle(rng, [...exprs]).slice(0, total - 1);
        const options = shuffle(rng, [expr(op, a, b), ...distractors]);
        const item: ChoiceItem = {
          ...baseFields(
            ctx,
            { ro: 'Ce calcul arată săgețile pe axă?', en: 'Which calculation do the arrows on the number line show?' },
            fullJumps(op, max, a, b),
          ),
          type: 'choice',
          options: options.map((t, i) => ({ id: `e${i}`, text: { ro: t, en: t } })),
          correctId: `e${options.indexOf(expr(op, a, b))}`,
        };
        return item;
      }
    }
  };
}

export const addition: GeneratorFn = build(ADD, 'addition');
export const subtraction: GeneratorFn = build(SUB, 'subtraction');
