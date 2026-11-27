/**
 * `probability` generator (grades VII-VIII): classical probability = favourable / possible cases. params:
 *   scenarios: any of 'urn' | 'die' | 'numbers' | 'dice2' | 'coins'
 *   asks:      any of 'prob' | 'fav' | 'total' | 'percent' | 'complement'
 *
 * The favourable and possible cases are COUNTED by code (predicates over the sample space), the probability is the
 * reduced fraction. The urn scenario draws the balls on a `grid` visual. Distractors: odds (favourable / unfavourable),
 * the complement, the inverse fraction, an unreduced fraction, favourable / (possible + 1).
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L } from './mathKit';
import { fr, frText, gcd, isPrime, isSquare, rawFrText } from './rational';

const same = (s: string) => L(s, s);
const SCENARIOS = ['urn', 'die', 'numbers', 'dice2', 'coins'] as const;
const ASKS = ['prob', 'fav', 'total', 'percent', 'complement'] as const;
type Scenario = (typeof SCENARIOS)[number];
type Ask = (typeof ASKS)[number];

interface Sc {
  /** "…Se extrage o bilă." (without the question) */
  setup: ReturnType<typeof L>;
  /** "să fie roșie" */
  event: ReturnType<typeof L>;
  notEvent: ReturnType<typeof L>;
  fav: number;
  total: number;
  visual?: VisualSpec;
}

const DIE_EVENTS: { ro: string; en: string; test: (n: number) => boolean }[] = [
  { ro: 'un număr par', en: 'an even number', test: (n) => n % 2 === 0 },
  { ro: 'un număr impar', en: 'an odd number', test: (n) => n % 2 === 1 },
  { ro: 'un număr mai mare decât 4', en: 'a number greater than 4', test: (n) => n > 4 },
  { ro: 'un număr mai mic decât 3', en: 'a number less than 3', test: (n) => n < 3 },
  { ro: 'un divizor al lui 6', en: 'a divisor of 6', test: (n) => 6 % n === 0 },
  { ro: 'un număr prim', en: 'a prime number', test: isPrime },
  { ro: 'un multiplu de 3', en: 'a multiple of 3', test: (n) => n % 3 === 0 },
];

