/**
 * `fraction` generator (params: denoms, named, kinds, maxSet, max).
 *  - read:  fraction visual -> "Ce fracție este colorată?" (choice)
 *  - pick:  "Care desen arată 3/4?" (picture-choice with fraction visuals)
 *  - tf:    statement about the picture (true-false)
 *  - setOf / setFill / whole: fractions of a set of objects ("1/4 din 12", "o jumătate din 8")
 *  - cmp / cmpSym / cmpOrder / cmpPic: compare fractions with the same denominator
 * `named` shows 1/2, 1/4, 3/4 as "o jumătate", "un sfert", "trei sferturi".
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, LocalizedText, NumberInputItem, OrderItem, PictureChoiceItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, optionCount, paramBool, paramInt, paramStrings, pick, randInt, shuffle, weighted } from './util';
import { stringOptions, textOptions } from './measureText';
import { THINGS, roCount } from './things';

type Ctx = Parameters<GeneratorFn>[1];
type Kind = 'read' | 'pick' | 'tf' | 'setOf' | 'setFill' | 'whole' | 'cmp' | 'cmpSym' | 'cmpOrder' | 'cmpPic';

interface Frac {
  n: number;
  d: number;
}

const same = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
const key = (f: Frac) => `${f.n}/${f.d}`;

const NAMED: { f: Frac; ro: string; en: string }[] = [
  { f: { n: 1, d: 2 }, ro: 'o jumătate', en: 'one half' },
  { f: { n: 1, d: 4 }, ro: 'un sfert', en: 'one quarter' },
  { f: { n: 3, d: 4 }, ro: 'trei sferturi', en: 'three quarters' },
];

function fracText(f: Frac, named: boolean): LocalizedText {
  if (named) {
    const hit = NAMED.find((x) => same(x.f, f) && x.f.d === f.d);
    if (hit) return { ro: hit.ro, en: hit.en };
  }
  return { ro: key(f), en: key(f) };
}

const spec = (f: Frac, shape: 'circle' | 'bar'): VisualSpec => ({ kind: 'fraction', numerator: f.n, denominator: f.d, shape });

/** Fractions with denominator from `denoms`, 0 < n < d (named mode: only 1/2, 1/4, 3/4). */
function pool(denoms: number[], named: boolean): Frac[] {
  if (named) return NAMED.map((x) => x.f);
  const out: Frac[] = [];
  for (const d of denoms) for (let n = 1; n < d; n++) out.push({ n, d });
  return out;
}

function wrongFractions(rng: Rng, f: Frac, denoms: number[], named: boolean): Frac[] {
  const all = pool(denoms, named).filter((x) => !same(x, f));
  if (named) return shuffle(rng, all);
  // prefer look-alikes: same denominator, or same numerator
  const close = all.filter((x) => x.d === f.d || x.n === f.n);
  return [...shuffle(rng, close), ...shuffle(rng, all.filter((x) => !close.includes(x)))];
}

/* ---- kinds -------------------------------------------------------- */

function read(ctx: Ctx, denoms: number[], named: boolean): Item {
  const { rng, difficulty: d } = ctx;
  const f = pick(rng, pool(denoms, named));
  const shape = chance(rng, 0.5) ? 'circle' : 'bar';
  const { options, correctId } = textOptions(
    rng,
    fracText(f, named),
    wrongFractions(rng, f, denoms, named).map((w) => fracText(w, named)),
    optionCount(d),
  );
  const item: ChoiceItem = {
    ...baseFields(ctx, { ro: 'Ce parte din figură este colorată?', en: 'What part of the shape is coloured?' }, spec(f, shape)),
    type: 'choice',
    options,
    correctId,
  };
  return item;
}

function pickPic(ctx: Ctx, denoms: number[], named: boolean): Item {
  const { rng, difficulty: d } = ctx;
  const f = pick(rng, pool(denoms, named));
  const shape = chance(rng, 0.5) ? 'circle' : 'bar';
  const opts = [f];
  for (const w of wrongFractions(rng, f, denoms, named)) {
    if (opts.length >= optionCount(d)) break;
    if (!opts.some((o) => same(o, w))) opts.push(w);
  }
  const label = fracText(f, named);
  const item: PictureChoiceItem = {
    ...baseFields(ctx, { ro: `Care desen are colorat ${label.ro}?`, en: `Which picture has ${label.en} coloured?` }),
    type: 'picture-choice',
    options: shuffle(rng, opts).map((o) => ({ id: `f${o.n}_${o.d}`, visual: spec(o, shape) })),
    correctId: `f${f.n}_${f.d}`,
  };
  return item;
}

