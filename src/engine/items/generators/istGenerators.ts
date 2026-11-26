/**
 * History (`ist`, grade IV) generators — all content comes from content/data/ist/history.json.
 *   `ist-century`   which century is year X (Roman numerals as in Romanian schools), reverse, î.Hr., and
 *                   time units (params: { mode?: 'century' | 'units' })
 *   `ist-timeline`  order events chronologically, "which came first", years between two events, length of a reign
 *                   (params: { topics?: string[] })
 *   `ist-ruler`     match ruler <-> achievement, or "who was..." (params: { era?: string, ids?: string[] })
 *   `ist-fact`      true/false statements and "in which year" questions (params: { topics: string[] })
 *   `ist-legend`    legend (story) or historical fact? (choice or sort)
 */
import type { CardContent, ChoiceItem, Item, MatchItem, NumberInputItem, OrderItem, SortItem, TrueFalseItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import {
  IST_EVENTS, IST_FACTS, IST_LEGENDS, IST_RULERS, type IstEvent, type IstRuler,
} from './istData';
import {
  centuryLabelEn, centuryLabelRo, centuryNumber, centuryRange, formatYear,
} from './istTime';
import { baseFields, chance, paramStrings, pick, randInt, shuffle, weighted, type Rng } from './util';

/* ---- helpers --------------------------------------------------------- */

const yearCmp = (a: IstEvent, b: IstEvent) => a.year - b.year;
const eventsOf = (topics: string[] | undefined): IstEvent[] =>
  topics ? IST_EVENTS.filter((e) => topics.includes(e.topic)) : [...IST_EVENTS];
const optTopics = (params: Record<string, unknown>): string[] | undefined => {
  const v = params.topics;
  return Array.isArray(v) && v.length && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
};
const dedupe = <T,>(xs: T[]): T[] => [...new Set(xs)];

/** Distinct values from `candidates` that are not in `avoid`, first `n` of a shuffle */
function takeDistinct(rng: Rng, candidates: number[], avoid: number[], n: number): number[] {
  const out: number[] = [];
  for (const v of shuffle(rng, dedupe(candidates))) {
    if (out.length >= n) break;
    if (!avoid.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

const opt = (id: string, ro: string, en?: string): CardContent => ({ id, text: en ? { ro, en } : { ro } });

/* ---- ist-century ------------------------------------------------------ */

function pluralRo(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const UNITS = [
  { ro1: 'deceniu', roN: 'decenii', en1: 'decade', enN: 'decades', years: 10 },
  { ro1: 'secol', roN: 'secole', en1: 'century', enN: 'centuries', years: 100 },
  { ro1: 'mileniu', roN: 'milenii', en1: 'millennium', enN: 'millennia', years: 1000 },
] as const;

function unitsItem(ctx: Parameters<GeneratorFn>[1]): Item {
  const { rng, difficulty: d } = ctx;
  if (d <= 1 || chance(rng, 0.25)) {
    // "How many years in a ...?" (choice)
    const u = pick(rng, UNITS);
    const options = shuffle(rng, UNITS.map((x) => x.years));
    const item: ChoiceItem = {
      ...baseFields(ctx, {
        ro: `Câți ani are un ${u.ro1}?`,
        en: `How many years are in a ${u.en1}?`,
      }),
      type: 'choice',
      options: options.map((y) => opt(`y${y}`, String(y))),
      correctId: `y${u.years}`,
    };
    return item;
  }
  const kind = randInt(rng, 0, 2);
  if (kind === 0) {
    const u = pick(rng, UNITS.slice(0, 2));
    const k = randInt(rng, 2, 9);
    const item: NumberInputItem = {
      ...baseFields(ctx, {
        ro: `Câți ani au ${k} ${pluralRo(k, u.ro1, u.roN)}?`,
        en: `How many years are ${k} ${u.enN}?`,
      }),
      type: 'number-input',
      correct: k * u.years,
    };
    return item;
  }
  if (kind === 1) {
    const [small, big] = pick(rng, [[UNITS[0], UNITS[1]], [UNITS[1], UNITS[2]]] as const);
    const ratio = big.years / small.years;
    const item: NumberInputItem = {
      ...baseFields(ctx, {
        ro: `Câte ${small.roN} are un ${big.ro1}?`,
        en: `How many ${small.enN} are in a ${big.en1}?`,
      }),
      type: 'number-input',
      correct: ratio,
    };
    return item;
  }
  const k = randInt(rng, 2, 5);
  const years = k * 100;
  const item: NumberInputItem = {
    ...baseFields(ctx, {
      ro: `Câte decenii au ${k} secole?`,
      en: `How many decades are in ${k} centuries?`,
    }),
    type: 'number-input',
    correct: years / 10,
  };
  return item;
}

function centuryOptions(rng: Rng, n: number, bc: boolean, total: number): { id: string; n: number; bc: boolean }[] {
  const cands: { n: number; bc: boolean }[] = [];
  for (const dn of [-1, 1, -2, 2, 3]) if (n + dn >= 1 && n + dn <= 21) cands.push({ n: n + dn, bc });
  const wrong = shuffle(rng, cands).slice(0, total - 1);
  return shuffle(rng, [{ n, bc }, ...wrong]).map((o) => ({ ...o, id: `c${o.bc ? 'b' : 'a'}${o.n}` }));
}

const centuryOpt = (o: { id: string; n: number; bc: boolean }, markAd = false): CardContent =>
  opt(o.id, centuryLabelRo(o.n, o.bc, markAd), centuryLabelEn(o.n, o.bc, markAd));

export const century: GeneratorFn = (params, ctx): Item => {
  if (params.mode === 'units') return unitsItem(ctx);
  const { rng, difficulty: d } = ctx;

  /* years before Christ: d >= 4, half of the time */
  if (d >= 4 && chance(rng, 0.5)) {
    const year = -randInt(rng, 1, 600);
    const n = centuryNumber(year);
    const options = [
      { n, bc: true },
      { n, bc: false },
      { n: n + 1, bc: true },
      { n: n + 1, bc: false },
    ].map((o) => ({ ...o, id: `c${o.bc ? 'b' : 'a'}${o.n}` }));
    const item: ChoiceItem = {
      ...baseFields(ctx, {
        ro: `Anul ${formatYear(year, 'ro')} face parte din...`,
        en: `The year ${formatYear(year, 'en')} belongs to...`,
      }),
      type: 'choice',
      options: shuffle(rng, options).map((o) => centuryOpt(o, true)),
      correctId: `cb${n}`,
    };
    return item;
  }

  /* reverse: which year belongs to century N? */
  if (d >= 4) {
    const n = randInt(rng, 5, 20);
    const { from, to } = centuryRange(n, false);
    const inside = randInt(rng, from, to);
    const prev = centuryRange(n - 1, false);
    const next = centuryRange(n + 1, false);
    const wrong = [
      randInt(rng, next.from, next.to),
      // the traps at the edges: the last year of the previous century / the first year of the next one
      chance(rng, 0.5) ? prev.to : next.from,
      randInt(rng, prev.from, prev.to),
    ];
    const years = dedupe([inside, ...wrong]);
    if (years.length < 4) years.push(to + 150 + (inside % 7));
    const item: ChoiceItem = {
      ...baseFields(ctx, {
        ro: `Care dintre ani face parte din ${centuryLabelRo(n, false)}?`,
        en: `Which of these years belongs to ${centuryLabelEn(n, false)}?`,
      }),
      type: 'choice',
      options: shuffle(rng, years).map((y) => opt(`y${y}`, String(y))),
      correctId: `y${inside}`,
    };
    return item;
  }

  let year: number;
  if (d <= 1) {
    // a year from the curated event table (AD), so the child meets familiar dates
    year = pick(rng, IST_EVENTS.filter((e) => e.year > 0 && !e.approx)).year;
  } else if (d === 2) {
    year = randInt(rng, 101, 2000);
  } else {
    // boundary years: ...00, ...01 (and ...99, ...50)
    const c = randInt(rng, 2, 21);
    year = pick(rng, [(c - 1) * 100, (c - 1) * 100 + 1, c * 100 - 1, (c - 1) * 100 + 50]);
  }
  const n = centuryNumber(year);
  const options = centuryOptions(rng, n, false, d <= 1 ? 3 : 4);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `În ce secol a fost anul ${year}?`,
      en: `Which century does the year ${year} belong to?`,
    }),
    type: 'choice',
    options: options.map((o) => centuryOpt(o)),
    correctId: `ca${n}`,
  };
  return item;
};

/* ---- ist-timeline ------------------------------------------------------ */

const cardLabel = (e: IstEvent, withYear: boolean) => ({
  ro: withYear ? `${e.ro} (${formatYear(e.year, 'ro')})` : e.ro,
  en: withYear ? `${e.en} (${formatYear(e.year, 'en')})` : e.en,
});

function pickSpaced(rng: Rng, pool: IstEvent[], k: number, minGap: number): IstEvent[] {
  let fallback: IstEvent[] = [];
  for (let t = 0; t < 40; t++) {
    const picked = shuffle(rng, pool).slice(0, k).sort(yearCmp);
    fallback = picked;
    if (picked.every((e, i) => i === 0 || e.year - picked[i - 1].year >= minGap)) return picked;
  }
  return fallback;
}

export const timeline: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const topics = optTopics(params);
  const pool = eventsOf(topics);

  /* length of a reign (d >= 3) */
  const rulers = IST_RULERS.filter((r) => r.reign && (!topics || r.topics.some((t) => topics.includes(t))));
  if (d >= 3 && rulers.length && chance(rng, 0.2)) {
    const r = pick(rng, rulers);
    const [a, b] = r.reign as [number, number];
    const item: NumberInputItem = {
      ...baseFields(ctx, {
        ro: `${r.ro} a condus între anii ${a} și ${b}. Câți ani au trecut între acești doi ani?`,
        en: `${r.en} ruled between the years ${a} and ${b}. How many years are there between these two years?`,
      }),
      type: 'number-input',
      correct: b - a,
    };
    return item;
  }

  /* years between two events (d >= 3) */
  const exact = pool.filter((e) => !e.approx);
  if (d >= 3 && chance(rng, 0.3)) {
    const anyExact = exact.length >= 2 ? exact : IST_EVENTS.filter((e) => !e.approx);
    const [a, b] = shuffle(rng, anyExact.filter((e) => e.year > 0)).slice(0, 2).sort(yearCmp);
    const item: NumberInputItem = {
      ...baseFields(
        ctx,
        {
          ro: `Câți ani au trecut de la „${a.ro}” (${a.year}) până la „${b.ro}” (${b.year})?`,
          en: `How many years passed from “${a.en}” (${a.year}) to “${b.en}” (${b.year})?`,
        },
        { kind: 'number-line', from: a.year, to: b.year, marks: [a.year, b.year] },
      ),
      type: 'number-input',
      correct: b.year - a.year,
    };
    return item;
  }

  /* which happened first? (d <= 2, one third of the time) */
  if (d <= 2 && pool.length >= 2 && chance(rng, 0.33)) {
    const [a, b] = pickSpaced(rng, pool, 2, 10);
    const first = a.year < b.year ? a : b;
    const ids = shuffle(rng, [a, b]);
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: 'Care eveniment a avut loc mai întâi?', en: 'Which event happened first?' }),
      type: 'choice',
      options: ids.map((e) => opt(`e_${e.id}`, e.ro, e.en)),
      correctId: `e_${first.id}`,
    };
    return item;
  }

  /* order the events */
  const k = Math.min(pool.length, d <= 2 ? 3 : d === 3 ? 4 : 5);
  const picked = pickSpaced(rng, pool, k, d <= 3 ? 10 : 1);
  const withYear = d <= 1;
  const cards = picked.map((e) => ({ id: `e_${e.id}`, text: cardLabel(e, withYear) }));
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
};