function scenario(rng: () => number, kind: Scenario): Sc {
  if (kind === 'urn') {
    const counts = [randInt(rng, 1, 6), randInt(rng, 1, 6), randInt(rng, 0, 5)];
    const total = counts.reduce((s, c) => s + c, 0);
    const colours = [
      { ro: 'roșie', en: 'red', roN: 'roșii', enN: 'red', icon: '🔴' },
      { ro: 'albastră', en: 'blue', roN: 'albastre', enN: 'blue', icon: '🔵' },
      { ro: 'verde', en: 'green', roN: 'verzi', enN: 'green', icon: '🟢' },
    ];
    const idx = pick(rng, counts[2] > 0 ? [0, 1, 2] : [0, 1]);
    const useOr = chance(rng, 0.25) && counts[2] > 0;
    const fav = useOr ? counts[0] + counts[1] : counts[idx];
    const list = counts.map((c, i) => (c > 0 ? `${c} ${colours[i].roN}` : '')).filter(Boolean);
    const listEn = counts.map((c, i) => (c > 0 ? `${c} ${colours[i].enN}` : '')).filter(Boolean);
    const cells = shuffle(rng, counts.flatMap((c, i) => Array.from({ length: c }, () => colours[i].icon)));
    // no empty cells (they would be drawn as dashed "?" boxes): one strip, or two equal rows
    const rows = total <= 10 ? 1 : 2;
    const cols = rows === 1 ? total : total / 2;
    const drawable = total <= 10 || total % 2 === 0;
    return {
      setup: L(`O urnă conține bile ${list.join(', ')}. Se extrage la întâmplare o bilă.`, `An urn holds ${listEn.join(', ')} balls. One ball is drawn at random.`),
      event: useOr ? L('să fie roșie sau albastră', 'the ball is red or blue') : L(`să fie ${colours[idx].ro}`, `the ball is ${colours[idx].en}`),
      notEvent: useOr ? L('să fie verde', 'the ball is green') : L(`să nu fie ${colours[idx].ro}`, `the ball is not ${colours[idx].en}`),
      fav,
      total,
      visual: drawable ? { kind: 'grid', rows, cols, cells } : undefined,
    };
  }
  if (kind === 'die') {
    const e = pick(rng, DIE_EVENTS);
    const fav = [1, 2, 3, 4, 5, 6].filter(e.test).length;
    return { setup: L('Se aruncă un zar obișnuit, cu fețele numerotate de la 1 la 6.', 'A normal die with faces 1 to 6 is rolled.'), event: L(`să se obțină ${e.ro}`, `the result is ${e.en}`), notEvent: L(`să nu se obțină ${e.ro}`, `the result is not ${e.en}`), fav, total: 6 };
  }
  if (kind === 'numbers') {
    const N = pick(rng, [10, 12, 15, 20]);
    const k = pick(rng, [2, 3, 4, 5, 6]);
    const events = [
      { ro: `multiplu de ${k}`, en: `a multiple of ${k}`, test: (n: number) => n % k === 0 },
      { ro: 'număr prim', en: 'a prime number', test: isPrime },
      { ro: 'pătrat perfect', en: 'a perfect square', test: isSquare },
      { ro: `divizor al lui ${N}`, en: `a divisor of ${N}`, test: (n: number) => N % n === 0 },
    ];
    const e = pick(rng, events);
    const fav = Array.from({ length: N }, (_, i) => i + 1).filter(e.test).length;
    return { setup: L(`Se alege la întâmplare un număr natural de la 1 la ${N}.`, `A natural number from 1 to ${N} is chosen at random.`), event: L(`ca numărul ales să fie ${e.ro}`, `the chosen number is ${e.en}`), notEvent: L(`ca numărul ales să nu fie ${e.ro}`, `the chosen number is not ${e.en}`), fav, total: N };
  }
  if (kind === 'dice2') {
    const s = randInt(rng, 3, 11);
    let fav = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === s) fav++;
    return { setup: L('Se aruncă două zaruri obișnuite.', 'Two normal dice are rolled.'), event: L(`ca suma numerelor obținute să fie ${s}`, `the sum of the two numbers is ${s}`), notEvent: L(`ca suma numerelor obținute să nu fie ${s}`, `the sum of the two numbers is not ${s}`), fav, total: 36 };
  }
  const n = chance(rng, 0.7) ? 2 : 3;
  const outcomes = Array.from({ length: 2 ** n }, (_, i) => Array.from({ length: n }, (_, j) => (i >> j) & 1));
  const events = [
    { ro: 'de două ori stema', en: 'two heads', test: (o: number[]) => o.every((x) => x === 1) },
    { ro: 'cel puțin o dată stema', en: 'at least one head', test: (o: number[]) => o.some((x) => x === 1) },
    { ro: 'exact o dată stema', en: 'exactly one head', test: (o: number[]) => o.filter((x) => x === 1).length === 1 },
  ];
  const e = pick(rng, events);
  const fav = outcomes.filter(e.test).length;
  const words = n === 2 ? ['două monede', 'two coins'] : ['trei monede', 'three coins'];
  const ev = n === 2 ? e : { ro: e.ro.replace('de două ori', 'de trei ori'), en: e.en.replace('two heads', 'three heads'), test: e.test };
  return { setup: L(`Se aruncă ${words[0]}.`, `${words[1][0].toUpperCase()}${words[1].slice(1)} are tossed.`), event: L(`să apară ${ev.ro}`, `you get ${ev.en}`), notEvent: L(`să nu apară ${ev.ro}`, `you do not get ${ev.en}`), fav, total: 2 ** n };
}

