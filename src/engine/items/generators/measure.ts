/**
 * `measure` generator: length (cm, m, km), mass (kg, g) and capacity (l, ml).
 * params: units (plain units to compare/add), unitNames (units asked in `unit` items), pairs (conversions, "m-cm" "km-m" "kg-g" "l-ml"),
 *         kinds (ruler, compare, convert, add, unit, tf), maxVal (bound for plain values), max.
 *  - ruler:   ruler visual ("Cât măsoară creionul?")
 *  - compare: same unit (choice / fill-gap with < > =) or mixed units ("1 m {{gap}} 90 cm")
 *  - convert: "3 m = {{gap}} cm", "2 kg 300 g = ? g"
 *  - add:     two quantities added or subtracted
 *  - unit:    which unit measures a given thing
 *  - tf:      true/false statements
 */
import type { ChoiceItem, FillGapItem, Item, NumberInputItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import { baseFields, chance, optionCount, paramInt, paramStrings, pick, randInt, shuffle, weighted } from './util';
import { stringOptions, textOptions } from './measureText';

type Ctx = Parameters<GeneratorFn>[1];
type Kind = 'ruler' | 'compare' | 'convert' | 'add' | 'unit' | 'tf';

interface Pair {
  big: string;
  small: string;
  factor: number;
}

const PAIRS: Record<string, Pair> = {
  'm-cm': { big: 'm', small: 'cm', factor: 100 },
  'km-m': { big: 'km', small: 'm', factor: 1000 },
  'kg-g': { big: 'kg', small: 'g', factor: 1000 },
  'l-ml': { big: 'l', small: 'ml', factor: 1000 },
};

type Family = 'length' | 'mass' | 'capacity';
const FAMILY: Record<string, Family> = { cm: 'length', m: 'length', km: 'length', kg: 'mass', g: 'mass', l: 'capacity', ml: 'capacity' };

const MORE: Record<Family, { more: { ro: string; en: string }; less: { ro: string; en: string } }> = {
  length: { more: { ro: 'mai lung', en: 'longer' }, less: { ro: 'mai scurt', en: 'shorter' } },
  mass: { more: { ro: 'mai greu', en: 'heavier' }, less: { ro: 'mai ușor', en: 'lighter' } },
  capacity: { more: { ro: 'mai mare', en: 'bigger' }, less: { ro: 'mai mic', en: 'smaller' } },
};

const RULER_THINGS = [
  { ro: 'Creionul', en: 'The pencil' },
  { ro: 'Șnurul', en: 'The string' },
  { ro: 'Panglica', en: 'The ribbon' },
  { ro: 'Frunza', en: 'The leaf' },
  { ro: 'Bețișorul', en: 'The stick' },
  { ro: 'Pixul', en: 'The pen' },
  { ro: 'Radiera', en: 'The eraser' },
];

const UNIT_FACTS: { ro: string; en: string; unit: string }[] = [
  { ro: 'lungimea unui creion', en: 'the length of a pencil', unit: 'cm' },
  { ro: 'grosimea unei cărți', en: 'the thickness of a book', unit: 'cm' },
  { ro: 'înălțimea unei uși', en: 'the height of a door', unit: 'm' },
  { ro: 'lungimea unei săli de clasă', en: 'the length of a classroom', unit: 'm' },
  { ro: 'distanța dintre două orașe', en: 'the distance between two towns', unit: 'km' },
  { ro: 'greutatea unui elev', en: "a pupil's weight", unit: 'kg' },
  { ro: 'greutatea unui sac de cartofi', en: 'the weight of a sack of potatoes', unit: 'kg' },
  { ro: 'greutatea unui bob de strugure', en: 'the weight of a grape', unit: 'g' },
  { ro: 'greutatea unei pâini mici', en: 'the weight of a small loaf', unit: 'g' },
  { ro: 'apa dintr-o găleată', en: 'the water in a bucket', unit: 'l' },
  { ro: 'sucul dintr-o sticlă mare', en: 'the juice in a big bottle', unit: 'l' },
  { ro: 'siropul dintr-o linguriță', en: 'the syrup in a teaspoon', unit: 'ml' },
  { ro: 'apa dintr-un pahar mic', en: 'the water in a small glass', unit: 'ml' },
];

const SYM = ['<', '>', '='];
const relation = (a: number, b: number) => (a < b ? '<' : a > b ? '>' : '=');
const q = (n: number, u: string) => `${n} ${u}`;

/** Bound for plain values of a unit */
function bound(unit: string, maxVal: number): number {
  return unit === 'cm' || unit === 'g' || unit === 'ml' ? maxVal : Math.min(maxVal, 30);
}

/* ---- kinds -------------------------------------------------------- */

function ruler(ctx: Ctx, maxVal: number): Item {
  const { rng, difficulty: d } = ctx;
  const top = Math.max(10, Math.ceil(Math.min(maxVal, 30) / 10) * 10);
  const thing = pick(rng, RULER_THINGS);
  const offset = d >= 3 && chance(rng, 0.6);
  let a = 0;
  let b: number;
  if (offset) {
    a = randInt(rng, 1, Math.floor(top / 2));
    b = randInt(rng, a + 2, Math.max(a + 2, top));
  } else b = randInt(rng, 2, top);
  const len = b - a;
  const visual: VisualSpec = {
    kind: 'ruler',
    to: top,
    unit: 'cm',
    ...(a ? { from: a } : {}),
    objectEnd: b,
    objectLabel: { ro: thing.ro, en: thing.en },
  };
  const prompt = offset
    ? { ro: `${thing.ro} începe la ${a} și se termină la ${b} pe riglă. Câți cm măsoară?`, en: `${thing.en} starts at ${a} and ends at ${b} on the ruler. How many cm long is it?` }
    : { ro: `${thing.ro} începe de la 0 pe riglă. Câți cm măsoară?`, en: `${thing.en} starts at 0 on the ruler. How many cm long is it?` };
  if (chance(rng, 0.5)) {
    const item: NumberInputItem = { ...baseFields(ctx, prompt, visual), type: 'number-input', correct: len };
    return item;
  }
  const wrong = [len + 1, len - 1, b, a, len + 2, len - 2].filter((x) => x > 0 && x !== len);
  const { options, correctId } = textOptions(rng, { ro: String(len) }, wrong.map((x) => ({ ro: String(x) })), optionCount(d));
  const item: ChoiceItem = { ...baseFields(ctx, prompt, visual), type: 'choice', options, correctId };
  return item;
}

function compare(ctx: Ctx, units: string[], pairs: Pair[], maxVal: number): Item {
  const { rng } = ctx;
  const mixed = pairs.length > 0 && (units.length === 0 || chance(rng, 0.4));
  if (mixed) {
    const p = pick(rng, pairs);
    const a = randInt(rng, 1, p.big === 'km' || p.big === 'm' ? 9 : 9);
    const exact = a * p.factor;
    const cands = [exact, exact - p.factor / 10, exact + p.factor / 10, exact - p.factor / 2, exact + p.factor / 2];
    const b = pick(rng, cands);
    const rel = relation(exact, b);
    const t = `${q(a, p.big)} {{gap}} ${q(b, p.small)}`;
    const item: FillGapItem = {
      ...baseFields(ctx, { ro: 'Alege semnul potrivit: <, > sau =.', en: 'Choose the right sign: <, > or =.' }),
      type: 'fill-gap',
      template: { ro: t, en: t },
      options: [...SYM],
      correct: rel,
    };
    return item;
  }
  const u = pick(rng, units);
  const hi = bound(u, maxVal);
  const a = randInt(rng, 1, hi);
  let b = randInt(rng, 1, hi);
  if (b === a) b = a === hi ? a - 1 : a + 1;
  if (chance(rng, 0.5)) {
    const more = chance(rng, 0.5);
    const fam = MORE[FAMILY[u]];
    const word = more ? fam.more : fam.less;
    const correct = more ? Math.max(a, b) : Math.min(a, b);
    const options = shuffle(rng, [a, b]).map((v) => ({ id: `v${v}`, text: { ro: q(v, u), en: q(v, u) } }));
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: `Care este ${word.ro}: ${q(a, u)} sau ${q(b, u)}?`, en: `Which is ${word.en}: ${q(a, u)} or ${q(b, u)}?` }),
      type: 'choice',
      options,
      correctId: `v${correct}`,
    };
    return item;
  }
  const t = `${q(a, u)} {{gap}} ${q(b, u)}`;
  const item: FillGapItem = {
    ...baseFields(ctx, { ro: 'Alege semnul potrivit: <, > sau =.', en: 'Choose the right sign: <, > or =.' }),
    type: 'fill-gap',
    template: { ro: t, en: t },
    options: [...SYM],
    correct: relation(a, b),
  };
  return item;
}

