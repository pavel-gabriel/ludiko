/**
 * `integers` generator (grade VI, the set Z). params:
 *   modes: any of 'line' | 'jump' | 'dist' | 'opp' | 'abs' | 'absEq' | 'order' | 'compare' | 'add' | 'sub' | 'mul' | 'div' | 'expr'
 *   range: largest absolute value of an operand (default 10)
 *
 * Number-line visuals use negative ranges (from < 0 < to). Texts use the typographic minus "−" and put negative
 * operands in parentheses ("5 − (−3)", "(−4) · 6"). Typed answers are only offered when the result is a
 * non-negative whole number (the numpad has no minus key). Distractors: sign errors, adding absolute values,
 * the other sign of the product, evaluating strictly left to right.
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, pick, randInt, shuffle } from './util';
import { aInt, aT, build, evalFlat, L, MINUS, OP_SYM, pInt, sInt, type Op } from './mathKit';

const same = (s: string) => L(s, s);
const MODES = ['line', 'jump', 'dist', 'opp', 'abs', 'absEq', 'order', 'compare', 'add', 'sub', 'mul', 'div', 'expr'] as const;
type Mode = (typeof MODES)[number];

const nz = (rng: () => number, r: number): number => {
  const v = randInt(rng, 1, r);
  return chance(rng, 0.5) ? -v : v;
};

export const integers: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const range = Math.max(5, paramInt(params, 'range', 10));
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['add']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['add'] as Mode[]));
  const r = d <= 1 ? Math.min(range, 9) : d <= 3 ? range : range * 2;

  switch (mode) {
    case 'line': {
      const R = pick(rng, [5, 6, 8, 10]);
      let m = nz(rng, R - 1);
      if (d <= 1) m = -Math.abs(m);
      const visual: VisualSpec = { kind: 'number-line', from: -R, to: R, step: 1, marks: [m] };
      const wrongs = [-m, m + 1, m - 1, m + 2, m - 2].filter((w) => w !== m && Math.abs(w) <= R);
      return build(ctx, {
        prompt: L('Ce număr întreg este marcat pe axă?', 'Which integer is marked on the number line?'),
        visual,
        answer: aInt(m),
        wrong: wrongs.map(aInt),
        must: [aInt(-m)],
        noPad: true,
      });
    }

    case 'jump': {
      const a = nz(rng, 7);
      const b = nz(rng, 7);
      const c = a + b;
      const text = (x: number, y: number, z: number) => `${sInt(x)} ${y < 0 ? `− ${sInt(-y)}` : `+ ${sInt(y)}`} = ${sInt(z)}`;
      const lo = Math.min(a, c, 0) - 1;
      const hi = Math.max(a, c, 0) + 1;
      const visual: VisualSpec = { kind: 'number-line', from: lo, to: hi, step: 1, jumps: [{ from: a, to: c }] };
      const cands = [text(a, -b, a - b), text(-a, b, -a + b), text(a, b, -c), text(a, b, c + 1), text(-a, -b, -c)];
      const right = text(a, b, c);
      return build(ctx, {
        prompt: L('Care adunare sau scădere este ilustrată pe axă (săgeata pornește de la primul număr)?', 'Which addition or subtraction is shown on the number line (the arrow starts at the first number)?'),
        visual,
        answer: aT(right),
        wrong: cands.filter((x) => x !== right).map((x) => aT(x)),
        only: ['choice'],
      });
    }

    case 'dist': {
      const a = randInt(rng, -r, -1);
      const b = randInt(rng, 1, r);
      const [x, y] = chance(rng, 0.5) ? [a, b] : [b, a];
      const dist = b - a;
      const lo = Math.min(a, b) - 1;
      const hi = Math.max(a, b) + 1;
      const step = hi - lo > 24 ? 5 : 1;
      return build(ctx, {
        prompt: L(`Punctele A(${sInt(x)}) și B(${sInt(y)}) sunt pe axa numerelor. Care este lungimea segmentului AB (în unități)?`, `Points A(${sInt(x)}) and B(${sInt(y)}) are on the number line. What is the length of segment AB (in units)?`),
        visual: d <= 2 && hi - lo <= 24 ? { kind: 'number-line', from: lo, to: hi, step, marks: [x, y] } : undefined,
        answer: aInt(dist),
        wrong: [aInt(Math.abs(Math.abs(a) - Math.abs(b))), aInt(dist + 1), aInt(dist - 1), aInt(Math.max(Math.abs(a), Math.abs(b)))].filter((w) => w.int !== dist),
        must: [aInt(Math.abs(Math.abs(a) - Math.abs(b)))].filter((w) => w.int !== dist),
        gap: same(`AB = {{gap}}`),
      });
    }

    case 'opp': {
      const a = nz(rng, r);
      return build(ctx, {
        prompt: L(`Care este opusul numărului ${sInt(a)}?`, `What is the opposite of ${sInt(a)}?`),
        answer: aInt(-a),
        wrong: [aInt(a), aInt(-a + 1), aInt(-a - 1), aInt(0)].filter((w) => w.ro !== aInt(-a).ro),
        gap: same(`Opusul lui ${sInt(a)} este {{gap}}`),
        tf: (x) => same(`opusul lui ${sInt(a)} este ${x.ro}`),
      });
    }

    case 'abs': {
      const a = nz(rng, r);
      const b = nz(rng, r);
      const kind = pick(rng, ['one', 'sum', 'diff']);
      let text: string;
      let v: number;
      let wrongs: number[];
      if (kind === 'one') {
        text = `|${sInt(a)}|`;
        v = Math.abs(a);
        wrongs = [a, -Math.abs(a), Math.abs(a) + 1, 0];
      } else if (kind === 'sum') {
        text = `|${sInt(a)}| + |${sInt(b)}|`;
        v = Math.abs(a) + Math.abs(b);
        wrongs = [a + b, Math.abs(a + b), Math.abs(Math.abs(a) - Math.abs(b)), v + 1];
      } else {
        text = `|${sInt(a)} + ${pInt(b)}|`;
        v = Math.abs(a + b);
        wrongs = [Math.abs(a) + Math.abs(b), a + b, -(a + b), v + 1, Math.abs(a - b)];
      }
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(v),
        wrong: wrongs.filter((w) => w !== v).map(aInt),
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'absEq': {
      const a = randInt(rng, 2, r);
      const right = `${MINUS}${a} și ${a}`;
      return build(ctx, {
        prompt: L(`Care sunt numerele întregi x pentru care |x| = ${a}?`, `Which integers x satisfy |x| = ${a}?`),
        answer: aT(right, `${MINUS}${a} and ${a}`),
        wrong: [aT(`${a}`), aT(`${MINUS}${a}`), aT(`0 și ${a}`, `0 and ${a}`), aT(`${MINUS}${a} și 0`, `${MINUS}${a} and 0`)],
        must: [aT(`${a}`)],
        only: ['choice'],
      });
    }

    case 'order': {
      let vals: number[] = [];
      for (let t = 0; t < 30; t++) {
        const set = new Set<number>();
        while (set.size < 4) set.add(randInt(rng, -r, r));
        vals = [...set];
        if (vals.some((v) => v < 0)) break; // the point of the exercise: negatives
      }
      const sorted = [...vals].sort((x, y) => x - y);
      const byAbs = [...vals].sort((x, y) => Math.abs(x) - Math.abs(y) || x - y);
      const text = (l: number[]) => l.map(sInt).join(' < ');
      const swap = (i: number) => sorted.map((v, k) => (k === i ? sorted[i + 1] : k === i + 1 ? sorted[i] : v));
      const cands = [byAbs, [...sorted].reverse(), swap(0), swap(1), swap(2)].map(text).filter((t) => t !== text(sorted));
      return build(ctx, {
        prompt: L(`Ordonează crescător numerele ${shuffle(rng, vals).map(sInt).join(', ')}.`, `Put the numbers ${shuffle(rng, vals).map(sInt).join(', ')} in increasing order.`),
        answer: aT(text(sorted)),
        wrong: cands.map((t) => aT(t)),
        must: [aT(text(byAbs))].filter((x) => x.ro !== text(sorted)),
        only: ['choice'],
      });
    }

    case 'compare': {
      let a = nz(rng, r);
      let b = nz(rng, r);
      if (chance(rng, 0.5)) {
        a = -randInt(rng, 1, r);
        b = -randInt(rng, 1, r);
      }
      if (a === b) b = a + 1 === 0 ? a + 2 : a + 1;
      const sg = a < b ? '<' : '>';
      return build(ctx, {
        prompt: L(`Compară ${sInt(a)} și ${sInt(b)}. Care semn se potrivește?`, `Compare ${sInt(a)} and ${sInt(b)}. Which sign fits?`),
        answer: aT(sg),
        wrong: ['<', '>', '='].filter((s) => s !== sg).map((s) => aT(s)),
        gap: same(`${sInt(a)} {{gap}} ${sInt(b)}`),
        gapPrompt: L('Alege semnul potrivit.', 'Choose the right sign.'),
        tf: (s) => same(`${sInt(a)} ${s.ro} ${sInt(b)}`),
      });
    }

    case 'add':
    case 'sub': {
      const isSub = mode === 'sub';
      let a = nz(rng, r);
      let b = nz(rng, r);
      if (d <= 1) {
        a = randInt(rng, 1, r);
        b = chance(rng, 0.5) ? -randInt(rng, 1, r) : randInt(rng, 1, r);
        if (chance(rng, 0.5)) a = -a;
      }
      const res = isSub ? a - b : a + b;
      const text = `${sInt(a)} ${isSub ? MINUS : '+'} ${pInt(b)}`;
      const wrongs = [
        -res, Math.abs(a) + Math.abs(b), -(Math.abs(a) + Math.abs(b)), Math.abs(Math.abs(a) - Math.abs(b)), isSub ? a + b : a - b, res + 1, res - 1,
        isSub ? b - a : -(a - b),
      ].filter((w) => w !== res);
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(res),
        wrong: wrongs.map(aInt),
        must: wrongs.slice(0, 2).map(aInt),
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'mul':
    case 'div': {
      const isDiv = mode === 'div';
      const f = Math.min(r, 12);
      let a = nz(rng, Math.min(f, 9));
      const b = nz(rng, Math.min(f, 9));
      if (d <= 1) {
        a = randInt(rng, 2, 9);
      }
      const bb = d <= 1 ? (chance(rng, 0.5) ? -b : b) : b;
      let text: string;
      let res: number;
      if (isDiv) {
        const dividend = a * bb;
        text = `${pInt(dividend)} : ${pInt(bb)}`;
        res = a;
      } else {
        text = `${pInt(a)} · ${pInt(bb)}`;
        res = a * bb;
      }
      const wrongs = [-res, Math.abs(res), a + bb, res + 1, res - 1, a - bb].filter((w) => w !== res && (res !== 0 || w !== 0));
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(res),
        wrong: wrongs.map(aInt),
        must: [aInt(-res)],
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'expr': {
      for (let t = 0; t < 200; t++) {
        const n = d <= 2 ? 3 : 4;
        const vals = Array.from({ length: n }, () => nz(rng, d <= 2 ? 6 : 8));
        const ops = Array.from({ length: n - 1 }, () => pick(rng, ['+', '-', '*', '*'] as Op[]));
        if (!ops.some((o) => o === '*') || !ops.some((o) => o === '+' || o === '-')) continue;
        const right = evalFlat(vals, ops, 'prec');
        const naive = evalFlat(vals, ops, 'ltr');
        if (right === null || naive === null || right === naive || Math.abs(right) > 99 || Math.abs(naive) > 99) continue;
        const text = vals.map((v, i) => (i === 0 ? sInt(v) : `${OP_SYM[ops[i - 1]]} ${pInt(v)}`)).join(' ');
        const wrongs = [naive, -right, right + 1, right - 1, right + 2].filter((w) => w !== right);
        return build(ctx, {
          prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
          answer: aInt(right),
          wrong: wrongs.map(aInt),
          must: [aInt(naive)],
          gap: same(`${text} = {{gap}}`),
          tf: (x) => same(`${text} = ${x.ro}`),
        });
      }
      return build(ctx, { prompt: L('Calculează: −3 + 4 · (−2)', 'Work out: −3 + 4 · (−2)'), answer: aInt(-11), wrong: [aInt(-10), aInt(-2), aInt(11)] });
    }
  }
};

registerGenerator('integers', integers);
