/**
 * `algebra` generator (grade VIII): algebraic calculus and the "formule de calcul prescurtat". params:
 *   modes: any of 'expandSq' | 'expandDiff' | 'expandProd' | 'factor' | 'identity' | 'eval' | 'simplify' | 'numeric'
 *
 * Expressions are polynomials in x stored as coefficient arrays; the right answer and every distractor are produced by
 * exact polynomial arithmetic, and a distractor is only used if its polynomial differs from the right one (so no option
 * is secretly equivalent). Texts use superscripts (x², x³) and the typographic minus. Distractors: the missing middle
 * term ((x+3)² = x²+9), a wrong sign of the middle term, the coefficient squared wrongly, sign slips when distributing a
 * minus, (x−c)² confused with (x+c)² or with x²−c².
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, MINUS, sInt, sup } from './mathKit';
import { gcd } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['expandSq', 'expandDiff', 'expandProd', 'factor', 'identity', 'eval', 'simplify', 'numeric'] as const;
type Mode = (typeof MODES)[number];

/** coefficient array: p[i] is the coefficient of x^i */
export type Poly = number[];

export const polyMul = (p: Poly, q: Poly): Poly => {
  const out = new Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] += a * b)));
  return out;
};
const trim = (p: Poly): Poly => {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1] === 0) out.pop();
  return out;
};
export const polyEq = (p: Poly, q: Poly): boolean => {
  const a = trim(p);
  const b = trim(q);
  return a.length === b.length && a.every((v, i) => v === b[i]);
};
export const polyAdd = (p: Poly, q: Poly, sign = 1): Poly => Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + sign * (q[i] ?? 0));
export const polyEval = (p: Poly, x: number): number => p.reduceRight((acc, c) => acc * x + c, 0);

/** "x² + 6x + 9", "4x² − 12x + 9", "−x + 5" */
export function polyText(p: Poly): string {
  const q = trim(p);
  let out = '';
  for (let i = q.length - 1; i >= 0; i--) {
    const c = q[i];
    if (c === 0) continue;
    const mag = Math.abs(c);
    const body = i === 0 ? String(mag) : `${mag === 1 ? '' : mag}x${i === 1 ? '' : sup(i)}`;
    if (out === '') out = `${c < 0 ? MINUS : ''}${body}`;
    else out += ` ${c < 0 ? MINUS : '+'} ${body}`;
  }
  return out === '' ? '0' : out;
}

/** "(x + 3)", "(2x − 5)" */
const bin = (a: number, b: number): string => `(${polyText([b, a])})`;

interface Cand {
  text: string;
  poly: Poly;
}

/** wrong candidates whose polynomial differs from the right one; unique by text */
function distinct(right: Poly, rightText: string, cands: Cand[]): string[] {
  const seen = new Set<string>([rightText]);
  const out: string[] = [];
  for (const c of cands) {
    if (polyEq(c.poly, right) || seen.has(c.text)) continue;
    seen.add(c.text);
    out.push(c.text);
  }
  return out;
}
const asCand = (p: Poly): Cand => ({ text: polyText(p), poly: p });

