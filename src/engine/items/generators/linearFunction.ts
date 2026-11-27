/**
 * `linear-function` generator (grade VIII): f(x) = ax + b. params:
 *   modes: any of 'value' | 'zero' | 'oy' | 'slope' | 'point' | 'pointValue' | 'monotone' | 'eqline' | 'line2'
 *
 * Values, zeros and slopes are integers built backwards from a, b and the chosen points (exact arithmetic). Points
 * are written with a semicolon, A(2; 7), as in Romanian textbooks. Distractors: swapped coordinates, a wrong sign of b,
 * the reciprocal of the slope, swapping a and b, the zero taken as −b instead of −b/a.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, sInt, tfItem } from './mathKit';
import { fr, frText } from './rational';
import { polyText } from './algebra';

const same = (s: string) => L(s, s);
const MODES = ['value', 'zero', 'oy', 'slope', 'point', 'pointValue', 'monotone', 'eqline', 'line2'] as const;
type Mode = (typeof MODES)[number];

const fText = (a: number, b: number): string => `f(x) = ${polyText([b, a])}`;
const pt = (x: number, y: number): string => `(${sInt(x)}; ${sInt(y)})`;
const nz = (rng: () => number, lo: number, hi: number): number => {
  for (;;) {
    const v = randInt(rng, lo, hi);
    if (v !== 0) return v;
  }
};

export const linearFunction: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['value']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['value'] as Mode[]));
  const a = nz(rng, d <= 1 ? 1 : -5, d <= 1 ? 5 : 6);
  const b = randInt(rng, -9, 9);

  switch (mode) {
    case 'value': {
      const x0 = randInt(rng, d <= 1 ? 0 : -5, 6);
      const v = a * x0 + b;
      const wrongs = [a * x0 - b, a + x0 + b, (a + b) * x0, b * x0 + a, -v, v + 1, v - 1].filter((w) => w !== v);
      return build(ctx, {
        prompt: L(`Se consideră funcția ${fText(a, b)}. Calculează f(${sInt(x0)}).`, `Consider the function ${fText(a, b)}. Work out f(${sInt(x0)}).`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: wrongs.slice(0, 2).map(aInt),
        gap: same(`${fText(a, b)}, f(${sInt(x0)}) = {{gap}}`),
        tf: (x) => same(`pentru ${fText(a, b)} avem f(${sInt(x0)}) = ${x.ro}`),
      });
    }

    case 'zero': {
      const x0 = nz(rng, -6, 8);
      const bb = -a * x0;
      const right = pt(x0, 0);
      const wrongs = [pt(0, x0), pt(-x0, 0), pt(0, bb), pt(bb, 0), pt(x0 + 1, 0)].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`În ce punct intersectează graficul funcției ${fText(a, bb)} axa Ox?`, `At which point does the graph of ${fText(a, bb)} meet the Ox axis?`),
        answer: aT(right),
        wrong: wrongs.map((w) => aT(w)),
        must: [aT(pt(0, bb)), aT(pt(-x0, 0))].filter((w) => w.ro !== right),
        only: ['choice', 'tf'],
        tf: (x) => same(`graficul funcției ${fText(a, bb)} intersectează axa Ox în punctul ${x.ro}`),
      });
    }

    case 'oy': {
      const right = pt(0, b);
      const wrongs = [pt(b, 0), pt(0, -b), pt(0, a), pt(a, 0), pt(0, b + 1)].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`În ce punct intersectează graficul funcției ${fText(a, b)} axa Oy?`, `At which point does the graph of ${fText(a, b)} meet the Oy axis?`),
        answer: aT(right),
        wrong: wrongs.map((w) => aT(w)),
        must: [aT(pt(b, 0)), aT(pt(0, a))].filter((w) => w.ro !== right),
        only: ['choice', 'tf'],
        tf: (x) => same(`graficul funcției ${fText(a, b)} intersectează axa Oy în punctul ${x.ro}`),
      });
    }

    case 'slope': {
      const m = nz(rng, -6, 6);
      const x1 = randInt(rng, -4, 4);
      const x2 = x1 + nz(rng, -4, 4);
      const y1 = randInt(rng, -6, 8);
      const y2 = y1 + m * (x2 - x1);
      const recip = Math.abs(m) === 1 ? null : aT(frText(fr(1, m)));
      const wrongs = [aInt(-m), ...(recip ? [recip] : []), aInt(m + 1), aInt(m - 1), aInt(y2 - y1), aInt(x2 - x1)].filter((w) => w.ro !== aInt(m).ro);
      return build(ctx, {
        prompt: L(`Care este panta dreptei care trece prin punctele A${pt(x1, y1)} și B${pt(x2, y2)}?`, `What is the slope of the line through A${pt(x1, y1)} and B${pt(x2, y2)}?`),
        answer: aInt(m),
        wrong: wrongs,
        must: [aInt(-m), ...(recip ? [recip] : [])].filter((w) => w.ro !== aInt(m).ro),
        noPad: true,
        tf: (x) => same(`panta dreptei prin A${pt(x1, y1)} și B${pt(x2, y2)} este ${x.ro}`),
        tfWrong: wrongs,
      });
    }

    case 'point': {
      const x0 = randInt(rng, -4, 6);
      const truth = chance(rng, 0.5);
      const y = a * x0 + b;
      const shown = truth ? y : pick(rng, [y + 1, y - 1, -y, a * x0 - b].filter((w) => w !== y));
      return tfItem(ctx, L(`punctul A${pt(x0, shown)} aparține graficului funcției ${fText(a, b)}.`, `the point A${pt(x0, shown)} lies on the graph of ${fText(a, b)}.`), shown === y);
    }

    case 'pointValue': {
      const x0 = randInt(rng, 0, 6);
      const v = a * x0 + b;
      const wrongs = [-v, a * x0 - b, v + 1, v - 1, x0 + a + b].filter((w) => w !== v);
      return build(ctx, {
        prompt: L(`Pentru ce valoare a lui m punctul P(${x0}; m) aparține graficului funcției ${fText(a, b)}?`, `For which value of m does the point P(${x0}; m) lie on the graph of ${fText(a, b)}?`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: wrongs.slice(0, 2).map(aInt),
        gap: same(`m = {{gap}}`),
      });
    }

    case 'monotone': {
      const slope = pick(rng, [nz(rng, 1, 6), -nz(rng, 1, 6), nz(rng, 1, 6), -nz(rng, 1, 6), 0]);
      const word = (s: number): [string, string] => (s > 0 ? ['crescătoare', 'increasing'] : s < 0 ? ['descrescătoare', 'decreasing'] : ['constantă', 'constant']);
      const [ro, en] = word(slope);
      const others = [1, -1, 0].filter((s) => Math.sign(s) !== Math.sign(slope)).map((s) => word(s));
      return build(ctx, {
        prompt: L(`Funcția ${fText(slope, b)} este:`, `The function ${fText(slope, b)} is:`),
        answer: aT(ro, en),
        wrong: others.map(([r, e]) => aT(r, e)),
        only: ['choice'],
      });
    }

    case 'eqline': {
      const m = nz(rng, -5, 5);
      const right = fText(m, b);
      const wrongs = [fText(b === 0 ? m + 1 : b, m), fText(m, -b), fText(-m, b), fText(m, b + 1), fText(m + 1, b)].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`Dreapta are panta ${sInt(m)} și intersectează axa Oy în punctul ${pt(0, b)}. Care este funcția ei?`, `A line has slope ${sInt(m)} and meets the Oy axis at ${pt(0, b)}. Which function describes it?`),
        answer: aT(right),
        wrong: [...new Set(wrongs)].map((w) => aT(w)),
        must: [aT(fText(b === 0 ? m + 1 : b, m)), aT(fText(m, -b))].filter((w) => w.ro !== right),
        only: ['choice'],
      });
    }

    case 'line2': {
      const m = nz(rng, -4, 5);
      const x1 = randInt(rng, -3, 3);
      const x2 = x1 + nz(rng, 1, 3);
      const y1 = m * x1 + b;
      const y2 = m * x2 + b;
      const right = fText(m, b);
      const wrongs = [fText(b === 0 ? m + 1 : b, m), fText(m, -b), fText(-m, b), fText(m, y1), fText(m, b + m)].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`Graficul unei funcții liniare trece prin punctele A${pt(x1, y1)} și B${pt(x2, y2)}. Care este funcția?`, `The graph of a linear function passes through A${pt(x1, y1)} and B${pt(x2, y2)}. Which function is it?`),
        answer: aT(right),
        wrong: [...new Set(wrongs)].map((w) => aT(w)),
        must: [aT(fText(m, y1))].filter((w) => w.ro !== right),
        only: ['choice'],
      });
    }
  }
};

registerGenerator('linear-function', linearFunction);
