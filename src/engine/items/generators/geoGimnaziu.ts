/**
 * Geography generators for grades V-VIII (curated datasets in content/data/geo/*.json, answers computed by code).
 *
 *   geo-quiz     { topic }                 curated multiple-choice + true/false statements
 *   geo-capital  { scope }                 country <-> capital: choice, match, fill-gap, true/false
 *   geo-sort     { kind, scope? }          eu | landlocked | neighbour | continent | relief-form | county-region | massif-group | mountain-continent
 *   geo-eu       {}                        EU membership (2026, 27 members): choice and true/false
 *   geo-county   {}                        county <-> county seat (Romania): choice, match, fill-gap, true/false
 *   geo-river    {}                        Romanian rivers: direct mouth, length order, city on a river
 *   geo-peak     {}                        Romanian peaks and massifs: massif, group, highest, order, fill-gap
 *   geo-order    { set }                   order items: planets-sun | planets-size | continents | oceans | world-peaks | ro-peaks | ro-rivers
 *   geo-world    {}                        world mountains / rivers / peaks -> continent or mouth
 *   geo-relief-unit {}                     Romanian relief units: form, description match
 *   geo-scale    { level }                 map scale arithmetic with the decimal comma
 * Every random draw uses the seeded rng, so a seed always gives the same items.
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, LocalizedText, MatchItem, NumberInputItem, OrderItem, SortItem, TrueFalseItem, VisualSpec } from '../../types';
import {
  CITY_RIVERS, CONTINENTS_BY_AREA, CONTINENT_NAMES, COUNTIES, COUNTRIES, EUROPE, MASSIFS, OCEANS_BY_AREA, PEAKS, PLANETS_BY_SIZE,
  PLANETS_FROM_SUN, QUIZ_TOPICS, RELIEF_FEATURES, RELIEF_FORMS, RELIEF_UNITS, RO_RIVERS, WORLD_MOUNTAINS, WORLD_PEAKS, WORLD_RIVERS,
  countriesFor, type CapitalScope, type ContinentId, type Country, type Named, type Valued,
} from './geoGimnaziuData';
import { fmt } from './numfmt';
import { registerGenerator, type GeneratorContext, type GeneratorFn } from './registry';
import { baseFields, optionCount, pick, shuffle, type Rng } from './util';

const L = (ro: string, en?: string): LocalizedText => (en ? { ro, en } : { ro });
const NB = '\u00a0'; // non-breaking space

/** Choice item from named options (ro/en pairs): correct + wrong distractors, deduplicated by Romanian text */
function choice(ctx: GeneratorContext, prompt: LocalizedText, correct: Named, wrongPool: readonly Named[], total: number, visual?: VisualSpec): ChoiceItem {
  const seen = new Set<string>([correct.ro]);
  const wrong: Named[] = [];
  for (const w of shuffle(ctx.rng, wrongPool)) {
    if (wrong.length >= total - 1) break;
    if (seen.has(w.ro)) continue;
    seen.add(w.ro);
    wrong.push(w);
  }
  const all = shuffle(ctx.rng, [correct, ...wrong]);
  const idx = all.findIndex((o) => o.ro === correct.ro);
  return {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: all.map((o, i) => ({ id: `o${i}`, text: L(o.ro, o.en) })),
    correctId: `o${idx}`,
  };
}

const tf = (ctx: GeneratorContext, prompt: LocalizedText, correct: boolean): TrueFalseItem => ({ ...baseFields(ctx, prompt), type: 'true-false', correct });

function fillGap(ctx: GeneratorContext, template: LocalizedText, correct: string, wrongPool: readonly string[], total: number): FillGapItem {
  const wrong = [...new Set(shuffle(ctx.rng, wrongPool).filter((w) => w !== correct))].slice(0, total - 1);
  return { ...baseFields(ctx, { ro: 'Completează.', en: 'Fill in the gap.' }), type: 'fill-gap', template, options: shuffle(ctx.rng, [correct, ...wrong]), correct };
}

function match(ctx: GeneratorContext, prompt: LocalizedText, pairs: { l: Named; r: Named }[]): MatchItem {
  return {
    ...baseFields(ctx, prompt),
    type: 'match',
    pairs: pairs.map((p, i) => ({ left: { id: `l${i}`, text: L(p.l.ro, p.l.en) }, right: { id: `r${i}`, text: L(p.r.ro, p.r.en) } })),
  };
}

