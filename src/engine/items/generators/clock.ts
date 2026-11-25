/**
 * `clock` generator (params: minutes, deltas, max). Reads a clock visual (12-hour dial):
 *  - choice / fill-gap: "Ce oră arată ceasul?" (answers as Romanian phrase or digital time)
 *  - picture-choice: "Care ceas arată ora 3 și un sfert?"
 *  - true-false: a statement about the clock
 *  - choice: "Peste 30 de minute ce oră va fi?" (elapsed time, when `deltas` is given)
 * `minutes` = the minute values the clock may show (full hours: [0]; half: [0, 30]; ...).
 */
import type { ChoiceItem, FillGapItem, Item, LocalizedText, PictureChoiceItem, TrueFalseItem, VisualSpec } from '../../types';
import type { GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, optionCount, pick, randInt, shuffle, weighted } from './util';
import { digitalTime, hoursText, minutesText, nextHour, stringOptions, textOptions, timeText } from './measureText';

interface Time {
  h: number; // 1..12
  m: number;
}

const key = (t: Time) => `${t.h}:${t.m}`;
const clockSpec = (t: Time): VisualSpec => ({ kind: 'clock', hours: t.h, minutes: t.m });

function paramNumbers(params: Record<string, unknown>, key: string, fallback: number[]): number[] {
  const v = params[key];
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number') ? (v as number[]) : fallback;
}

/** Times a child plausibly confuses with `t`, restricted to the allowed minute values. */
function confusions(rng: Rng, t: Time, minutes: number[]): Time[] {
  const out: Time[] = [];
  const add = (h: number, m: number) => {
    const hh = ((((h - 1) % 12) + 12) % 12) + 1;
    if (minutes.includes(m) && !(hh === t.h && m === t.m)) out.push({ h: hh, m });
  };
  add(t.h + 1, t.m);
  add(t.h - 1, t.m);
  // hands swapped: the minute hand read as the hour
  if (t.m % 5 === 0) add(t.m / 5 || 12, t.h * 5 === 60 ? 0 : (t.h * 5) % 60);
  for (const m of minutes) {
    add(t.h, m);
    add(t.h + 1, m);
  }
  for (let i = 0; i < 6; i++) add(randInt(rng, 1, 12), pick(rng, minutes));
  return out;
}

function distinctTimes(rng: Rng, t: Time, minutes: number[], count: number): Time[] {
  const seen = new Set<string>([key(t)]);
  const out: Time[] = [];
  for (const c of shuffle(rng, confusions(rng, t, minutes))) {
    if (out.length >= count) break;
    if (seen.has(key(c))) continue;
    seen.add(key(c));
    out.push(c);
  }
  return out;
}

const phrase = (t: Time, words: boolean): LocalizedText => (words ? timeText(t.h, t.m) : { ro: digitalTime(t.h, t.m), en: digitalTime(t.h, t.m) });

function deltaText(delta: number): LocalizedText {
  if (delta === 60) return { ro: 'peste o oră', en: 'in 1 hour' };
  if (delta % 60 === 0) {
    const h = hoursText(delta / 60);
    return { ro: `peste ${h.ro}`, en: `in ${h.en}` };
  }
  const m = minutesText(delta);
  return { ro: `peste ${m.ro}`, en: `in ${m.en}` };
}

function addMinutes(t: Time, delta: number): Time {
  const total = (((t.h % 12) * 60 + t.m + delta) % 720 + 720) % 720;
  return { h: Math.floor(total / 60) || 12, m: total % 60 };
}

type Kind = 'read' | 'readGap' | 'pick' | 'tf' | 'elapsed';

export const clock: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const minutes = paramNumbers(params, 'minutes', [0]);
  const deltas = paramNumbers(params, 'deltas', []);
  const words = chance(rng, 0.5);
  const t: Time = { h: randInt(rng, 1, 12), m: pick(rng, minutes) };
  const total = optionCount(d);

  const kind = weighted<Kind>(rng, [
    ['read', 30],
    ['readGap', 18],
    ['pick', 22],
    ['tf', 14],
    ['elapsed', deltas.length ? 20 : 0],
  ]);

  switch (kind) {
    case 'read': {
      const { options, correctId } = textOptions(
        rng,
        phrase(t, words),
        distinctTimes(rng, t, minutes, 6).map((c) => phrase(c, words)),
        total,
      );
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Ce oră arată ceasul?', en: 'What time does the clock show?' }, clockSpec(t)),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
    case 'readGap': {
      const correct = digitalTime(t.h, t.m);
      const options = stringOptions(rng, correct, distinctTimes(rng, t, minutes, 6).map((c) => digitalTime(c.h, c.m)), total);
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Ce oră arată ceasul? Completează.', en: 'What time does the clock show? Fill in the gap.' }, clockSpec(t)),
        type: 'fill-gap',
        template: { ro: 'Ceasul arată ora {{gap}}.', en: 'The clock shows {{gap}}.' },
        options,
        correct,
      };
      return item;
    }
    case 'pick': {
      const wrong = distinctTimes(rng, t, minutes, total - 1);
      const opts = shuffle(rng, [t, ...wrong]);
      const label = phrase(t, words);
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Care ceas arată ${label.ro}?`, en: `Which clock shows ${label.en}?` }),
        type: 'picture-choice',
        options: opts.map((o) => ({ id: `t${o.h}_${o.m}`, visual: clockSpec(o) })),
        correctId: `t${t.h}_${t.m}`,
      };
      return item;
    }
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? t : (distinctTimes(rng, t, minutes, 1)[0] ?? { h: nextHour(t.h), m: t.m });
      const label = phrase(shown, words);
      const item: TrueFalseItem = {
        ...baseFields(
          ctx,
          { ro: `Adevărat sau fals: ceasul arată ${label.ro}.`, en: `True or false: the clock shows ${label.en}.` },
          clockSpec(t),
        ),
        type: 'true-false',
        correct: truth,
      };
      return item;
    }
    case 'elapsed': {
      const delta = pick(rng, deltas);
      const result = addMinutes(t, delta);
      const when = deltaText(delta);
      const wrong: Time[] = [
        t,
        { h: nextHour(result.h), m: result.m },
        { h: ((result.h + 10) % 12) + 1, m: result.m },
        ...deltas.filter((x) => x !== delta).map((x) => addMinutes(t, x)),
        ...distinctTimes(rng, result, minutes, 4),
      ].filter((c) => key(c) !== key(result));
      const { options, correctId } = textOptions(
        rng,
        phrase(result, words),
        wrong.map((c) => phrase(c, words)),
        total,
      );
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          {
            ro: `Ceasul arată ora din imagine. Ce oră va fi ${when.ro}?`,
            en: `The clock shows the time in the picture. What time will it be ${when.en}?`,
          },
          clockSpec(t),
        ),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
  }
};
