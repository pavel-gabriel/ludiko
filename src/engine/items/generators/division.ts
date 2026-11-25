/**
 * `division` generator (Romanian notation: "a : b").
 *
 *  - Table mode  `{ tables: [2,3,4,5] }`: divisor from `tables`, quotient 2..10, exact (division as the
 *    inverse of multiplication).
 *  - Large mode  `{ dMin?, dMax, max, remainder? }`: dividend <= max, divisor in [dMin, dMax],
 *    `remainder: true` => 0 < remainder < divisor, `remainder: false` => exact. Sampled, never enumerated.
 *
 * Item types: choice, number-input, fill-gap (quotient / divisor / remainder / "a = b x q + r"),
 * true-false, and groups of objects for small exact divisions.
 */
import type { Item, LocalizedText, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramBool, paramInt, pick, randInt, weighted } from './util';
import { fmt, numDigits, pow10, roNum } from './numfmt';
import { numChoice, numGap, numInput, randWithDigits, same, trueFalse } from './numItems';
import { THINGS } from './things';

interface Div {
  a: number; // dividend
  b: number; // divisor
  q: number;
  r: number;
}

function tableDiv(params: Record<string, unknown>, ctx: Parameters<GeneratorFn>[1]): Div {
  const { rng, difficulty: d } = ctx;
  const tables = Array.isArray(params.tables) ? (params.tables as number[]).filter((n) => Number.isInteger(n) && n >= 2) : [2, 3, 4, 5];
  const b = pick(rng, tables.length ? tables : [2]);
  const q = randInt(rng, 2, d <= 1 ? 6 : 10);
  return { a: b * q, b, q, r: 0 };
}

function largeDiv(params: Record<string, unknown>, ctx: Parameters<GeneratorFn>[1]): Div {
  const { rng, difficulty: d } = ctx;
  const dMin = Math.max(2, paramInt(params, 'dMin', 2));
  const dMax = Math.max(dMin, paramInt(params, 'dMax', 9));
  const max = Math.max(50, paramInt(params, 'max', 10000));
  const remainder = paramBool(params, 'remainder') ?? false;
  for (let t = 0; t < 40; t++) {
    const b = randInt(rng, dMin, dMax);
    const r = remainder ? randInt(rng, 1, b - 1) : 0;
    const qMax = Math.floor((max - r) / b);
    if (qMax < 2) continue;
    const wMax = numDigits(qMax);
    const w = d <= 2 ? randInt(rng, Math.max(1, wMax - 1), wMax) : chance(rng, 0.75) ? wMax : randInt(rng, 1, wMax);
    let q = Math.max(remainder ? 1 : 2, randWithDigits(rng, w, qMax));
    // a zero inside the quotient (e.g. 4 025 : 5 = 805) at higher difficulty
    if (d >= 3 && numDigits(q) >= 3 && chance(rng, 0.3)) {
      const i = randInt(rng, 1, numDigits(q) - 2);
      const digit = Math.floor(q / pow10(i)) % 10;
      q -= digit * pow10(i);
    }
    if (q < 1 || q > qMax) continue;
    return { a: q * b + r, b, q, r };
  }
  return { a: remainder ? 47 : 48, b: remainder ? 5 : 6, q: remainder ? 9 : 8, r: remainder ? 2 : 0 };
}

const eqRo = (a: number, b: number): string => `${fmt(a)} : ${fmt(b)}`;
const eqEn = (a: number, b: number): string => `${fmt(a)} ÷ ${fmt(b)}`;
const both = (f: (lang: 'ro' | 'en') => string): LocalizedText => ({ ro: f('ro'), en: f('en') });