function tf(ctx: Ctx, denoms: number[], named: boolean): Item {
  const { rng } = ctx;
  const f = pick(rng, pool(denoms, named));
  const truth = chance(rng, 0.5);
  const claim = truth ? f : (wrongFractions(rng, f, denoms, named)[0] ?? f);
  const label = fracText(claim, named);
  const item: TrueFalseItem = {
    ...baseFields(
      ctx,
      { ro: `Adevărat sau fals: desenul are colorat ${label.ro}.`, en: `True or false: the picture has ${label.en} coloured.` },
      spec(f, chance(rng, 0.5) ? 'circle' : 'bar'),
    ),
    type: 'true-false',
    correct: truth || same(claim, f),
  };
  return item;
}

function setScene(ctx: Ctx, denoms: number[], named: boolean, maxSet: number) {
  const { rng } = ctx;
  const f = pick(rng, pool(denoms, named));
  const kMax = Math.max(1, Math.floor(maxSet / f.d));
  const k = randInt(rng, 1, Math.min(kMax, 10));
  const total = f.d * k;
  return { f, k, total, answer: f.n * k, thing: pick(rng, THINGS) };
}

function setOf(ctx: Ctx, denoms: number[], named: boolean, maxSet: number): Item {
  const { rng, difficulty: d } = ctx;
  const { f, total, answer, thing } = setScene(ctx, denoms, named, maxSet);
  const label = fracText(f, named);
  const prompt = {
    ro: `Sunt ${roCount(total, thing)}. Câte ${thing.ro} reprezintă ${label.ro} din ele?`,
    en: `There are ${total} ${thing.en}. How many ${thing.en} are ${label.en} of them?`,
  };
  const visual: VisualSpec = { kind: 'objects', icon: thing.icon, count: total, groups: f.d };
  if (chance(rng, 0.5)) {
    const item: NumberInputItem = { ...baseFields(ctx, prompt, visual), type: 'number-input', correct: answer };
    return item;
  }
  const wrong = [total / f.d, total - answer, answer + 1, answer - 1, total, answer * 2].filter((x) => Number.isInteger(x) && x > 0 && x !== answer);
  const { options, correctId } = textOptions(rng, { ro: String(answer) }, wrong.map((x) => ({ ro: String(x) })), optionCount(d));
  const item: ChoiceItem = { ...baseFields(ctx, prompt, visual), type: 'choice', options, correctId };
  return item;
}

function setFill(ctx: Ctx, denoms: number[], named: boolean, maxSet: number): Item {
  const { rng, difficulty: d } = ctx;
  const { f, total, answer } = setScene(ctx, denoms, named, maxSet);
  const label = fracText(f, named);
  const t = `${label.ro} din ${total} = {{gap}}`;
  const wrong = [total / f.d, total - answer, answer + 1, answer - 1, answer * 2, total].filter((x) => Number.isInteger(x) && x > 0 && x !== answer);
  const item: FillGapItem = {
    ...baseFields(ctx, { ro: 'Calculează.', en: 'Work it out.' }),
    type: 'fill-gap',
    template: { ro: t, en: `${label.en} of ${total} = {{gap}}` },
    options: stringOptions(rng, String(answer), wrong.map(String), optionCount(d)),
    correct: String(answer),
  };
  return item;
}

function whole(ctx: Ctx, denoms: number[], maxSet: number): Item {
  const { rng } = ctx;
  const dd = pick(rng, denoms.filter((x) => x >= 2 && x <= 10));
  const k = randInt(rng, 1, Math.max(1, Math.min(10, Math.floor(maxSet / dd))));
  const item: NumberInputItem = {
    ...baseFields(ctx, { ro: `1/${dd} dintr-un număr este ${k}. Care este numărul?`, en: `1/${dd} of a number is ${k}. What is the number?` }),
    type: 'number-input',
    correct: dd * k,
  };
  return item;
}

function sameDenom(rng: Rng, denoms: number[], count: number): Frac[] {
  const dd = pick(rng, denoms.filter((x) => x >= count + 1));
  const ns = shuffle(rng, Array.from({ length: dd - 1 }, (_, i) => i + 1)).slice(0, count);
  return ns.map((n) => ({ n, d: dd }));
}