function sort(ctx: GeneratorContext, prompt: LocalizedText, cats: { id: string; label: Named }[], cards: { text: Named; cat: string }[]): SortItem {
  return {
    ...baseFields(ctx, prompt),
    type: 'sort',
    categories: cats.map((c) => ({ id: c.id, label: L(c.label.ro, c.label.en) })),
    cards: shuffle(ctx.rng, cards).map((c, i) => ({ id: `k${i}`, text: L(c.text.ro, c.text.en), categoryId: c.cat })),
  };
}

function order(ctx: GeneratorContext, prompt: LocalizedText, sortedItems: Named[]): OrderItem {
  const cards: CardContent[] = shuffle(ctx.rng, sortedItems).map((n) => ({ id: `c${sortedItems.indexOf(n)}`, text: L(n.ro, n.en) }));
  return { ...baseFields(ctx, prompt), type: 'order', cards, correctOrder: sortedItems.map((_, i) => `c${i}`) };
}

const N = (ro: string, en?: string): Named => ({ ro, en: en ?? ro });

/** Pick `k` entries whose values all differ by at least `minRatio` (so no two are nearly tied), sorted descending by value */
function pickSpread<T extends { v: number }>(rng: Rng, pool: readonly T[], k: number, minRatio = 1.04): T[] {
  for (let tries = 0; tries < 200; tries++) {
    const chosen = shuffle(rng, pool).slice(0, k);
    const sorted = [...chosen].sort((a, b) => b.v - a.v);
    let ok = true;
    for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i].v / sorted[i + 1].v < minRatio) ok = false;
    if (ok) return sorted;
  }
  throw new Error('geo: could not pick a well-separated subset');
}

/* ------------------------------------------------------------------ */
/*  geo-quiz                                                           */
/* ------------------------------------------------------------------ */

export const geoQuiz: GeneratorFn = (params, ctx): Item => {
  const topic = typeof params.topic === 'string' ? params.topic : '';
  const pool = QUIZ_TOPICS[topic];
  if (!pool || pool.mcq.length === 0) throw new Error(`geo-quiz: unknown topic "${topic}" (skill ${ctx.skill.id})`);
  const { rng, difficulty } = ctx;
  if (pool.tf.length > 0 && rng() < 0.3) {
    const e = pick(rng, pool.tf);
    return tf(ctx, L(e.statement), e.correct);
  }
  const e = pick(rng, pool.mcq);
  return choice(ctx, L(e.prompt), N(e.correct), e.wrong.map((w) => N(w)), optionCount(difficulty));
};

/* ------------------------------------------------------------------ */
/*  geo-capital                                                        */
/* ------------------------------------------------------------------ */

const cName = (c: Country): Named => N(c.ro, c.en);
const capName = (c: Country): Named => N(c.capital.ro, c.capital.en);

export const geoCapital: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const scope = (typeof params.scope === 'string' ? params.scope : 'europe-core') as CapitalScope;
  const pool = countriesFor(scope);
  if (pool.length < 4) throw new Error(`geo-capital: scope "${scope}" is too small`);
  const total = Math.min(optionCount(d), pool.length);
  const mode = pick(rng, d <= 1 ? ['ct', 'ct', 'tc', 'tf'] : d === 2 ? ['ct', 'tc', 'match', 'gap', 'tf'] : ['ct', 'tc', 'match', 'gap', 'tf', 'match']);
  const c = pick(rng, pool);
  if (mode === 'ct') {
    return choice(ctx, L(`Care este capitala țării „${c.ro}”?`, `What is the capital of ${c.en}?`), capName(c), pool.filter((x) => x.id !== c.id).map(capName), total);
  }
  if (mode === 'tc') {
    return choice(ctx, L(`Orașul ${c.capital.ro} este capitala unei țări. Care este aceea?`, `${c.capital.en} is a capital city. Of which country?`), cName(c), pool.filter((x) => x.id !== c.id).map(cName), total);
  }
  if (mode === 'match') {
    const pairs = shuffle(rng, pool).slice(0, 4).map((x) => ({ l: cName(x), r: capName(x) }));
    return match(ctx, L('Potrivește fiecare țară cu capitala ei.', 'Match each country with its capital.'), pairs);
  }
  if (mode === 'gap') {
    return fillGap(ctx, L(`Capitala țării „${c.ro}” este {{gap}}.`, `The capital of ${c.en} is {{gap}}.`), c.capital.ro, pool.filter((x) => x.id !== c.id).map((x) => x.capital.ro), total);
  }
  const truth = rng() < 0.5;
  const shown = truth ? c : pick(rng, pool.filter((x) => x.id !== c.id));
  return tf(ctx, L(`Capitala țării „${c.ro}” este ${shown.capital.ro}.`, `The capital of ${c.en} is ${shown.capital.en}.`), truth);
};

