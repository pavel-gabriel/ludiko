/**
 * `fractions-ops` generator (grades V-VII). params:
 *   modes:   any of 'equiv' | 'simplify' | 'compare' | 'order' | 'add' | 'sub' | 'mul' | 'div' | 'of' | 'mixed'
 *   maxDen:  largest denominator of an operand (default 10)
 *   negative: operands may be negative (grade VII rational numbers)
 *
 * Every result is computed with exact rational arithmetic (rational.ts) and is shown reduced; the prompts
 * ask for the lowest terms ("forma ireductibilă"), so unreduced forms (e.g. 6/8) are only ever WRONG answers
 * (or, for 'equiv', the asked-for equal fraction). Classic mistakes used as distractors: adding numerators
 * and denominators, (a+k)/(b+k) for equivalence, forgetting to flip when dividing, forgetting to simplify,
 * sign slips, ignoring precedence / parentheses.
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L, MINUS, type Ans } from './mathKit';
import { type Fr, fr, frAdd, frCmp, frDiv, frEq, frIsInt, frMul, frSub, frText, gcd, rawFrText } from './rational';

type Rng = () => number;

export const aFr = (x: Fr): Ans => (frIsInt(x) ? aInt(x.n) : aT(frText(x)));
export const fP = (x: Fr): string => (x.n < 0 ? `(${frText(x)})` : frText(x));

/** distinct fractions (by value), none equal to `exclude` */
export const uniqFr = (list: Fr[], exclude: Fr): Fr[] => {
  const out: Fr[] = [];
  for (const x of list) if (!frEq(x, exclude) && !out.some((y) => frEq(y, x))) out.push(x);
  return out;
};

const coprimeNum = (rng: Rng, den: number): number => {
  for (let t = 0; t < 40; t++) {
    const n = randInt(rng, 1, den - 1);
    if (gcd(n, den) === 1) return n;
  }
  return 1;
};

/** random proper reduced fraction with 2 <= den <= maxDen */
export function properFr(rng: Rng, maxDen: number, neg: boolean): Fr {
  const d = randInt(rng, 2, maxDen);
  const n = coprimeNum(rng, d);
  return fr(neg && chance(rng, 0.5) ? -n : n, d);
}

const barVisual = (x: Fr): VisualSpec | undefined =>
  x.n > 0 && x.n <= x.d && x.d <= 12 ? { kind: 'fraction', numerator: x.n, denominator: x.d, shape: 'bar' } : undefined;

const MODES = ['equiv', 'simplify', 'compare', 'order', 'add', 'sub', 'mul', 'div', 'of', 'mixed'] as const;
type Mode = (typeof MODES)[number];

const same = (s: string) => L(s, s);

