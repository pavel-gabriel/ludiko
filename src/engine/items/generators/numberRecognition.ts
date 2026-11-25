/**
 * `number-recognition` generator (params: max). Item types: picture → number (choice / number-input),
 * picture-choice ("show me n"), number word → digit and digit → number word (choice).
 */
import type { CardContent, ChoiceItem, Item, NumberInputItem, PictureChoiceItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import { baseFields, chance, clamp, numberCards, numberOptions, optionCount, paramInt, pick, randInt, weighted } from './util';
import { THINGS } from './things';
import { blocksSpec, objectsSpec } from './visuals';
import { enWord, roWord } from './words';

type Kind = 'pictureChoice' | 'pictureInput' | 'showMe' | 'wordToDigit' | 'digitToWord';

export const numberRecognition: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(3, paramInt(params, 'max', 10));
  const n = randInt(rng, 1, clamp(Math.ceil(max * (0.45 + 0.14 * d)), 3, max));
  const thing = pick(rng, THINGS);
  const canWords = max <= 100;

  const visualFor = (v: number): VisualSpec =>
    v <= 20 && (v < 5 || chance(rng, 0.5)) ? objectsSpec(thing.icon, v) : blocksSpec(v);

  const kinds: [Kind, number][] = [['pictureChoice', 30], ['pictureInput', 15], ['showMe', 20]];
  if (canWords) kinds.push(['wordToDigit', 18], ['digitToWord', 17]);
  const kind = weighted(rng, kinds);

  const near = (v: number) => [v - 1, v + 1, v - 2, v + 2, v + 10, v - 10];

  switch (kind) {
    case 'pictureChoice': {
      const values = numberOptions(rng, n, near(n), optionCount(d), 0, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Ce număr este arătat?', en: 'Which number is shown?' }, visualFor(n)),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${n}`,
      };
      return item;
    }
    case 'pictureInput': {
      const item: NumberInputItem = {
        ...baseFields(ctx, { ro: 'Scrie numărul arătat.', en: 'Type the number shown.' }, visualFor(n)),
        type: 'number-input',
        correct: n,
      };
      return item;
    }
    case 'showMe': {
      const values = numberOptions(rng, n, near(n), optionCount(d), 1, Math.min(max, 20));
      const options: (CardContent & { visual: VisualSpec })[] = values.map((v) => ({
        id: `n${v}`,
        visual: objectsSpec(thing.icon, v),
      }));
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Arată numărul ${n}.`, en: `Show the number ${n}.` }),
        type: 'picture-choice',
        options,
        correctId: `n${n}`,
      };
      return item;
    }
    case 'wordToDigit': {
      const values = numberOptions(rng, n, near(n), optionCount(d), 0, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Care număr este „${roWord(n)}”?`,
          en: `Which number is “${enWord(n)}”?`,
        }),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${n}`,
      };
      return item;
    }
    case 'digitToWord': {
      const values = numberOptions(rng, n, near(n), optionCount(d), 0, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Cum se scrie cu litere numărul ${n}?`,
          en: `How do you write the number ${n} in words?`,
        }),
        type: 'choice',
        options: values.map((v) => ({ id: `n${v}`, text: { ro: roWord(v), en: enWord(v) } })),
        correctId: `n${n}`,
      };
      return item;
    }
  }
};