/* ------------------------------------------------------------------ */
/*  geo-sort                                                           */
/* ------------------------------------------------------------------ */

function twoCats<T>(rng: Rng, a: T[], b: T[], per: number): [T[], T[]] {
  return [shuffle(rng, a).slice(0, per), shuffle(rng, b).slice(0, per)];
}

export const geoSort: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kind = typeof params.kind === 'string' ? params.kind : 'eu';
  const per = d <= 1 ? 2 : 3;
  if (kind === 'eu' || kind === 'landlocked' || kind === 'neighbour') {
    const core = kind === 'neighbour' ? EUROPE.filter((c) => c.core || c.borderRomania) : EUROPE.filter((c) => c.id !== 'bosnia' && c.id !== 'romania');
    const yes = kind === 'eu' ? core.filter((c) => c.eu) : kind === 'landlocked' ? core.filter((c) => c.landlocked) : core.filter((c) => c.borderRomania);
    const no = kind === 'eu' ? core.filter((c) => !c.eu) : kind === 'landlocked' ? core.filter((c) => !c.landlocked) : core.filter((c) => !c.borderRomania && c.id !== 'romania');
    const [ys, ns] = twoCats(rng, yes, no, per);
    const labels =
      kind === 'eu'
        ? [N('Stat membru UE', 'EU member'), N('Nu este membru UE', 'Not an EU member')]
        : kind === 'landlocked'
          ? [N('Fără ieșire la mare', 'Landlocked'), N('Cu ieșire la mare', 'With a sea coast')]
          : [N('Vecin al României', 'Neighbour of Romania'), N('Nu se învecinează cu România', 'Not a neighbour of Romania')];
    const prompt = L(
      kind === 'eu' ? 'Așază fiecare țară europeană în grupa potrivită.' : kind === 'landlocked' ? 'Care țări nu au ieșire la mare și care au?' : 'Care țări se învecinează cu România?',
      kind === 'eu' ? 'Put each European country in the right group.' : kind === 'landlocked' ? 'Which countries have no sea coast and which do?' : 'Which countries border Romania?',
    );
    return sort(ctx, prompt, [{ id: 'yes', label: labels[0] }, { id: 'no', label: labels[1] }], [...ys.map((c) => ({ text: cName(c), cat: 'yes' })), ...ns.map((c) => ({ text: cName(c), cat: 'no' }))]);
  }
  if (kind === 'continent') {
    const scope = (Array.isArray(params.scope) ? params.scope : ['europa', 'asia', 'africa']) as ContinentId[];
    const conts = shuffle(rng, scope).slice(0, 3);
    const cards = conts.flatMap((cid) => shuffle(rng, COUNTRIES.filter((c) => c.continent === cid)).slice(0, 2).map((c) => ({ text: cName(c), cat: cid })));
    return sort(ctx, L('Pe ce continent se află fiecare țară?', 'On which continent is each country?'), conts.map((cid) => ({ id: cid, label: CONTINENT_NAMES[cid] })), cards);
  }
  if (kind === 'relief-form') {
    const forms = shuffle(rng, RELIEF_FORMS);
    const cards = forms.flatMap((f) => shuffle(rng, RELIEF_FEATURES.filter((x) => x.form === f)).slice(0, 2).map((x) => ({ text: N(x.ro), cat: f })));
    return sort(ctx, L('Din ce formă de relief face parte fiecare unitate?', 'Which landform does each unit belong to?'), forms.map((f) => ({ id: f, label: N(f) })), cards);
  }
  if (kind === 'county-region') {
    const regions = shuffle(rng, ['Muntenia', 'Moldova', 'Transilvania', 'Oltenia']).slice(0, 3);
    const cards = regions.flatMap((r) => shuffle(rng, COUNTIES.filter((c) => c.region === r)).slice(0, 2).map((c) => ({ text: N(`Județul ${c.ro}`, `${c.ro} County`), cat: r })));
    return sort(ctx, L('În ce regiune istorică se află fiecare județ?', 'In which historical region is each county?'), regions.map((r) => ({ id: r, label: N(r) })), cards);
  }
  if (kind === 'massif-group') {
    const groups = ['Carpații Orientali', 'Carpații Meridionali', 'Carpații Occidentali'];
    const cards = groups.flatMap((g) => shuffle(rng, MASSIFS.filter((m) => m.group === g)).slice(0, 2).map((m) => ({ text: N(m.ro), cat: g })));
    return sort(ctx, L('Din ce grup al Carpaților face parte fiecare masiv?', 'Which group of the Carpathians does each massif belong to?'), groups.map((g) => ({ id: g, label: N(g) })), cards);
  }
  if (kind === 'mountain-continent') {
    const conts = shuffle(rng, ['europa', 'asia', 'africa', 'america-nord'] as ContinentId[]).slice(0, 3);
    const cards = conts.flatMap((cid) => shuffle(rng, WORLD_MOUNTAINS.filter((m) => m.continent === cid)).slice(0, 2).map((m) => ({ text: N(m.ro, m.en), cat: cid })));
    return sort(ctx, L('Pe ce continent se află fiecare lanț muntos?', 'On which continent is each mountain range?'), conts.map((cid) => ({ id: cid, label: CONTINENT_NAMES[cid] })), cards);
  }
  throw new Error(`geo-sort: unknown kind "${kind}"`);
};

