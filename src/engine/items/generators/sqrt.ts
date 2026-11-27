/**
 * `sqrt` generator (grades VII-VIII): square roots, irrational numbers, radicals. params:
 *   modes: any of 'perfect' | 'perfectFrac' | 'between' | 'approx' | 'irrational' | 'irrationalTf' | 'classify' |
 *                 'simplify' | 'radSum' | 'prodRoot' | 'compare' | 'expr'
 *
 * Facts are decided with integer arithmetic only (isqrt, exact squares; comparisons of √m with a decimal use
 * m·10^2k versus p²). Distractors: the root of a sum taken as the sum of roots, √ of a decimal with the
 * decimal point misplaced, adding radicands, forgetting the coefficient.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L, MINUS, tfItem } from './mathKit';
import { decText, fr, frText, isSquare, isqrt } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['perfect', 'perfectFrac', 'between', 'approx', 'irrational', 'irrationalTf', 'classify', 'simplify', 'radSum', 'prodRoot', 'compare', 'expr'] as const;
type Mode = (typeof MODES)[number];

const NON_SQUARES = Array.from({ length: 98 }, (_, i) => i + 2).filter((n) => !isSquare(n));
const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13];
const root = (n: number | string) => `√${n}`;
/** "3√5" (coefficient 1 is omitted) */
const rc = (c: number, b: number): string => (c === 1 ? root(b) : `${c}√${b}`);
const gcdn = (a: number, b: number): number => (b ? gcdn(b, a % b) : a);
/** reduced non-integer fraction text p/q, 1 < q <= maxQ */
function nonIntFrac(rng: () => number, maxQ: number): string {
  for (;;) {
    const q = randInt(rng, 2, maxQ);
    const p = randInt(rng, 1, 9);
    if (gcdn(p, q) === 1) return `${p}/${q}`;
  }
}
/** decimal with one decimal digit that is not a whole number, e.g. 3,7 */
const decNonInt = (rng: () => number, lang: 'ro' | 'en'): string => {
  const v = randInt(rng, 11, 99);
  return decText(v % 10 === 0 ? v + 1 : v, 1, lang);
};

