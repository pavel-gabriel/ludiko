/** Shared helper for the labelled "which one is it?" choice items of the Romanian gimnaziu generators. */
import type { ChoiceItem, LocalizedText } from '../../types';
import type { GeneratorContext } from './registry';
import { baseFields, optionCount, shuffle } from './util';

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-');

/**
 * A choice item whose options are labels from `pool` (the correct one plus distractors).
 * 3 options at the easiest level, else 4 (fewer if the pool is small).
 */
export function labelChoice(ctx: GeneratorContext, prompt: LocalizedText, correct: string, pool: readonly string[]): ChoiceItem {
  const { rng, difficulty } = ctx;
  const count = Math.min(optionCount(difficulty), pool.length);
  const wrong = shuffle(
    rng,
    pool.filter((x) => x !== correct),
  ).slice(0, count - 1);
  const options = shuffle(rng, [correct, ...wrong]).map((l) => ({ id: `l_${slug(l)}`, text: { ro: l } }));
  return {
    ...baseFields(ctx, prompt),
    type: 'choice',
    options,
    correctId: `l_${slug(correct)}`,
  };
}

/** The labels of `all` named in `wanted`; every label when `wanted` is absent or names fewer than `min` */
export function restrictLabels(all: readonly string[], wanted: unknown, min = 3): string[] {
  if (Array.isArray(wanted)) {
    const sel = all.filter((l) => (wanted as unknown[]).includes(l));
    if (sel.length >= min) return sel;
  }
  return [...all];
}