/* ------------------------------------------------------------------ */
/*  geo-eu                                                             */
/* ------------------------------------------------------------------ */

export const geoEu: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const pool = EUROPE.filter((c) => c.id !== 'romania');
  const members = pool.filter((c) => c.eu);
  const others = pool.filter((c) => !c.eu);
  const mode = pick(rng, d <= 1 ? ['yes', 'tf', 'tf'] : ['yes', 'no', 'tf', 'tf']);
  if (mode === 'yes') {
    return choice(ctx, L('Care dintre aceste țări este stat membru al Uniunii Europene?', 'Which of these countries is a member state of the European Union?'), cName(pick(rng, members)), others.map(cName), optionCount(d));
  }
  if (mode === 'no') {
    return choice(ctx, L('Care dintre aceste țări NU este stat membru al Uniunii Europene?', 'Which of these countries is NOT a member state of the European Union?'), cName(pick(rng, others)), members.map(cName), optionCount(d));
  }
  const c = pick(rng, pool);
  return tf(ctx, L(`Țara „${c.ro}” este stat membru al Uniunii Europene.`, `${c.en} is a member state of the European Union.`), c.eu);
};

/* ------------------------------------------------------------------ */
/*  geo-county                                                         */
/* ------------------------------------------------------------------ */

const withSeat = COUNTIES.filter((c) => c.seat !== null);

export const geoCounty: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const total = optionCount(d);
  const mode = pick(rng, d <= 1 ? ['seat', 'seat', 'county', 'tf'] : ['seat', 'county', 'match', 'gap', 'tf', 'match']);
  const c = pick(rng, withSeat);
  const seat = c.seat as string;
  const others = withSeat.filter((x) => x.id !== c.id);
  if (mode === 'seat') return choice(ctx, L(`Care este reședința județului ${c.ro}?`, `What is the county seat of ${c.ro} County?`), N(seat), others.map((x) => N(x.seat as string)), total);
  if (mode === 'county') return choice(ctx, L(`Orașul ${seat} este reședința unui județ. Care este acela?`, `${seat} is a county seat. Of which county?`), N(c.ro), others.map((x) => N(x.ro)), total);
  if (mode === 'match') {
    const pairs = shuffle(rng, withSeat).slice(0, 4).map((x) => ({ l: N(`Județul ${x.ro}`, `${x.ro} County`), r: N(x.seat as string) }));
    return match(ctx, L('Potrivește fiecare județ cu reședința lui.', 'Match each county with its seat.'), pairs);
  }
  if (mode === 'gap') return fillGap(ctx, L(`Reședința județului ${c.ro} este {{gap}}.`, `The seat of ${c.ro} County is {{gap}}.`), seat, others.map((x) => x.seat as string), total);
  const truth = rng() < 0.5;
  const shown = truth ? seat : (pick(rng, others).seat as string);
  return tf(ctx, L(`Reședința județului ${c.ro} este ${shown}.`, `The seat of ${c.ro} County is ${shown}.`), truth);
};

/* ------------------------------------------------------------------ */
/*  geo-river                                                          */
/* ------------------------------------------------------------------ */

const MOUTH_DISTRACTORS = ['Dunărea', 'Tisa', 'Siretul', 'Mureșul', 'Oltul', 'Prutul'];

