/**
 * `linear-equation` generator (grades V-VIII). params:
 *   kinds: any of 'basic' | 'both' | 'paren' | 'frac' | 'rational' | 'word' | 'verify' | 'ineq'
 *
 * Every equation is built backwards from its solution (so the solution is exact): 'basic' has a natural
 * solution (typable), 'both' / 'paren' integer solutions that may be negative (offered as options), 'rational'
 * a reduced fraction. 'ineq' (grade VIII) gives intervals such as (−∞; 3] and turns the sign when dividing by a
 * negative number. Distractors: sign slips, forgetting to divide, dividing before subtracting, forgetting to
 * turn the inequality sign.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L, MINUS, sInt, type Ans } from './mathKit';
import { fr, frText, gcd, lcm, rawFrText } from './rational';

const same = (s: string) => L(s, s);
const KINDS = ['basic', 'both', 'paren', 'frac', 'rational', 'word', 'verify', 'ineq'] as const;
type Kind = (typeof KINDS)[number];

const term = (a: number): string => (a === 1 ? 'x' : a === -1 ? `${MINUS}x` : `${sInt(a)}x`);
const lin = (a: number, b: number): string => (b === 0 ? term(a) : `${term(a)} ${b < 0 ? MINUS : '+'} ${Math.abs(b)}`);
const nzInt = (rng: () => number, lo: number, hi: number): number => {
  for (;;) {
    const v = randInt(rng, lo, hi);
    if (v !== 0) return v;
  }
};

/** Answers for an integer solution: wrong values that are plausible */
const intAns = (right: number, extra: number[]): { answer: Ans; wrong: Ans[] } => ({
  answer: aInt(right),
  wrong: [...extra, right + 1, right - 1, -right, right + 2].filter((w) => w !== right).map(aInt),
});

function solve(ctx: Parameters<GeneratorFn>[1], eq: string, x: number, extra: number[], tfStatement = true): Item {
  const { answer, wrong } = intAns(x, extra);
  return build(ctx, {
    prompt: L(`Rezolvă ecuația ${eq}. Care este valoarea lui x?`, `Solve the equation ${eq}. What is the value of x?`),
    answer,
    wrong,
    must: extra.filter((w) => w !== x).slice(0, 2).map(aInt),
    gap: same(`${eq} ⇒ x = {{gap}}`),
    gapPrompt: L('Rezolvă ecuația.', 'Solve the equation.'),
    tf: tfStatement ? (a) => same(`soluția ecuației ${eq} este x = ${a.ro}`) : undefined,
  });
}

