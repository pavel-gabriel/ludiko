/**
 * `order-of-operations` generator (params: parens, max, factorMax, ops).
 *
 *   parens:false  expressions WITHOUT parentheses where precedence matters ("7 + 3 × 4", "40 − 18 : 3")
 *   parens:true   expressions WITH parentheses that change the result ("(7 + 3) × 4", "60 : (2 + 4)")
 *   max           largest result (default 100); factorMax: largest factor/divisor (default 10)
 *   operandMax    largest number or intermediate result allowed anywhere (default: max)
 *   ops           allowed operations among "+", "-", "*", "/" (default all four)
 *
 * Every intermediate result is a non-negative integer (divisions are exact). The classic wrong answers
 * (left to right ignoring precedence / ignoring the parentheses) are offered as distractors.
 * Item types: number-input, choice, fill-gap, true-false, "which operation is done first?".
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, paramBool, paramInt, paramStrings, pick, randInt, shuffle, weighted } from './util';
import { fmt } from './numfmt';
import { numChoice, numGap, numInput, trueFalse } from './numItems';
import type { ChoiceItem } from '../../types';

type Op = '+' | '-' | '*' | '/';
export type Tok = number | Op | '(' | ')';

const isOp = (t: Tok): t is Op => t === '+' || t === '-' || t === '*' || t === '/';
const isMul = (t: Tok): boolean => t === '*' || t === '/';
const SYM: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': ':' };
const SYM_EN: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** Evaluate with the usual precedence. strict: every step must be a non-negative integer (else null). */
export function evalTokens(tokens: readonly Tok[], strict: boolean, cap = Infinity): number | null {
  let i = 0;
  const apply = (op: Op, l: number, r: number): number | null => {
    let v: number;
    switch (op) {
      case '+': v = l + r; break;
      case '-': v = l - r; break;
      case '*': v = l * r; break;
      case '/':
        if (r === 0) return null;
        v = l / r;
        break;
    }
    if (strict && (!Number.isInteger(v) || v < 0 || v > cap)) return null;
    return v;
  };
  const factor = (): number | null => {
    const t = tokens[i++];
    if (t === '(') {
      const v = expr();
      if (tokens[i++] !== ')') return null;
      return v;
    }
    return typeof t === 'number' ? t : null;
  };
  const term = (): number | null => {
    let l = factor();
    while (l !== null && (tokens[i] === '*' || tokens[i] === '/')) {
      const op = tokens[i++] as Op;
      const r = factor();
      l = r === null ? null : apply(op, l, r);
    }
    return l;
  };
  const expr = (): number | null => {
    let l = term();
    while (l !== null && (tokens[i] === '+' || tokens[i] === '-')) {
      const op = tokens[i++] as Op;
      const r = term();
      l = r === null ? null : apply(op, l, r);
    }
    return l;
  };
  const v = expr();
  return i === tokens.length ? v : null;
}

/** Left to right, ignoring precedence (the classic mistake); parentheses are skipped. */
function evalLtr(tokens: readonly Tok[]): number | null {
  const flat = tokens.filter((t) => t !== '(' && t !== ')');
  let acc = flat[0] as number;
  for (let k = 1; k < flat.length; k += 2) {
    const op = flat[k] as Op;
    const r = flat[k + 1] as number;
    acc = op === '+' ? acc + r : op === '-' ? acc - r : op === '*' ? acc * r : r === 0 ? NaN : acc / r;
  }
  return Number.isFinite(acc) ? acc : null;
}

export function render(tokens: readonly Tok[], lang: 'ro' | 'en' = 'ro'): string {
  const sym = lang === 'ro' ? SYM : SYM_EN;
  let out = '';
  for (const t of tokens) {
    if (t === '(') out += '(';
    else if (t === ')') out = `${out.trimEnd()}) `;
    else if (typeof t === 'number') out += `${fmt(t)} `;
    else out += `${sym[t]} `;
  }
  return out.trim();
}

