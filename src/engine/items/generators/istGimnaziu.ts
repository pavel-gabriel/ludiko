/**
 * History gimnaziu (`ist`, grades V-VIII) generators — all content comes from content/data/ist/*-gimnaziu.json.
 *   `ist-events`  built from the curated events dataset (params: { tags: string[] }): chronological ordering,
 *                 "which came first / last", century of an event, year of an event (choice and fill-gap),
 *                 years between two events (number input on a number line)
 *   `ist-gim`     true/false statements, term/person matches, curated questions and two-group sorting (params: { tags })
 * Everything is deterministic for a given rng; answers are computed from the event years, never stored.
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, MatchItem, NumberInputItem, OrderItem, SortItem, TrueFalseItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import {
  DEEP_YEAR, GIM_CHOICES, GIM_EVENTS, GIM_FACTS, GIM_PAIRS, GIM_SORTS, type GimEvent,
} from './istGimData';
import { centuryLabelEn, centuryLabelRo, centuryNumber, formatYear } from './istTime';
import { baseFields, chance, paramStrings, pick, shuffle, weighted, type Rng } from './util';

const byYear = (a: GimEvent, b: GimEvent) => a.year - b.year;
const opt = (id: string, ro: string, en?: string): CardContent => ({ id, text: en ? { ro, en } : { ro } });

function eventsFor(tags: string[]): GimEvent[] {
  return GIM_EVENTS.filter((e) => e.tags.some((t) => tags.includes(t)));
}

/** One event per distinct year (the first of a shuffle), so an ordering can never contain a tie */
function distinctYears(rng: Rng, pool: readonly GimEvent[]): GimEvent[] {
  const seen = new Set<number>();
  const out: GimEvent[] = [];
  for (const e of shuffle(rng, pool)) {
    if (seen.has(e.year)) continue;
    seen.add(e.year);
    out.push(e);
  }
  return out;
}

/** k events with distinct years, preferably at least `minGap` years apart; sorted oldest first */
function pickSpaced(rng: Rng, pool: readonly GimEvent[], k: number, minGap: number): GimEvent[] {
  const uniq = distinctYears(rng, pool);
  const want = Math.min(k, uniq.length);
  for (let t = 0; t < 40; t++) {
    const picked = shuffle(rng, uniq).slice(0, want).sort(byYear);
    if (picked.every((e, i) => i === 0 || e.year - picked[i - 1].year >= minGap)) return picked;
  }
  return shuffle(rng, uniq).slice(0, want).sort(byYear);
}

const label = (e: GimEvent, withYear: boolean) => ({
  ro: withYear ? `${e.ro} (${formatYear(e.year, 'ro')})` : e.ro,
  en: withYear ? `${e.en} (${formatYear(e.year, 'en')})` : e.en,
});

/** Century questions are only safe for events whose year is not near a century boundary when approximate */
const centuryOk = (e: GimEvent) => e.year > DEEP_YEAR && (!e.approx || (Math.abs(e.year) % 100 >= 10 && Math.abs(e.year) % 100 <= 90));
const yearOk = (e: GimEvent) => e.year > DEEP_YEAR;

/* ---- modes -------------------------------------------------------------- */

type Ctx = Parameters<GeneratorFn>[1];

function orderItem(ctx: Ctx, pool: GimEvent[]): Item {
  const { rng, difficulty: d } = ctx;
  const k = d <= 2 ? 3 : d === 3 ? 4 : 5;
  const picked = pickSpaced(rng, pool, k, d <= 3 ? 5 : 1);
  const cards = picked.map((e) => ({ id: `e_${e.id}`, text: label(e, d <= 1) }));
  const item: OrderItem = {
    ...baseFields(ctx, {
      ro: 'Pune evenimentele în ordine cronologică, de la cel mai vechi la cel mai nou.',
      en: 'Put the events in chronological order, from the oldest to the newest.',
    }),
    type: 'order',
    cards: shuffle(rng, cards),
    correctOrder: cards.map((c) => c.id),
  };
  return item;
}

function firstItem(ctx: Ctx, pool: GimEvent[]): Item {
  const { rng, difficulty: d } = ctx;
  const picked = pickSpaced(rng, pool, d <= 2 ? 2 : 3, 5);
  const last = d >= 3 && chance(rng, 0.4);
  const target = last ? picked[picked.length - 1] : picked[0];
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: last ? 'Care eveniment a avut loc cel mai târziu?' : 'Care eveniment a avut loc primul?',
      en: last ? 'Which event happened the latest?' : 'Which event happened first?',
    }),
    type: 'choice',
    options: shuffle(rng, picked).map((e) => opt(`e_${e.id}`, e.ro, e.en)),
    correctId: `e_${target.id}`,
  };
  return item;
}

