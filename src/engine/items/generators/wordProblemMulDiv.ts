/**
 * Multiplication / division word problems for the `word-problem` generator (original Romanian text with
 * English translations). Used when `ops` contains "*" and/or "/":
 *
 *  - repeated groups:      "Într-o cutie sunt 6 mere. Câte mere sunt în 7 cutii?"      (n x k)
 *  - sharing equally:      "Ana împarte în mod egal 42 de mere în 6 cutii. Câte ...?"  (total : n)
 *  - grouping:             "... le pune câte 6 într-o cutie. De câte cutii are nevoie?" (total : k)
 *  - with remainder (params.remainder): "Câte cutii pline poate face?" / "Câte mere rămân?"
 *  - two steps (when "+"/"-" are also allowed, difficulty >= 3): n x k + a, n x k - x, total : n + x
 *
 * All counts are >= 2 so Romanian/English agreement never needs singular forms.
 * Params: factorMax (largest per-group number, default 10), groupsMax (largest number of groups, default 10).
 */
import type { LocalizedText, VisualSpec } from '../../types';
import type { Rng } from './util';
import { chance, paramBool, paramInt, pick, randInt, weighted } from './util';
import { THINGS, type Thing } from './things';
import { roNum } from './numfmt';
import type { Problem } from './wordProblem';

const NAMES = ['Ana', 'Maria', 'Ioana', 'Elena', 'Sofia', 'Daria', 'Andrei', 'Mihai', 'Tudor', 'Radu', 'Luca', 'Matei'];

interface Box {
  /** "Într-o cutie" (sentence start) / "într-o cutie" */
  inOneCap: string;
  into: string;
  pl: string;
  each: string;
  en: string;
  enPl: string;
}

const BOXES: Box[] = [
  { inOneCap: 'Într-o cutie', into: 'într-o cutie', pl: 'cutii', each: 'fiecare cutie', en: 'box', enPl: 'boxes' },
  { inOneCap: 'Într-o pungă', into: 'într-o pungă', pl: 'pungi', each: 'fiecare pungă', en: 'bag', enPl: 'bags' },
  { inOneCap: 'Într-un coș', into: 'într-un coș', pl: 'coșuri', each: 'fiecare coș', en: 'basket', enPl: 'baskets' },
  { inOneCap: 'Într-un pachet', into: 'într-un pachet', pl: 'pachete', each: 'fiecare pachet', en: 'packet', enPl: 'packets' },
];

interface Ctx {
  rng: Rng;
  d: number;
  max: number;
  fMax: number;
  gMax: number;
  n1: string;
  t: Thing;
  b: Box;
}

/** x per group and y groups with x * y + extra <= max, sized by difficulty */
function factors(c: Ctx, extra = 0): { x: number; y: number } {
  const { rng, d, max, fMax, gMax } = c;
  const room = Math.max(8, max - extra);
  const xHi = Math.min(d <= 2 ? (fMax > 10 ? 99 : Math.min(fMax, 6)) : fMax, Math.floor(room / 2));
  const x = randInt(rng, 2, Math.max(2, xHi));
  const yHi = Math.max(2, Math.min(d <= 2 ? Math.min(gMax, fMax > 10 ? 9 : 6) : gMax, Math.floor(room / x)));
  return { x, y: randInt(rng, 2, yHi) };
}

const groupsVisual = (t: Thing, count: number, groups: number, d: number, rng: Rng): VisualSpec | undefined =>
  count <= 30 && d <= 2 && chance(rng, 0.45) ? { kind: 'objects', icon: t.icon, count, groups } : undefined;