interface Built {
  tokens: Tok[];
  value: number;
  /** Token index of the left operand of the operation done first */
  firstIdx: number;
  /** two independent parenthesised groups: "which first?" has no single answer */
  ambiguous: boolean;
}

type Shape = 'plain3' | 'plain4' | 'p1' | 'p2' | 'p3';

function build(rng: Rng, parens: boolean, d: number, max: number, factorMax: number, ops: Op[], cap: number): Built | null {
  const shape: Shape = parens ? (d >= 4 && chance(rng, 0.35) ? 'p3' : chance(rng, 0.5) ? 'p1' : 'p2') : d >= 4 && chance(rng, 0.4) ? 'plain4' : 'plain3';
  const nOps = shape === 'plain3' || shape === 'p1' || shape === 'p2' ? 2 : 3;
  const hasMul = ops.some(isMul);
  const hasAdd = ops.some((o) => !isMul(o));
  const chosen: Op[] = Array.from({ length: nOps }, () => pick(rng, ops));
  // plain expressions must mix the two precedence levels (from difficulty 2 on) so that precedence matters
  if (!parens && hasMul && hasAdd && d >= 2 && (!chosen.some(isMul) || chosen.every(isMul))) return null;

  const [o1, o2, o3] = chosen;
  const slots: (number | Op | '(' | ')')[] =
    shape === 'plain3' ? [0, o1, 0, o2, 0]
    : shape === 'plain4' ? [0, o1, 0, o2, 0, o3, 0]
    : shape === 'p1' ? ['(', 0, o1, 0, ')', o2, 0]
    : shape === 'p2' ? [0, o2, '(', 0, o1, 0, ')']
    : ['(', 0, o1, 0, ')', o2, '(', 0, o3, 0, ')'];

  const addCap = Math.max(12, Math.round(max * (0.25 + 0.1 * d)));
  const tokens: Tok[] = slots.map((t, k) => {
    if (t !== 0) return t as Tok;
    // operand cap depends on the neighbouring operators
    const adjacentMul = [slots[k - 1], slots[k + 1]].some((x) => x === '*' || x === '/');
    return adjacentMul ? randInt(rng, 2, factorMax) : randInt(rng, 2, addCap);
  });

  // make every ':' exact where the dividend is a single plain number
  for (let k = 0; k < tokens.length; k++) {
    if (tokens[k] !== '/') continue;
    let right = tokens[k + 1];
    const left = tokens[k - 1];
    if (right === '(' && typeof left === 'number') {
      // A : (B o C) => make A a multiple of the group's value
      const close = tokens.indexOf(')', k + 1);
      const g = evalTokens(tokens.slice(k + 2, close), true, cap);
      if (g === null || g < 1 || tokens[k - 2] === '*' || tokens[k - 2] === '/') continue;
      right = g;
    }
    if (typeof right !== 'number' || typeof left !== 'number') continue; // group on the left: rely on rejection
    const before = tokens[k - 2];
    if (before === '*' || before === '/') continue;
    tokens[k - 1] = right * randInt(rng, 2, factorMax);
  }

  if (tokens.some((t) => typeof t === 'number' && t > cap)) return null;
  const value = evalTokens(tokens, true, cap);
  if (value === null || value > max) return null;
  if (parens) {
    // the parentheses must matter
    const noParens = evalTokens(tokens.filter((t) => t !== '(' && t !== ')'), false);
    if (noParens === value) return null;
  } else {
    const ltr = evalLtr(tokens);
    if (hasMul && hasAdd && d >= 2 && ltr === value) return null;
  }

  // index of the left operand of the operation done first
  let firstIdx: number;
  if (parens) firstIdx = tokens.indexOf('(') + 1;
  else {
    const m = tokens.findIndex((t) => isMul(t));
    firstIdx = m > 0 ? m - 1 : 0;
  }
  return { tokens, value, firstIdx, ambiguous: shape === 'p3' };
}

const FALLBACK_PLAIN: Tok[] = [7, '+', 3, '*', 4];
const FALLBACK_PAREN: Tok[] = ['(', 7, '+', 3, ')', '*', 4];