function convert(ctx: Ctx, pairs: Pair[]): Item {
  const { rng, difficulty: d } = ctx;
  const p = pick(rng, pairs);
  const mode = weighted<'down' | 'up' | 'compound'>(rng, [['down', 40], ['up', 30], ['compound', d >= 3 ? 30 : 8]]);
  const a = randInt(rng, 1, 9);
  if (mode === 'down') {
    const ans = a * p.factor;
    const item: FillGapItem = {
      ...baseFields(ctx, { ro: `Transformă în ${p.small}.`, en: `Convert to ${p.small}.` }),
      type: 'fill-gap',
      template: { ro: `${q(a, p.big)} = {{gap}} ${p.small}`, en: `${q(a, p.big)} = {{gap}} ${p.small}` },
      options: stringOptions(rng, String(ans), [a * 10, a * 100, a * 1000, a * p.factor * 10, ans + p.factor, ans / 10 || 5].filter((x) => Number.isInteger(x) && x !== ans).map(String), optionCount(d)),
      correct: String(ans),
    };
    return item;
  }
  if (mode === 'up') {
    const item: FillGapItem = {
      ...baseFields(ctx, { ro: `Transformă în ${p.big}.`, en: `Convert to ${p.big}.` }),
      type: 'fill-gap',
      template: { ro: `${q(a * p.factor, p.small)} = {{gap}} ${p.big}`, en: `${q(a * p.factor, p.small)} = {{gap}} ${p.big}` },
      options: stringOptions(rng, String(a), [a * 10, a + 1, Math.max(1, a - 1), a * 100, a + 10].map(String), optionCount(d)),
      correct: String(a),
    };
    return item;
  }
  const rest = pick(rng, p.factor === 100 ? [10, 20, 25, 30, 40, 50, 75] : [100, 200, 250, 300, 400, 500, 750]);
  const item: NumberInputItem = {
    ...baseFields(ctx, { ro: `Transformă în ${p.small}: ${q(a, p.big)} ${rest} ${p.small}.`, en: `Convert to ${p.small}: ${q(a, p.big)} ${rest} ${p.small}.` }),
    type: 'number-input',
    correct: a * p.factor + rest,
  };
  return item;
}

