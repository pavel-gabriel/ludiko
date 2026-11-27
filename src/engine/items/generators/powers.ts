/**
 * `powers` generator (grades V-VII). params:
 *   modes: any of 'eval' | 'special' | 'pow10' | 'expFind' | 'compare' | 'orderOps' |
 *                 'product' | 'quotient' | 'power' | 'neg' | 'intExp'
 *
 * Exponents are written with superscripts ("2⁵", "10⁻²") in the text. All values are exact integers
 * (or exact reduced fractions for negative exponents). Classic mistakes used as distractors: a·n instead of
 * aⁿ, multiplying exponents when multiplying powers, adding them for a power of a power, wrong sign of
 * (−a)ⁿ, ignoring precedence in an expression with powers.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt, shuffle } from './util';
import { aInt, aT, build, evalFlat, L, MINUS, OP_SYM, sInt, sup, type Ans, type Op } from './mathKit';
import { fr, frText } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['eval', 'special', 'pow10', 'expFind', 'compare', 'orderOps', 'product', 'quotient', 'power', 'neg', 'intExp'] as const;
type Mode = (typeof MODES)[number];

/** exact integer power (callers keep results below 2^53) */
export const ipow = (a: number, n: number): number => {
  let r = 1;
  for (let i = 0; i < n; i++) r *= a;
  return r;
};

const SIGNS = ['<', '>', '='];

interface Atom {
  text: string;
  value: number;
  /** value if the exponent is (wrongly) read as a multiplication */
  slip?: number;
}

/** Atoms of an expression with powers: number, power, or parenthesised power */
function atom(rng: () => number, d: number): Atom {
  const kind = d >= 3 ? pick(rng, ['num', 'pow', 'pow', 'par']) : pick(rng, ['num', 'pow', 'pow']);
  if (kind === 'num') {
    const n = randInt(rng, 2, 12);
    return { text: String(n), value: n };
  }
  if (kind === 'pow') {
    const a = randInt(rng, 2, 5);
    const e = randInt(rng, 2, a <= 3 ? 4 : 3);
    return { text: `${a}${sup(e)}`, value: ipow(a, e), slip: a * e };
  }
  const x = randInt(rng, 5, 9);
  const y = randInt(rng, 1, 4);
  const e = randInt(rng, 2, 3);
  return { text: `(${x} − ${y})${sup(e)}`, value: ipow(x - y, e), slip: (x - y) * e };
}

/** Left-to-right style strictness: every addition/subtraction step stays non-negative */
function strictValue(vals: number[], ops: Op[]): number | null {
  const terms: number[] = [vals[0]];
  const adds: Op[] = [];
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === '*' || ops[i] === '/') {
      const last = terms[terms.length - 1];
      const v = evalFlat([last, vals[i + 1]], [ops[i]], 'ltr');
      if (v === null) return null;
      terms[terms.length - 1] = v;
    } else {
      adds.push(ops[i]);
      terms.push(vals[i + 1]);
    }
  }
  let acc = terms[0];
  for (let i = 0; i < adds.length; i++) {
    acc = adds[i] === '+' ? acc + terms[i + 1] : acc - terms[i + 1];
    if (acc < 0) return null;
  }
  return acc;
}