export const division: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const tableMode = params.tables !== undefined;
  const { a, b, q, r } = tableMode ? tableDiv(params, ctx) : largeDiv(params, ctx);
  const withRem = r > 0;
  const op = (lang: 'ro' | 'en') => (lang === 'ro' ? eqRo(a, b) : eqEn(a, b));
  const small = a <= 50;

  const qWrong = [
    q + 1, q - 1, q + 2, q - 2, q * 10, Math.floor(q / 10), a - b, a + b, b, Math.round(q / 2),
    ...(withRem ? [q + 1, Math.floor(a / (b + 1)), Math.floor(a / (b - 1))] : []),
  ];
  const rWrong = [b, r + 1, r - 1, b - r, q, Math.max(0, b - 1), r + 2];

  if (withRem) {
    const kind = weighted<'quot' | 'rem' | 'quotIn' | 'remIn' | 'gapRem' | 'verify' | 'tf'>(rng, [
      ['quot', 20], ['rem', 22], ['quotIn', 10], ['remIn', 12], ['gapRem', 14], ['verify', 14], ['tf', 8],
    ]);
    switch (kind) {
      case 'quot':
        return numChoice(ctx, both((l) => (l === 'ro' ? `Împarte ${fmt(a)} la ${fmt(b)}. Care este câtul?` : `Divide ${fmt(a)} by ${fmt(b)}. What is the quotient?`)), q, qWrong);
      case 'rem':
        return numChoice(ctx, both((l) => (l === 'ro' ? `Împarte ${fmt(a)} la ${fmt(b)}. Care este restul?` : `Divide ${fmt(a)} by ${fmt(b)}. What is the remainder?`)), r, rWrong);
      case 'quotIn':
        return numInput(ctx, both((l) => (l === 'ro' ? `Împarte ${fmt(a)} la ${fmt(b)}. Scrie câtul.` : `Divide ${fmt(a)} by ${fmt(b)}. Type the quotient.`)), q);
      case 'remIn':
        return numInput(ctx, both((l) => (l === 'ro' ? `Împarte ${fmt(a)} la ${fmt(b)}. Scrie restul.` : `Divide ${fmt(a)} by ${fmt(b)}. Type the remainder.`)), r);
      case 'gapRem':
        return numGap(ctx, { ro: `${eqRo(a, b)} = ${fmt(q)} rest {{gap}}`, en: `${eqEn(a, b)} = ${fmt(q)} remainder {{gap}}` }, r, rWrong, true);
      case 'verify':
        // a = b x q + r : the check of a division with remainder
        return numGap(ctx, same(`${fmt(a)} = ${fmt(b)} × {{gap}} + ${fmt(r)}`), q, qWrong, true);
      case 'tf': {
        const truth = chance(rng, 0.5);
        const shownQ = truth ? q : chance(rng, 0.5) ? q + 1 : q;
        const shownR = truth ? r : shownQ === q ? (r + 1 < b ? r + 1 : Math.max(0, r - 1)) : r;
        return trueFalse(
          ctx,
          { ro: `${eqRo(a, b)} = ${fmt(shownQ)} rest ${fmt(shownR)}`, en: `${eqEn(a, b)} = ${fmt(shownQ)} remainder ${fmt(shownR)}` },
          shownQ === q && shownR === r,
        );
      }
    }
  }

  const kind = weighted<'choice' | 'input' | 'gap' | 'divisor' | 'tf' | 'groups' | 'inverse'>(rng, [
    ['choice', 24], ['input', 20], ['gap', 12], ['divisor', 14], ['tf', 8],
    ['groups', tableMode && small && d <= 3 ? 16 : 0],
    ['inverse', tableMode ? 14 : 0],
  ]);

  switch (kind) {
    case 'choice':
      return numChoice(ctx, both((l) => (l === 'ro' ? `Cât face ${op(l)}?` : `What is ${op(l)}?`)), q, qWrong);
    case 'input':
      return numInput(ctx, both((l) => (l === 'ro' ? `Cât face ${op(l)}?` : `What is ${op(l)}?`)), q);
    case 'gap':
      return numGap(ctx, { ro: `${eqRo(a, b)} = {{gap}}`, en: `${eqEn(a, b)} = {{gap}}` }, q, qWrong, chance(rng, 0.6));
    case 'divisor':
      return numGap(
        ctx,
        { ro: `${fmt(a)} : {{gap}} = ${fmt(q)}`, en: `${fmt(a)} ÷ {{gap}} = ${fmt(q)}` },
        b,
        [b + 1, b - 1, b + 2, b - 2, q, a, b * 2],
        chance(rng, 0.6),
      );
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? q : pick(rng, qWrong.filter((v) => v > 0 && v !== q));
      return trueFalse(ctx, { ro: `${eqRo(a, b)} = ${fmt(shown)}`, en: `${eqEn(a, b)} = ${fmt(shown)}` }, truth);
    }
    case 'groups': {
      const thing = pick(rng, THINGS);
      const visual: VisualSpec = { kind: 'objects', icon: thing.icon, count: a, groups: b };
      const text = {
        ro: `Se împart în mod egal ${roNum(a, thing.ro)} în ${b} grupe. Câte ${thing.ro} sunt într-o grupă?`,
        en: `${a} ${thing.en} are shared equally into ${b} groups. How many ${thing.en} are in each group?`,
      };
      return chance(rng, 0.5) ? numChoice(ctx, text, q, qWrong, { visual }) : numInput(ctx, text, q, visual);
    }
    case 'inverse': {
      // division as the inverse of multiplication
      const useDivisor = chance(rng, 0.5);
      const given = useDivisor ? `${b} × ${q} = ${a}` : `${q} × ${b} = ${a}`;
      const second = useDivisor ? b : q;
      const answer = useDivisor ? q : b;
      return numGap(
        ctx,
        { ro: `Știind că ${given}, avem ${fmt(a)} : ${second} = {{gap}}`, en: `Knowing that ${given}, we get ${fmt(a)} ÷ ${second} = {{gap}}` },
        answer,
        [answer + 1, answer - 1, a, second, a - second, answer + 2],
        true,
      );
    }
  }
};

registerGenerator('division', division);