/* ---- ist-ruler ---------------------------------------------------------- */

function rulerPool(params: Record<string, unknown>): IstRuler[] {
  const ids = paramStrings(params, 'ids', []);
  if (ids.length) return IST_RULERS.filter((r) => ids.includes(r.id));
  const era = typeof params.era === 'string' ? params.era : undefined;
  return era ? IST_RULERS.filter((r) => r.era === era) : [...IST_RULERS];
}

export const ruler: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const pool = rulerPool(params);

  if (d <= 2 && chance(rng, 0.5)) {
    const target = pick(rng, pool);
    const others = IST_RULERS.filter((r) => r.era === target.era && r.id !== target.id);
    const wrong = shuffle(rng, others).slice(0, d <= 1 ? 2 : 3);
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: `Cine a fost ${target.achRo}?`, en: `Who was ${target.achEn}?` }),
      type: 'choice',
      options: shuffle(rng, [target, ...wrong]).map((r) => opt(`r_${r.id}`, r.ro, r.en)),
      correctId: `r_${target.id}`,
    };
    return item;
  }

  const n = Math.min(pool.length, d <= 2 ? 3 : 4);
  const chosen = shuffle(rng, pool).slice(0, n);
  const item: MatchItem = {
    ...baseFields(ctx, {
      ro: 'Potrivește fiecare personalitate cu ceea ce a făcut.',
      en: 'Match each historical figure with what they did.',
    }),
    type: 'match',
    pairs: chosen.map((r) => ({
      left: opt(`l_${r.id}`, r.ro, r.en),
      right: opt(`r_${r.id}`, r.achRo, r.achEn),
    })),
  };
  return item;
};