function add(ctx: Ctx, units: string[], maxVal: number): Item {
  const { rng, difficulty: d } = ctx;
  const u = pick(rng, units);
  const hi = Math.max(4, Math.floor(bound(u, maxVal) / 2));
  const a = randInt(rng, 2, hi);
  const b = randInt(rng, 2, hi);
  const subtract = chance(rng, d >= 2 ? 0.4 : 0.2) && a !== b;
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const fam = FAMILY[u];
  const ans = subtract ? big - small : a + b;
  const prompts: Record<Family, [string, string]> = {
    length: [
      `Un șnur are ${q(a, u)}, iar altul are ${q(b, u)}. Câți ${u} au împreună?`,
      `One string is ${q(a, u)} long and another is ${q(b, u)} long. How many ${u} do they have together?`,
    ],
    mass: [
      `Un sac are ${q(a, u)} de mere, iar altul are ${q(b, u)}. Câte ${u} sunt în total?`,
      `One sack has ${q(a, u)} of apples and another has ${q(b, u)}. How many ${u} are there in total?`,
    ],
    capacity: [
      `Într-o sticlă sunt ${q(a, u)} de suc, iar în alta sunt ${q(b, u)}. Câți ${u} sunt în total?`,
      `One bottle holds ${q(a, u)} of juice and another holds ${q(b, u)}. How many ${u} are there in total?`,
    ],
  };
  const subs: Record<Family, [string, string]> = {
    length: [
      `Un șnur are ${q(big, u)}, iar altul are ${q(small, u)}. Cu câți ${u} este primul mai lung?`,
      `One string is ${q(big, u)} and another is ${q(small, u)}. By how many ${u} is the first one longer?`,
    ],
    mass: [
      `Un sac are ${q(big, u)}, iar altul are ${q(small, u)}. Cu câte ${u} este primul mai greu?`,
      `One sack weighs ${q(big, u)} and another ${q(small, u)}. By how many ${u} is the first one heavier?`,
    ],
    capacity: [
      `În prima sticlă sunt ${q(big, u)}, iar în a doua sunt ${q(small, u)}. Cu câți ${u} are prima mai mult?`,
      `The first bottle holds ${q(big, u)} and the second holds ${q(small, u)}. By how many ${u} does the first hold more?`,
    ],
  };
  const [ro, en] = subtract ? subs[fam] : prompts[fam];
  const item: NumberInputItem = { ...baseFields(ctx, { ro, en }), type: 'number-input', correct: ans };
  return item;
}

