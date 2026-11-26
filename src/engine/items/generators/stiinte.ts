/**
 * Science generators (subject "stiinte", grades III-IV), all fed by the own fact tables in stiinteData.ts:
 *   sci-sort      sort things into 2-3 categories              params: { set }
 *   sci-which     "which of these ...?" / "what is X?" choice   params: { set }
 *   sci-tf        true/false statement about one thing          params: { set }
 *   sci-relation  pair questions (organ-function, young ...)    params: { set }
 *   sci-order     put the stages of a process in order          params: { sequences?: string[] }
 * Optional params for the youngest levels (grades 0-II): `cats` (string[]: keep only those categories of a set)
 * and `options` (max answer options for sci-which / sci-relation, default 3-4 by difficulty).
 */
import type { CardContent, ChoiceItem, Item, OrderItem, SortItem, TrueFalseItem, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { CLASS_SETS, RELATIONS, SEQUENCES, cap, type Cat, type ClassSet, type Thing } from './stiinteData';
import { baseFields, optionCount, paramInt, paramStrings, pick, shuffle } from './util';

const vis = (emoji?: string): VisualSpec | undefined => (emoji ? { kind: 'objects', icon: emoji, count: 1 } : undefined);
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function getSet(params: Record<string, unknown>): ClassSet {
  const set = CLASS_SETS[String(params.set)];
  if (!set) throw new Error(`Unknown science set "${String(params.set)}"`);
  const keep = paramStrings(params, 'cats', []);
  return keep.length > 0 ? { ...set, cats: set.cats.filter((c) => keep.includes(c.id)) } : set;
}

/** Answer options for a question: `params.options` (2-6) or the difficulty default */
const optionsFor = (params: Record<string, unknown>, d: number): number => Math.max(2, Math.min(6, paramInt(params, 'options', optionCount(d))));

function thingCard(t: Thing): CardContent {
  const v = vis(t.emoji);
  return { id: `t_${slug(t.en)}`, text: { ro: t.ro, en: t.en }, ...(v ? { visual: v } : {}) };
}

export const sciSort: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const set = getSet(params);
  const nCats = Math.min(set.cats.length, d <= 1 ? 2 : 3);
  const cats = shuffle(rng, set.cats).slice(0, nCats);
  const perCat = d <= 1 ? 2 : d === 2 ? 2 : 2;
  const cards: (CardContent & { categoryId: string })[] = [];
  for (const c of cats) {
    const n = Math.min(c.things.length, perCat + (nCats === 2 && d >= 2 ? 1 : 0));
    for (const t of shuffle(rng, c.things).slice(0, n)) cards.push({ ...thingCard(t), categoryId: c.id });
  }
  const item: SortItem = {
    ...baseFields(ctx, set.qSort),
    type: 'sort',
    categories: cats.map((c) => ({ id: c.id, label: c.label })),
    cards: shuffle(rng, cards),
  };
  return item;
};

/** Things that are surely NOT in `c` */
function outsiders(set: ClassSet, c: Cat): Thing[] {
  return [...set.cats.filter((x) => x.id !== c.id).flatMap((x) => x.things), ...(set.extras ?? [])];
}

export const sciWhich: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const set = getSet(params);
  const useWhat = set.what !== undefined && rng() < 0.4;

  if (useWhat && set.what) {
    const pool = set.cats.flatMap((c) => c.things.map((t) => ({ t, c })));
    const { t, c } = pick(rng, pool);
    const others = shuffle(rng, set.cats.filter((x) => x.id !== c.id)).slice(0, optionsFor(params, d) - 1);
    const item: ChoiceItem = {
      ...baseFields(ctx, set.what(t), vis(t.emoji)),
      type: 'choice',
      options: shuffle(rng, [c, ...others]).map((x) => ({ id: `c_${x.id}`, text: x.label })),
      correctId: `c_${c.id}`,
    };
    return item;
  }

  const c = pick(rng, set.cats);
  const right = pick(rng, c.things);
  const wrong: Thing[] = [];
  for (const t of shuffle(rng, outsiders(set, c))) {
    if (wrong.length >= optionsFor(params, d) - 1) break;
    if (t.en !== right.en && !wrong.some((w) => w.en === t.en)) wrong.push(t);
  }
  const item: ChoiceItem = {
    ...baseFields(ctx, { ro: `Care dintre acestea ${c.pred.ro}?`, en: `Which of these ${c.pred.en}?` }),
    type: 'choice',
    options: shuffle(rng, [right, ...wrong]).map(thingCard),
    correctId: thingCard(right).id,
  };
  return item;
};