function centuryItem(ctx: Ctx, pool: GimEvent[]): Item {
  const { rng, difficulty: d } = ctx;
  const e = pick(rng, pool.filter(centuryOk));
  const bc = e.year < 0;
  const n = centuryNumber(e.year);
  const cands: { n: number; bc: boolean }[] = [];
  for (const dn of [-1, 1, -2, 2, 3]) if (n + dn >= 1 && (bc || n + dn <= 21)) cands.push({ n: n + dn, bc });
  if (d >= 3 && (bc || n <= 21)) cands.push({ n, bc: !bc }); // same number, wrong era
  const total = d <= 1 ? 3 : 4;
  const wrong = shuffle(rng, cands).slice(0, total - 1);
  const all = shuffle(rng, [{ n, bc }, ...wrong]);
  const mixed = all.some((o) => o.bc !== bc);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `În ce secol a avut loc evenimentul „${e.ro}”?${e.approx ? ' (aproximativ)' : ''}`,
      en: `In which century did this event happen: “${e.en}”?${e.approx ? ' (approximately)' : ''}`,
    }),
    type: 'choice',
    options: all.map((o) => opt(`c${o.bc ? 'b' : 'a'}${o.n}`, centuryLabelRo(o.n, o.bc, mixed), centuryLabelEn(o.n, o.bc, mixed))),
    correctId: `c${bc ? 'b' : 'a'}${n}`,
  };
  return item;
}

/** distinct positive magnitudes near `abs`, never equal to it */
function yearDistractors(rng: Rng, abs: number, count: number): number[] {
  const steps = abs < 60 ? [1, 2, 3, 5, 8, 10] : abs < 1000 ? [5, 10, 15, 20, 30, 50, 100] : [3, 5, 10, 20, 30, 50, 100];
  const cands = steps.flatMap((s) => [abs + s, abs - s]).filter((y) => y > 0);
  return shuffle(rng, [...new Set(cands)]).slice(0, count);
}

function yearItem(ctx: Ctx, pool: GimEvent[]): Item {
  const { rng, difficulty: d } = ctx;
  const e = pick(rng, pool.filter(yearOk));
  const sign = Math.sign(e.year);
  const abs = Math.abs(e.year);
  const ys = [abs, ...yearDistractors(rng, abs, d <= 1 ? 2 : 3)].sort((a, b) => (sign < 0 ? b - a : a - b));
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `În ce an a avut loc evenimentul „${e.ro}”?${e.approx ? ' (aproximativ)' : ''}`,
      en: `In which year did this event happen: “${e.en}”?${e.approx ? ' (approximately)' : ''}`,
    }),
    type: 'choice',
    options: ys.map((y) => opt(`y${y}`, formatYear(sign * y, 'ro'), formatYear(sign * y, 'en'))),
    correctId: `y${abs}`,
  };
  return item;
}

function gapItem(ctx: Ctx, pool: GimEvent[]): Item {
  const { rng } = ctx;
  const e = pick(rng, pool.filter(yearOk));
  const bc = e.year < 0;
  const abs = Math.abs(e.year);
  const ys = shuffle(rng, [abs, ...yearDistractors(rng, abs, 3)]);
  const item: FillGapItem = {
    ...baseFields(ctx, { ro: 'Completează anul.', en: 'Fill in the year.' }),
    type: 'fill-gap',
    template: {
      ro: `„${e.ro}” – anul {{gap}}${bc ? ' î.Hr.' : ''}${e.approx ? ' (aproximativ)' : ''}.`,
      en: `“${e.en}” – the year {{gap}}${bc ? ' BC' : ''}${e.approx ? ' (approximately)' : ''}.`,
    },
    options: ys.map(String),
    correct: String(abs),
  };
  return item;
}

function betweenItem(ctx: Ctx, pool: GimEvent[]): Item | null {
  const { rng } = ctx;
  const exact = distinctYears(rng, pool.filter((e) => !e.approx && yearOk(e)));
  const group = pick(rng, [exact.filter((e) => e.year < 0), exact.filter((e) => e.year > 0)].filter((g) => g.length >= 2));
  if (!group) return null;
  const [a, b] = shuffle(rng, group).slice(0, 2).sort(byYear);
  const item: NumberInputItem = {
    ...baseFields(
      ctx,
      {
        ro: `Câți ani au trecut de la „${a.ro}” (${formatYear(a.year, 'ro')}) până la „${b.ro}” (${formatYear(b.year, 'ro')})?`,
        en: `How many years passed from “${a.en}” (${formatYear(a.year, 'en')}) to “${b.en}” (${formatYear(b.year, 'en')})?`,
      },
      { kind: 'number-line', from: a.year, to: b.year, marks: [a.year, b.year] },
    ),
    type: 'number-input',
    correct: b.year - a.year,
  };
  return item;
}