export const geoRiver: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const total = optionCount(d);
  const mode = pick(rng, d <= 1 ? ['mouth', 'city', 'city'] : ['mouth', 'city', 'order', 'city', 'order']);
  if (mode === 'order') {
    const picked = pickSpread(rng, RO_RIVERS.map((r) => ({ ...r, v: r.lengthKm })), d <= 1 ? 3 : 4);
    const longest = rng() < 0.5;
    const seq = longest ? picked : [...picked].reverse();
    return order(
      ctx,
      L(longest ? 'Ordonează râurile de la cel mai lung la cel mai scurt.' : 'Ordonează râurile de la cel mai scurt la cel mai lung.', longest ? 'Order the rivers from the longest to the shortest.' : 'Order the rivers from the shortest to the longest.'),
      seq.map((r) => N(r.ro)),
    );
  }
  if (mode === 'city') {
    const e = pick(rng, CITY_RIVERS);
    const rivers = [...new Set(CITY_RIVERS.map((x) => x.river))].filter((r) => r !== e.river);
    return choice(ctx, L(`Pe ce râu se află orașul ${e.city}?`, `On which river does the city of ${e.city} stand?`), N(e.river), rivers.map((r) => N(r)), total);
  }
  const r = pick(rng, RO_RIVERS);
  const wrong = [...MOUTH_DISTRACTORS, ...(r.mouth === 'Marea Neagră' ? ['Marea Adriatică', 'Marea Baltică'] : [])].filter((m) => m !== r.mouth && m !== r.ro);
  return choice(ctx, L(`În ce se varsă direct ${r.ro}?`, `Into what does the ${r.ro} flow directly?`), N(r.mouth), wrong.map((w) => N(w)), total);
};

/* ------------------------------------------------------------------ */
/*  geo-peak                                                           */
/* ------------------------------------------------------------------ */

const heightsOk = (list: { heightM: number }[]): boolean => {
  const s = [...list].sort((a, b) => b.heightM - a.heightM);
  return s.every((p, i) => i === 0 || s[i - 1].heightM / p.heightM >= 1.04);
};

export const geoPeak: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const total = optionCount(d);
  const mode = pick(rng, d <= 1 ? ['massif', 'group', 'highest'] : ['massif', 'group', 'highest', 'order', 'gap', 'massif']);
  if (mode === 'massif') {
    const p = pick(rng, PEAKS);
    return choice(ctx, L(`În ce masiv se află vârful ${p.ro}?`, `In which massif is the peak ${p.ro}?`), N(p.massif), PEAKS.filter((x) => x.massif !== p.massif).map((x) => N(x.massif)), total);
  }
  if (mode === 'group') {
    const m = pick(rng, MASSIFS);
    return choice(ctx, L(`Din ce grup al Carpaților face parte masivul ${m.ro}?`, `Which group of the Carpathians does the ${m.ro} massif belong to?`), N(m.group), ['Carpații Orientali', 'Carpații Meridionali', 'Carpații Occidentali'].map((g) => N(g)), 3);
  }
  const k = mode === 'order' ? (d <= 2 ? 3 : 4) : 3;
  let picked = shuffle(rng, PEAKS).slice(0, k);
  for (let t = 0; t < 200 && !heightsOk(picked); t++) picked = shuffle(rng, PEAKS).slice(0, k);
  const desc = [...picked].sort((a, b) => b.heightM - a.heightM);
  if (mode === 'highest') {
    return choice(ctx, L('Care dintre aceste vârfuri este cel mai înalt?', 'Which of these peaks is the highest?'), N(desc[0].ro), desc.slice(1).map((p) => N(p.ro)), picked.length);
  }
  if (mode === 'order') {
    return order(ctx, L('Ordonează vârfurile de la cel mai înalt la cel mai jos.', 'Order the peaks from the highest to the lowest.'), desc.map((p) => N(p.ro)));
  }
  return fillGap(ctx, L('Vârful {{gap}} este cel mai înalt din România.', '{{gap}} is the highest peak in Romania.'), 'Moldoveanu', PEAKS.filter((p) => p.ro !== 'Moldoveanu').map((p) => p.ro), total);
};

/* ------------------------------------------------------------------ */
/*  geo-order                                                          */
/* ------------------------------------------------------------------ */