function mulOne(c: Ctx): Problem {
  const { rng, t, b, n1 } = c;
  const { x: k, y: n } = factors(c);
  const p = n * k;
  const form = weighted<'A' | 'B' | 'C' | 'D'>(rng, [['A', 30], ['B', 30], ['C', 20], ['D', 20]]);
  const wrong = [p + k, p - k, p + n, p - n, n + k, p + 10, p - 10, p * 10, k * (n + 1), (k + 1) * n];
  let text: LocalizedText;
  let visual: VisualSpec | undefined;
  let thing = t;
  if (form === 'A') {
    text = {
      ro: `${b.inOneCap} sunt ${roNum(k, t.ro)}. Câte ${t.ro} sunt în ${roNum(n, b.pl)}?`,
      en: `Each ${b.en} holds ${k} ${t.en}. How many ${t.en} are there in ${n} ${b.enPl}?`,
    };
    visual = groupsVisual(t, p, n, c.d, rng);
  } else if (form === 'B') {
    text = {
      ro: `${n1} pune în ${b.each} câte ${roNum(k, t.ro)}. Câte ${t.ro} pune în total în ${roNum(n, b.pl)}?`,
      en: `${n1} puts ${k} ${t.en} in each ${b.en}. How many ${t.en} does ${n1} put in ${n} ${b.enPl} altogether?`,
    };
    visual = groupsVisual(t, p, n, c.d, rng);
  } else if (form === 'C') {
    text = {
      ro: `${n1} citește în fiecare zi câte ${roNum(k, 'pagini')}. Câte pagini citește în ${roNum(n, 'zile')}?`,
      en: `${n1} reads ${k} pages every day. How many pages does ${n1} read in ${n} days?`,
    };
  } else {
    text = {
      ro: `În sală sunt ${roNum(n, 'rânduri')} cu câte ${roNum(k, 'scaune')}. Câte scaune sunt în total?`,
      en: `A hall has ${n} rows with ${k} chairs each. How many chairs are there altogether?`,
    };
  }
  return { text, answer: p, wrong, thing, ...(visual ? { visual } : {}) };
}

function divOne(c: Ctx, remainder: boolean): Problem {
  const { rng, t, b, n1 } = c;
  if (remainder) {
    // grouping with a remainder: total = q * k + r
    const { x: k, y: q } = factors(c, c.fMax);
    const r = randInt(rng, 1, k - 1);
    const total = q * k + r;
    const askBoxes = chance(rng, 0.5);
    const base = {
      ro: `${n1} are ${roNum(total, t.ro)} și le pune câte ${k} ${b.into}.`,
      en: `${n1} has ${total} ${t.en} and puts ${k} in each ${b.en}.`,
    };
    return askBoxes
      ? {
          text: { ro: `${base.ro} Câte ${b.pl} pline poate face?`, en: `${base.en} How many full ${b.enPl} can ${n1} make?` },
          answer: q,
          wrong: [q + 1, q - 1, q + 2, r, k, total - k, Math.round(total / 2)],
          thing: t,
        }
      : {
          text: { ro: `${base.ro} Câte ${t.ro} rămân?`, en: `${base.en} How many ${t.en} are left over?` },
          answer: r,
          wrong: [k - r, r + 1, r - 1, q, k, k - 1, r + 2],
          thing: t,
        };
  }
  const { x, y } = factors(c);
  const shareVisual = groupsVisual(t, x * y, y, c.d, rng);
  const form = weighted<'share' | 'group' | 'pages'>(rng, [['share', 40], ['group', 40], ['pages', 20]]);
  const total = x * y;
  const wrong = (q: number, other: number) => [q + 1, q - 1, q + 2, q - 2, total - other, total + other, q * 10, other, Math.max(2, Math.round(total / 10))];
  if (form === 'share') {
    // y boxes, x things in each
    return {
      text: {
        ro: `${n1} împarte în mod egal ${roNum(total, t.ro)} în ${roNum(y, b.pl)}. Câte ${t.ro} pune în ${b.each}?`,
        en: `${n1} shares ${total} ${t.en} equally into ${y} ${b.enPl}. How many ${t.en} go in each ${b.en}?`,
      },
      answer: x,
      wrong: wrong(x, y),
      thing: t,
      ...(shareVisual ? { visual: shareVisual } : {}),
    };
  }
  if (form === 'group') {
    return {
      text: {
        ro: `${n1} are ${roNum(total, t.ro)} și le pune câte ${x} ${b.into}. De câte ${b.pl} are nevoie?`,
        en: `${n1} has ${total} ${t.en} and puts ${x} in each ${b.en}. How many ${b.enPl} does ${n1} need?`,
      },
      answer: y,
      wrong: wrong(y, x),
      thing: t,
    };
  }
  return {
    text: {
      ro: `${n1} a citit ${roNum(total, 'pagini')} în ${roNum(y, 'zile')}, în fiecare zi același număr de pagini. Câte pagini a citit într-o zi?`,
      en: `${n1} read ${total} pages in ${y} days, the same number of pages every day. How many pages did ${n1} read each day?`,
    },
    answer: x,
    wrong: wrong(x, y),
    thing: t,
  };
}

