/**
 * `shapes` generator (params: topic 'names' | 'perimeter', max). There is no shape VisualSpec yet,
 * so figures are described in words (see the report for the proposed `shape` visual).
 *  - names:     sides/corners of triunghi, pătrat, dreptunghi, cerc (choice, fill-gap, sort, true-false)
 *  - perimeter: perimeter of a triangle, square or rectangle by adding the sides; missing side
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, NumberInputItem, SortItem, TrueFalseItem } from '../../types';
import type { GeneratorFn } from './registry';
import { baseFields, chance, numberOptions, optionCount, pick, randInt, shuffle, weighted } from './util';
import { stringOptions, textOptions } from './measureText';

type Ctx = Parameters<GeneratorFn>[1];

interface Shape {
  ro: string;
  /** with indefinite article */
  roA: string;
  en: string;
  enA: string;
  sides: number;
}

const SHAPES: Shape[] = [
  { ro: 'triunghi', roA: 'un triunghi', en: 'triangle', enA: 'a triangle', sides: 3 },
  { ro: 'pătrat', roA: 'un pătrat', en: 'square', enA: 'a square', sides: 4 },
  { ro: 'dreptunghi', roA: 'un dreptunghi', en: 'rectangle', enA: 'a rectangle', sides: 4 },
  { ro: 'cerc', roA: 'un cerc', en: 'circle', enA: 'a circle', sides: 0 },
];
const POLY = SHAPES.slice(0, 3);

type NamesKind = 'count' | 'which' | 'sort' | 'gap' | 'tf';

function names(ctx: Ctx): Item {
  const { rng, difficulty: d } = ctx;
  const kind = weighted<NamesKind>(rng, [['count', 24], ['which', 24], ['sort', 14], ['gap', 18], ['tf', 20]]);
  switch (kind) {
    case 'count': {
      const s = pick(rng, POLY);
      const corners = chance(rng, 0.4);
      const prompt = corners
        ? { ro: `Câte colțuri are ${s.roA}?`, en: `How many corners does ${s.enA} have?` }
        : { ro: `Câte laturi are ${s.roA}?`, en: `How many sides does ${s.enA} have?` };
      if (chance(rng, 0.5)) {
        const item: NumberInputItem = { ...baseFields(ctx, prompt), type: 'number-input', correct: s.sides };
        return item;
      }
      const nums = numberOptions(rng, s.sides, [3, 4, 5, 2, 6, 0], optionCount(d));
      const item: ChoiceItem = {
        ...baseFields(ctx, prompt),
        type: 'choice',
        options: nums.map((n): CardContent => ({ id: `n${n}`, text: { ro: String(n) } })),
        correctId: `n${s.sides}`,
      };
      return item;
    }
    case 'which': {
      const target = pick(rng, [3, 4]);
      const correct = pick(rng, POLY.filter((s) => s.sides === target));
      const wrong = SHAPES.filter((s) => s.sides !== target);
      const { options, correctId } = textOptions(
        rng,
        { ro: correct.ro, en: correct.en },
        wrong.map((s) => ({ ro: s.ro, en: s.en })),
        optionCount(d),
      );
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Care figură are ${target} laturi${target === 4 ? ' și 4 colțuri' : ''}?`,
          en: `Which shape has ${target} sides${target === 4 ? ' and 4 corners' : ''}?`,
        }),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
    case 'sort': {
      const cards: CardContent[] = shuffle(rng, POLY).map((s, i) => ({ id: `s${i}`, text: { ro: s.ro, en: s.en } }));
      const item: SortItem = {
        ...baseFields(ctx, { ro: 'Pune fiecare figură la numărul ei de laturi.', en: 'Put each shape with its number of sides.' }),
        type: 'sort',
        categories: [
          { id: 'c3', label: { ro: '3 laturi', en: '3 sides' } },
          { id: 'c4', label: { ro: '4 laturi', en: '4 sides' } },
        ],
        cards: cards.map((c) => ({ ...c, categoryId: POLY.find((s) => s.ro === c.text?.ro)!.sides === 3 ? 'c3' : 'c4' })),
      };
      return item;
    }
    case 'gap': {
      const s = pick(rng, POLY);
      const corners = chance(rng, 0.4);
      const unit = corners ? { ro: 'colțuri', en: 'corners' } : { ro: 'laturi', en: 'sides' };
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Completează cu numărul potrivit.', en: 'Fill in the right number.' }),
        type: 'fill-gap',
        template: { ro: `${cap(s.roA)} are {{gap}} ${unit.ro}.`, en: `${cap(s.enA)} has {{gap}} ${unit.en}.` },
        options: stringOptions(rng, String(s.sides), ['3', '4', '5', '6', '2'], optionCount(d)),
        correct: String(s.sides),
      };
      return item;
    }
    case 'tf': {
      const facts: { ro: string; en: string; ok: boolean }[] = [
        { ro: 'Un triunghi are 3 laturi.', en: 'A triangle has 3 sides.', ok: true },
        { ro: 'Un triunghi are 4 colțuri.', en: 'A triangle has 4 corners.', ok: false },
        { ro: 'Un pătrat are 4 laturi egale.', en: 'A square has 4 equal sides.', ok: true },
        { ro: 'Un pătrat are 3 laturi.', en: 'A square has 3 sides.', ok: false },
        { ro: 'Un dreptunghi are 4 colțuri.', en: 'A rectangle has 4 corners.', ok: true },
        { ro: 'Un dreptunghi are 5 laturi.', en: 'A rectangle has 5 sides.', ok: false },
        { ro: 'Un cerc nu are colțuri.', en: 'A circle has no corners.', ok: true },
        { ro: 'Un cerc are 4 laturi.', en: 'A circle has 4 sides.', ok: false },
        { ro: 'Un ceas de perete rotund are forma unui cerc.', en: 'A round wall clock is shaped like a circle.', ok: true },
        { ro: 'O fereastră obișnuită are forma unui triunghi.', en: 'An ordinary window is shaped like a triangle.', ok: false },
      ];
      const f = pick(rng, facts);
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Adevărat sau fals: ${f.ro}`, en: `True or false: ${f.en}` }),
        type: 'true-false',
        correct: f.ok,
      };
      return item;
    }
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---- perimeter ---------------------------------------------------- */