function cmp(ctx: Ctx, denoms: number[]): Item {
  const { rng, difficulty: d } = ctx;
  const fs = sameDenom(rng, denoms, d >= 3 ? 3 : 2);
  const bigger = chance(rng, 0.5);
  const target = fs.reduce((a, b) => ((bigger ? b.n > a.n : b.n < a.n) ? b : a));
  const item: ChoiceItem = {
    ...baseFields(
      ctx,
      bigger ? { ro: 'Care fracție este mai mare?', en: 'Which fraction is bigger?' } : { ro: 'Care fracție este mai mică?', en: 'Which fraction is smaller?' },
    ),
    type: 'choice',
    options: fs.map((f) => ({ id: `f${f.n}`, text: { ro: key(f), en: key(f) } })),
    correctId: `f${target.n}`,
  };
  return item;
}

function cmpSym(ctx: Ctx, denoms: number[]): Item {
  const { rng } = ctx;
  const dd = pick(rng, denoms);
  const a = randInt(rng, 1, dd - 1);
  const b = chance(rng, 0.15) ? a : randInt(rng, 1, dd - 1);
  const t = `${a}/${dd} {{gap}} ${b}/${dd}`;
  const item: FillGapItem = {
    ...baseFields(ctx, { ro: 'Alege semnul potrivit: <, > sau =.', en: 'Choose the right sign: <, > or =.' }),
    type: 'fill-gap',
    template: { ro: t, en: t },
    options: ['<', '>', '='],
    correct: a < b ? '<' : a > b ? '>' : '=',
  };
  return item;
}

function cmpOrder(ctx: Ctx, denoms: number[]): Item {
  const { rng, difficulty: d } = ctx;
  const fs = sameDenom(rng, denoms.filter((x) => x >= 5), d >= 4 ? 4 : 3);
  const asc = chance(rng, 0.5);
  const cards: CardContent[] = fs.map((f, i) => ({ id: `c${i}`, text: { ro: key(f), en: key(f) } }));
  const sorted = [...fs.keys()].sort((x, y) => (asc ? fs[x].n - fs[y].n : fs[y].n - fs[x].n));
  const item: OrderItem = {
    ...baseFields(
      ctx,
      asc
        ? { ro: 'Aranjează fracțiile de la cea mai mică la cea mai mare.', en: 'Arrange the fractions from smallest to biggest.' }
        : { ro: 'Aranjează fracțiile de la cea mai mare la cea mai mică.', en: 'Arrange the fractions from biggest to smallest.' },
    ),
    type: 'order',
    cards,
    correctOrder: sorted.map((i) => `c${i}`),
  };
  return item;
}

function cmpPic(ctx: Ctx, denoms: number[]): Item {
  const { rng } = ctx;
  const [a, b] = sameDenom(rng, denoms, 2);
  const bigger = chance(rng, 0.5);
  const target = (bigger ? a.n > b.n : a.n < b.n) ? a : b;
  const shape = chance(rng, 0.5) ? 'circle' : 'bar';
  const item: PictureChoiceItem = {
    ...baseFields(
      ctx,
      bigger ? { ro: 'Care desen are colorată o parte mai mare?', en: 'Which picture has more coloured?' } : { ro: 'Care desen are colorată o parte mai mică?', en: 'Which picture has less coloured?' },
    ),
    type: 'picture-choice',
    options: shuffle(rng, [a, b]).map((f) => ({ id: `f${f.n}`, visual: spec(f, shape) })),
    correctId: `f${target.n}`,
  };
  return item;
}

export const fraction: GeneratorFn = (params, ctx): Item => {
  const denoms = Array.isArray(params.denoms) ? (params.denoms as number[]) : [2, 4];
  const named = paramBool(params, 'named') ?? false;
  const maxSet = paramInt(params, 'maxSet', 20);
  const kinds = paramStrings(params, 'kinds', ['read', 'pick', 'tf']) as Kind[];
  const kind = weighted<Kind>(ctx.rng, kinds.map((k) => [k, 1] as const));
  switch (kind) {
    case 'read':
      return read(ctx, denoms, named);
    case 'pick':
      return pickPic(ctx, denoms, named);
    case 'tf':
      return tf(ctx, denoms, named);
    case 'setOf':
      return setOf(ctx, denoms, named, maxSet);
    case 'setFill':
      return setFill(ctx, denoms, named, maxSet);
    case 'whole':
      return whole(ctx, denoms, maxSet);
    case 'cmp':
      return cmp(ctx, denoms);
    case 'cmpSym':
      return cmpSym(ctx, denoms);
    case 'cmpOrder':
      return cmpOrder(ctx, denoms);
    case 'cmpPic':
      return cmpPic(ctx, denoms);
  }
};