export const geoOrder: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const set = typeof params.set === 'string' ? params.set : 'continents';
  const k = d <= 1 ? 3 : 4;
  if (set === 'planets-sun') {
    const idx = shuffle(rng, PLANETS_FROM_SUN.map((_, i) => i)).slice(0, k).sort((a, b) => a - b);
    return order(ctx, L('Ordonează planetele începând cu cea mai apropiată de Soare.', 'Order the planets starting with the one closest to the Sun.'), idx.map((i) => PLANETS_FROM_SUN[i]));
  }
  const bigFirst = rng() < 0.5;
  const mk = (pool: readonly Valued[], noun: { ro: string; en: string; what: { ro: string; en: string } }): Item => {
    const picked = pickSpread(rng, pool, Math.min(k, pool.length));
    const seq = bigFirst ? picked : [...picked].reverse();
    return order(
      ctx,
      L(`Ordonează ${noun.ro} ${bigFirst ? `de la cel mai mare ${noun.what.ro} la cel mai mic` : `de la cel mai mic ${noun.what.ro} la cel mai mare`}.`, `Order the ${noun.en} from ${bigFirst ? 'largest to smallest' : 'smallest to largest'} ${noun.what.en}.`),
      seq.map((p) => N(p.ro, p.en)),
    );
  };
  if (set === 'planets-size') return mk(PLANETS_BY_SIZE, { ro: 'planetele', en: 'planets', what: { ro: 'diametru', en: 'diameter' } });
  if (set === 'continents') return mk(CONTINENTS_BY_AREA, { ro: 'continentele', en: 'continents', what: { ro: 'suprafață', en: 'area' } });
  if (set === 'oceans') return mk(OCEANS_BY_AREA, { ro: 'oceanele', en: 'oceans', what: { ro: 'suprafață', en: 'area' } });
  if (set === 'world-peaks') {
    const picked = pickSpread(rng, WORLD_PEAKS, k);
    return order(ctx, L('Ordonează vârfurile de la cel mai înalt la cel mai jos.', 'Order the peaks from the highest to the lowest.'), picked.map((p) => N(p.ro, p.en)));
  }
  if (set === 'ro-peaks') {
    const picked = pickSpread(rng, PEAKS.map((p) => ({ ...p, v: p.heightM })), k);
    return order(ctx, L('Ordonează vârfurile României de la cel mai înalt la cel mai jos.', 'Order the Romanian peaks from the highest to the lowest.'), picked.map((p) => N(p.ro)));
  }
  if (set === 'ro-rivers') {
    const picked = pickSpread(rng, RO_RIVERS.map((r) => ({ ...r, v: r.lengthKm })), k);
    return order(ctx, L('Ordonează râurile de la cel mai lung la cel mai scurt.', 'Order the rivers from the longest to the shortest.'), picked.map((r) => N(r.ro)));
  }
  throw new Error(`geo-order: unknown set "${set}"`);
};

/* ------------------------------------------------------------------ */
/*  geo-world                                                          */
/* ------------------------------------------------------------------ */

const CONT_RO = (id: ContinentId): Named => CONTINENT_NAMES[id];

export const geoWorld: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const total = optionCount(d);
  const only = typeof params.only === 'string' ? params.only : '';
  const modes = only ? [only] : d <= 1 ? ['mountain', 'river', 'peak'] : ['mountain', 'river', 'mouth', 'peak', 'mouth'];
  const mode = pick(rng, modes);
  const conts: ContinentId[] = ['europa', 'asia', 'africa', 'america-nord', 'america-sud', 'oceania'];
  if (mode === 'mountain') {
    const m = pick(rng, WORLD_MOUNTAINS);
    return choice(ctx, L(`Pe ce continent se află ${m.ro}?`, `On which continent are the ${m.en}?`), CONT_RO(m.continent), conts.filter((c) => c !== m.continent).map(CONT_RO), total);
  }
  if (mode === 'river') {
    const r = pick(rng, WORLD_RIVERS);
    return choice(ctx, L(`Pe ce continent curge ${r.ro}?`, `On which continent does the ${r.en} flow?`), CONT_RO(r.continent), conts.filter((c) => c !== r.continent).map(CONT_RO), total);
  }
  if (mode === 'mouth') {
    const r = pick(rng, WORLD_RIVERS);
    const pool = WORLD_RIVERS.map((x) => x.mouth).filter((m) => m.ro !== r.mouth.ro && !m.ro.startsWith('Ocean'));
    return choice(ctx, L(`În ce se varsă direct ${r.ro}?`, `Into what does the ${r.en} flow directly?`), r.mouth, pool, total);
  }
  const p = pick(rng, WORLD_PEAKS);
  const names = [...new Set(WORLD_PEAKS.map((x) => x.continent))].filter((c) => c !== p.continent);
  const enOf = (ro: string) => WORLD_PEAKS.find((x) => x.continent === ro)?.continentEn ?? ro;
  return choice(ctx, L(`Pe ce continent se află vârful ${p.ro}?`, `On which continent is ${p.en}?`), N(p.continent, p.continentEn), names.map((c) => N(c, enOf(c))), total);
};

