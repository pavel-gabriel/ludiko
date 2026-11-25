/**
 * Item builders shared by the grade III-IV number generators (multiplication, division, equation,
 * order-of-operations, rounding, number-reading). Numbers shown to the child go through `fmt`
 * (grouped from 10 000 up); answers typed by the child (`number-input`, `fill-gap`) are plain digits.
 */
import type { ChoiceItem, FillGapItem, LocalizedText, NumberInputItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorContext } from './registry';
import { baseFields, numberOptions, optionCount, type Rng } from './util';
import { fmtCards } from './numfmt';

/** Choice of numbers: the correct one plus plausible wrong values (unique, >= 0). */
export function numChoice(
  ctx: GeneratorContext,
  prompt: LocalizedText,
  correct: number,
  wrong: readonly number[],
  opts: { visual?: VisualSpec; hi?: number; must?: readonly number[] } = {},
): ChoiceItem {
  const values = numberOptions(ctx.rng, correct, wrong, optionCount(ctx.difficulty), 0, opts.hi);
  // wrong answers that MUST be offered (the classic mistake of the skill): swap them in for other distractors
  const musts = [...new Set(opts.must ?? [])].filter((v) => Number.isInteger(v) && v >= 0 && v !== correct && (opts.hi === undefined || v <= opts.hi));
  for (const v of musts.slice(0, values.length - 2)) {
    if (values.includes(v)) continue;
    const slot = values.findIndex((x) => x !== correct && !musts.includes(x));
    if (slot >= 0) values[slot] = v;
  }
  return {
    ...baseFields(ctx, prompt, opts.visual),
    type: 'choice',
    options: fmtCards(values),
    correctId: `n${correct}`,
  };
}

export function numInput(ctx: GeneratorContext, prompt: LocalizedText, correct: number, visual?: VisualSpec): NumberInputItem {
  return { ...baseFields(ctx, prompt, visual), type: 'number-input', correct };
}

/**
 * Fill-gap with a numeric gap. Options are offered only when `withOptions` and every number is below
 * 10 000 (options are compared as text, so they must be plain digits); otherwise the child types the answer.
 */
export function numGap(
  ctx: GeneratorContext,
  template: LocalizedText,
  correct: number,
  wrong: readonly number[],
  withOptions: boolean,
  visual?: VisualSpec,
  prompt: LocalizedText = { ro: 'Completează cu numărul care lipsește.', en: 'Fill in the missing number.' },
): FillGapItem {
  const useOptions = withOptions && correct < 10000 && wrong.every((w) => w < 10000);
  return {
    ...baseFields(ctx, prompt, visual),
    type: 'fill-gap',
    template,
    ...(useOptions
      ? { options: numberOptions(ctx.rng, correct, wrong, optionCount(ctx.difficulty), 0, 9999).map(String) }
      : {}),
    correct: String(correct),
  };
}

export function trueFalse(ctx: GeneratorContext, statement: LocalizedText, truth: boolean): TrueFalseItem {
  return {
    ...baseFields(ctx, {
      ro: `Adevărat sau fals: ${statement.ro}`,
      en: `True or false: ${statement.en ?? statement.ro}`,
    }),
    type: 'true-false',
    correct: truth,
  };
}

/** Same text in both languages */
export const same = (s: string): LocalizedText => ({ ro: s, en: s });

/** Random number with `w` digits (leading digit non-zero) not above `top` */
export function randWithDigits(rng: Rng, w: number, top: number): number {
  const lo = w <= 1 ? 1 : 10 ** (w - 1);
  const hi = Math.min(10 ** w - 1, top);
  return hi <= lo ? lo : lo + Math.floor(rng() * (hi - lo + 1));
}