export const orderOfOps: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const parens = paramBool(params, 'parens') ?? false;
  const max = Math.max(30, paramInt(params, 'max', 100));
  const factorMax = Math.max(3, paramInt(params, 'factorMax', 10));
  const cap = Math.max(max, paramInt(params, 'operandMax', max));
  const ops = paramStrings(params, 'ops', ['+', '-', '*', '/']).filter((o): o is Op => ['+', '-', '*', '/'].includes(o));

  let built: Built | null = null;
  for (let t = 0; t < 400 && !built; t++) built = build(rng, parens, d, max, factorMax, ops.length ? ops : ['+'], cap);
  const tokens = built?.tokens ?? (parens ? FALLBACK_PAREN : FALLBACK_PLAIN);
  const value = built?.value ?? (parens ? 40 : 19);
  const noParens = evalTokens(tokens.filter((t) => t !== '(' && t !== ')'), false);
  const ltr = evalLtr(tokens);

  const ro = render(tokens, 'ro');
  const en = render(tokens, 'en');
  const isInt = (v: number | null): v is number => v !== null && Number.isInteger(v) && v >= 0 && v !== value;
  const wrong = [
    ...[ltr, noParens].filter(isInt),
    value + 1, value - 1, value + 2, value - 2, value + 10, value - 10, ...(value > 5 ? [Math.round(value / 2)] : []),
  ];
  const skillWrong = shuffle(rng, wrong);

  const kind = weighted<'input' | 'choice' | 'tf' | 'gap' | 'first'>(rng, [['input', 24], ['choice', 26], ['tf', 12], ['gap', 14], ['first', d >= 2 ? 24 : 12]]);
  switch (kind) {
    case 'input':
      return numInput(ctx, { ro: `Calculează: ${ro}`, en: `Calculate: ${en}` }, value);
    case 'choice':
      // the classic mistake always among the options
      return numChoice(ctx, { ro: `Cât face ${ro}?`, en: `What is ${en}?` }, value, skillWrong, { must: [ltr, noParens].filter(isInt) });
    case 'gap':
      return numGap(ctx, { ro: `${ro} = {{gap}}`, en: `${en} = {{gap}}` }, value, skillWrong, chance(rng, 0.5));
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? value : pick(rng, [...wrong.slice(0, 2).filter(isInt), ...skillWrong].filter((v) => v >= 0 && v !== value));
      return trueFalse(ctx, { ro: `${ro} = ${fmt(shown)}`, en: `${en} = ${fmt(shown)}` }, truth);
    }
    case 'first': {
      // which operation is done first? options are the adjacent pairs of the expression
      const nums = tokens.map((t, i) => [t, i] as const).filter(([t]) => typeof t === 'number');
      const pairs = nums.slice(0, -1).map(([a, i], k) => {
        const op = tokens.slice(i + 1).find(isOp) as Op;
        const b = nums[k + 1][0] as number;
        return { idx: i, ro: `${fmt(a as number)} ${SYM[op]} ${fmt(b)}`, en: `${fmt(a as number)} ${SYM_EN[op]} ${fmt(b)}` };
      });
      const firstIdx = built?.firstIdx ?? (parens ? 1 : 2);
      const correct = pairs.find((p) => p.idx === firstIdx) ?? pairs[0];
      const uniq = pairs.filter((p, i) => pairs.findIndex((q) => q.ro === p.ro) === i);
      if (built?.ambiguous || uniq.length < 2 || !uniq.includes(correct)) return numInput(ctx, { ro: `Calculează: ${ro}`, en: `Calculate: ${en}` }, value);
      const options = shuffle(rng, uniq);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Ce operație se efectuează prima în ${ro}?`,
          en: `Which operation is done first in ${en}?`,
        }),
        type: 'choice',
        options: options.map((p, i) => ({ id: `e${i}`, text: { ro: p.ro, en: p.en } })),
        correctId: `e${options.indexOf(correct)}`,
      };
      return item;
    }
  }
};

registerGenerator('order-of-operations', orderOfOps);
