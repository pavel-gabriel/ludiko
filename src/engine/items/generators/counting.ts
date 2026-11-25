/**
 * `counting` generator (params: max). Item types: choice / number-input over an `objects` or
 * `base10-blocks` picture, picture-choice, "what comes after/before", fill-gap sequences, skip counting.
 */
import type { ChoiceItem, FillGapItem, Item, NumberInputItem, PictureChoiceItem, VisualSpec } from '../../types';
import type { GeneratorFn, GeneratorContext } from './registry';
import {
  baseFields, chance, clamp, numberCards, numberOptions, optionCount, paramInt, pick, randInt, shuffle,
  visualKey, weighted,
} from './util';
import { THINGS } from './things';
import { blocksSpec, objectsSpec } from './visuals';

type Kind = 'objChoice' | 'objInput' | 'picChoice' | 'neighbour' | 'between' | 'blocksChoice' | 'blocksInput' | 'skip';

function numberChoice(
  ctx: GeneratorContext,
  prompt: { ro: string; en: string },
  correct: number,
  candidates: number[],
  hi: number,
  visual?: VisualSpec,
): ChoiceItem {
  const values = numberOptions(ctx.rng, correct, candidates, optionCount(ctx.difficulty), 0, hi);
  return {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: numberCards(values),
    correctId: `n${correct}`,
  };
}

export const counting: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(3, paramInt(params, 'max', 10));
  const objCap = Math.min(max, 20);
  const scale = (cap: number, lo = 2) => clamp(Math.ceil(cap * (0.4 + 0.15 * d)), Math.min(lo, cap), cap);

  const kinds: [Kind, number][] =
    max <= 20
      ? [['objChoice', 25], ['objInput', 15], ['picChoice', 20], ['neighbour', 20], ['between', 20]]
      : [['blocksChoice', 20], ['blocksInput', 15], ['neighbour', 20], ['skip', 25], ['between', 10], ['objChoice', 10]];
  const kind = weighted(rng, kinds);
  const thing = pick(rng, THINGS);

  switch (kind) {
    case 'objChoice': {
      const n = randInt(rng, 1, scale(objCap));
      return numberChoice(
        ctx,
        { ro: `Câte ${thing.ro} sunt?`, en: `How many ${thing.en} are there?` },
        n,
        [n - 1, n + 1, n - 2, n + 2],
        max,
        objectsSpec(thing.icon, n),
      );
    }
    case 'objInput': {
      const n = randInt(rng, 1, scale(objCap));
      const item: NumberInputItem = {
        ...baseFields(
          ctx,
          { ro: `Numără ${thing.ro}. Scrie câte sunt.`, en: `Count the ${thing.en}. Type how many there are.` },
          objectsSpec(thing.icon, n),
        ),
        type: 'number-input',
        correct: n,
      };
      return item;
    }
    case 'picChoice': {
      const n = randInt(rng, 2, Math.max(2, scale(objCap)));
      const counts = numberOptions(rng, n, [n - 1, n + 1, n - 2, n + 2], optionCount(d), 1, objCap);
      const options = counts.map((c) => ({ id: `n${c}`, visual: objectsSpec(thing.icon, c) }));
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Alege imaginea cu ${n} ${thing.ro}.`, en: `Pick the picture with ${n} ${thing.en}.` }),
        type: 'picture-choice',
        options: options.filter((o, i, arr) => arr.findIndex((x) => visualKey(x.visual) === visualKey(o.visual)) === i),
        correctId: `n${n}`,
      };
      return item;
    }
    case 'neighbour': {
      const after = chance(rng, 0.5);
      const n = after ? randInt(rng, 0, scale(max - 1, 1)) : randInt(rng, 1, scale(max, 2));
      const correct = after ? n + 1 : n - 1;
      const visual: VisualSpec | undefined =
        max <= 20 && chance(rng, 0.6) ? { kind: 'number-line', from: 0, to: Math.max(10, max), step: 1, marks: [n] } : undefined;
      return numberChoice(
        ctx,
        after
          ? { ro: `Ce număr vine imediat după ${n}?`, en: `Which number comes right after ${n}?` }
          : { ro: `Ce număr vine imediat înainte de ${n}?`, en: `Which number comes right before ${n}?` },
        correct,
        after ? [n - 1, n + 2, n + 3, n - 2, n + 10] : [n + 1, n - 2, n - 3, n + 2, n - 10],
        max,
        visual,
      );
    }
    case 'between': {
      const n = randInt(rng, 1, scale(max - 1, 1));
      const values = numberOptions(rng, n, [n - 1, n + 1, n + 2, n - 2, n + 10, n - 10], optionCount(d), 0, max);
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Ce număr lipsește?', en: 'Which number is missing?' }),
        type: 'fill-gap',
        template: { ro: `${n - 1}, {{gap}}, ${n + 1}`, en: `${n - 1}, {{gap}}, ${n + 1}` },
        options: values.map(String),
        correct: String(n),
      };
      return item;
    }
    case 'blocksChoice':
    case 'blocksInput': {
      const hi = Math.min(max, 999);
      const n = randInt(rng, 11, clamp(Math.ceil(hi * (0.4 + 0.15 * d)), 12, hi));
      const prompt = { ro: 'Ce număr arată cuburile?', en: 'What number do the blocks show?' };
      if (kind === 'blocksInput') {
        const item: NumberInputItem = { ...baseFields(ctx, prompt, blocksSpec(n)), type: 'number-input', correct: n };
        return item;
      }
      return numberChoice(ctx, prompt, n, [n + 1, n - 1, n + 10, n - 10, (n % 10) * 10 + Math.floor(n / 10)], max, blocksSpec(n));
    }
    case 'skip': {
      const steps = [2, 5, 10].filter((s) => Math.floor(max / s) >= 4);
      const step = pick(rng, steps);
      const startK = randInt(rng, 1, Math.floor(max / step) - 3);
      const terms = [0, 1, 2, 3].map((i) => step * (startK + i));
      const gapAt = randInt(rng, 1, 3);
      const correct = terms[gapAt];
      const values = numberOptions(rng, correct, [correct + step, correct - step, correct + 1, correct - 1], optionCount(d), 0, max);
      const template = terms.map((t, i) => (i === gapAt ? '{{gap}}' : String(t))).join(', ');
      const item: FillGapItem = {
        ...baseFields(ctx, {
          ro: `Numără din ${step} în ${step}. Ce număr lipsește?`,
          en: `Count in steps of ${step}. Which number is missing?`,
        }),
        type: 'fill-gap',
        template: { ro: template, en: template },
        options: shuffle(rng, values).map(String),
        correct: String(correct),
      };
      return item;
    }
  }
};