/* ------------------------------------------------------------------ */
/*  geo-relief-unit                                                    */
/* ------------------------------------------------------------------ */

export const geoReliefUnit: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const mode = pick(rng, d <= 1 ? ['form', 'form', 'which'] : ['form', 'which', 'match', 'which']);
  const u = pick(rng, RELIEF_UNITS);
  if (mode === 'form') {
    return choice(ctx, L(`Din ce formă de relief face parte unitatea „${u.ro}”?`, `Which landform is "${u.ro}"?`), N(u.form), RELIEF_FORMS.map((f) => N(f)), 3);
  }
  if (mode === 'match') {
    const pairs = shuffle(rng, RELIEF_UNITS).slice(0, 4).map((x) => ({ l: N(x.ro), r: N(x.note) }));
    return match(ctx, L('Potrivește fiecare unitate de relief cu locul ei.', 'Match each relief unit with its location.'), pairs);
  }
  return choice(ctx, L(`Care unitate de relief se află ${u.note}?`, `Which relief unit is ${u.note}?`), N(u.ro), RELIEF_UNITS.filter((x) => x.ro !== u.ro && x.note !== u.note).map((x) => N(x.ro)), optionCount(d));
};

/* ------------------------------------------------------------------ */
/*  geo-scale                                                          */
/* ------------------------------------------------------------------ */

/** Decimal comma text of tenths/hundredths... given as an exact value; integer part grouped with non-breaking spaces from 10 000 */
export function fmtDecimal(x: number): string {
  const s = Number(x.toFixed(6)).toString();
  const [i, f] = s.split('.');
  const whole = fmt(Number(i));
  return f ? `${whole},${f}` : whole;
}

export const scaleText = (n: number): string => `1:${fmt(n)}`;

/** Real distance for `tenths` tenths of a centimetre on a map of scale 1:n; metres below 1 km (n < 100 000), else km */
export function realDistance(tenths: number, n: number): { value: number; unit: 'm' | 'km' } {
  const realCm = (tenths * n) / 10; // exact: n is a multiple of 10
  return n < 100000 ? { value: realCm / 100, unit: 'm' } : { value: Number((realCm / 100000).toFixed(6)), unit: 'km' };
}

const SCALES_ALL = [10000, 25000, 50000, 100000, 200000, 500000, 1000000, 2000000];
const SCALES_KM = [50000, 100000, 200000, 500000, 1000000, 2000000];
const cmText = (tenths: number): string => `${fmtDecimal(tenths / 10)}${NB}cm`;

function numberChoice(ctx: GeneratorContext, prompt: LocalizedText, correct: number, unit: string, total: number, visual?: VisualSpec): ChoiceItem {
  const cand = [correct * 10, correct / 10, correct * 2, correct / 2, correct * 100, correct / 100, correct + 1, correct * 5].map((v) => Number(v.toFixed(6)));
  const texts = new Set<string>([fmtDecimal(correct)]);
  const wrong: number[] = [];
  for (const v of shuffle(ctx.rng, cand)) {
    if (wrong.length >= total - 1) break;
    if (v <= 0 || texts.has(fmtDecimal(v))) continue;
    texts.add(fmtDecimal(v));
    wrong.push(v);
  }
  for (let k = 3; wrong.length < total - 1; k++) {
    const v = Number((correct * (1 + k / 10)).toFixed(6));
    if (!texts.has(fmtDecimal(v))) { texts.add(fmtDecimal(v)); wrong.push(v); }
  }
  const all = shuffle(ctx.rng, [correct, ...wrong]);
  return {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: all.map((v, i) => ({ id: `o${i}`, text: { ro: `${fmtDecimal(v)}${NB}${unit}` } })),
    correctId: `o${all.indexOf(correct)}`,
  };
}