export const sqrt: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['perfect']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['perfect'] as Mode[]));

  switch (mode) {
    case 'perfect': {
      const k = randInt(rng, 2, d <= 1 ? 12 : 25);
      const n = k * k;
      if (d >= 3 && chance(rng, 0.4)) {
        const a = randInt(rng, 2, 9);
        const b = randInt(rng, 2, 9);
        const text = `√(${a * a} · ${b * b})`;
        return build(ctx, {
          prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
          answer: aInt(a * b),
          wrong: [aInt(a + b), aInt(a * a * b), aInt(a * b * b), aInt(a * a + b * b), aInt(a * b + 1)].filter((w) => w.int !== a * b),
          gap: same(`${text} = {{gap}}`),
        });
      }
      return build(ctx, {
        prompt: L(`Calculează: ${root(n)}`, `Work out: ${root(n)}`),
        answer: aInt(k),
        wrong: [aInt(k + 1), aInt(k - 1), aInt(Math.floor(n / 2)), aInt(k * 2), aInt(n)].filter((w) => w.int !== k && (w.int ?? 0) > 0),
        must: [aInt(Math.floor(n / 2))].filter((w) => w.int !== k),
        gap: same(`${root(n)} = {{gap}}`),
        tf: (x) => same(`${root(n)} = ${x.ro}`),
      });
    }

    case 'perfectFrac': {
      if (chance(rng, 0.5)) {
        let p = randInt(rng, 1, 9);
        let q = randInt(rng, 2, 12);
        if (p >= q) [p, q] = [q - 1, q];
        const f = fr(p, q);
        const text = `√(${p * p}/${q * q})`;
        const wrongs = [fr(p * p, q), fr(p, q * q), fr(p * p, q * q), fr(q, p), fr(p + 1, q)].filter((w) => !(w.n === f.n && w.d === f.d));
        const seen = new Set<string>();
        const uniq = wrongs.filter((w) => !seen.has(frText(w)) && seen.add(frText(w)));
        return build(ctx, {
          prompt: L(`Calculează: ${text}. Scrie rezultatul ca fracție ireductibilă.`, `Work out: ${text}. Write the result as a fraction in lowest terms.`),
          answer: aT(frText(f)),
          wrong: uniq.map((w) => aT(frText(w))),
          must: [aT(frText(fr(p * p, q))), aT(frText(fr(p * p, q * q)))].filter((w) => w.ro !== frText(f)),
          only: ['choice', 'tf'],
          tf: (x) => same(`${text} = ${x.ro}`),
        });
      }
      const k = randInt(rng, 2, 9);
      const n = k * k;
      const ro = decText(n, 2, 'ro');
      const en = decText(n, 2, 'en');
      return build(ctx, {
        prompt: L(`Calculează: √${ro}`, `Work out: √${en}`),
        answer: { ro: decText(k, 1, 'ro'), en: decText(k, 1, 'en') },
        wrong: [
          { ro: decText(k, 2, 'ro'), en: decText(k, 2, 'en') },
          { ro: decText(n, 1, 'ro'), en: decText(n, 1, 'en') },
          { ro: String(k), en: String(k) },
          { ro: decText(Math.floor(n / 2), 2, 'ro'), en: decText(Math.floor(n / 2), 2, 'en') },
        ].filter((w) => w.ro !== decText(k, 1, 'ro')),
        must: [{ ro: decText(k, 2, 'ro'), en: decText(k, 2, 'en') }],
        only: ['choice'],
      });
    }

    case 'between': {
      const n = pick(rng, NON_SQUARES);
      const s = isqrt(n);
      const opt = (lo: number) => `${lo} și ${lo + 1}`;
      const optEn = (lo: number) => `${lo} and ${lo + 1}`;
      const los = [s - 1, s + 1, s - 2, s + 2, Math.floor(n / 4)].filter((v) => v !== s && v >= 0);
      return build(ctx, {
        prompt: L(`Între ce două numere naturale consecutive se află ${root(n)}?`, `Between which two consecutive natural numbers is ${root(n)}?`),
        answer: aT(opt(s), optEn(s)),
        wrong: los.map((v) => aT(opt(v), optEn(v))),
        must: [aT(opt(s - 1), optEn(s - 1)), aT(opt(s + 1), optEn(s + 1))].filter(() => s >= 1),
        only: ['choice'],
      });
    }

    case 'approx': {
      const n = pick(rng, NON_SQUARES);
      const s = isqrt(n);
      const nearest = n - s * s <= s ? s : s + 1;
      return build(ctx, {
        prompt: L(`Aproximează ${root(n)} cu cel mai apropiat număr natural.`, `Approximate ${root(n)} by the nearest natural number.`),
        answer: aInt(nearest),
        wrong: [aInt(nearest === s ? s + 1 : s), aInt(nearest + 2), aInt(Math.floor(n / 2)), aInt(Math.max(1, nearest - 2))].filter((w) => w.int !== nearest && (w.int ?? 0) > 0),
        must: [aInt(nearest === s ? s + 1 : s)],
        gap: same(`${root(n)} ≈ {{gap}}`),
      });
    }

    case 'irrational': {
      const irr = pick(rng, [...NON_SQUARES.filter((n) => n <= 60).map((n) => ({ ro: root(n), en: root(n) })), ...(d >= 2 ? [{ ro: 'π', en: 'π' }] : [])]);
      const k = randInt(rng, 2, 12);
      const f1 = nonIntFrac(rng, 13);
      const f2 = nonIntFrac(rng, 13);
      const dec2 = randInt(rng, 11, 99);
      const dec2v = dec2 % 10 === 0 ? dec2 + 1 : dec2;
      const per = `${randInt(rng, 1, 9)},(${randInt(rng, 1, 9)})`;
      const perEn = per.replace(',', '.');
      const sp = randInt(rng, 2, 9);
      const sq = randInt(rng, 2, 9);
      const rationals = [
        { ro: root(k * k), en: root(k * k) },
        { ro: decText(dec2v, 2, 'ro'), en: decText(dec2v, 2, 'en') },
        { ro: `${MINUS}${f1}`, en: `${MINUS}${f1}` },
        { ro: per, en: perEn },
        { ro: `${MINUS}${randInt(rng, 2, 30)}`, en: '' },
        { ro: `√(${sp * sp}/${sq * sq})`, en: `√(${sp * sp}/${sq * sq})` },
        { ro: f2, en: f2 },
      ].map((o) => ({ ro: o.ro, en: o.en || o.ro }));
      const picked = shuffle(rng, rationals).slice(0, 3);
      // the three rational options must differ from each other
      const texts = new Set(picked.map((p) => p.ro));
      if (texts.size < 3) return tfItem(ctx, L(`${root(k * k)} este număr irațional.`, `${root(k * k)} is an irrational number.`), false);
      return build(ctx, {
        prompt: L('Care dintre numerele următoare este irațional?', 'Which of these numbers is irrational?'),
        answer: aT(irr.ro, irr.en),
        wrong: picked.map((p) => aT(p.ro, p.en)),
        only: ['choice'],
      });
    }

    case 'irrationalTf': {
      const truth = chance(rng, 0.5);
      const n = truth ? pick(rng, NON_SQUARES) : randInt(rng, 2, 14) ** 2;
      return tfItem(ctx, L(`${root(n)} este număr irațional.`, `${root(n)} is an irrational number.`), !isSquare(n));
    }

    case 'classify': {
      const kind = pick(rng, ['N', 'Z', 'Q', 'R']);
      let text: string;
      if (kind === 'N') {
        const k = randInt(rng, 1, 12);
        text = pick(rng, [String(randInt(rng, 0, 30)), root(k * k), `${k * 3}/3`]);
      } else if (kind === 'Z') {
        const k = randInt(rng, 2, 12);
        text = pick(rng, [`${MINUS}${randInt(rng, 1, 30)}`, `${MINUS}${root(k * k)}`, `${MINUS}${k * 2}/2`]);
      } else if (kind === 'Q') {
        const sp = randInt(rng, 1, 5);
        const sq = randInt(rng, sp + 1, 9);
        text = pick(rng, [nonIntFrac(rng, 7), decNonInt(rng, 'ro'), `${MINUS}${nonIntFrac(rng, 7)}`, `√(${sp * sp}/${sq * sq})`]);
      } else {
        text = pick(rng, [root(pick(rng, NON_SQUARES.filter((n) => n < 60))), `${MINUS}${root(pick(rng, [2, 3, 5, 7]))}`, 'π']);
      }
      const right = kind === 'N' ? 'ℕ' : kind === 'Z' ? 'ℤ' : kind === 'Q' ? 'ℚ' : 'ℝ';
      // "9/3"-style values equal naturals; ensure the fraction forms are exact
      return build(ctx, {
        prompt: L(`Care este cea mai mică mulțime dintre ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ căreia îi aparține numărul ${text}?`, `What is the smallest set among ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ that contains the number ${text.replace(',', '.')}?`),
        answer: aT(right),
        wrong: ['ℕ', 'ℤ', 'ℚ', 'ℝ'].filter((s) => s !== right).map((s) => aT(s)),
        only: ['choice'],
      });
    }

    case 'simplify': {
      const a = randInt(rng, 2, d <= 2 ? 6 : 10);
      const b = pick(rng, SQUAREFREE);
      const n = a * a * b;
      const right = `${a}√${b}`;
      const wrongs = [`${a * a}√${b}`, `${b}√${a}`, `√${a + b}`, `${a}√${b * 2}`, `${a + 1}√${b}`, `${a}${root(b + 1)}`].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`Scoate factorii de sub radical: ${root(n)} = ?`, `Simplify the radical: ${root(n)} = ?`),
        answer: aT(right),
        wrong: [...new Set(wrongs)].map((w) => aT(w)),
        must: [aT(`${a * a}√${b}`), aT(`${b}√${a}`)],
        only: ['choice', 'tf'],
        tf: (x) => same(`${root(n)} = ${x.ro}`),
      });
    }

    case 'radSum': {
      const b = pick(rng, SQUAREFREE.filter((v) => v <= 7));
      const a1 = randInt(rng, 1, 5);
      const a2 = randInt(rng, 2, 6);
      const sub = chance(rng, 0.3) && a2 > a1;
      const n1 = a1 * a1 * b;
      const n2 = a2 * a2 * b;
      const coefR = sub ? a2 - a1 : a1 + a2;
      const text = sub ? `${root(n2)} ${MINUS} ${root(n1)}` : `${root(n1)} + ${root(n2)}`;
      const right = rc(coefR, b);
      const wrongs = [`√${sub ? n2 - n1 : n1 + n2}`, rc(coefR, b * 2), rc(a1 * a2, b), rc(coefR + 1, b), rc(Math.max(1, sub ? a1 + a2 : Math.abs(a2 - a1) + 1), b)].filter((w) => w !== right);
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aT(right),
        wrong: [...new Set(wrongs)].map((w) => aT(w)),
        must: [aT(wrongs[0])],
        only: ['choice'],
      });
    }

    case 'prodRoot': {
      const a = randInt(rng, 2, 12);
      const s = randInt(rng, 2, 6);
      const x = a;
      const y = a * s * s;
      if (chance(rng, 0.5)) {
        const text = `${root(x)} · ${root(y)}`;
        return build(ctx, {
          prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
          answer: aInt(a * s),
          wrong: [aInt(a * s * s), aInt(x + y), aInt(a + s), aInt(a * a * s), aInt(a * s + 1)].filter((w) => w.int !== a * s && (w.int ?? 0) > 0),
          must: [aInt(a * s * s)].filter((w) => w.int !== a * s),
          gap: same(`${text} = {{gap}}`),
        });
      }
      const k = randInt(rng, 2, 11);
      return build(ctx, {
        prompt: L(`Calculează: (${root(k)})²`, `Work out: (${root(k)})²`),
        answer: aInt(k),
        wrong: [aInt(k * 2), aInt(k * k), aInt(k + 1), aInt(Math.max(1, k - 1))].filter((w) => w.int !== k),
        must: [aInt(k * 2)],
        gap: same(`(${root(k)})² = {{gap}}`),
      });
    }

    case 'compare': {
      if (chance(rng, 0.4)) {
        const m = randInt(rng, 2, 60);
        const n = randInt(rng, 2, 60);
        if (m !== n) {
          const sg = m < n ? '<' : '>';
          return build(ctx, {
            prompt: L(`Compară ${root(m)} și ${root(n)}. Care semn se potrivește?`, `Compare ${root(m)} and ${root(n)}. Which sign fits?`),
            answer: aT(sg),
            wrong: ['<', '>', '='].filter((s) => s !== sg).map((s) => aT(s)),
            gap: same(`${root(m)} {{gap}} ${root(n)}`),
            gapPrompt: L('Alege semnul potrivit.', 'Choose the right sign.'),
            tf: (x) => same(`${root(m)} ${x.ro} ${root(n)}`),
          });
        }
      }
      for (let t = 0; t < 100; t++) {
        const m = pick(rng, NON_SQUARES.filter((v) => v <= 60));
        const k = pick(rng, [1, 2]);
        const p0 = isqrt(m * 10 ** (2 * k));
        const p = chance(rng, 0.5) ? p0 : p0 + 1;
        if (p % 10 === 0) continue;
        const sg = m * 10 ** (2 * k) > p * p ? '>' : '<';
        const ro = decText(p, k, 'ro');
        const en = decText(p, k, 'en');
        return build(ctx, {
          prompt: L(`Compară ${root(m)} și ${ro}. Care semn se potrivește?`, `Compare ${root(m)} and ${en}. Which sign fits?`),
          answer: aT(sg),
          wrong: ['<', '>', '='].filter((s) => s !== sg).map((s) => aT(s)),
          gap: L(`${root(m)} {{gap}} ${ro}`, `${root(m)} {{gap}} ${en}`),
          gapPrompt: L('Alege semnul potrivit.', 'Choose the right sign.'),
        });
      }
      return tfItem(ctx, same('√2 < 2'), true);
    }

    case 'expr': {
      const triples: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15]];
      const [a, b, c] = pick(rng, triples);
      const text = `√(${a * a} + ${b * b})`;
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(c),
        wrong: [aInt(a + b), aInt(a * a + b * b), aInt(c + 1), aInt(Math.abs(a - b)), aInt(c - 1)].filter((w) => w.int !== c && (w.int ?? 0) > 0),
        must: [aInt(a + b)],
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }
  }
};

registerGenerator('sqrt', sqrt);