export const fractionsOps: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const maxDen = Math.max(4, paramInt(params, 'maxDen', 10));
  const neg = params.negative === true;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['add', 'sub']).filter((m): m is Mode =>
    (MODES as readonly string[]).includes(m),
  );
  const mode = pick(rng, modes.length ? modes : (['add'] as Mode[]));

  switch (mode) {
    case 'equiv': {
      const base = properFr(rng, Math.min(maxDen, 9), false);
      const k = randInt(rng, 2, d <= 2 ? 5 : 8);
      const n2 = base.n * k;
      const d2 = base.d * k;
      if (chance(rng, 0.5)) {
        // find the missing numerator / denominator
        const topGap = chance(rng, 0.5);
        const known = topGap ? d2 : n2;
        const answer = topGap ? n2 : d2;
        const wrongs = (topGap
          ? [base.n + k, base.n + (d2 - base.d), n2 + 1, base.n * (k - 1), d2 - base.d]
          : [base.d + k, base.d + (n2 - base.n), d2 + 1, base.d * (k - 1), n2 - base.n]
        ).filter((w) => w > 0 && w !== answer);
        const eqText = topGap ? `${base.n}/${base.d} = ?/${known}` : `${base.n}/${base.d} = ${known}/?`;
        return build(ctx, {
          prompt: L(`Completează egalitatea ${eqText} Care număr înlocuiește semnul „?”?`, `Complete the equality ${eqText} Which number replaces “?”?`),
          visual: d <= 2 ? barVisual(base) : undefined,
          answer: aInt(answer),
          wrong: wrongs.map(aInt),
          must: wrongs.slice(0, 1).map(aInt),
          gap: same(topGap ? `${base.n}/${base.d} = {{gap}}/${known}` : `${base.n}/${base.d} = ${known}/{{gap}}`),
          tf: (a) => same(eqText.replace('?', a.ro)),
        });
      }
      const pairs: [number, number][] = [
        [base.n + k, base.d + k], [n2, base.d], [base.n, d2], [n2, d2 + 1], [n2 + 1, d2], [base.d * k, base.n * k], [n2 + k, d2 + k * 2],
      ];
      const ok = pairs.filter(([n, dd]) => dd > 0 && !frEq(fr(n, dd), base));
      return build(ctx, {
        prompt: L(`Care dintre fracții este egală cu ${frText(base)}?`, `Which of these fractions is equal to ${frText(base)}?`),
        visual: d <= 2 ? barVisual(base) : undefined,
        answer: aT(rawFrText(n2, d2)),
        wrong: ok.map(([n, dd]) => aT(rawFrText(n, dd))),
        must: ok.slice(0, 1).map(([n, dd]) => aT(rawFrText(n, dd))),
        tf: (a) => same(`${frText(base)} = ${a.ro}`),
      });
    }

    case 'simplify': {
      const base = properFr(rng, Math.min(maxDen, 9), false);
      const k = pick(rng, d <= 1 ? [2, 3, 5] : [4, 6, 8, 9, 10, 12]);
      const n2 = base.n * k;
      const d2 = base.d * k;
      const partial = [2, 3, 5].filter((p) => k % p === 0 && k !== p).map((p) => aT(rawFrText(base.n * (k / p), base.d * (k / p))));
      const diffs = uniqFr(
        [fr(n2 - k, d2 - k), fr(base.d, base.n), fr(n2, d2 + k), fr(base.n + 1, base.d)].filter((x) => x.d > 0 && x.n > 0),
        base,
      );
      if (chance(rng, 0.35)) {
        return build(ctx, {
          prompt: L(
            `Fracția ${n2}/${d2} se simplifică până devine ireductibilă. Care este numitorul fracției ireductibile?`,
            `The fraction ${n2}/${d2} is simplified until it is irreducible. What is the denominator of the irreducible fraction?`,
          ),
          answer: aInt(base.d),
          wrong: [aInt(d2), aInt(base.n), aInt(d2 - k), aInt(base.d * 2)].filter((w) => w.int !== base.d),
        });
      }
      return build(ctx, {
        prompt: L(`Simplifică fracția ${n2}/${d2} și scrie rezultatul în forma ireductibilă.`, `Simplify the fraction ${n2}/${d2} and write the irreducible form.`),
        answer: aT(frText(base)),
        wrong: [...partial, ...diffs.map(aFr)],
        must: partial.slice(0, 1),
        tf: (a) => same(`${n2}/${d2} = ${a.ro} (forma ireductibilă)`),
        tfWrong: diffs.map(aFr),
        gap: same(`${n2}/${d2} = {{gap}}`),
        gapPrompt: L('Scrie fracția ireductibilă egală cu cea dată.', 'Write the irreducible fraction equal to the given one.'),
      });
    }

    case 'compare': {
      const a = properFr(rng, maxDen, neg);
      let b = properFr(rng, maxDen, neg);
      const equal = chance(rng, 0.12);
      if (equal) b = a;
      const c = frCmp(a, b);
      const sign = c < 0 ? '<' : c > 0 ? '>' : '=';
      const bText = equal ? rawFrText(a.n * 2, a.d * 2) : frText(b);
      const others = ['<', '>', '='].filter((s) => s !== sign).map((s) => aT(s));
      return build(ctx, {
        prompt: L(`Compară fracțiile ${frText(a)} și ${bText}. Care semn se potrivește?`, `Compare the fractions ${frText(a)} and ${bText}. Which sign fits?`),
        answer: aT(sign),
        wrong: others,
        gap: same(`${frText(a)} {{gap}} ${bText}`),
        gapPrompt: L('Alege semnul potrivit.', 'Choose the right sign.'),
        tf: (s) => same(`${frText(a)} ${s.ro} ${bText}`),
      });
    }

    case 'order': {
      const set: Fr[] = [];
      for (let t = 0; t < 80 && set.length < 3; t++) {
        const x = properFr(rng, maxDen, neg);
        if (!set.some((y) => frEq(x, y))) set.push(x);
      }
      const sorted = [...set].sort(frCmp);
      const text = (list: Fr[]) => list.map(frText).join(' < ');
      const perms = [[0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((p) => p.map((i) => sorted[i]));
      const shown = shuffle(rng, set).map(frText).join(', ');
      return build(ctx, {
        prompt: L(`Ordonează crescător fracțiile ${shown}.`, `Put the fractions ${shown} in increasing order.`),
        answer: aT(text(sorted)),
        wrong: perms.map((p) => aT(text(p))),
        must: [aT(text([...sorted].reverse()))],
        only: ['choice'],
      });
    }

    case 'add':
    case 'sub': {
      const sub = mode === 'sub';
      let x = fr(1, 2);
      let y = fr(1, 3);
      for (let guard = 0; guard < 60; guard++) {
        let b: number;
        let b2: number;
        if (d <= 1) {
          b = randInt(rng, 3, maxDen);
          b2 = b;
        } else if (d === 2) {
          const b0 = randInt(rng, 2, Math.max(2, Math.floor(maxDen / 2)));
          const m = pick(rng, [2, 3]);
          [b, b2] = chance(rng, 0.5) ? [b0, b0 * m] : [b0 * m, b0];
        } else {
          b = randInt(rng, 2, maxDen);
          b2 = randInt(rng, 2, maxDen);
        }
        const n1 = coprimeNum(rng, b);
        const n2 = coprimeNum(rng, b2);
        x = fr(neg && chance(rng, 0.5) ? -n1 : n1, b);
        y = fr(neg && chance(rng, 0.5) ? -n2 : n2, b2);
        if (sub && !neg && frCmp(x, y) < 0) [x, y] = [y, x];
        if (!frEq(x, y) && (d <= 2 || x.d !== y.d)) break;
      }
      const res = sub ? frSub(x, y) : frAdd(x, y);
      const sym = sub ? MINUS : '+';
      const expr = `${frText(x)} ${sym} ${fP(y)}`;
      // like denominators and no negatives: also ask for the numerator of the result
      if (d <= 1 && !neg && x.d === y.d && chance(rng, 0.5)) {
        const na = sub ? x.n - y.n : x.n + y.n;
        return build(ctx, {
          prompt: L(`Completează: ${frText(x)} ${sym} ${frText(y)} = ?/${x.d}. Care este numărătorul?`, `Complete: ${frText(x)} ${sym} ${frText(y)} = ?/${x.d}. What is the numerator?`),
          visual: barVisual(x),
          answer: aInt(na),
          wrong: [aInt(x.n + y.n + 1), aInt(Math.abs(x.n - y.n)), aInt(na + 2), aInt(x.n * y.n)].filter((w) => w.int !== na),
          gap: same(`${frText(x)} ${sym} ${frText(y)} = {{gap}}/${x.d}`),
        });
      }
      const common = x.d * y.d;
      const unreduced = sub ? x.n * y.d - y.n * x.d : x.n * y.d + y.n * x.d;
      const wrongFr: Fr[] = [
        fr(sub ? x.n - y.n : x.n + y.n, sub ? x.d - y.d || 1 : x.d + y.d), // numerators and denominators combined
        fr(sub ? x.n - y.n : x.n + y.n, x.d),
        fr(sub ? x.n + y.n : x.n - y.n, common),
        fr(-res.n, res.d),
        fr(res.n + 1, res.d),
        fr(res.n, res.d + 1),
      ];
      const wrongs = uniqFr(wrongFr, res).filter((w) => w.n !== 0);
      const raw = res.d !== common && gcd(unreduced, common) > 1 ? [aT(rawFrText(unreduced, common))] : [];
      return build(ctx, {
        prompt: L(`Calculează și scrie rezultatul în forma ireductibilă: ${expr}`, `Work it out and write the result in lowest terms: ${expr}`),
        answer: aFr(res),
        wrong: [...raw, ...wrongs.map(aFr)],
        must: [...raw, ...wrongs.slice(0, 1).map(aFr)],
        gap: same(`${expr} = {{gap}}`),
        gapPrompt: L('Calculează (forma ireductibilă).', 'Calculate (lowest terms).'),
        tf: (a) => same(`${expr} = ${a.ro}`),
        tfWrong: wrongs.map(aFr),
      });
    }

    case 'mul':
    case 'div': {
      const isDiv = mode === 'div';
      let x = properFr(rng, maxDen, neg);
      let y = properFr(rng, maxDen, neg);
      if (d >= 3 && chance(rng, 0.3)) x = fr(Math.sign(x.n) * (x.d + Math.abs(x.n)), x.d); // improper operand
      if (isDiv && chance(rng, 0.2)) y = fr(y.d, y.n); // divisor greater than 1
      const res = isDiv ? frDiv(x, y) : frMul(x, y);
      const expr = `${frText(x)} ${isDiv ? ':' : '·'} ${fP(y)}`;
      const noFlip = frMul(x, y);
      const flipFirst = isDiv ? frDiv(fr(x.d, x.n), y) : frAdd(x, y);
      const rawN = isDiv ? x.n * y.d : x.n * y.n;
      const rawD = isDiv ? x.d * y.n : x.d * y.d;
      const raw = gcd(rawN, rawD) > 1 ? [aT(rawFrText(rawD < 0 ? -rawN : rawN, Math.abs(rawD)))] : [];
      const wrongs = uniqFr(
        [...(isDiv ? [noFlip, flipFirst] : [flipFirst, fr(x.n * y.n, x.d + y.d)]), fr(-res.n, res.d), fr(res.n + 1, res.d), fr(res.d, res.n)],
        res,
      ).filter((w) => w.n !== 0);
      return build(ctx, {
        prompt: L(`Calculează și scrie rezultatul în forma ireductibilă: ${expr}`, `Work it out and write the result in lowest terms: ${expr}`),
        answer: aFr(res),
        wrong: [...raw, ...wrongs.map(aFr)],
        must: [...(isDiv && !frEq(noFlip, res) ? [aFr(noFlip)] : []), ...raw],
        gap: same(`${expr} = {{gap}}`),
        gapPrompt: L('Calculează (forma ireductibilă).', 'Calculate (lowest terms).'),
        tf: (a) => same(`${expr} = ${a.ro}`),
        tfWrong: wrongs.map(aFr),
      });
    }

    case 'of': {
      const f = properFr(rng, Math.min(maxDen, 9), false);
      const part = randInt(rng, 2, d <= 2 ? 9 : 15);
      const total = f.d * part;
      const shown = f.n * part;
      if (d >= 3 && chance(rng, 0.45)) {
        return build(ctx, {
          prompt: L(`${frText(f)} dintr-un număr este ${shown}. Care este numărul?`, `${frText(f)} of a number is ${shown}. What is the number?`),
          answer: aInt(total),
          wrong: [aInt(shown * f.n), aInt(part * f.n), aInt(shown + f.d), aInt(shown * f.d), aInt(part)].filter((w) => w.int !== total),
          must: [aInt(shown * f.n)].filter((w) => w.int !== total),
          tf: (a) => same(`${frText(f)} dintr-un număr este ${shown}, deci numărul este ${a.ro}`),
        });
      }
      return build(ctx, {
        prompt: L(`Cât este ${frText(f)} din ${total}?`, `What is ${frText(f)} of ${total}?`),
        visual: d <= 2 ? barVisual(f) : undefined,
        answer: aInt(shown),
        wrong: [aInt(part), aInt(total * f.n), aInt(total - shown), aInt(total + shown), aInt(shown + f.d)].filter((w) => w.int !== shown),
        must: [aInt(part)].filter((w) => w.int !== shown),
        gap: L(`${frText(f)} din ${total} = {{gap}}`, `${frText(f)} of ${total} = {{gap}}`),
        tf: (a) => L(`${frText(f)} din ${total} este ${a.ro}`, `${frText(f)} of ${total} is ${a.ro}`),
      });
    }

    case 'mixed': {
      const apply = (a: Fr, op: string, b: Fr): Fr => (op === '+' ? frAdd(a, b) : op === '-' ? frSub(a, b) : op === '*' ? frMul(a, b) : frDiv(a, b));
      const sym = (op: string) => (op === '+' ? '+' : op === '-' ? MINUS : op === '*' ? '·' : ':');
      for (let t = 0; t < 80; t++) {
        const x = properFr(rng, maxDen, neg);
        const y = properFr(rng, maxDen, neg);
        const z = properFr(rng, maxDen, neg);
        const useParens = d >= 2 && chance(rng, 0.45);
        const lo = pick(rng, ['+', '-']);
        const hi = pick(rng, ['*', '/']);
        let text: string;
        let right: Fr;
        let naive: Fr;
        try {
        if (useParens) {
          text = `(${frText(x)} ${sym(lo)} ${fP(y)}) ${sym(hi)} ${fP(z)}`;
          right = apply(apply(x, lo, y), hi, z);
          naive = apply(x, lo, apply(y, hi, z)); // ignores the parentheses
        } else if (chance(rng, 0.5)) {
          text = `${frText(x)} ${sym(lo)} ${frText(y)} ${sym(hi)} ${fP(z)}`;
          right = apply(x, lo, apply(y, hi, z));
          naive = apply(apply(x, lo, y), hi, z); // left to right
        } else {
          text = `${frText(x)} ${sym(hi)} ${frText(y)} ${sym(lo)} ${fP(z)}`;
          right = apply(apply(x, hi, y), lo, z);
          naive = apply(x, hi, apply(y, lo, z)); // adds first
        }
        } catch {
          continue; // a division by zero in a distractor: draw again
        }
        if (frEq(right, naive) || right.n === 0 || Math.abs(right.n) > 400 || right.d > 400 || Math.abs(naive.n) > 400 || naive.d > 400) continue;
        const wrongs = uniqFr([naive, fr(-right.n, right.d), fr(right.n + 1, right.d), fr(right.n, right.d + 1)], right).filter((w) => w.n !== 0);
        return build(ctx, {
          prompt: L(`Calculează și scrie rezultatul în forma ireductibilă: ${text}`, `Work it out and write the result in lowest terms: ${text}`),
          answer: aFr(right),
          wrong: wrongs.map(aFr),
          must: [aFr(naive)].filter((w) => w.ro !== aFr(right).ro),
          tf: (a) => same(`${text} = ${a.ro}`),
          tfWrong: wrongs.map(aFr),
          gap: same(`${text} = {{gap}}`),
        });
      }
      return build(ctx, {
        prompt: L('Calculează: 1/2 + 1/3 · 3/4', 'Work out: 1/2 + 1/3 · 3/4'),
        answer: aT('3/4'),
        wrong: [aT('5/8'), aT('1/2'), aT('5/6')],
      });
    }
  }
};

registerGenerator('fractions-ops', fractionsOps);