export const powers: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['eval']).filter((m): m is Mode =>
    (MODES as readonly string[]).includes(m),
  );
  const mode = pick(rng, modes.length ? modes : (['eval'] as Mode[]));

  switch (mode) {
    case 'eval': {
      const a = randInt(rng, 2, d <= 1 ? 6 : 10);
      const n = randInt(rng, 2, d <= 1 ? 3 : a <= 3 ? 7 : a <= 5 ? 5 : 4);
      const v = ipow(a, n);
      const expr = `${a}${sup(n)}`;
      const wrongs = [a * n, ipow(a, n - 1), ipow(a, n + 1), ipow(n, a), a + n, v - a, v + a].filter((w) => w !== v && w > 0 && w <= 999999);
      return build(ctx, {
        prompt: L(`Calculează: ${expr}`, `Work out: ${expr}`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: [aInt(a * n)].filter((w) => w.int !== v),
        gap: same(`${expr} = {{gap}}`),
        tf: (x) => same(`${expr} = ${x.ro}`),
      });
    }

    case 'special': {
      const a = randInt(rng, 2, 12);
      const kind = pick(rng, ['zero', 'one', 'baseOne', 'baseZero']);
      const [text, v, wrongs] =
        kind === 'zero' ? [`${a}⁰`, 1, [0, a, a * 0 + 2]]
        : kind === 'one' ? [`${a}¹`, a, [1, a + 1, a * a]]
        : kind === 'baseOne' ? [`1${sup(a)}`, 1, [a, 0, 2]]
        : [`0${sup(randInt(rng, 2, 9))}`, 0, [1, 2, 9]];
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(v as number),
        wrong: (wrongs as number[]).filter((w) => w !== v).map(aInt),
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'pow10': {
      const n = randInt(rng, 2, d <= 1 ? 4 : 6);
      const v = ipow(10, n);
      if (chance(rng, 0.4)) {
        return build(ctx, {
          prompt: L(`Câte zerouri are numărul 10${sup(n)} scris cu cifre?`, `How many zeros does 10${sup(n)} have when written in digits?`),
          answer: aInt(n),
          wrong: [aInt(n + 1), aInt(n - 1), aInt(n * 10 > 99 ? n + 2 : n * 10), aInt(n * 2)].filter((w) => w.int !== n && (w.int ?? 0) > 0),
          gap: same(`10${sup(n)} are {{gap}} zerouri`),
        });
      }
      return build(ctx, {
        prompt: L(`Calculează: 10${sup(n)}`, `Work out: 10${sup(n)}`),
        answer: aInt(v),
        wrong: [aInt(10 * n), aInt(v / 10), aInt(v * 10), aInt(ipow(n, 10) > 999999 ? v + n : ipow(n, 10)), aInt(n)].filter((w) => w.int !== v),
        must: [aInt(10 * n)],
        gap: same(`10${sup(n)} = {{gap}}`),
      });
    }

    case 'expFind': {
      const a = pick(rng, [2, 2, 3, 3, 4, 5, 6, 7, 10]);
      const n = randInt(rng, 2, a === 2 ? 9 : a <= 4 ? 5 : 4);
      const v = ipow(a, n);
      return build(ctx, {
        prompt: L(`Află exponentul n din egalitatea ${a}ⁿ = ${sInt(v)}.`, `Find the exponent n in ${a}ⁿ = ${sInt(v)}.`),
        answer: aInt(n),
        wrong: [aInt(n + 1), aInt(n - 1), aInt(Math.floor(v / a)), aInt(n * 2), aInt(a)].filter((w) => w.int !== n && (w.int ?? 0) > 0),
        gap: same(`${a}${'^'}{{gap}} = ${sInt(v)}`),
        gapPrompt: L('Află exponentul (n).', 'Find the exponent (n).'),
        tf: (x) => same(`${a}${sup(x.ro)} = ${sInt(v)}`),
      });
    }

    case 'compare': {
      let a = 2;
      let m = 3;
      let b = 3;
      let n = 2;
      for (let t = 0; t < 60; t++) {
        a = randInt(rng, 2, 6);
        m = randInt(rng, 2, 5);
        b = randInt(rng, 2, 9);
        n = randInt(rng, 2, 5);
        if (a !== b && ipow(a, m) <= 100000 && ipow(b, n) <= 100000) break;
      }
      const x = ipow(a, m);
      const y = ipow(b, n);
      const sg = x < y ? '<' : x > y ? '>' : '=';
      const L1 = `${a}${sup(m)}`;
      const L2 = `${b}${sup(n)}`;
      return build(ctx, {
        prompt: L(`Compară ${L1} și ${L2}. Care semn se potrivește?`, `Compare ${L1} and ${L2}. Which sign fits?`),
        answer: aT(sg),
        wrong: SIGNS.filter((s) => s !== sg).map((s) => aT(s)),
        gap: same(`${L1} {{gap}} ${L2}`),
        gapPrompt: L('Alege semnul potrivit.', 'Choose the right sign.'),
        tf: (s) => same(`${L1} ${s.ro} ${L2}`),
      });
    }

    case 'orderOps': {
      const count = d <= 2 ? 3 : 4;
      for (let t = 0; t < 200; t++) {
        const atoms = Array.from({ length: count }, () => atom(rng, d));
        if (!atoms.some((x) => x.slip)) continue;
        const ops = Array.from({ length: count - 1 }, () => pick(rng, ['+', '-', '*', '*', '/'] as Op[]));
        if (!ops.some((o) => o === '+' || o === '-') || !ops.some((o) => o === '*' || o === '/')) continue;
        const vals = atoms.map((x) => x.value);
        const right = strictValue(vals, ops);
        if (right === null || right > 99999) continue;
        const naive = evalFlat(vals, ops, 'ltr');
        const slipIdx = atoms.findIndex((x) => x.slip !== undefined && x.slip !== x.value);
        const slipVals = vals.map((v, i) => (i === slipIdx ? (atoms[i].slip as number) : v));
        const slip = slipIdx >= 0 ? strictValue(slipVals, ops) : null;
        const wrongs = [naive, slip, right + 1, right - 1, right + 10].filter((w): w is number => w !== null && w >= 0 && w !== right);
        if (wrongs.length < 3) continue;
        const text = atoms.map((x, i) => (i === 0 ? x.text : `${OP_SYM[ops[i - 1]]} ${x.text}`)).join(' ');
        return build(ctx, {
          prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
          answer: aInt(right),
          wrong: wrongs.map(aInt),
          must: [naive, slip].filter((w): w is number => w !== null && w >= 0 && w !== right).map(aInt),
          gap: same(`${text} = {{gap}}`),
          tf: (x) => same(`${text} = ${x.ro}`),
        });
      }
      return build(ctx, { prompt: L('Calculează: 2 + 3² · 4', 'Work out: 2 + 3² · 4'), answer: aInt(38), wrong: [aInt(180), aInt(44), aInt(26)] });
    }

    case 'product':
    case 'quotient':
    case 'power': {
      const a = pick(rng, [2, 3, 4, 5, 6, 7, 10]);
      let m = randInt(rng, 2, 7);
      let n = randInt(rng, 2, 6);
      let text: string;
      let e: number;
      let wrongE: number[];
      if (mode === 'product') {
        text = `${a}${sup(m)} · ${a}${sup(n)}`;
        e = m + n;
        wrongE = [m * n, Math.abs(m - n), e - 1, e + 1];
      } else if (mode === 'quotient') {
        if (m <= n) [m, n] = [n + 1, m];
        text = `${a}${sup(m)} : ${a}${sup(n)}`;
        e = m - n;
        wrongE = [m + n, Math.floor(m / n) === m / n ? m / n : m * n, e + 1, e - 1];
      } else {
        m = randInt(rng, 2, 4);
        n = randInt(rng, 2, 4);
        text = `(${a}${sup(m)})${sup(n)}`;
        e = m * n;
        wrongE = [m + n, ipow(m, n), e + 1, e - 1];
      }
      const wrongPows = shuffle(rng, wrongE).filter((w) => w > 0 && w !== e);
      if (chance(rng, 0.5)) {
        return build(ctx, {
          prompt: L(`Află numărul n din egalitatea ${text} = ${a}ⁿ.`, `Find n in ${text} = ${a}ⁿ.`),
          answer: aInt(e),
          wrong: wrongE.filter((w) => w > 0 && w !== e).map(aInt),
          must: [aInt(wrongE[0])].filter((w) => w.int !== e),
          gap: same(`${text} = ${a}^{{gap}}`),
          gapPrompt: L('Află exponentul (n).', 'Find the exponent (n).'),
        });
      }
      return build(ctx, {
        prompt: L(`Scrie ca putere: ${text}`, `Write as a single power: ${text}`),
        answer: aT(`${a}${sup(e)}`),
        wrong: [...wrongPows.map((w) => aT(`${a}${sup(w)}`)), aT(`${a * a}${sup(e)}`)],
        must: wrongPows.slice(0, 1).map((w) => aT(`${a}${sup(w)}`)),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'neg': {
      const a = randInt(rng, 2, 5);
      const n = randInt(rng, 2, a <= 3 ? 5 : 4);
      const paren = chance(rng, 0.6);
      const text = paren ? `(${MINUS}${a})${sup(n)}` : `${MINUS}${a}${sup(n)}`;
      const v = paren ? (n % 2 === 0 ? ipow(a, n) : -ipow(a, n)) : -ipow(a, n);
      const wrongs = [-v, ipow(a, n), -ipow(a, n), a * n, -a * n, v + (v > 0 ? a : -a)].filter((w) => w !== v);
      return build(ctx, {
        prompt: L(`Calculează: ${text}`, `Work out: ${text}`),
        answer: aInt(v),
        wrong: wrongs.map(aInt),
        must: [aInt(-v)],
        gap: same(`${text} = {{gap}}`),
        tf: (x) => same(`${text} = ${x.ro}`),
      });
    }

    case 'intExp': {
      const n = randInt(rng, 1, 3);
      if (chance(rng, 0.35)) {
        const p = n === 1 ? 2 : n;
        const v = fr(1, ipow(10, p));
        const dec = `0,${'0'.repeat(p - 1)}1`;
        const decEn = `0.${'0'.repeat(p - 1)}1`;
        void v;
        return build(ctx, {
          prompt: L(`Scrie ca număr zecimal: 10${sup(-p)}`, `Write as a decimal: 10${sup(-p)}`),
          answer: { ro: dec, en: decEn },
          wrong: [
            { ro: `0,${'0'.repeat(p)}1`, en: `0.${'0'.repeat(p)}1` },
            { ro: `0,${'0'.repeat(Math.max(0, p - 2))}1`, en: `0.${'0'.repeat(Math.max(0, p - 2))}1` },
            { ro: `${MINUS}${ipow(10, p)}`, en: `${MINUS}${ipow(10, p)}` },
            { ro: `${MINUS}0,${'0'.repeat(p - 1)}1`, en: `${MINUS}0.${'0'.repeat(p - 1)}1` },
          ].filter((w) => w.ro !== dec),
          only: ['choice'],
        });
      }
      const a = randInt(rng, 2, d <= 2 ? 5 : 7);
      const e = randInt(rng, 1, 3);
      const base = chance(rng, 0.7) ? { text: `${a}`, inv: fr(1, ipow(a, e)) } : { text: `(1/${a})`, inv: fr(ipow(a, e), 1) };
      const exprText = `${base.text}${sup(-e)}`;
      const right: Ans = base.inv.d === 1 ? aInt(base.inv.n) : aT(frText(base.inv));
      const otherBase = base.text.startsWith('(') ? ipow(a, e) : ipow(a, e);
      const wrongs: Ans[] = [
        aT(`${MINUS}${ipow(a, e)}`), aT(`${MINUS}${a * e}`), aT(`1/${a * e}`), aT(String(otherBase)),
        aT(`${MINUS}1/${ipow(a, e)}`), aT(`1/${ipow(a, e)}`), aT(String(a * e)),
      ].filter((w) => w.ro !== right.ro);
      return build(ctx, {
        prompt: L(`Calculează: ${exprText}`, `Work out: ${exprText}`),
        answer: right,
        wrong: wrongs,
        must: wrongs.slice(0, 1),
        tf: (x) => same(`${exprText} = ${x.ro}`),
      });
    }
  }
};

registerGenerator('powers', powers);
