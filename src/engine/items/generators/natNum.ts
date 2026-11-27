/** Shared helpers for the numeric natural-science generators (fiz, chim, bio): number display and numeric items. */
import type { ChoiceItem, Item, LocalizedText, NumberInputItem, VisualSpec } from '../../types';
import { fmt } from './numfmt';
import type { GeneratorContext } from './registry';
import { baseFields, optionCount, shuffle } from './util';

const round6 = (v: number): number => Number(v.toFixed(6));

/** Romanian display of a number: decimal comma, thin grouping of the integer part ("12 500", "2,5") */
export function disp(v: number): string {
  const r = round6(v);
  const neg = r < 0 ? '-' : '';
  const [i, f] = String(Math.abs(r)).split('.');
  return neg + fmt(Number(i)) + (f ? `,${f}` : '');
}

/**
 * An item whose answer is the number `value`: a typed number when it is an integer, otherwise a choice
 * among decimal-comma options (typing "2,5" on a phone is a chore and not the skill being checked).
 */
export function numericItem(ctx: GeneratorContext, prompt: LocalizedText, value: number, visual?: VisualSpec): Item {
  const { rng, difficulty } = ctx;
  const v = round6(value);
  if (Number.isInteger(v)) {
    const item: NumberInputItem = { ...baseFields(ctx, prompt, visual), type: 'number-input', correct: v };
    return item;
  }
  const cands = [v * 10, v / 10, v * 100, v / 100, v * 2, v / 2, v + 1, v - 1, v * 1000, v + 0.5, v - 0.5].map(round6).filter((x) => x > 0 && x !== v);
  const wrong = [...new Set(cands)].slice(0, 12);
  const picked = shuffle(rng, wrong).slice(0, optionCount(difficulty) - 1);
  const texts = shuffle(rng, [v, ...picked]);
  const item: ChoiceItem = {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: disp(t) } })),
    correctId: `o${texts.indexOf(v)}`,
  };
  return item;
}

/** A string-list param written either as one string ("length") or as a list (["length", "mass"]) */
export function listParam(params: Record<string, unknown>, key: string, fallback: string[]): string[] {
  const v = params[key];
  if (typeof v === 'string' && v) return [v];
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) return v as string[];
  return fallback;
}
