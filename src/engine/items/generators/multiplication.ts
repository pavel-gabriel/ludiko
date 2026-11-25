/**
 * `multiplication` generator.
 *
 *  - Table mode  `{ tables: [2,3,4,5] }`: one factor from `tables`, the other 1..10 (either order).
 *  - Large mode  `{ aMin?, aMax, bMin?, bMax, max? }`: a x b with a in [aMin, aMax], b in [bMin, bMax],
 *    product <= max (default 1 000 000). Sampled, never enumerated.
 *
 * Item types: choice, number-input, fill-gap (result / missing factor / partial products), true-false,
 * and (small products) groups of objects.
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, pick, randInt, weighted } from './util';
import { digitAt, fmt, numDigits, pow10 } from './numfmt';
import { numChoice, numGap, numInput, randWithDigits, same, trueFalse } from './numItems';
import { THINGS } from './things';

interface Fact {
  a: number;
  b: number;
}

const NOTHING: number[] = [];

function tableFact(params: Record<string, unknown>, ctx: Parameters<GeneratorFn>[1]): Fact {
  const { rng, difficulty: d } = ctx;
  const tables = Array.isArray(params.tables) ? (params.tables as number[]).filter((n) => Number.isInteger(n) && n >= 2) : [2, 3, 4, 5];
  const t = pick(rng, tables.length ? tables : [2]);
  const top = d <= 1 ? 6 : 10;
  const m = randInt(rng, 2, top);
  return chance(rng, 0.5) ? { a: t, b: m } : { a: m, b: t };
}

/** Width-biased sample of the first factor; reduced below the full width at low difficulty. */
function sampleLarge(params: Record<string, unknown>, ctx: Parameters<GeneratorFn>[1]): Fact {
  const { rng, difficulty: d } = ctx;
  const aMin = Math.max(2, paramInt(params, 'aMin', 10));
  const aMax = Math.max(aMin + 1, paramInt(params, 'aMax', 99));
  const bMin = Math.max(2, paramInt(params, 'bMin', 2));
  const bMax = Math.max(bMin, paramInt(params, 'bMax', 9));
  const max = paramInt(params, 'max', 1_000_000);
  const wMax = numDigits(aMax);
  const wMin = Math.max(1, numDigits(aMin));
  for (let t = 0; t < 40; t++) {
    let b = randInt(rng, bMin, bMax);
    // easier at low difficulty: round tens for two-digit multipliers
    if (bMax >= 20 && d <= 2 && chance(rng, 0.4)) b = Math.max(bMin, Math.floor(b / 10) * 10 || 10);
    const wa = d <= 2 ? randInt(rng, Math.max(wMin, wMax - 1), wMax) : chance(rng, 0.75) ? wMax : randInt(rng, wMin, wMax);
    const a = randWithDigits(rng, wa, aMax);
    if (a >= aMin && a * b <= max) return { a, b };
  }
  return { a: aMin, b: bMin };
}

export const multiplication: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const tableMode = params.tables !== undefined;
  const { a, b } = tableMode ? tableFact(params, ctx) : sampleLarge(params, ctx);
  const r = a * b;
  const e = `${fmt(a)} × ${fmt(b)}`;
  const small = r <= 50;

  const wrong = tableMode
    ? [r + a, r - a, r + b, r - b, (a + 1) * b, a * (b + 1), (a - 1) * b, a * (b - 1), a + b, r + 10, r - 10]
    : [
        r + 10, r - 10, r + 100, r - 100, r + 1000, r - 1000, a + b, r + a, r - a,
        a * (b + 1), a * Math.max(0, b - 1), (a % 10) * b + Math.floor(a / 10) * b, r * 10, Math.floor(r / 10),
      ].concat(carryless(a, b));

  const kind = weighted<'choice' | 'input' | 'gap' | 'factor' | 'tf' | 'groups' | 'partial' | 'repeat'>(rng, [
    ['choice', 24], ['input', 20], ['gap', 12], ['factor', 14], ['tf', 8],
    ['groups', tableMode && small && d <= 3 ? 18 : 0],
    ['partial', !tableMode && b < 10 && a >= 20 && a < 1000 && a % 10 !== 0 ? 16 : 0],
    ['repeat', tableMode && d <= 2 && Math.min(a, b) <= 6 ? 10 : 0],
  ]);

  switch (kind) {
    case 'choice':
      return numChoice(ctx, { ro: `Cât face ${e}?`, en: `What is ${e}?` }, r, wrong);
    case 'input':
      return numInput(ctx, { ro: `Cât face ${e}?`, en: `What is ${e}?` }, r);
    case 'gap':
      return numGap(ctx, same(`${e} = {{gap}}`), r, wrong, chance(rng, 0.6));
    case 'factor': {
      const hideFirst = chance(rng, 0.5);
      const missing = hideFirst ? a : b;
      const known = hideFirst ? b : a;
      const template = hideFirst ? `{{gap}} × ${fmt(known)} = ${fmt(r)}` : `${fmt(known)} × {{gap}} = ${fmt(r)}`;
      const cands = [missing + 1, missing - 1, missing + 2, missing - 2, r, known, missing * 10, missing + 10];
      return numGap(ctx, same(template), missing, cands, chance(rng, 0.6));
    }
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? r : pick(rng, wrong.filter((v) => v > 0 && v !== r));
      return trueFalse(ctx, same(`${e} = ${fmt(shown)}`), truth);
    }
    case 'groups': {
      const thing = pick(rng, THINGS);
      const text = {
        ro: `Sunt ${a} grupe cu câte ${b} ${thing.ro}. Câte ${thing.ro} sunt în total?`,
        en: `There are ${a} groups of ${b} ${thing.en}. How many ${thing.en} are there in total?`,
      };
      const spec: VisualSpec = { kind: 'objects', icon: thing.icon, count: r, groups: a };
      return chance(rng, 0.5) ? numChoice(ctx, text, r, wrong, { visual: spec }) : numInput(ctx, text, r, spec);
    }
    case 'partial': {
      const tens = Math.floor(a / 10) * 10;
      const ones = a % 10;
      // a x b = (tens x b) + (ones x b): ask for the second partial product (or the first)
      const askOnes = chance(rng, 0.5) || ones === 0;
      const first = tens * b;
      const second = ones * b;
      const missing = askOnes ? second : first;
      const template = askOnes ? `${e} = ${fmt(first)} + {{gap}}` : `${e} = {{gap}} + ${fmt(second)}`;
      return numGap(ctx, same(template), missing, [missing + 10, missing - 10, missing + b, missing - b, tens, ones, first + second], chance(rng, 0.6));
    }
    case 'repeat': {
      const n = Math.min(a, b);
      const m = Math.max(a, b);
      const sum = Array.from({ length: n }, () => String(m)).join(' + ');
      return numGap(ctx, same(`${n} × ${m} = ${sum} = {{gap}}`), r, wrong, true);
    }
  }
};

/** Result when the carries are forgotten, for a x one-digit b (a classic slip) */
function carryless(a: number, b: number): number[] {
  if (b >= 10) return NOTHING;
  let r = 0;
  for (let i = 0; i < numDigits(a); i++) r += ((digitAt(a, i) * b) % 10) * pow10(i);
  return [r];
}

registerGenerator('multiplication', multiplication);