export const algebra: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['expandSq']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['expandSq'] as Mode[]));

  switch (mode) {
    case 'expandSq': {
      const a = d <= 1 ? 1 : pick(rng, [1, 1, 2, 3]);
      const b = pick(rng, [-1, 1]) * randInt(rng, 1, d <= 2 ? 7 : 10);
      const lin: Poly = [b, a];
      const right = polyMul(lin, lin);
      const expr = `(${polyText(lin)})²`;
      const cands: Cand[] = [
        asCand([b * b, 0, a * a]), // the middle term is missing
        asCand([b * b, -2 * a * b, a * a]), // sign of the middle term
        asCand([b * b, a * b, a * a]), // middle term without the 2
        asCand([-b * b, 2 * a * b, a * a]),
        asCand([b * b, 2 * a * b, a]), // a not squared
        asCand([b * b, 2 * a * b, 2 * a]),
      ];
      const wrongs = distinct(right, polyText(right), cands);
      return build(ctx, {
        prompt: L(`Dezvoltă: ${expr}`, `Expand: ${expr}`),
        answer: aT(polyText(right)),
        wrong: wrongs.map((w) => aT(w)),
        must: wrongs.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${expr} = ${x.ro}`),
      });
    }

    case 'expandDiff': {
      const a = d <= 1 ? 1 : pick(rng, [1, 2, 3, 4]);
      const b = randInt(rng, 1, 10);
      const right = polyMul([-b, a], [b, a]);
      const expr = `(${polyText([b, a])})(${polyText([-b, a])})`;
      const cands: Cand[] = [
        asCand([b * b, 0, a * a]), // sum instead of difference
        asCand([b * b, -2 * a * b, a * a]),
        asCand([b * b, 2 * a * b, a * a]),
        asCand([-b * b, 0, a]), // a not squared
        asCand([-b, 0, a * a]), // b not squared
        asCand([-b * b, 2 * a * b, a * a]),
      ];
      const wrongs = distinct(right, polyText(right), cands);
      return build(ctx, {
        prompt: L(`Dezvoltă: ${expr}`, `Expand: ${expr}`),
        answer: aT(polyText(right)),
        wrong: wrongs.map((w) => aT(w)),
        must: wrongs.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${expr} = ${x.ro}`),
      });
    }

    case 'expandProd': {
      const a = pick(rng, [1, 1, 2, 3]);
      const c = pick(rng, [1, 1, 2]);
      const b = pick(rng, [-1, 1]) * randInt(rng, 1, 8);
      const e = pick(rng, [-1, 1]) * randInt(rng, 1, 8);
      const p1: Poly = [b, a];
      const p2: Poly = [e, c];
      const right = polyMul(p1, p2);
      const expr = `(${polyText(p1)})(${polyText(p2)})`;
      const cands: Cand[] = [
        asCand([b * e, a * e + c * b === 0 ? 1 : 0, a * c]), // the cross terms are forgotten
        asCand([b * e, a * c * (b + e), a * c]),
        asCand([b + e, a * e + c * b, a * c]),
        asCand([b * e, -(a * e + c * b), a * c]),
        asCand([-b * e, a * e + c * b, a * c]),
        asCand([b * e, a * e + c * b, a + c]),
      ];
      const wrongs = distinct(right, polyText(right), cands);
      return build(ctx, {
        prompt: L(`Dezvoltă și redu termenii asemenea: ${expr}`, `Expand and collect like terms: ${expr}`),
        answer: aT(polyText(right)),
        wrong: wrongs.map((w) => aT(w)),
        must: wrongs.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${expr} = ${x.ro}`),
      });
    }

    case 'factor': {
      const kind = pick(rng, d <= 1 ? [0, 1, 2] : [0, 1, 2, 3, 4]);
      const c = randInt(rng, 2, 11);
      let expr: Poly;
      let rightText: string;
      let cands: { text: string; poly: Poly }[];
      const prod = (...fs: [number, number][]): Poly => fs.map(([k, m]) => [m, k] as Poly).reduce((acc, f) => polyMul(acc, f), [1]);
      if (kind === 0) {
        expr = [-c * c, 0, 1];
        rightText = `${bin(1, -c)}${bin(1, c)}`;
        cands = [
          { text: `${bin(1, -c)}²`, poly: prod([1, -c], [1, -c]) },
          { text: `${bin(1, c)}²`, poly: prod([1, c], [1, c]) },
          { text: `${bin(1, -c * c)}${bin(1, 1)}`, poly: prod([1, -c * c], [1, 1]) },
          { text: `${bin(1, -2 * c)}${bin(1, 2 * c)}`, poly: prod([1, -2 * c], [1, 2 * c]) },
          { text: `${bin(1, -c)}${bin(1, 2 * c)}`, poly: prod([1, -c], [1, 2 * c]) },
        ];
      } else if (kind === 1) {
        expr = [c * c, 2 * c, 1];
        rightText = `${bin(1, c)}²`;
        cands = [
          { text: `${bin(1, -c)}²`, poly: prod([1, -c], [1, -c]) },
          { text: `${bin(1, -c)}${bin(1, c)}`, poly: prod([1, -c], [1, c]) },
          { text: `${bin(1, 2 * c)}²`, poly: prod([1, 2 * c], [1, 2 * c]) },
          { text: `${bin(1, c * c)}${bin(1, 1)}`, poly: prod([1, c * c], [1, 1]) },
          { text: `x${bin(1, 2 * c)}`, poly: prod([1, 0], [1, 2 * c]) },
        ];
      } else if (kind === 2) {
        expr = [c * c, -2 * c, 1];
        rightText = `${bin(1, -c)}²`;
        cands = [
          { text: `${bin(1, c)}²`, poly: prod([1, c], [1, c]) },
          { text: `${bin(1, -c)}${bin(1, c)}`, poly: prod([1, -c], [1, c]) },
          { text: `${bin(1, -2 * c)}²`, poly: prod([1, -2 * c], [1, -2 * c]) },
          { text: `${bin(1, -c * c)}${bin(1, -1)}`, poly: prod([1, -c * c], [1, -1]) },
          { text: `x${bin(1, -2 * c)}`, poly: prod([1, 0], [1, -2 * c]) },
        ];
      } else if (kind === 3) {
        const p = pick(rng, [-1, 1]) * randInt(rng, 1, 7);
        let q = pick(rng, [-1, 1]) * randInt(rng, 1, 7);
        if (p === q || p === -q) q = q > 0 ? q + 8 : q - 8;
        expr = [p * q, p + q, 1];
        rightText = `${bin(1, p)}${bin(1, q)}`;
        cands = [
          { text: `${bin(1, -p)}${bin(1, -q)}`, poly: prod([1, -p], [1, -q]) },
          { text: `${bin(1, p)}${bin(1, -q)}`, poly: prod([1, p], [1, -q]) },
          { text: `${bin(1, -p)}${bin(1, q)}`, poly: prod([1, -p], [1, q]) },
          { text: `${bin(1, p * q)}${bin(1, 1)}`, poly: prod([1, p * q], [1, 1]) },
          { text: `${bin(1, p + q)}${bin(1, p * q)}`, poly: prod([1, p + q], [1, p * q]) },
        ];
      } else {
        // common factor: g(ax + b)
        const g = randInt(rng, 2, 9);
        const a1 = randInt(rng, 1, 5);
        let b1 = randInt(rng, 1, 6);
        if (gcd(a1, b1) !== 1) b1 = a1 + 1;
        expr = [g * b1, g * a1];
        rightText = `${g}(${polyText([b1, a1])})`;
        cands = [
          { text: `${g}(${polyText([b1 + 1, a1])})`, poly: [g * (b1 + 1), g * a1] },
          { text: `${g}(${polyText([b1, a1 + 1])})`, poly: [g * b1, g * (a1 + 1)] },
          { text: `${g}x(${polyText([b1, a1])})`, poly: polyMul([0, g], [b1, a1]) },
          { text: `${g * a1}(${polyText([b1, 1])})`, poly: [g * a1 * b1, g * a1] },
          { text: `${g}(${polyText([-b1, a1])})`, poly: [-g * b1, g * a1] },
        ];
      }
      const wrongs = distinct(expr, rightText, cands);
      return build(ctx, {
        prompt: L(`Descompune în factori: ${polyText(expr)}`, `Factorise: ${polyText(expr)}`),
        answer: aT(rightText),
        wrong: wrongs.map((w) => aT(w)),
        must: wrongs.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${polyText(expr)} = ${x.ro}`),
      });
    }

    case 'identity': {
      const which = pick(rng, [0, 1, 2]);
      const form = ['(a + b)²', '(a − b)²', '(a − b)(a + b)'][which];
      const right = ['a² + 2ab + b²', 'a² − 2ab + b²', 'a² − b²'][which];
      const wrong = [
        ['a² + b²', 'a² + ab + b²', 'a² − 2ab + b²', '2a + 2b'],
        ['a² − b²', 'a² − 2ab − b²', 'a² + 2ab + b²', 'a² − ab + b²'],
        ['a² + b²', 'a² − 2ab + b²', '(a − b)²', 'a² − 2b'],
      ][which];
      return build(ctx, {
        prompt: L(`Care este dezvoltarea corectă a lui ${form}?`, `Which is the correct expansion of ${form}?`),
        answer: aT(right),
        wrong: wrong.map((w) => aT(w)),
        must: wrong.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${form} = ${x.ro}`),
      });
    }

    case 'eval': {
      const x = pick(rng, [-1, 1]) * randInt(rng, 1, d <= 2 ? 4 : 6);
      const lead = pick(rng, [1, 1, 2, 3]);
      const mid = pick(rng, [-1, 1]) * randInt(rng, 1, 6);
      const cst = pick(rng, [-1, 1]) * randInt(rng, 0, 9);
      const p: Poly = [cst, mid, lead];
      const v = polyEval(p, x);
      const slipSquare = lead * -(x * x) + mid * x + cst; // (-x)^2 read as -(x^2)
      const slipSign = lead * x * x + mid * -x + cst;
      const wrongs = [slipSquare, slipSign, -v, v + 1, v - 1, lead * x * 2 + mid * x + cst].filter((w) => w !== v);
      const expr = polyText(p);
      return build(ctx, {
        prompt: L(`Calculează valoarea expresiei ${expr} pentru x = ${sInt(x)}.`, `Evaluate ${expr} for x = ${sInt(x)}.`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: wrongs.slice(0, 2).map(aInt),
        tf: (a) => same(`pentru x = ${sInt(x)}, ${expr} = ${a.ro}`),
      });
    }

    case 'simplify': {
      if (chance(rng, 0.4)) {
        const a = pick(rng, [-1, 1]) * randInt(rng, 1, 6);
        const b = pick(rng, [-1, 1]) * randInt(rng, 1, 9);
        const c = pick(rng, [-1, 1]) * randInt(rng, 1, 6);
        const e = pick(rng, [-1, 1]) * randInt(rng, 1, 9);
        const p1: Poly = [b, a];
        const p2: Poly = [e, c];
        const right = polyAdd(p1, p2);
        const text = `(${polyText(p1)}) + (${polyText(p2)})`;
        const wrongs = distinct(right, polyText(right), [asCand(polyAdd(p1, p2, -1)), asCand([b + e, a * c]), asCand([b * e, a + c]), asCand([b + e, a + c + 1]), asCand([-(b + e), a + c])]);
        return build(ctx, {
          prompt: L(`Redu termenii asemenea: ${text}`, `Collect like terms: ${text}`),
          answer: aT(polyText(right)),
          wrong: wrongs.map((w) => aT(w)),
          must: wrongs.slice(0, 2).map((w) => aT(w)),
          only: ['choice', 'tf'],
          tf: (x) => same(`${text} = ${x.ro}`),
        });
      }
      const a = randInt(rng, 2, 6);
      const b = pick(rng, [-1, 1]) * randInt(rng, 1, 8);
      const c = randInt(rng, 2, 5);
      const e = pick(rng, [-1, 1]) * randInt(rng, 1, 8);
      // a(x + b) − c(x + e)
      const right = polyAdd([a * b, a], [c * e, c], -1);
      const slip = [a * b - c * e, a - c]; // the minus is not distributed to the second term of the bracket
      const text = `${a}(${polyText([b, 1])}) ${MINUS} ${c}(${polyText([e, 1])})`;
      const wrongs = distinct(right, polyText(right), [asCand(slip), asCand([a * b + c * e, a - c]), asCand([a * b, a - c]), asCand([a * b - c * e, a + c]), asCand([a + b - c - e, 0])]);
      return build(ctx, {
        prompt: L(`Redu termenii asemenea: ${text}`, `Simplify: ${text}`),
        answer: aT(polyText(right)),
        wrong: wrongs.map((w) => aT(w)),
        must: wrongs.slice(0, 2).map((w) => aT(w)),
        only: ['choice', 'tf'],
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'numeric': {
      const kind = pick(rng, [0, 1, 2]);
      if (kind === 0) {
        const k = randInt(rng, 1, 20);
        const a = 50 + k;
        const b = 50 - k;
        return build(ctx, {
          prompt: L(`Calculează cu formule de calcul prescurtat: ${a}² ${MINUS} ${b}²`, `Use a short-cut formula: ${a}² ${MINUS} ${b}²`),
          answer: aInt(200 * k),
          wrong: [aInt((a - b) ** 2), aInt(a * a + b * b), aInt(100 * k), aInt(200 * k + 100), aInt(2 * k)].filter((w) => w.int !== 200 * k),
          must: [aInt((a - b) ** 2)].filter((w) => w.int !== 200 * k),
        });
      }
      if (kind === 1) {
        const n = pick(rng, [20, 30, 40, 50, 60, 70, 80, 90, 100]);
        const m = pick(rng, [-1, 1]) * randInt(rng, 1, 4);
        const base = n + m;
        const v = base * base;
        return build(ctx, {
          prompt: L(`Calculează cu formule de calcul prescurtat: ${base}²`, `Use a short-cut formula: ${base}²`),
          answer: aInt(v),
          wrong: [aInt(n * n + m * m), aInt(v - 2 * m * n * 2), aInt(n * n + 2 * m * n - m * m), aInt(v + 2 * Math.abs(m)), aInt(n * n - 2 * m * n + m * m)].filter((w) => w.int !== v && (w.int ?? 0) > 0),
          must: [aInt(n * n + m * m)].filter((w) => w.int !== v),
        });
      }
      const n = randInt(rng, 3, 30) * pick(rng, [1, 2, 5]) + 1;
      return build(ctx, {
        prompt: L(`Calculează cu formule de calcul prescurtat: ${n - 1} · ${n + 1}`, `Use a short-cut formula: ${n - 1} · ${n + 1}`),
        answer: aInt(n * n - 1),
        wrong: [aInt(n * n + 1), aInt(n * n), aInt(n * n - 2), aInt(n * n - 1 + 2 * n), aInt(2 * n)].filter((w) => w.int !== n * n - 1 && (w.int ?? 0) > 0),
        must: [aInt(n * n + 1), aInt(n * n)],
      });
    }
  }
};

registerGenerator('algebra', algebra);
