/**
 * `addition` (params: max, carry?) and `subtraction` (params: max, borrow?) generators.
 *
 * Operand pairs are enumerated once per (max, flag) so the carry/borrow constraint is exact:
 *  - carry:false  => ones digits sum to < 10;   carry:true  => ones digits sum to >= 10
 *  - borrow:false => ones(a) >= ones(b);        borrow:true => ones(a) < ones(b)
 * and the result always stays within [0, max].
 *
 * Item types: choice, number-input, fill-gap (3 gap positions), true-false, and "read the jumps"
 * (choice among calculations). Number-line scaffolds never reveal the answer.
 */
import type { ChoiceItem, FillGapItem, Item, LocalizedText, NumberInputItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn, GeneratorContext } from './registry';
import {
  baseFields, ceilTen, chance, floorTen, numberCards, numberOptions, optionCount, paramBool, paramInt, pick,
  shuffle, weighted,
} from './util';

interface Pair {
  a: number;
  b: number;
}

interface Op {
  /** Symbol shown to the child */
  sym: '+' | '−';
  result: (a: number, b: number) => number;
  pairs: (max: number, flag: boolean | undefined) => Pair[];
  /** Size used to pick easier pairs at low difficulty */
  size: (p: Pair) => number;
  /** Plausible wrong results */
  wrongResults: (a: number, b: number, flagged: boolean) => number[];
}

const cache = new Map<string, Pair[]>();

function memo(key: string, build: () => Pair[]): Pair[] {
  let v = cache.get(key);
  if (!v) cache.set(key, (v = build()));
  return v;
}

export const addCarries = (a: number, b: number): boolean => (a % 10) + (b % 10) >= 10;
export const subBorrows = (a: number, b: number): boolean => a % 10 < b % 10;

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
  size: (p) => p.a,
  wrongResults: (a, b, borrow) => {
    const r = a - b;
    // classic borrow slip: subtract the smaller ones digit from the larger
    const slip = floorTen(a) - floorTen(b) + Math.abs((a % 10) - (b % 10));
    return [r + 1, r - 1, r + 10, r - 10, a + b, borrow ? slip : r + 2, r - 2];
  },
};

function choosePair(ctx: GeneratorContext, pairs: Pair[], op: Op, max: number): Pair {
  if (pairs.length === 0) throw new Error(`${op.sym}: no operand pair fits max=${max} with the requested flag`);
  const limit = max * (0.35 + 0.13 * ctx.difficulty);
  let pool = pairs.filter((p) => op.size(p) <= limit);
  if (pool.length < 8) pool = pairs;
  return pool[Math.floor(ctx.rng() * pool.length)];
}

const expr = (op: Op, a: number, b: number): string => `${a} ${op.sym} ${b}`;

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
    const { a, b } = choosePair(ctx, op.pairs(max, flag), op, max);
    const r = op.result(a, b);
    const flagged = name === 'addition' ? addCarries(a, b) : subBorrows(a, b);
    const wrong = op.wrongResults(a, b, flagged);
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
          options: numberCards(values),
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
          pos === 'result' ? `${a} ${sym} ${b} = {{gap}}`
          : pos === 'second' ? `${a} ${sym} {{gap}} = ${r}`
          : `{{gap}} ${sym} ${b} = ${r}`;
        const cands =
          pos === 'result'
            ? wrong
            : pos === 'second'
              ? [b + 1, b - 1, b + 2, b - 2, r, a, b + 10, b - 10]
              : [a + 1, a - 1, a + 2, a - 2, r, b, a + 10, a - 10];
        const prompt: LocalizedText = { ro: 'Completează cu numărul care lipsește.', en: 'Fill in the missing number.' };
        const typed = chance(rng, 0.35);
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
        const stmt = `${a} ${op.sym} ${b} = ${shown}`;
        const item: TrueFalseItem = {
          ...baseFields(ctx, { ro: `Adevărat sau fals: ${stmt}`, en: `True or false: ${stmt}` }),
          type: 'true-false',
          correct: truth,
        };
        return item;
      }
      case 'jumps': {
        // distractors: same operation with a nearby operand (only pairs that obey the skill's flag), or the other operation
        const allowed = new Set(op.pairs(max, flag).map((p) => `${p.a}|${p.b}`));
        const exprs = new Set<string>();
        for (const [x, y] of [[a, b + 1], [a, b - 1], [a + 1, b], [a - 1, b]]) {
          if (allowed.has(`${x}|${y}`)) exprs.add(expr(op, x, y));
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