export const gimEvents: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const tags = paramStrings(params, 'tags', []);
  const pool = eventsFor(tags);
  if (new Set(pool.map((e) => e.year)).size < 3) throw new Error(`ist-events: not enough events for tags ${tags.join(',')}`);
  const hasCentury = pool.some(centuryOk);
  const hasYear = pool.some(yearOk);
  const hasBetween =
    new Set(pool.filter((e) => !e.approx && yearOk(e) && e.year < 0).map((e) => e.year)).size >= 2 ||
    new Set(pool.filter((e) => !e.approx && yearOk(e) && e.year > 0).map((e) => e.year)).size >= 2;
  const w = (cond: boolean, v: number) => (cond ? v : 0);
  const mode = weighted(rng, [
    ['order', d <= 1 ? 0.35 : d === 2 ? 0.3 : d === 3 ? 0.25 : 0.3],
    ['first', d <= 1 ? 0.35 : d === 2 ? 0.2 : d === 3 ? 0.15 : 0.1],
    ['year', w(hasYear, d <= 1 ? 0.3 : d === 2 ? 0.2 : 0)],
    ['century', w(hasCentury, d <= 1 ? 0 : d === 2 ? 0.3 : 0.25)],
    ['gap', w(hasYear, d <= 2 ? 0 : 0.15)],
    ['between', w(hasBetween, d <= 2 ? 0 : 0.2)],
  ] as const);
  switch (mode) {
    case 'first':
      return firstItem(ctx, pool);
    case 'year':
      return yearItem(ctx, pool);
    case 'century':
      return centuryItem(ctx, pool);
    case 'gap':
      return gapItem(ctx, pool);
    case 'between':
      return betweenItem(ctx, pool) ?? orderItem(ctx, pool);
    default:
      return orderItem(ctx, pool);
  }
};

/* ---- ist-gim ----------------------------------------------------------- */

export const gim: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const tags = paramStrings(params, 'tags', []);
  const facts = GIM_FACTS.filter((f) => tags.includes(f.tag));
  const choices = GIM_CHOICES.filter((c) => tags.includes(c.tag));
  const pairs = GIM_PAIRS.filter((p) => tags.includes(p.tag));
  const sorts = GIM_SORTS.filter((s) => tags.includes(s.tag));
  if (!facts.length && !choices.length && !pairs.length && !sorts.length) throw new Error(`ist-gim: no content for tags ${tags.join(',')}`);

  const kind = weighted(rng, [
    ['tf', facts.length ? 3 : 0],
    ['choice', choices.length ? 3 : 0],
    ['match', pairs.length >= 3 ? 2 : 0],
    ['sort', sorts.length && d >= 2 ? 1.5 : 0],
  ] as const);

  if (kind === 'choice') {
    const c = pick(rng, choices);
    const order = shuffle(rng, c.options.map((o, i) => ({ o, i })));
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: c.ro, en: c.en }),
      type: 'choice',
      options: order.map(({ o, i }) => opt(`o${i}`, o.ro, o.en)),
      correctId: `o${c.correct}`,
    };
    return item;
  }
  if (kind === 'match') {
    const n = Math.min(pairs.length, d <= 2 ? 3 : 4);
    const chosen = shuffle(rng, pairs).slice(0, n);
    const item: MatchItem = {
      ...baseFields(ctx, { ro: 'Potrivește fiecare termen sau persoană cu explicația ei.', en: 'Match each term or person with its explanation.' }),
      type: 'match',
      pairs: chosen.map((p, i) => ({ left: opt(`l${i}`, p.left.ro, p.left.en), right: opt(`r${i}`, p.right.ro, p.right.en) })),
    };
    return item;
  }
  if (kind === 'sort') {
    const s = pick(rng, sorts);
    const item: SortItem = {
      ...baseFields(ctx, { ro: s.promptRo, en: s.promptEn }),
      type: 'sort',
      categories: s.categories.map((c) => ({ id: c.id, label: { ro: c.ro, en: c.en } })),
      cards: shuffle(rng, s.cards).map((c, i) => ({ id: `s${i}`, text: { ro: c.ro, en: c.en }, categoryId: c.cat })),
    };
    return item;
  }
  const f = pick(rng, facts);
  const item: TrueFalseItem = {
    ...baseFields(ctx, { ro: f.ro, en: f.en }),
    type: 'true-false',
    correct: f.ok,
  };
  return item;
};

registerGenerator('ist-events', gimEvents);
registerGenerator('ist-gim', gim);
