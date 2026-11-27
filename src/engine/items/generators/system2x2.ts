/**
 * `system-2x2` generator (grades VII-VIII): linear systems of two equations in x and y with a unique INTEGER
 * solution (built backwards from the solution, determinant checked non-zero). params:
 *   negative: solutions may be negative (default from difficulty 3)
 *
 * Items: pick the solution pair "(x; y)", true/false "the pair is a solution", the value of x / y / x + y.
 * Distractors: the swapped pair (y; x), a pair that satisfies only ONE of the two equations (shifted along that
 * line), sign slips.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, MINUS, sInt, tfItem } from './mathKit';

const same = (s: string) => L(s, s);

const coef = (a: number, v: string): string => (a === 1 ? v : a === -1 ? `${MINUS}${v}` : `${sInt(a)}${v}`);
/** "2x − 3y" */
const lin2 = (a: number, b: number): string => `${coef(a, 'x')} ${b < 0 ? MINUS : '+'} ${coef(Math.abs(b), 'y')}`;
const pair = (x: number, y: number): string => `(${sInt(x)}; ${sInt(y)})`;

export const system2x2: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const allowNeg = params.negative === true || d >= 3;
  for (let t = 0; t < 200; t++) {
    const lo = allowNeg ? -6 : 1;
    const x = randInt(rng, lo, 9) || 1;
    const y = randInt(rng, lo, 9) || 2;
    let a = 1;
    let b = 1;
    let c = 1;
    let e = -1;
    if (d >= 2) {
      a = pick(rng, [1, 2, 3, -1, -2]);
      b = pick(rng, [1, -1, 2, -2, 3]);
      c = pick(rng, [1, 2, -1, 3, 4]);
      e = pick(rng, [-1, 1, -2, 2, -3]);
    }
    if (a * e - b * c === 0) continue;
    const r1 = a * x + b * y;
    const r2 = c * x + e * y;
    if (Math.abs(r1) > 40 || Math.abs(r2) > 40) continue;
    const sys = `${lin2(a, b)} = ${sInt(r1)} și ${lin2(c, e)} = ${sInt(r2)}`;
    const sysEn = sys.replace(' și ', ' and ');
    const solvedPair = pair(x, y);
    const only1 = pair(x + b, y - a);
    const only2 = pair(x + e, y - c);
    const wrongPairs = [pair(y, x), pair(x, -y), pair(-x, y), only1, only2].filter((w) => w !== solvedPair);
    const kind = pick(rng, ['pair', 'pair', 'value', 'tf']);
    if (kind === 'tf') {
      const truth = chance(rng, 0.5);
      const shown = truth ? solvedPair : pick(rng, wrongPairs);
      return tfItem(ctx, L(`perechea ${shown} este soluția sistemului ${sys}`, `the pair ${shown} is the solution of the system ${sysEn}`), truth);
    }
    if (kind === 'value') {
      const which = pick(rng, ['x', 'y', 'sum']);
      const v = which === 'x' ? x : which === 'y' ? y : x + y;
      const name = which === 'sum' ? 'x + y' : which;
      const wrongs = [which === 'x' ? y : which === 'y' ? x : x * y, -v, v + 1, v - 1, x + y + 1].filter((w) => w !== v);
      return build(ctx, {
        prompt: L(`Rezolvă sistemul ${sys}. Cât este ${name}?`, `Solve the system ${sysEn}. What is ${name}?`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: [aInt(which === 'x' ? y : which === 'y' ? x : -v)].filter((w) => w.int !== v),
        gap: same(`${name} = {{gap}}`),
        gapPrompt: L(`Rezolvă sistemul ${sys}.`, `Solve the system ${sysEn}.`),
      });
    }
    return build(ctx, {
      prompt: L(`Rezolvă sistemul ${sys}. Care este soluția (x; y)?`, `Solve the system ${sysEn}. What is the solution (x; y)?`),
      answer: aT(solvedPair),
      wrong: wrongPairs.map((w) => aT(w)),
      must: [aT(only1), aT(pair(y, x))].filter((w) => w.ro !== solvedPair),
      only: ['choice'],
    });
  }
  return build(ctx, { prompt: L('Rezolvă sistemul x + y = 5 și x − y = 1. Cât este x?', 'Solve x + y = 5 and x − y = 1. What is x?'), answer: aInt(3), wrong: [aInt(2), aInt(4), aInt(1)] });
};

registerGenerator('system-2x2', system2x2);
