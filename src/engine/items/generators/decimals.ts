/**
 * `decimals` generator (grades V-VI). params:
 *   modes: any of 'compare' | 'order' | 'locate' | 'toDecimal' | 'toFraction' | 'add' | 'sub' | 'mul' | 'div' | 'round'
 *   maxInt: largest integer part of an operand (default 20)
 *
 * Decimals are scaled integers (value = scaled / 10^k) so every result is EXACT (no floating point);
 * Romanian prompts use the decimal comma ("2,5"), English ones the decimal point. Distractors: misaligned
 * decimal point (digits added right-aligned), decimal point shifted by one place, the longer decimal taken
 * as the larger, numerator and denominator glued together when converting fractions.
 */
import type { Item, LocalizedText, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, pick, randInt, shuffle } from './util';
import { aT, build, type Ans } from './mathKit';
import { decText, decToFr, fr, frText, frToDecimal, gcd, rawFrText } from './rational';

type Rng = () => number;
export interface D {
  s: number;
  k: number;
}

const dt = (x: D, lang: 'ro' | 'en' = 'ro') => decText(x.s, x.k, lang);
/** Localised text from a function of the language */
const lt = (f: (lang: 'ro' | 'en') => string): LocalizedText => ({ ro: f('ro'), en: f('en') });
const ent = (a: Ans, l: 'ro' | 'en') => (l === 'ro' ? a.ro : (a.en ?? a.ro));

/** exact value equality of two scaled decimals */
export const eqD = (x: D, y: D): boolean => x.s * 10 ** y.k === y.s * 10 ** x.k;

/** Answer for a decimal; typed-able when it is a non-negative whole number */
export function aDec(s: number, k: number): Ans {
  const whole = k === 0 || s % 10 ** k === 0;
  const ans: Ans = { ro: decText(s, k, 'ro'), en: decText(s, k, 'en') };
  if (whole && s >= 0) ans.int = s / 10 ** k;
  return ans;
}
const aD = (x: D): Ans => aDec(x.s, x.k);

/** distinct, positive, value-different decimals */
function wrongSet(list: D[], right: D): D[] {
  const out: D[] = [];
  for (const w of list) if (w.s > 0 && !eqD(w, right) && !out.some((o) => eqD(o, w))) out.push(w);
  return out;
}

const MODES = ['compare', 'order', 'locate', 'toDecimal', 'toFraction', 'add', 'sub', 'mul', 'div', 'round'] as const;
type Mode = (typeof MODES)[number];

/** random decimal with exactly `k` decimals (last digit non-zero) and integer part < maxInt */
function rdec(rng: Rng, k: number, maxInt: number): D {
  for (let t = 0; t < 30; t++) {
    const s = randInt(rng, 1, maxInt * 10 ** k - 1);
    if (k === 0 || s % 10 !== 0) return { s, k };
  }
  return { s: 10 ** k + 1, k };
}

/** round half up (5 and above rounds up) dropping `drop` decimal digits, exactly */
const roundDrop = (s: number, drop: number): number => {
  const unit = 10 ** drop;
  return Math.floor((2 * s + unit) / (2 * unit));
};

const sameLen = (n: number) => String(n).length;