/* ---- ist-fact ------------------------------------------------------------ */

const stripDot = (s: string) => s.replace(/\.$/, '');

function dateStatement(rng: Rng, e: IstEvent): { ro: string; en: string; ok: boolean } {
  const ok = chance(rng, 0.5);
  let year = e.year;
  if (!ok) {
    const same = IST_EVENTS.filter((x) => Math.sign(x.year) === Math.sign(e.year) && Math.abs(x.year - e.year) >= 4).map((x) => x.year);
    year = same.length ? pick(rng, same) : e.year + (e.year > 0 ? 50 : -50);
  }
  return {
    ro: `${e.stemRo} ${formatYear(year, 'ro')}.`,
    en: `${e.stemEn} ${formatYear(year, 'en')}.`,
    ok,
  };
}

function dateChoice(ctx: Parameters<GeneratorFn>[1], e: IstEvent): Item {
  const { rng } = ctx;
  const sign = Math.sign(e.year);
  const abs = Math.abs(e.year);
  const others = IST_EVENTS.map((x) => x.year).filter((y) => Math.sign(y) === sign && Math.abs(Math.abs(y) - abs) >= 4).map(Math.abs);
  const offsets = [10, 20, 30, 50, 100].flatMap((o) => [abs + o, abs - o]).filter((y) => y > 0);
  const wrong = takeDistinct(rng, others, [abs], 3);
  for (const y of takeDistinct(rng, offsets, [abs, ...wrong], 3 - wrong.length)) wrong.push(y);
  const all = [abs, ...wrong].sort((a, b) => (sign < 0 ? b - a : a - b));
  const lab = (y: number, lang: 'ro' | 'en') => formatYear(sign * y, lang);
  const approx = e.approx;
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `În ce an a avut loc evenimentul „${e.ro}”?${approx ? ' (aproximativ)' : ''}`,
      en: `In which year did this event happen: “${e.en}”?${approx ? ' (approximately)' : ''}`,
    }),
    type: 'choice',
    options: all.map((y) => opt(`y${y}`, lab(y, 'ro'), lab(y, 'en'))),
    correctId: `y${abs}`,
  };
  return item;
}