export const sciTf: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const set = getSet(params);
  const truth = rng() < 0.5;
  const c = pick(rng, set.cats);
  let thing: Thing;
  let predCat: Cat;
  if (truth) {
    thing = pick(rng, c.things);
    predCat = c;
  } else {
    thing = pick(rng, outsiders(set, c));
    predCat = c;
  }
  const item: TrueFalseItem = {
    ...baseFields(
      ctx,
      {
        ro: `Adevărat sau fals? ${cap(thing.d)} ${predCat.pred.ro}.`,
        en: `True or false? The ${thing.en} ${predCat.pred.en}.`,
      },
      vis(thing.emoji),
    ),
    type: 'true-false',
    correct: truth,
  };
  return item;
};

export const sciRelation: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const rel = RELATIONS[String(params.set)];
  if (!rel) throw new Error(`Unknown science relation "${String(params.set)}"`);
  const p = pick(rng, rel.pairs);
  const askKey = rng() < 0.5;
  const n = Math.min(optionsFor(params, d), rel.pairs.length);
  const others = shuffle(rng, rel.pairs.filter((x) => x !== p)).slice(0, n - 1);
  const all = shuffle(rng, [p, ...others]);
  const idx = (x: typeof p) => `r${rel.pairs.indexOf(x)}`;
  const item: ChoiceItem = askKey
    ? {
        ...baseFields(ctx, rel.askK(p)),
        type: 'choice',
        options: all.map((x) => {
          const v = vis(x.k.emoji);
          return { id: idx(x), text: { ro: x.k.ro, en: x.k.en }, ...(v ? { visual: v } : {}) };
        }),
        correctId: idx(p),
      }
    : {
        ...baseFields(ctx, rel.askV(p), vis(p.k.emoji)),
        type: 'choice',
        options: all.map((x) => ({ id: idx(x), text: { ro: cap(x.v.ro), en: cap(x.v.en) } })),
        correctId: idx(p),
      };
  return item;
};

export const sciOrder: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const ids = paramStrings(params, 'sequences', Object.keys(SEQUENCES));
  const seq = SEQUENCES[pick(rng, ids)];
  if (!seq) throw new Error('Unknown science sequence');
  const cards: CardContent[] = seq.steps.map((s, i) => {
    const v = vis(s.emoji);
    return { id: `s${i}`, text: { ro: cap(s.ro), en: cap(s.en) }, ...(v ? { visual: v } : {}) };
  });
  const correctOrder = cards.map((c) => c.id);
  let shuffled = shuffle(rng, cards);
  for (let k = 0; k < 8 && shuffled.every((c, i) => c.id === correctOrder[i]); k++) shuffled = shuffle(rng, cards);
  if (shuffled.every((c, i) => c.id === correctOrder[i])) shuffled = [...cards].reverse();
  const item: OrderItem = { ...baseFields(ctx, seq.prompt), type: 'order', cards: shuffled, correctOrder };
  return item;
};

registerGenerator('sci-sort', sciSort);
registerGenerator('sci-which', sciWhich);
registerGenerator('sci-tf', sciTf);
registerGenerator('sci-relation', sciRelation);
registerGenerator('sci-order', sciOrder);
