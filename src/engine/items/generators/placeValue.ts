/**
 * `place-value` generator (params: max). Item types: blocks → number (choice / number-input),
 * "how many tens/ones does n have?", fill-gap decompositions, picture-choice of blocks, and match
 * (blocks ↔ number).
 */
import type {
  CardContent, ChoiceItem, FillGapItem, Item, MatchItem, NumberInputItem, PictureChoiceItem,
} from '../../types';
import type { GeneratorFn } from './registry';
import {
  baseFields, chance, clamp, numberCards, numberOptions, optionCount, paramInt, randInt, shuffle, visualKey, weighted,
} from './util';
import { blocksSpec } from './visuals';

type Kind = 'blocksChoice' | 'blocksInput' | 'howMany' | 'decompose' | 'blocksPick' | 'match' | 'buildNumber';

export const placeValue: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(20, paramInt(params, 'max', 100));
  /** Two-digit numbers below 100 (100 itself is a different picture and not needed here) */
  const top = Math.min(max, 99);
  const pickN = () => randInt(rng, 11, clamp(Math.ceil(top * (0.45 + 0.13 * d)), 15, top));
  const total = optionCount(d);
  const kind = weighted<Kind>(rng, [
    ['blocksChoice', 18], ['blocksInput', 14], ['howMany', 20], ['decompose', 16], ['blocksPick', 12], ['match', 10], ['buildNumber', 10],
  ]);

  const n = pickN();
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  /** Wrong numbers a child plausibly picks: swapped digits, off by one/ten */
  const nearN = [ones * 10 + tens, n + 1, n - 1, n + 10, n - 10, tens, ones];

  switch (kind) {
    case 'blocksChoice': {
      const values = numberOptions(rng, n, nearN, total, 0, top);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Ce număr arată cuburile?', en: 'What number do the blocks show?' }, blocksSpec(n)),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${n}`,
      };
      return item;
    }
    case 'blocksInput': {
      const item: NumberInputItem = {
        ...baseFields(ctx, { ro: 'Scrie numărul arătat de cuburi.', en: 'Type the number the blocks show.' }, blocksSpec(n)),
        type: 'number-input',
        correct: n,
      };
      return item;
    }
    case 'howMany': {
      const askTens = chance(rng, 0.6);
      const correct = askTens ? tens : ones;
      const values = numberOptions(rng, correct, askTens ? [ones, tens + 1, tens - 1, n] : [tens, ones + 1, ones - 1, n % 5], total, 0, 9);
      const showBlocks = d <= 2 && chance(rng, 0.5);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          askTens
            ? { ro: `Câte zeci are ${n}?`, en: `How many tens does ${n} have?` }
            : { ro: `Câte unități are ${n}?`, en: `How many ones does ${n} have?` },
          showBlocks ? blocksSpec(n) : undefined,
        ),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${correct}`,
      };
      return item;
    }
    case 'decompose': {
      const variant = weighted<'tensOnes' | 'plus'>(rng, [['tensOnes', 50], ['plus', 50]]);
      if (variant === 'tensOnes') {
        const t = `${n} = {{gap}} zeci + ${ones} unități`;
        const te = `${n} = {{gap}} tens + ${ones} ones`;
        const item: FillGapItem = {
          ...baseFields(ctx, { ro: 'Completează cu numărul care lipsește.', en: 'Fill in the missing number.' }),
          type: 'fill-gap',
          template: { ro: t, en: te },
          options: numberOptions(rng, tens, [tens + 1, tens - 1, ones, 10 - tens], total, 0, 9).map(String),
          correct: String(tens),
        };
        return item;
      }
      const t = `${n} = ${tens * 10} + {{gap}}`;
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Completează cu numărul care lipsește.', en: 'Fill in the missing number.' }),
        type: 'fill-gap',
        template: { ro: t, en: t },
        options: numberOptions(rng, ones, [tens, ones + 1, ones - 1, 10 - ones, n], total, 0, top).map(String),
        correct: String(ones),
      };
      return item;
    }
    case 'blocksPick': {
      const values = numberOptions(rng, n, nearN, total, 1, top);
      const options = values
        .map((v) => ({ id: `n${v}`, visual: blocksSpec(v) }))
        .filter((o, i, arr) => arr.findIndex((x) => visualKey(x.visual) === visualKey(o.visual)) === i);
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Alege cuburile pentru numărul ${n}.`, en: `Pick the blocks for the number ${n}.` }),
        type: 'picture-choice',
        options,
        correctId: `n${n}`,
      };
      return item;
    }
    case 'match': {
      const nums = new Set<number>([n]);
      while (nums.size < 3) nums.add(pickN());
      const pairs = [...nums].map((v, i) => ({
        left: { id: `l${i}`, visual: blocksSpec(v) } as CardContent,
        right: { id: `r${i}`, text: { ro: String(v) } } as CardContent,
      }));
      const item: MatchItem = {
        ...baseFields(ctx, { ro: 'Potrivește cuburile cu numărul lor.', en: 'Match the blocks with their number.' }),
        type: 'match',
        pairs,
      };
      return item;
    }
    case 'buildNumber': {
      const values = numberOptions(rng, n, nearN, total, 10, top);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Care număr are ${tens} ${tens === 1 ? 'zece' : 'zeci'} și ${ones} ${ones === 1 ? 'unitate' : 'unități'}?`,
          en: `Which number has ${tens} ${tens === 1 ? 'ten' : 'tens'} and ${ones} ${ones === 1 ? 'one' : 'ones'}?`,
        }),
        type: 'choice',
        options: shuffle(rng, numberCards(values)),
        correctId: `n${n}`,
      };
      return item;
    }
  }
};