export const linearEquation: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kinds = (Array.isArray(params.kinds) ? (params.kinds as string[]) : ['basic']).filter((k): k is Kind => (KINDS as readonly string[]).includes(k));
  const kind = pick(rng, kinds.length ? kinds : (['basic'] as Kind[]));

  switch (kind) {
    case 'basic': {
      const x = randInt(rng, 1, d <= 2 ? 10 : 20);
      const form = pick(rng, [0, 1, 2, 3]);
      const a = randInt(rng, 2, d <= 2 ? 6 : 12);
      const b = randInt(rng, 1, 20);
      if (form === 0) {
        const c = a * x + b;
        return solve(ctx, `${a}x + ${b} = ${c}`, x, [c - b, (c - b) * a, c + b, Math.floor(c / a) + b].filter((v) => v > 0));
      }
      if (form === 1) {
        const b2 = randInt(rng, 1, Math.max(1, a * x - 1));
        const c = a * x - b2;
        return solve(ctx, `${a}x ${MINUS} ${b2} = ${c}`, x, [c + b2, c - b2, x + 3, (c + b2) * a].filter((v) => v > 0));
      }
      if (form === 2) {
        const c = x + b;
        return solve(ctx, `x + ${b} = ${c}`, x, [c + b, b, c].filter((v) => v > 0));
      }
      // x : a + b = c  (x = a * (c - b))
      const q = x;
      const c = q + b;
      return solve(ctx, `x : ${a} + ${b} = ${c}`, a * q, [q, (c + b) * a, c * a + b, c * a].filter((v) => v > 0 && v !== a * q));
    }

    case 'both': {
      for (let t = 0; t < 100; t++) {
        const x = nzInt(rng, -8, 9);
        const a = nzInt(rng, -6, 7);
        const c = nzInt(rng, -6, 7);
        if (a === c) continue;
        const b = randInt(rng, -15, 15);
        const dd = (a - c) * x + b;
        if (Math.abs(dd) > 40) continue;
        const eq = `${lin(a, b)} = ${lin(c, dd)}`;
        const slip = (a + c) !== 0 && (dd - b) % (a + c) === 0 ? (dd - b) / (a + c) : x + 3;
        return solve(ctx, eq, x, [slip, -x, (b - dd) % (a - c) === 0 ? (b - dd) / (a - c) : x + 2]);
      }
      return solve(ctx, '3x + 4 = x + 10', 3, [7, -3]);
    }

    case 'paren': {
      for (let t = 0; t < 100; t++) {
        const x = nzInt(rng, -6, 10);
        const a = randInt(rng, 2, 7);
        const b = nzInt(rng, -9, 9);
        const withOuter = d >= 3 && chance(rng, 0.5);
        const e = withOuter ? randInt(rng, 1, 12) : 0;
        const c = a * (x + b) + e;
        const sign = b < 0 ? MINUS : '+';
        const eq = withOuter ? `${a}(x ${sign} ${Math.abs(b)}) + ${e} = ${sInt(c)}` : `${a}(x ${sign} ${Math.abs(b)}) = ${sInt(c)}`;
        const cc = c - e;
        const noDistribute = (cc - b) % a === 0 ? (cc - b) / a : x + 1; // (ax + b = c) slip
        const signSlip = cc % a === 0 ? cc / a + b : x - 2;
        if (Math.abs(c) > 99) continue;
        return solve(ctx, eq, x, [noDistribute, signSlip, cc % a === 0 ? cc / a : x + 3, -x]);
      }
      return solve(ctx, '2(x + 3) = 14', 4, [11, 10]);
    }

    case 'frac': {
      const form = pick(rng, [0, 1, 2]);
      if (form === 0) {
        const a = randInt(rng, 2, 9);
        const b = randInt(rng, 1, 9);
        const x = a * randInt(rng, 1, 9);
        const c = x / a + b;
        return solve(ctx, `x/${a} + ${b} = ${c}`, x, [c - b, (c + b) * a, c * a + b, x / a]);
      }
      if (form === 1) {
        const p = pick(rng, [2, 3, 4, 5]);
        const q = pick(rng, [2, 3, 4, 5, 6].filter((v) => v !== p));
        const L2 = lcm(p, q);
        const x = L2 * randInt(rng, 1, 5);
        const c = x / p + x / q;
        return solve(ctx, `x/${p} + x/${q} = ${c}`, x, [c * p, c * q, c * p * q, (c * L2) / 2 === x ? x + L2 : (c * L2) / 2]);
      }
      for (let t = 0; t < 100; t++) {
        const a = randInt(rng, 2, 6);
        const c = randInt(rng, 2, 6);
        const x = randInt(rng, 1, 9);
        const b = randInt(rng, 1, 9);
        const num = a * x + b;
        if (num % c !== 0) continue;
        const dd = num / c;
        return solve(ctx, `(${a}x + ${b})/${c} = ${dd}`, x, [dd * c, dd - b, (dd * c - b) % a === 0 ? (dd * c - b) / a + 1 : x + 2, dd]);
      }
      return solve(ctx, 'x/2 + 3 = 7', 8, [4, 10]);
    }

    case 'rational': {
      for (let t = 0; t < 200; t++) {
        const a = randInt(rng, 2, 9);
        const b = randInt(rng, -9, 9);
        const c = randInt(rng, -9, 15);
        const num = c - b;
        if (num === 0 || num % a === 0) continue;
        const sol = fr(num, a);
        const eq = `${a}x ${b < 0 ? MINUS : '+'} ${Math.abs(b)} = ${sInt(c)}`;
        const raw = gcd(num, a) > 1 ? [aT(rawFrText(num, a))] : [];
        const wrongs = [fr(a, num), fr(-num, a), fr(c + b, a), fr(num + 1, a), fr(num, a + 1), fr(c, a)].filter((w) => !(w.n === sol.n && w.d === sol.d));
        const seen = new Set<string>();
        const uniq = wrongs.filter((w) => w.n !== 0 && !seen.has(frText(w)) && seen.add(frText(w)));
        return build(ctx, {
          prompt: L(`Rezolvă ecuația ${eq}. Scrie soluția ca fracție ireductibilă.`, `Solve the equation ${eq}. Write the solution as a fraction in lowest terms.`),
          answer: aT(frText(sol)),
          wrong: [...raw, ...uniq.map((w) => aT(frText(w)))],
          must: [...raw, ...uniq.slice(0, 1).map((w) => aT(frText(w)))],
          tf: (x) => same(`soluția ecuației ${eq} este x = ${x.ro}`),
          tfWrong: uniq.map((w) => aT(frText(w))),
        });
      }
      return solve(ctx, '2x + 1 = 4', 1, [2]);
    }

    case 'word': {
      const which = randInt(rng, 0, 4);
      if (which === 0) {
        const a = randInt(rng, 2, 9);
        const b = randInt(rng, 1, 20);
        const x = randInt(rng, 2, 15);
        const c = a * x + b;
        return build(ctx, {
          prompt: L(`Un număr înmulțit cu ${a} și mărit cu ${b} dă ${c}. Care este numărul?`, `A number multiplied by ${a} and increased by ${b} gives ${c}. What is the number?`),
          answer: aInt(x),
          wrong: [aInt(c - b), aInt(x + 1), aInt(x - 1), aInt((c - b) * a), aInt(c + b)].filter((w) => w.int !== x && (w.int ?? 0) > 0),
          must: [aInt(c - b)].filter((w) => w.int !== x),
        });
      }
      if (which === 1) {
        const b = randInt(rng, 2, 15);
        const x = randInt(rng, 3, 30);
        const c = 2 * x - b;
        return build(ctx, {
          prompt: L(`Dublul unui număr, micșorat cu ${b}, este ${c}. Care este numărul?`, `Twice a number, decreased by ${b}, is ${c}. What is the number?`),
          answer: aInt(x),
          wrong: [aInt(c - b), aInt(x + b), aInt(Math.floor(c / 2)), aInt(c + b), aInt(x - 1)].filter((w) => w.int !== x && (w.int ?? 0) > 0),
          must: [aInt(Math.floor(c / 2))].filter((w) => w.int !== x),
        });
      }
      if (which === 2) {
        const x = randInt(rng, 3, 60);
        const S = 3 * x + 3;
        return build(ctx, {
          prompt: L(`Suma a trei numere naturale consecutive este ${S}. Care este cel mai mic dintre ele?`, `The sum of three consecutive natural numbers is ${S}. What is the smallest of them?`),
          answer: aInt(x),
          wrong: [aInt(x + 1), aInt(x + 2), aInt(S / 3), aInt(x - 1), aInt(S - 3)].filter((w) => w.int !== x && (w.int ?? 0) > 0),
          must: [aInt(x + 1)],
        });
      }
      if (which === 3) {
        const k = randInt(rng, 2, 5);
        const n = randInt(rng, 2, 10);
        const x = randInt(rng, 5, 15);
        const S = k * x + x + 2 * n;
        return build(ctx, {
          prompt: L(
            `Tatăl are de ${k} ori vârsta fiului. Peste ${n} ani, suma vârstelor lor va fi ${S} ani. Câți ani are fiul acum?`,
            `A father is ${k} times as old as his son. In ${n} years the sum of their ages will be ${S}. How old is the son now?`,
          ),
          answer: aInt(x),
          wrong: [aInt(x + n), aInt(S / (k + 1) === Math.floor(S / (k + 1)) ? S / (k + 1) : x + 2), aInt(x - n > 0 ? x - n : x + 3), aInt(k * x), aInt(x + 1)].filter((w) => w.int !== x && (w.int ?? 0) > 0),
          must: [aInt(x + n)],
        });
      }
      const m = randInt(rng, 1, 9);
      const x = randInt(rng, 2, 25);
      const P = 4 * x + 2 * m;
      return build(ctx, {
        prompt: L(
          `Un dreptunghi are lungimea cu ${m} cm mai mare decât lățimea, iar perimetrul de ${P} cm. Care este lățimea (în cm)?`,
          `A rectangle's length is ${m} cm more than its width and its perimeter is ${P} cm. What is the width (in cm)?`,
        ),
        answer: aInt(x),
        wrong: [aInt(x + m), aInt(P / 2 - m), aInt(Math.floor(P / 4)), aInt(x - 1), aInt(x + 1)].filter((w) => w.int !== x && (w.int ?? 0) > 0),
        must: [aInt(x + m)],
      });
    }

    case 'verify': {
      const x = nzInt(rng, -6, 9);
      const a = randInt(rng, 2, 7);
      const b = nzInt(rng, -9, 9);
      const c = a * x + b;
      const eq = `${lin(a, b)} = ${sInt(c)}`;
      const pool = [x + 1, x - 1, -x, x + 2, x - 2, x * 2, 0].filter((w) => w !== x);
      return build(ctx, {
        prompt: L(`Care dintre numere este soluția ecuației ${eq}?`, `Which of these numbers is the solution of ${eq}?`),
        answer: aInt(x),
        wrong: shuffle(rng, [...new Set(pool)]).map(aInt),
        only: ['choice'],
        noPad: true,
      });
    }

    case 'ineq': {
      if (d >= 2 && chance(rng, 0.3)) {
        // how many natural numbers satisfy it (a > 0)
        const a = randInt(rng, 1, 5);
        const t = randInt(rng, 2, 8);
        const b = randInt(rng, 0, 9);
        const strict = chance(rng, 0.5);
        const c = a * t + b;
        const count = strict ? t : t + 1;
        const eq = `${lin(a, b)} ${strict ? '<' : '≤'} ${c}`;
        return build(ctx, {
          prompt: L(`Câte numere naturale verifică inegalitatea ${eq}?`, `How many natural numbers satisfy ${eq}?`),
          answer: aInt(count),
          wrong: [aInt(count + 1), aInt(count - 1), aInt(t + 2), aInt(Math.max(1, t - 1))].filter((w) => w.int !== count && (w.int ?? 0) > 0),
          must: [aInt(strict ? t + 1 : t)],
        });
      }
      const a = nzInt(rng, d <= 2 ? -1 : -6, 6);
      const t = randInt(rng, -7, 8);
      const b = randInt(rng, -9, 9);
      const c = a * t + b;
      const rel = pick(rng, ['<', '≤', '>', '≥']);
      const flip: Record<string, string> = { '<': '>', '≤': '≥', '>': '<', '≥': '≤' };
      const finalRel = a < 0 ? flip[rel] : rel;
      const text = (r: string, v: number): string => {
        const n = sInt(v);
        if (r === '<') return `x ∈ (${MINUS}∞; ${n})`;
        if (r === '≤') return `x ∈ (${MINUS}∞; ${n}]`;
        if (r === '>') return `x ∈ (${n}; +∞)`;
        return `x ∈ [${n}; +∞)`;
      };
      const right = text(finalRel, t);
      const cands = [text(rel, t), text(finalRel, -t), text(flip[finalRel], t), text(finalRel === '<' ? '≤' : finalRel === '≤' ? '<' : finalRel === '>' ? '≥' : '>', t), text(rel, -t)];
      const eq = `${lin(a, b)} ${rel} ${sInt(c)}`;
      return build(ctx, {
        prompt: L(`Rezolvă în ℝ inecuația ${eq}. Care este mulțimea soluțiilor?`, `Solve the inequality ${eq} over the reals. What is the solution set?`),
        answer: aT(right),
        wrong: cands.filter((x) => x !== right).map((x) => aT(x)),
        must: a < 0 ? [aT(text(rel, t))] : [aT(text(finalRel === '<' ? '≤' : finalRel === '≤' ? '<' : finalRel === '>' ? '≥' : '>', t))],
        only: ['choice'],
      });
    }
  }
};

registerGenerator('linear-equation', linearEquation);