export const geoScale: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const level = typeof params.level === 'number' ? params.level : 1;
  const total = optionCount(d);
  const mode = pick(rng, level <= 1 ? ['dist', 'dist', 'equiv', 'map'] : ['dist', 'map', 'find', 'detail', 'equiv']);
  const halves = level >= 2 || d >= 3;

  if (mode === 'dist') {
    const n = pick(rng, d <= 1 ? [100000, 200000, 500000, 1000000] : SCALES_ALL);
    const tenths = (halves ? pick(rng, [5, 15, 25, 35, 45, 20, 30, 40, 60, 75, 90]) : pick(rng, [10, 20, 30, 40, 50, 60, 70, 80])) as number;
    const real = realDistance(tenths, n);
    const cm = tenths / 10;
    const visual: VisualSpec | undefined = d <= 3 ? { kind: 'ruler', to: Math.max(Math.ceil(cm), 1), unit: 'cm', objectEnd: cm } : undefined;
    const prompt = L(
      `Pe o hartă la scara ${scaleText(n)}, distanța dintre două localități este de ${cmText(tenths)}. Care este distanța reală, în ${real.unit}?`,
      `On a map at scale ${scaleText(n)}, two towns are ${fmtDecimal(cm)} cm apart. What is the real distance, in ${real.unit}?`,
    );
    if (Number.isInteger(real.value) && d >= 3) {
      const item: NumberInputItem = { ...baseFields(ctx, prompt, visual), type: 'number-input', correct: real.value };
      return item;
    }
    return numberChoice(ctx, prompt, real.value, real.unit, total, visual);
  }
  if (mode === 'map') {
    for (let tries = 0; tries < 100; tries++) {
      const n = pick(rng, SCALES_KM);
      const tenths = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100]);
      const km = (tenths * n) / 1000000;
      if (!Number.isInteger(km) || km < 2 || km > 400) continue;
      const cm = tenths / 10;
      return numberChoice(
        ctx,
        L(
          `Două orașe se află la ${fmt(km)}${NB}km distanță în realitate. Ce distanță vor avea pe o hartă la scara ${scaleText(n)}, în cm?`,
          `Two cities are ${fmt(km)} km apart in reality. What distance will they have on a map at scale ${scaleText(n)}, in cm?`,
        ),
        cm,
        'cm',
        total,
      );
    }
  }
  if (mode === 'find') {
    const n = pick(rng, [100000, 200000, 500000, 1000000, 2000000]);
    const cm = pick(rng, [1, 2, 3, 4, 5, 6]);
    const km = (cm * n) / 100000;
    return choice(
      ctx,
      L(
        `Pe o hartă, ${cm}${NB}cm reprezintă ${fmt(km)}${NB}km în realitate. Care este scara hărții?`,
        `On a map, ${cm} cm stand for ${fmt(km)} km in reality. What is the scale of the map?`,
      ),
      N(scaleText(n)),
      SCALES_ALL.filter((s) => s !== n).map((s) => N(scaleText(s))),
      total,
    );
  }
  if (mode === 'detail') {
    const two = shuffle(rng, SCALES_ALL).slice(0, Math.min(total, 3));
    const biggest = Math.min(...two);
    const bigger = rng() < 0.5;
    const target = bigger ? biggest : Math.max(...two);
    return choice(
      ctx,
      bigger
        ? L('Care dintre aceste scări este cea mai mare (harta arată cele mai multe detalii)?', 'Which of these scales is the largest (the map shows the most detail)?')
        : L('Care dintre aceste scări este cea mai mică (harta arată cele mai puține detalii)?', 'Which of these scales is the smallest (the map shows the least detail)?'),
      N(scaleText(target)),
      two.filter((s) => s !== target).map((s) => N(scaleText(s))),
      two.length,
    );
  }
  // equiv: 1 cm on the map = X in reality -> scale
  const n = pick(rng, d <= 1 ? [100000, 200000, 500000, 1000000] : SCALES_ALL);
  const realText = n < 100000 ? `${fmt(n / 100)}${NB}m` : `${fmt(n / 100000)}${NB}km`;
  return choice(
    ctx,
    L(`Pe o hartă, 1${NB}cm reprezintă ${realText} în realitate. Care este scara hărții?`, `On a map, 1 cm stands for ${realText} in reality. What is the scale of the map?`),
    N(scaleText(n)),
    SCALES_ALL.filter((s) => s !== n).map((s) => N(scaleText(s))),
    total,
  );
};

registerGenerator('geo-quiz', geoQuiz);
registerGenerator('geo-capital', geoCapital);
registerGenerator('geo-sort', geoSort);
registerGenerator('geo-eu', geoEu);
registerGenerator('geo-county', geoCounty);
registerGenerator('geo-river', geoRiver);
registerGenerator('geo-peak', geoPeak);
registerGenerator('geo-order', geoOrder);
registerGenerator('geo-world', geoWorld);
registerGenerator('geo-relief-unit', geoReliefUnit);
registerGenerator('geo-scale', geoScale);