function unitItem(ctx: Ctx, allowed: string[]): Item {
  const { rng, difficulty: d } = ctx;
  const facts = UNIT_FACTS.filter((f) => allowed.includes(f.unit));
  const f = pick(rng, facts.length ? facts : UNIT_FACTS);
  const wrongUnits = allowed.filter((u) => u !== f.unit);
  const pool = wrongUnits.length >= 2 ? wrongUnits : ['cm', 'm', 'km', 'kg', 'g', 'l', 'ml'].filter((u) => u !== f.unit);
  const { options, correctId } = textOptions(rng, { ro: f.unit, en: f.unit }, pool.map((u) => ({ ro: u, en: u })), optionCount(d));
  const item: ChoiceItem = {
    ...baseFields(ctx, { ro: `În ce unitate măsurăm ${f.ro}?`, en: `Which unit do we use to measure ${f.en}?` }),
    type: 'choice',
    options,
    correctId,
  };
  return item;
}

function tf(ctx: Ctx, pairs: Pair[], units: string[], maxVal: number): Item {
  const { rng } = ctx;
  const truth = chance(rng, 0.5);
  if (pairs.length && chance(rng, 0.6)) {
    const p = pick(rng, pairs);
    const a = randInt(rng, 1, 9);
    const right = a * p.factor;
    const shown = truth ? right : pick(rng, [right * 10, right / 10, right + p.factor / 2].filter((x) => Number.isInteger(x) && x !== right));
    const item: TrueFalseItem = {
      ...baseFields(ctx, { ro: `Adevărat sau fals: ${q(a, p.big)} = ${q(shown, p.small)}.`, en: `True or false: ${q(a, p.big)} = ${q(shown, p.small)}.` }),
      type: 'true-false',
      correct: truth,
    };
    return item;
  }
  const u = pick(rng, units);
  const hi = bound(u, maxVal);
  const a = randInt(rng, 2, hi);
  let b = randInt(rng, 1, hi);
  if (b === a) b = a === 1 ? 2 : a - 1;
  const fam = MORE[FAMILY[u]];
  const [x, y] = truth ? [Math.max(a, b), Math.min(a, b)] : [Math.min(a, b), Math.max(a, b)];
  const item: TrueFalseItem = {
    ...baseFields(ctx, {
      ro: `Adevărat sau fals: ${q(x, u)} este ${fam.more.ro} decât ${q(y, u)}.`,
      en: `True or false: ${q(x, u)} is ${fam.more.en} than ${q(y, u)}.`,
    }),
    type: 'true-false',
    correct: truth,
  };
  return item;
}

export const measure: GeneratorFn = (params, ctx): Item => {
  const units = paramStrings(params, 'units', ['cm']);
  const pairNames = Array.isArray(params.pairs) ? (params.pairs as string[]) : [];
  const pairs = pairNames.map((n) => PAIRS[n]).filter(Boolean);
  const maxVal = paramInt(params, 'maxVal', 20);
  const kinds = paramStrings(params, 'kinds', ['ruler', 'compare', 'add', 'tf']) as Kind[];
  const kind = weighted<Kind>(ctx.rng, kinds.map((k) => [k, k === 'unit' ? 0.7 : 1] as const));
  const allUnits = [...new Set([...units, ...pairs.flatMap((p) => [p.big, p.small])])];
  switch (kind) {
    case 'ruler':
      return ruler(ctx, maxVal);
    case 'compare':
      return compare(ctx, units, pairs, maxVal);
    case 'convert':
      return convert(ctx, pairs);
    case 'add':
      return add(ctx, units, maxVal);
    case 'unit':
      return unitItem(ctx, paramStrings(params, 'unitNames', allUnits));
    case 'tf':
      return tf(ctx, pairs, units, maxVal);
  }
};