export const probability: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const scs = (Array.isArray(params.scenarios) ? (params.scenarios as string[]) : ['urn', 'die']).filter((s): s is Scenario => (SCENARIOS as readonly string[]).includes(s));
  const asks = (Array.isArray(params.asks) ? (params.asks as string[]) : ['prob']).filter((s): s is Ask => (ASKS as readonly string[]).includes(s));
  let sc: Sc;
  for (let t = 0; ; t++) {
    sc = scenario(rng, pick(rng, scs.length ? scs : (['urn'] as Scenario[])));
    if (sc.fav > 0 && sc.fav < sc.total) break;
    if (t > 50) throw new Error('no scenario');
  }
  const fav = sc.fav;
  const total = sc.total;
  let ask: Ask = pick(rng, asks.length ? asks : (['prob'] as Ask[]));
  if (ask === 'percent' && (fav * 100) % total !== 0) ask = 'prob';
  const visual = d <= 2 ? sc.visual : undefined;

  if (ask === 'fav' || ask === 'total') {
    const ans = ask === 'fav' ? fav : total;
    return build(ctx, {
      prompt: L(`${sc.setup.ro} Câte cazuri ${ask === 'fav' ? 'favorabile' : 'posibile'} există pentru evenimentul „${sc.event.ro}”?`, `${sc.setup.en} How many ${ask === 'fav' ? 'favourable' : 'possible'} cases are there for the event “${sc.event.en}”?`),
      visual,
      answer: aInt(ans),
      wrong: [aInt(ask === 'fav' ? total - fav : fav), aInt(ans + 1), aInt(Math.max(1, ans - 1)), aInt(total + fav), aInt(ans * 2)].filter((w) => w.int !== ans),
      must: [aInt(ask === 'fav' ? total - fav : fav)].filter((w) => w.int !== ans),
    });
  }

  if (ask === 'percent') {
    const pct = (fav * 100) / total;
    return build(ctx, {
      prompt: L(`${sc.setup.ro} Care este probabilitatea (în procente) ${sc.event.ro}?`, `${sc.setup.en} What is the probability, as a percent, that ${sc.event.en}?`),
      visual,
      answer: aInt(pct),
      wrong: [aInt(100 - pct), aInt(fav), aInt(Math.round(100 / fav)), aInt(pct + 10), aInt(Math.max(1, pct - 10))].filter((w) => w.int !== pct && (w.int ?? 0) > 0),
      must: [aInt(100 - pct)].filter((w) => w.int !== pct),
    });
  }

  const favN = ask === 'complement' ? total - fav : fav;
  const p = fr(favN, total);
  const ev = ask === 'complement' ? sc.notEvent : sc.event;
  const wrongs = [fr(favN, total - favN), fr(total - favN, total), fr(total, favN), fr(favN, total + 1), fr(favN + 1, total)].filter((w) => !(w.n === p.n && w.d === p.d));
  const seen = new Set<string>();
  const uniq = wrongs.filter((w) => !seen.has(frText(w)) && seen.add(frText(w)));
  const raw = gcd(favN, total) > 1 ? [aT(rawFrText(favN, total))] : [];
  const odds = fr(favN, total - favN);
  return build(ctx, {
    prompt: L(`${sc.setup.ro} Care este probabilitatea ${ev.ro}? Scrie fracția ireductibilă.`, `${sc.setup.en} What is the probability that ${ev.en}? Write the fraction in lowest terms.`),
    visual,
    answer: aT(frText(p)),
    wrong: [...raw, ...uniq.map((w) => aT(frText(w)))],
    must: [...raw, aT(frText(odds))].filter((w) => w.ro !== frText(p)),
    tf: (x) => L(`${sc.setup.ro} Probabilitatea ${ev.ro} este ${x.ro}.`, `${sc.setup.en} The probability that ${ev.en} is ${x.ro}.`),
    tfWrong: uniq.map((w) => aT(frText(w))),
    gap: same(`P = {{gap}}`),
    gapPrompt: L(`${sc.setup.ro} Probabilitatea ${ev.ro} (fracție ireductibilă):`, `${sc.setup.en} The probability that ${ev.en} (lowest terms):`),
  });
};

registerGenerator('probability', probability);
