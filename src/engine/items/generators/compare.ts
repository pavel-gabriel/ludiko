/**
 * `compare` generator (params: max). Item types: true-false ("12 > 9"), choice of the bigger/smaller
 * number, picture-choice (which group has more/fewer), fill-gap with < > =, order ascending/descending.
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, OrderItem, PictureChoiceItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, numberCards, paramInt, pick, randInt, shuffle, weighted } from './util';
import { THINGS } from './things';
import { objectsSpec } from './visuals';

type Kind = 'trueFalse' | 'pick' | 'order' | 'symbol' | 'groups';
type Sym = '<' | '>' | '=';

const relation = (a: number, b: number): Sym => (a < b ? '<' : a > b ? '>' : '=');

/** Two numbers in [lo, max]; closer together as difficulty grows. Equal only when `allowEqual`. */
function pickPair(rng: Rng, lo: number, max: number, d: number, allowEqual: boolean): [number, number] {
  const a = randInt(rng, lo, max);
  if (allowEqual && chance(rng, 0.15)) return [a, a];
  const spread = d >= 4 ? 2 : d >= 3 ? 4 : max;
  for (let tries = 0; tries < 20; tries++) {
    const delta = randInt(rng, 1, Math.max(1, Math.min(spread, max - lo)));
    const b = chance(rng, 0.5) ? a + delta : a - delta;
    if (b >= lo && b <= max && b !== a) return [a, b];
  }
  return [a, a === max ? a - 1 : a + 1];
}

export const compare: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(3, paramInt(params, 'max', 10));
  const objCap = Math.min(max, 20);

  const kind = weighted<Kind>(rng, [['trueFalse', 22], ['pick', 22], ['order', 20], ['symbol', 20], ['groups', max >= 3 ? 16 : 0]]);

  switch (kind) {
    case 'trueFalse': {
      const [a, b] = pickPair(rng, 0, max, d, true);
      const actual = relation(a, b);
      const truth = chance(rng, 0.5);
      const syms: Sym[] = ['<', '>', '='];
      const sym = truth ? actual : pick(rng, syms.filter((s) => s !== actual));
      const stmt = `${a} ${sym} ${b}`;
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Adevărat sau fals: ${stmt}`, en: `True or false: ${stmt}` }),
        type: 'true-false',
        correct: truth,
      };
      return item;
    }
    case 'pick': {
      const bigger = chance(rng, 0.5);
      const count = d >= 3 ? 3 : 2;
      const set = new Set<number>();
      const [a, b] = pickPair(rng, 0, max, d, false);
      set.add(a);
      set.add(b);
      while (set.size < count) set.add(randInt(rng, 0, max));
      const values = shuffle(rng, [...set]);
      const correct = bigger ? Math.max(...values) : Math.min(...values);
      const visual: VisualSpec | undefined =
        max <= 20 && chance(rng, 0.5) ? { kind: 'number-line', from: 0, to: Math.max(10, max), step: 1, marks: values } : undefined;
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          bigger
            ? { ro: 'Care număr este mai mare?', en: 'Which number is bigger?' }
            : { ro: 'Care număr este mai mic?', en: 'Which number is smaller?' },
          visual,
        ),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${correct}`,
      };
      return item;
    }
    case 'order': {
      const want = d >= 4 ? 5 : d >= 3 ? 4 : 3;
      const count = Math.min(want, max + 1);
      const values = shuffle(rng, Array.from({ length: max + 1 }, (_, i) => i)).slice(0, count);
      const ascending = chance(rng, 0.5);
      const cards: CardContent[] = values.map((v, i) => ({ id: `c${i}`, text: { ro: String(v) } }));
      const sorted = [...cards].sort((x, y) => Number(x.text?.ro) - Number(y.text?.ro));
      if (!ascending) sorted.reverse();
      const item: OrderItem = {
        ...baseFields(
          ctx,
          ascending
            ? { ro: 'Aranjează numerele de la cel mai mic la cel mai mare.', en: 'Arrange the numbers from smallest to largest.' }
            : { ro: 'Aranjează numerele de la cel mai mare la cel mai mic.', en: 'Arrange the numbers from largest to smallest.' },
        ),
        type: 'order',
        cards,
        correctOrder: sorted.map((c) => c.id),
      };
      return item;
    }
    case 'symbol': {
      const [a, b] = pickPair(rng, 0, max, d, true);
      const t = `${a} {{gap}} ${b}`;
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Alege semnul potrivit: <, > sau =.', en: 'Choose the right sign: <, > or =.' }),
        type: 'fill-gap',
        template: { ro: t, en: t },
        options: ['<', '>', '='],
        correct: relation(a, b),
      };
      return item;
    }
    case 'groups': {
      const thing = pick(rng, THINGS);
      const [a, b] = pickPair(rng, 1, objCap, d, false);
      const more = chance(rng, 0.5);
      const correct = more ? Math.max(a, b) : Math.min(a, b);
      const item: PictureChoiceItem = {
        ...baseFields(
          ctx,
          more
            ? { ro: `Unde sunt mai multe ${thing.ro}?`, en: `Where are there more ${thing.en}?` }
            : { ro: `Unde sunt mai puține ${thing.ro}?`, en: `Where are there fewer ${thing.en}?` },
        ),
        type: 'picture-choice',
        options: shuffle(rng, [a, b]).map((v) => ({ id: `n${v}`, visual: objectsSpec(thing.icon, v) })),
        correctId: `n${correct}`,
      };
      return item;
    }
  }
};