export const fact: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const topics = paramStrings(params, 'topics', []);
  const facts = IST_FACTS.filter((f) => topics.includes(f.topic));
  const events = IST_EVENTS.filter((e) => topics.includes(e.topic));
  if (!facts.length && !events.length) throw new Error(`ist-fact: no content for topics ${topics.join(',')}`);

  const mode = weighted(rng, [
    ['fact', facts.length ? 3 : 0],
    ['dateTF', events.length ? 1 : 0],
    ['dateChoice', events.length && d >= 2 ? 1.5 : 0],
  ] as const);

  if (mode === 'dateChoice') return dateChoice(ctx, pick(rng, events));

  const s = mode === 'dateTF' ? dateStatement(rng, pick(rng, events)) : pick(rng, facts);
  const ok = 'ok' in s ? s.ok : true;
  const item: TrueFalseItem = {
    ...baseFields(ctx, { ro: s.ro, en: s.en }),
    type: 'true-false',
    correct: ok,
  };
  return item;
};

/* ---- ist-legend ----------------------------------------------------------- */

const CATS = [
  { id: 'legend', label: { ro: 'Legendă sau poveste', en: 'Legend or story' } },
  { id: 'fact', label: { ro: 'Fapt istoric', en: 'Historical fact' } },
];

export const legend: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;

  if (d >= 3) {
    const legends = shuffle(rng, IST_LEGENDS.filter((l) => l.kind === 'L'));
    const facts = shuffle(rng, IST_LEGENDS.filter((l) => l.kind === 'F'));
    const nL = pick(rng, [1, 2, 2, 3]);
    const chosen = [...legends.slice(0, nL), ...facts.slice(0, 4 - nL)];
    const item: SortItem = {
      ...baseFields(ctx, {
        ro: 'Pune fiecare enunț la locul lui: legendă sau fapt istoric?',
        en: 'Put each sentence where it belongs: legend or historical fact?',
      }),
      type: 'sort',
      categories: CATS,
      cards: shuffle(rng, chosen).map((l, i) => ({
        id: `s${i}`,
        text: { ro: l.ro, en: l.en },
        categoryId: l.kind === 'L' ? 'legend' : 'fact',
      })),
    };
    return item;
  }

  const l = pick(rng, IST_LEGENDS);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `Este o legendă (o poveste) sau un fapt istoric? „${stripDot(l.ro)}”`,
      en: `Is this a legend (a story) or a historical fact? “${stripDot(l.en)}”`,
    }),
    type: 'choice',
    options: CATS.map((c) => ({ id: c.id, text: c.label })),
    correctId: l.kind === 'L' ? 'legend' : 'fact',
  };
  return item;
};

registerGenerator('ist-century', century);
registerGenerator('ist-timeline', timeline);
registerGenerator('ist-ruler', ruler);
registerGenerator('ist-fact', fact);
registerGenerator('ist-legend', legend);