function twoStep(c: Ctx, mulDiv: ('*' | '/')[], additive: string[]): Problem | null {
  const { rng, t, b, n1 } = c;
  type Form = 'mulAdd' | 'mulSub' | 'divAdd';
  const forms: [Form, number][] = [];
  if (mulDiv.includes('*') && additive.includes('+')) forms.push(['mulAdd', 40]);
  if (mulDiv.includes('*') && additive.includes('-')) forms.push(['mulSub', 40]);
  if (mulDiv.includes('/') && additive.includes('+')) forms.push(['divAdd', 40]);
  if (!forms.length) return null;
  const form = weighted(rng, forms);
  const { x: k, y: n } = factors(c, form === 'mulAdd' ? Math.round(c.max / 5) + 2 : 0);
  const p = n * k;
  if (form === 'mulAdd') {
    const a = randInt(rng, 2, Math.max(2, Math.min(c.max - p, Math.round(c.max / 5))));
    const ans = a + p;
    return {
      text: {
        ro: `${n1} are ${roNum(a, t.ro)}. Mai cumpără ${roNum(n, b.pl)} cu câte ${roNum(k, t.ro)}. Câte ${t.ro} are acum?`,
        en: `${n1} has ${a} ${t.en}. ${n1} buys ${n} more ${b.enPl} with ${k} ${t.en} in each. How many ${t.en} does ${n1} have now?`,
      },
      answer: ans,
      wrong: [p, ans + 1, ans - 1, a + n + k, ans + 10, ans - 10, a * k],
      thing: t,
    };
  }
  if (form === 'mulSub') {
    const x = randInt(rng, 2, Math.max(2, Math.floor(p / 2)));
    const ans = p - x;
    return {
      text: {
        ro: `La un magazin sosesc ${roNum(n, b.pl)} cu câte ${roNum(k, t.ro)}. Se vând ${roNum(x, t.ro)}. Câte ${t.ro} au rămas?`,
        en: `A shop receives ${n} ${b.enPl} with ${k} ${t.en} in each. ${x} ${t.en} are sold. How many ${t.en} are left?`,
      },
      answer: ans,
      wrong: [p, p + x, ans + 1, ans - 1, ans + 10, ans - 10, n * k - k],
      thing: t,
    };
  }
  const x = randInt(rng, 2, Math.max(2, Math.min(20, Math.round(k))));
  const ans = k + x;
  return {
    text: {
      ro: `${n1} împarte în mod egal ${roNum(p, t.ro)} în ${roNum(n, b.pl)}. Apoi mai pune în ${b.each} câte ${roNum(x, t.ro)}. Câte ${t.ro} sunt acum în ${b.each}?`,
      en: `${n1} shares ${p} ${t.en} equally into ${n} ${b.enPl}. Then ${n1} adds ${x} more ${t.en} to each ${b.en}. How many ${t.en} are in each ${b.en} now?`,
    },
    answer: ans,
    wrong: [k, p, ans + 1, ans - 1, p + x, n + x, ans + 10],
    thing: t,
  };
}

export function mulDivProblem(
  rng: Rng,
  params: Record<string, unknown>,
  d: number,
  mulDiv: ('*' | '/')[],
  additive: string[],
  wantTwoStep: boolean,
  max: number,
): Problem {
  const c: Ctx = {
    rng,
    d,
    max: Math.max(30, max),
    fMax: Math.max(3, paramInt(params, 'factorMax', 10)),
    gMax: Math.max(3, paramInt(params, 'groupsMax', 10)),
    n1: pick(rng, NAMES),
    t: pick(rng, THINGS),
    b: pick(rng, BOXES),
  };
  if (wantTwoStep) {
    const two = twoStep(c, mulDiv, additive);
    if (two) return two;
  }
  const op = pick(rng, mulDiv);
  return op === '*' ? mulOne(c) : divOne(c, paramBool(params, 'remainder') === true);
}
