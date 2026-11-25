/**
 * `equation` generator: find the unknown number (params: ops, max, factorMax).
 *
 *   ops: any of "+", "-", "*", "/"   (default ["+","-"])
 *   max: largest number appearing in the equation (default 100)
 *   factorMax: largest factor/divisor for * and / (default 10)
 *
 * The unknown can stand in either operand position: "? + 7 = 15", "27 + ? = 63", "? − 8 = 9",
 * "50 − ? = 31", "? × 6 = 42", "7 × ? = 56", "? : 4 = 9", "36 : ? = 6". Never in the result
 * (that is plain arithmetic). Item types: fill-gap, choice, number-input, true-false.
 */
import type { Item, LocalizedText } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, paramStrings, pick, randInt, weighted } from './util';
import { fmt, numDigits } from './numfmt';
import { numChoice, numGap, numInput, randWithDigits, trueFalse } from './numItems';

type OpSym = '+' | '-' | '*' | '/';

interface Eq {
  /** Display strings of the three numbers x op y = z with the unknown replaced by `slot` */
  x: number;
  y: number;
  z: number;
  op: OpSym;
  /** 'x' or 'y': which operand is unknown */
  unknown: 'x' | 'y';
}

const SYM: Record<OpSym, string> = { '+': '+', '-': '−', '*': '×', '/': ':' };
const SYM_EN: Record<OpSym, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function sample(ctx: Parameters<GeneratorFn>[1], op: OpSym, max: number, factorMax: number): Eq {
  const { rng, difficulty: d } = ctx;
  const unknown = chance(rng, 0.5) ? 'x' : 'y';
  const w = numDigits(max);
  /** number with a width biased to the top width (lower at easy difficulty) */
  const wide = (top: number, minW = 1): number => {
    const wt = numDigits(top);
    const width = d <= 2 ? randInt(rng, Math.max(minW, wt - 1), wt) : chance(rng, 0.75) ? wt : randInt(rng, minW, wt);
    return randWithDigits(rng, width, top);
  };
  switch (op) {
    case '+': {
      const z = Math.max(12, wide(max, Math.min(2, w)));
      const x = randInt(rng, 2, z - 2);
      return { x, y: z - x, z, op, unknown };
    }
    case '-': {
      const x = Math.max(12, wide(max, Math.min(2, w)));
      const y = randInt(rng, 2, x - 2);
      return { x, y, z: x - y, op, unknown };
    }
    case '*': {
      const y = randInt(rng, 2, factorMax);
      const xMax = Math.max(2, Math.floor(max / y));
      const x = Math.max(2, xMax <= 10 ? randInt(rng, 2, xMax) : wide(xMax));
      return chance(rng, 0.5) ? { x, y, z: x * y, op, unknown } : { x: y, y: x, z: x * y, op, unknown };
    }
    case '/': {
      const y = randInt(rng, 2, factorMax);
      const zMax = Math.max(2, Math.floor(max / y));
      const z = Math.max(2, zMax <= 10 ? randInt(rng, 2, zMax) : wide(zMax));
      return { x: y * z, y, z, op, unknown };
    }
  }
}

export const equation: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const ops = paramStrings(params, 'ops', ['+', '-']).filter((o): o is OpSym => ['+', '-', '*', '/'].includes(o));
  const max = Math.max(20, paramInt(params, 'max', 100));
  const factorMax = Math.max(3, paramInt(params, 'factorMax', 10));
  const op = pick(rng, ops.length ? ops : (['+'] as OpSym[]));
  const eq = sample(ctx, op, max, factorMax);
  const { x, y, z } = eq;
  const hidden = eq.unknown === 'x' ? x : y;
  const other = eq.unknown === 'x' ? y : x;

  const build = (slot: string, lang: 'ro' | 'en'): string => {
    const s = lang === 'ro' ? SYM[op] : SYM_EN[op];
    return `${eq.unknown === 'x' ? slot : fmt(x)} ${s} ${eq.unknown === 'y' ? slot : fmt(y)} = ${fmt(z)}`;
  };
  const text = (slot: string): LocalizedText => ({ ro: build(slot, 'ro'), en: build(slot, 'en') });

  const wrong = [
    hidden + 1, hidden - 1, hidden + 2, hidden - 2, other, z,
    op === '+' ? x + y : op === '*' ? x + y : z + other,
    op === '-' ? x + y : z - other, Math.abs(z - other), hidden + 10, hidden - 10,
    ...(op === '*' || op === '/' ? [hidden * 2, Math.max(1, Math.floor(hidden / 2))] : []),
  ];

  const kind = weighted<'gap' | 'choice' | 'input' | 'tf'>(rng, [['gap', 34], ['choice', 26], ['input', 24], ['tf', 16]]);
  switch (kind) {
    case 'gap':
      return numGap(ctx, text('{{gap}}'), hidden, wrong, chance(rng, 0.6));
    case 'choice':
      return numChoice(
        ctx,
        { ro: `Ce număr lipsește? ${build('?', 'ro')}`, en: `Which number is missing? ${build('?', 'en')}` },
        hidden,
        wrong,
      );
    case 'input':
      return numInput(ctx, { ro: `Află numărul necunoscut: ${build('?', 'ro')}`, en: `Find the unknown number: ${build('?', 'en')}` }, hidden);
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? hidden : pick(rng, wrong.filter((v) => v > 0 && v !== hidden));
      return trueFalse(
        ctx,
        {
          ro: `în ${build('?', 'ro')}, numărul ? este ${fmt(shown)}`,
          en: `in ${build('?', 'en')}, the number ? is ${fmt(shown)}`,
        },
        truth,
      );
    }
  }
};

registerGenerator('equation', equation);
