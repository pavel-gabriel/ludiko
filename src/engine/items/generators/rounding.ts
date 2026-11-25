/**
 * `rounding` generator (params: max, to). Round a natural number to tens / hundreds / thousands ...
 *
 *   max: numbers are below max (default 1000);  to: rounding units to use, e.g. [10, 100] (default [10, 100]).
 *
 * Rule used (the Romanian school rule): look at the digit to the right; 0-4 round down, 5-9 round up
 * (so a number ending exactly in 5, 50, 500... rounds up). Item types: choice, number-input,
 * "between which two tens/hundreds...?", true-false; a number-line window with the number marked
 * (never the answer) is attached at low difficulty.
 */
import type { Item, LocalizedText, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, chance, paramInt, pick, randInt, shuffle, weighted } from './util';
import { fmt, numDigits } from './numfmt';
import { numChoice, numInput, randWithDigits, trueFalse } from './numItems';
import type { ChoiceItem } from '../../types';

export const roundTo = (n: number, unit: number): number => Math.floor(n / unit + 0.5) * unit;

const UNIT_RO: Record<number, { name: string; to: string }> = {
  10: { name: 'zeci', to: 'zeci' },
  100: { name: 'sute', to: 'sute' },
  1000: { name: 'mii', to: 'mii' },
  10000: { name: 'zeci de mii', to: 'zeci de mii' },
  100000: { name: 'sute de mii', to: 'sute de mii' },
};
const UNIT_EN: Record<number, string> = { 10: 'tens', 100: 'hundreds', 1000: 'thousands', 10000: 'ten thousands', 100000: 'hundred thousands' };

function unitList(params: Record<string, unknown>, max: number): number[] {
  const raw = Array.isArray(params.to) ? (params.to as unknown[]).filter((u): u is number => typeof u === 'number') : [10, 100];
  const ok = raw.filter((u) => UNIT_RO[u] && u < max);
  return ok.length ? ok : [10];
}

export const rounding: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(100, paramInt(params, 'max', 1000));
  const units = unitList(params, max);
  const unit = pick(rng, units);

  // the number is larger than the unit and not already a multiple of it
  const minW = numDigits(unit);
  const maxW = numDigits(max - 1);
  let n = 0;
  for (let t = 0; t < 40; t++) {
    const w = Math.max(minW, d <= 2 ? maxW : chance(rng, 0.7) ? maxW : randInt(rng, minW, maxW));
    n = randWithDigits(rng, Math.min(w, maxW), max - 1);
    if (n % unit !== 0 && n > unit) break;
  }
  if (n % unit === 0) n += Math.max(1, Math.floor(unit / 2) - 1);

  const lower = Math.floor(n / unit) * unit;
  const upper = lower + unit;
  const r = roundTo(n, unit);
  const wrongUnit = (u: number) => roundTo(n, u);
  const wrong = [
    r === lower ? upper : lower, // the other neighbour: classic confusion about the direction
    n, wrongUnit(unit * 10), wrongUnit(Math.max(1, unit / 10)), r + unit, r - unit,
    lower - unit, upper + unit,
  ].filter((v) => v !== r);

  const name = UNIT_RO[unit];
  const ask: LocalizedText = {
    ro: `Rotunjește numărul ${fmt(n)} la ${name.to}.`,
    en: `Round ${fmt(n)} to the nearest ${UNIT_EN[unit]?.replace(/s$/, '') ?? unit}.`,
  };
  const useLine = d <= 2 && chance(rng, 0.7);
  const step = Math.max(1, unit / 10);
  const visual: VisualSpec | undefined = useLine ? { kind: 'number-line', from: lower, to: upper, step, marks: [n] } : undefined;

  const kind = weighted<'choice' | 'input' | 'between' | 'tf'>(rng, [['choice', 34], ['input', 24], ['between', 20], ['tf', 22]]);
  switch (kind) {
    case 'choice':
      return numChoice(ctx, ask, r, wrong, { visual, must: [wrong[0]] });
    case 'input':
      return numInput(ctx, ask, r, visual);
    case 'between': {
      // which two consecutive multiples of the unit enclose n? (options differ by the unit)
      const pairs = [lower, lower - unit, lower + unit, lower - 2 * unit].filter((x) => x >= 0 && x + unit <= max);
      const opts = shuffle(rng, [...new Set(pairs)]).slice(0, ctx.difficulty <= 1 ? 3 : 4);
      if (!opts.includes(lower)) opts[0] = lower;
      const options = shuffle(rng, opts);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: `Între ce două ${name.name} consecutive se află ${fmt(n)}?`,
          en: `Between which two consecutive ${UNIT_EN[unit]} is ${fmt(n)}?`,
        }, visual),
        type: 'choice',
        options: options.map((x) => ({ id: `p${x}`, text: { ro: `${fmt(x)} și ${fmt(x + unit)}`, en: `${fmt(x)} and ${fmt(x + unit)}` } })),
        correctId: `p${lower}`,
      };
      return item;
    }
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? r : pick(rng, wrong.filter((v) => v >= 0));
      return trueFalse(
        ctx,
        {
          ro: `${fmt(n)} rotunjit la ${name.to} este ${fmt(shown)}`,
          en: `${fmt(n)} rounded to the nearest ${UNIT_EN[unit]?.replace(/s$/, '') ?? unit} is ${fmt(shown)}`,
        },
        truth,
      );
    }
  }
};

registerGenerator('rounding', rounding);