type PerKind = 'triangle' | 'square' | 'rect' | 'missing' | 'tf' | 'concept';

function perimeter(ctx: Ctx): Item {
  const { rng, difficulty: d } = ctx;
  const kind = weighted<PerKind>(rng, [['triangle', 22], ['square', 18], ['rect', 22], ['missing', d >= 3 ? 18 : 6], ['tf', 12], ['concept', 6]]);
  const unit = chance(rng, 0.8) ? 'cm' : 'm';
  const hi = 6 + d * 3;
  const side = () => randInt(rng, 2, hi);
  const q = (n: number) => `${n} ${unit}`;

  const answer = (prompt: { ro: string; en: string }, correct: number, wrong: number[]): Item => {
    if (chance(rng, 0.5)) {
      const item: NumberInputItem = { ...baseFields(ctx, prompt), type: 'number-input', correct };
      return item;
    }
    const nums = numberOptions(rng, correct, wrong, optionCount(d), 1);
    const item: ChoiceItem = {
      ...baseFields(ctx, prompt),
      type: 'choice',
      options: nums.map((n): CardContent => ({ id: `n${n}`, text: { ro: String(n) } })),
      correctId: `n${correct}`,
    };
    return item;
  };
  const ask = { ro: `Care este perimetrul (în ${unit})?`, en: `What is the perimeter (in ${unit})?` };

  switch (kind) {
    case 'triangle': {
      const [a, b, c] = [side(), side(), side()];
      return answer(
        { ro: `Un triunghi are laturile de ${q(a)}, ${q(b)} și ${q(c)}. ${ask.ro}`, en: `A triangle has sides of ${q(a)}, ${q(b)} and ${q(c)}. ${ask.en}` },
        a + b + c,
        [a + b, a + c, b + c, a + b + c + 1, a + b + c - 1, a + b + c + 2],
      );
    }
    case 'square': {
      const a = side();
      return answer(
        { ro: `Un pătrat are latura de ${q(a)}. ${ask.ro}`, en: `A square has a side of ${q(a)}. ${ask.en}` },
        4 * a,
        [2 * a, 3 * a, a * a, 4 * a + 1, 4 * a - 1, 5 * a],
      );
    }
    case 'rect': {
      let [l, w] = [side(), side()];
      if (l === w) l += 1;
      return answer(
        { ro: `Un dreptunghi are lungimea de ${q(l)} și lățimea de ${q(w)}. ${ask.ro}`, en: `A rectangle is ${q(l)} long and ${q(w)} wide. ${ask.en}` },
        2 * (l + w),
        [l + w, l + 2 * w, 2 * l + w, l * w, 2 * (l + w) + 2, 2 * (l + w) - 2],
      );
    }
    case 'missing': {
      if (chance(rng, 0.5)) {
        const a = randInt(rng, 2, hi);
        const item: NumberInputItem = {
          ...baseFields(ctx, { ro: `Perimetrul unui pătrat este ${q(4 * a)}. Câți ${unit} măsoară o latură?`, en: `The perimeter of a square is ${q(4 * a)}. How many ${unit} is one side?` }),
          type: 'number-input',
          correct: a,
        };
        return item;
      }
      const [a, b, c] = [side(), side(), side()];
      const item: NumberInputItem = {
        ...baseFields(ctx, {
          ro: `Un triunghi are perimetrul de ${q(a + b + c)}. Două laturi au ${q(a)} și ${q(b)}. Câți ${unit} are a treia latură?`,
          en: `A triangle has a perimeter of ${q(a + b + c)}. Two sides are ${q(a)} and ${q(b)}. How many ${unit} is the third side?`,
        }),
        type: 'number-input',
        correct: c,
      };
      return item;
    }
    case 'tf': {
      const a = side();
      const truth = chance(rng, 0.5);
      const shown = truth ? 4 * a : pick(rng, [2 * a, 3 * a, a * a, 4 * a + 2].filter((x) => x !== 4 * a));
      const item: TrueFalseItem = {
        ...baseFields(ctx, {
          ro: `Adevărat sau fals: un pătrat cu latura de ${q(a)} are perimetrul de ${q(shown)}.`,
          en: `True or false: a square with a side of ${q(a)} has a perimeter of ${q(shown)}.`,
        }),
        type: 'true-false',
        correct: truth,
      };
      return item;
    }
    case 'concept': {
      const { options, correctId } = textOptions(
        rng,
        { ro: 'suma lungimilor tuturor laturilor', en: 'the sum of the lengths of all the sides' },
        [
          { ro: 'lungimea unei singure laturi', en: 'the length of just one side' },
          { ro: 'numărul de laturi', en: 'the number of sides' },
          { ro: 'spațiul din interiorul figurii', en: 'the space inside the shape' },
        ],
        optionCount(d),
      );
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Perimetrul unei figuri este…', en: 'The perimeter of a shape is…' }),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
  }
}

export const shapes: GeneratorFn = (params, ctx): Item => (params.topic === 'perimeter' ? perimeter(ctx) : names(ctx));