export const decimals: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const maxInt = Math.max(2, paramInt(params, 'maxInt', 20));
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['add', 'sub']).filter((m): m is Mode =>
    (MODES as readonly string[]).includes(m),
  );
  const mode = pick(rng, modes.length ? modes : (['add'] as Mode[]));
  const kMax = d <= 1 ? 1 : 2;

  switch (mode) {
    case 'compare': {
      // different numbers of decimals: the longer one is not automatically larger
      const intp = randInt(rng, 0, 9);
      const a: D = { s: intp * 10 + randInt(rng, 1, 9), k: 1 };
      let b: D = { s: intp * 100 + randInt(rng, 1, 99), k: 2 };
      if (b.s % 10 === 0) b = { s: b.s + 1, k: 2 };
      const flip = chance(rng, 0.5);
      const x = flip ? b : a;
      const y = flip ? a : b;
      const sg = eqD(x, y) ? '=' : x.s * 10 ** y.k < y.s * 10 ** x.k ? '<' : '>';
      return build(ctx, {
        prompt: lt((l) => `Compară numerele ${dt(x, l)} și ${dt(y, l)}. Care semn se potrivește?`),
        answer: aT(sg),
        wrong: ['<', '>', '='].filter((z) => z !== sg).map((z) => aT(z)),
        gap: lt((l) => `${dt(x, l)} {{gap}} ${dt(y, l)}`),
        gapPrompt: { ro: 'Alege semnul potrivit.', en: 'Choose the right sign.' },
        tf: (z) => lt((l) => `${dt(x, l)} ${z.ro} ${dt(y, l)}`),
      });
    }

    case 'order': {
      const vals: D[] = [];
      const intp = randInt(rng, 0, 9);
      for (let t = 0; t < 80 && vals.length < 3; t++) {
        const k = randInt(rng, 1, 3);
        const x: D = { s: intp * 10 ** k + randInt(rng, 1, 10 ** k - 1), k };
        if (x.s % 10 === 0) continue;
        if (!vals.some((v) => eqD(v, x))) vals.push(x);
      }
      const sorted = [...vals].sort((p, q) => p.s * 10 ** q.k - q.s * 10 ** p.k);
      const byLen = [...vals].sort((p, q) => p.k - q.k || p.s - q.s);
      const text = (list: D[], l: 'ro' | 'en') => list.map((v) => dt(v, l)).join(' < ');
      const perms = [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((p) => p.map((i) => sorted[i]));
      const cands = [...(text(byLen, 'ro') !== text(sorted, 'ro') ? [byLen] : []), ...perms];
      return build(ctx, {
        prompt: lt((l) => `Ordonează crescător numerele ${shuffle(rng, vals).map((v) => dt(v, l)).join('; ')}.`),
        answer: { ro: text(sorted, 'ro'), en: text(sorted, 'en') },
        wrong: cands.map((c) => ({ ro: text(c, 'ro'), en: text(c, 'en') })),
        must: [{ ro: text([...sorted].reverse(), 'ro'), en: text([...sorted].reverse(), 'en') }],
        only: ['choice'],
      });
    }

    case 'locate': {
      const hundredths = d >= 3 && chance(rng, 0.5);
      const base = randInt(rng, 0, 9);
      const tenths = hundredths ? randInt(rng, 0, 9) : 0;
      const j = randInt(rng, 1, 9);
      const k = hundredths ? 2 : 1;
      const loS = hundredths ? base * 100 + tenths * 10 : base * 10;
      const ans: D = { s: loS + j, k };
      const lo = loS / 10 ** k;
      const visual: VisualSpec = {
        kind: 'number-line',
        from: lo,
        to: (loS + (hundredths ? 10 : 10)) / 10 ** k,
        step: 1 / 10 ** k,
        marks: [ans.s / 10 ** k],
      };
      const swapped: D = { s: j * 10 + base, k: 1 };
      const wrongs = wrongSet(
        [{ s: ans.s + 1, k }, { s: ans.s - 1, k }, { s: loS + (10 - j), k }, { s: ans.s + 2, k }, ...(!hundredths ? [swapped] : [])],
        ans,
      ).filter((w) => w.s > loS || w.k !== k);
      return build(ctx, {
        prompt: { ro: 'Ce număr zecimal este marcat pe axă?', en: 'Which decimal number is marked on the number line?' },
        visual,
        answer: aD(ans),
        wrong: wrongs.map(aD),
        only: ['choice'],
      });
    }

    case 'toDecimal': {
      const den = pick(rng, d <= 1 ? [2, 4, 5, 10] : [2, 4, 5, 8, 10, 20, 25, 50, 100]);
      let n = randInt(rng, 1, den - 1);
      for (let t = 0; t < 30 && gcd(n, den) !== 1; t++) n = randInt(rng, 1, den - 1);
      const f = fr(n, den);
      const dec = frToDecimal(f) as { scaled: number; k: number };
      const right: D = { s: dec.scaled, k: dec.k };
      const glued = Number(`${f.n}${f.d}`);
      const wrongs = wrongSet(
        [
          { s: glued, k: sameLen(f.n) + sameLen(f.d) }, // 3/4 -> 0,34
          { s: glued, k: sameLen(f.d) }, // 3/4 -> 3,4
          { s: 10 ** right.k - right.s, k: right.k }, // the complement
          { s: right.s, k: right.k + 1 },
          { s: right.s * 10, k: right.k },
          { s: right.s + 1, k: right.k },
        ],
        right,
      );
      return build(ctx, {
        prompt: { ro: `Scrie fracția ${frText(f)} ca număr zecimal.`, en: `Write the fraction ${frText(f)} as a decimal.` },
        visual: d <= 2 && f.d <= 12 ? { kind: 'fraction', numerator: f.n, denominator: f.d, shape: 'bar' } : undefined,
        answer: aD(right),
        wrong: wrongs.map(aD),
        must: wrongs.slice(0, 1).map(aD),
        gap: { ro: `${frText(f)} = {{gap}}`, en: `${frText(f)} = {{gap}}` },
        tf: (a) => lt((l) => `${frText(f)} = ${ent(a, l)}`),
      });
    }

    case 'toFraction': {
      const x = rdec(rng, kMax, 3);
      const f = decToFr(x.s, x.k);
      const raw = rawFrText(x.s, 10 ** x.k);
      const wrongs = [
        fr(x.s, 10 ** (x.k + 1)), fr(x.s, 10 ** Math.max(1, x.k - 1)), fr(f.d, f.n), fr(f.n + 1, f.d), fr(f.n, f.d + 1), fr(x.s + 1, 10 ** x.k),
      ].filter((w) => !(w.n === f.n && w.d === f.d) && w.n > 0);
      const seen = new Set<string>();
      const uniq = wrongs.filter((w) => !seen.has(frText(w)) && seen.add(frText(w)));
      const reducible = gcd(x.s, 10 ** x.k) > 1;
      return build(ctx, {
        prompt: lt((l) => `Scrie numărul ${dt(x, l)} ca fracție ireductibilă.`),
        answer: aT(frText(f)),
        wrong: [...(reducible ? [aT(raw)] : []), ...uniq.map((w) => aT(frText(w)))],
        must: reducible ? [aT(raw)] : [],
        tf: (a) => lt((l) => `${dt(x, l)} = ${a.ro} (fracție ireductibilă)`),
        tfWrong: uniq.map((w) => aT(frText(w))),
      });
    }

    case 'add':
    case 'sub': {
      const isSub = mode === 'sub';
      let a = rdec(rng, randInt(rng, 1, kMax), maxInt);
      let b = rdec(rng, d <= 1 ? a.k : randInt(rng, 1, kMax), maxInt);
      const K = Math.max(a.k, b.k);
      const val = (x: D) => x.s * 10 ** (K - x.k);
      if (isSub && val(a) < val(b)) [a, b] = [b, a];
      if (isSub && val(a) === val(b)) a = { s: a.s + 10 ** a.k, k: a.k };
      const res = isSub ? val(a) - val(b) : val(a) + val(b);
      const right: D = { s: res, k: K };
      const aligned: D = { s: Math.abs(isSub ? a.s - b.s : a.s + b.s), k: K }; // digits added right-aligned
      const wrongs = wrongSet(
        [aligned, { s: res + 1, k: K }, { s: res - 1, k: K }, { s: res, k: K + 1 }, { s: res * 10, k: K }, { s: isSub ? val(a) + val(b) : Math.abs(val(a) - val(b)), k: K }],
        right,
      );
      const expr = (l: 'ro' | 'en') => `${dt(a, l)} ${isSub ? '−' : '+'} ${dt(b, l)}`;
      return build(ctx, {
        prompt: lt((l) => `Calculează: ${expr(l)}`),
        answer: aD(right),
        wrong: wrongs.map(aD),
        must: wrongSet([aligned], right).map(aD),
        gap: lt((l) => `${expr(l)} = {{gap}}`),
        gapPrompt: { ro: 'Calculează.', en: 'Calculate.' },
        tf: (z) => lt((l) => `${expr(l)} = ${ent(z, l)}`),
      });
    }

    case 'mul': {
      const pow = d >= 2 && chance(rng, 0.25);
      const a = rdec(rng, randInt(rng, 1, kMax), maxInt);
      let b: D;
      if (pow) b = { s: pick(rng, [10, 100, 1000]), k: 0 };
      else if (d <= 1 || chance(rng, 0.5)) b = { s: randInt(rng, 2, 9), k: 0 };
      else b = rdec(rng, 1, 10);
      const K = a.k + b.k;
      const right: D = { s: a.s * b.s, k: K };
      const wrongs = wrongSet(
        [{ s: right.s, k: K + 1 }, { s: right.s, k: Math.max(0, K - 1) }, { s: right.s, k: a.k }, { s: right.s * 10, k: K }, { s: right.s + 1, k: K }, { s: right.s, k: K + 2 }],
        right,
      );
      const expr = (l: 'ro' | 'en') => `${dt(a, l)} · ${dt(b, l)}`;
      return build(ctx, {
        prompt: lt((l) => `Calculează: ${expr(l)}`),
        answer: aD(right),
        wrong: wrongs.map(aD),
        must: wrongs.slice(0, 1).map(aD),
        gap: lt((l) => `${expr(l)} = {{gap}}`),
        gapPrompt: { ro: 'Calculează.', en: 'Calculate.' },
        tf: (z) => lt((l) => `${expr(l)} = ${ent(z, l)}`),
      });
    }

    case 'div': {
      // built from the quotient so the division is exact
      const q = rdec(rng, randInt(rng, 0, kMax), 12);
      const b: D =
        d <= 1 || chance(rng, 0.5)
          ? { s: pick(rng, [2, 3, 4, 5, 6, 8]), k: 0 }
          : pick(rng, [{ s: 2, k: 1 }, { s: 4, k: 1 }, { s: 5, k: 1 }, { s: 25, k: 1 }, { s: 25, k: 2 }]);
      const a: D = { s: q.s * b.s, k: q.k + b.k };
      const wrongs = wrongSet([{ s: q.s, k: q.k + 1 }, { s: q.s, k: Math.max(0, q.k - 1) }, { s: q.s * 10, k: q.k }, { s: q.s + 1, k: q.k }, { s: q.s, k: q.k + 2 }], q);
      const expr = (l: 'ro' | 'en') => `${dt(a, l)} : ${dt(b, l)}`;
      return build(ctx, {
        prompt: lt((l) => `Calculează: ${expr(l)}`),
        answer: aD(q),
        wrong: wrongs.map(aD),
        must: wrongs.slice(0, 1).map(aD),
        gap: lt((l) => `${expr(l)} = {{gap}}`),
        gapPrompt: { ro: 'Calculează.', en: 'Calculate.' },
        tf: (z) => lt((l) => `${expr(l)} = ${ent(z, l)}`),
      });
    }

    case 'round': {
      const x = rdec(rng, 3, 20);
      const toK = pick(rng, [0, 1, 2]);
      const up = roundDrop(x.s, x.k - toK);
      const down = Math.floor(x.s / 10 ** (x.k - toK));
      const right: D = { s: up, k: toK };
      const names: Record<number, [string, string]> = { 0: ['unități', 'whole number'], 1: ['zecimi', 'tenth'], 2: ['sutimi', 'hundredth'] };
      const wrongs = wrongSet(
        [
          { s: up === down ? down + 1 : down, k: toK }, // the other neighbour: classic direction slip
          { s: roundDrop(x.s, x.k - toK - 1), k: toK + 1 },
          ...(toK > 0 ? [{ s: roundDrop(x.s, x.k - toK + 1), k: toK - 1 }] : []),
          { s: up + 1, k: toK },
          { s: x.s, k: x.k },
        ],
        right,
      );
      return build(ctx, {
        prompt: lt((l) => (l === 'ro' ? `Rotunjește ${dt(x, l)} la ${names[toK][0]}.` : `Round ${dt(x, l)} to the nearest ${names[toK][1]}.`)),
        answer: aD(right),
        wrong: wrongs.map(aD),
        must: wrongs.slice(0, 1).map(aD),
        tf: (z) => lt((l) => (l === 'ro' ? `${dt(x, l)} rotunjit la ${names[toK][0]} este ${z.ro}` : `${dt(x, l)} rounded to the nearest ${names[toK][1]} is ${ent(z, l)}`)),
      });
    }
  }
};

registerGenerator('decimals', decimals);
