/**
 * `time-units` generator (params: topic 'calendar' | 'hm', max).
 *  - calendar: zi, săptămână, lună, an (days in a week, months in a year, what comes next, ordering)
 *  - hm: ore and minute (1 oră = 60 de minute, jumătate de oră, durations between two full hours)
 */
import type { CardContent, ChoiceItem, FillGapItem, Item, NumberInputItem, OrderItem, TrueFalseItem } from '../../types';
import type { GeneratorFn } from './registry';
import { baseFields, chance, numberOptions, optionCount, pick, randInt, shuffle, weighted } from './util';
import { hoursText, minutesText, stringOptions, textOptions, weeksText, yearsText } from './measureText';

const DAYS: [string, string][] = [
  ['luni', 'Monday'], ['marți', 'Tuesday'], ['miercuri', 'Wednesday'], ['joi', 'Thursday'],
  ['vineri', 'Friday'], ['sâmbătă', 'Saturday'], ['duminică', 'Sunday'],
];
const MONTHS: [string, string][] = [
  ['ianuarie', 'January'], ['februarie', 'February'], ['martie', 'March'], ['aprilie', 'April'], ['mai', 'May'],
  ['iunie', 'June'], ['iulie', 'July'], ['august', 'August'], ['septembrie', 'September'], ['octombrie', 'October'],
  ['noiembrie', 'November'], ['decembrie', 'December'],
];

type Kind = 'count' | 'next' | 'order' | 'multi' | 'tf' | 'longer';

function calendar(ctx: Parameters<GeneratorFn>[1]): Item {
  const { rng, difficulty: d } = ctx;
  const kind = weighted<Kind>(rng, [['count', 22], ['next', 24], ['order', 14], ['multi', d >= 2 ? 20 : 8], ['tf', 14], ['longer', 10]]);
  switch (kind) {
    case 'count': {
      const facts: { ro: string; en: string; n: number; wrong: number[] }[] = [
        { ro: 'Câte zile are o săptămână?', en: 'How many days are in a week?', n: 7, wrong: [5, 6, 8, 10, 12] },
        { ro: 'Câte luni are un an?', en: 'How many months are in a year?', n: 12, wrong: [10, 11, 13, 7, 52] },
        { ro: 'Câte zile are luna aprilie?', en: 'How many days does April have?', n: 30, wrong: [28, 29, 31, 12] },
        { ro: 'Câte zile are luna mai?', en: 'How many days does May have?', n: 31, wrong: [28, 29, 30, 12] },
        { ro: 'Câte zile are luna iunie?', en: 'How many days does June have?', n: 30, wrong: [28, 29, 31, 12] },
      ];
      const f = pick(rng, facts);
      const nums = numberOptions(rng, f.n, f.wrong, optionCount(d));
      if (chance(rng, 0.5)) {
        const item: ChoiceItem = {
          ...baseFields(ctx, { ro: f.ro, en: f.en }),
          type: 'choice',
          options: nums.map((n): CardContent => ({ id: `n${n}`, text: { ro: String(n) } })),
          correctId: `n${f.n}`,
        };
        return item;
      }
      const item: NumberInputItem = { ...baseFields(ctx, { ro: f.ro, en: f.en }), type: 'number-input', correct: f.n };
      return item;
    }
    case 'next': {
      const useDays = chance(rng, 0.5);
      const list = useDays ? DAYS : MONTHS;
      const i = randInt(rng, 0, list.length - 1);
      const after = chance(rng, 0.6);
      const target = list[(i + (after ? 1 : list.length - 1)) % list.length];
      const wrong = list.filter((_, j) => j !== (i + (after ? 1 : list.length - 1)) % list.length && j !== i);
      const { options, correctId } = textOptions(
        rng,
        { ro: target[0], en: target[1] },
        wrong.map((w) => ({ ro: w[0], en: w[1] })),
        optionCount(d),
      );
      const what = useDays ? { ro: 'zi', en: 'day' } : { ro: 'lună', en: 'month' };
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          after
            ? { ro: `Ce ${what.ro} urmează după ${list[i][0]}?`, en: `Which ${what.en} comes after ${list[i][1]}?` }
            : { ro: `Ce ${what.ro} este înainte de ${list[i][0]}?`, en: `Which ${what.en} comes before ${list[i][1]}?` },
        ),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
    case 'order': {
      const useDays = chance(rng, 0.6);
      const list = useDays ? DAYS : MONTHS;
      const len = d >= 3 ? 5 : 4;
      const start = randInt(rng, 0, list.length - len);
      const seq = list.slice(start, start + len);
      const cards: CardContent[] = shuffle(rng, seq).map((s, i) => ({ id: `c${i}`, text: { ro: s[0], en: s[1] } }));
      const correctOrder = seq.map((s) => cards.find((c) => c.text?.ro === s[0])!.id);
      const item: OrderItem = {
        ...baseFields(
          ctx,
          useDays
            ? { ro: 'Pune zilele în ordinea din săptămână.', en: 'Put the days in the order of the week.' }
            : { ro: 'Pune lunile în ordinea din an.', en: 'Put the months in the order of the year.' },
        ),
        type: 'order',
        cards,
        correctOrder,
      };
      return item;
    }
    case 'multi': {
      const n = randInt(rng, 2, d >= 3 ? 5 : 4);
      const useWeeks = chance(rng, 0.5);
      const answer = useWeeks ? n * 7 : n * 12;
      const q = useWeeks
        ? { ro: `Câte zile sunt în ${weeksText(n).ro}?`, en: `How many days are in ${weeksText(n).en}?` }
        : { ro: `Câte luni sunt în ${yearsText(n).ro}?`, en: `How many months are in ${yearsText(n).en}?` };
      const item: NumberInputItem = { ...baseFields(ctx, q), type: 'number-input', correct: answer };
      return item;
    }
    case 'tf': {
      const facts: { ro: string; en: string; ok: boolean }[] = [
        { ro: 'O săptămână are 7 zile.', en: 'A week has 7 days.', ok: true },
        { ro: 'O săptămână are 5 zile.', en: 'A week has 5 days.', ok: false },
        { ro: 'Un an are 12 luni.', en: 'A year has 12 months.', ok: true },
        { ro: 'Un an are 10 luni.', en: 'A year has 10 months.', ok: false },
        { ro: 'Sâmbăta vine după vineri.', en: 'Saturday comes after Friday.', ok: true },
        { ro: 'Duminica vine înainte de sâmbătă.', en: 'Sunday comes before Saturday.', ok: false },
        { ro: 'Luna martie vine după februarie.', en: 'March comes after February.', ok: true },
        { ro: 'Luna iunie vine înainte de mai.', en: 'June comes before May.', ok: false },
        { ro: 'Ianuarie este prima lună a anului.', en: 'January is the first month of the year.', ok: true },
        { ro: 'Decembrie este prima lună a anului.', en: 'December is the first month of the year.', ok: false },
      ];
      const f = pick(rng, facts);
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Adevărat sau fals: ${f.ro}`, en: `True or false: ${f.en}` }),
        type: 'true-false',
        correct: f.ok,
      };
      return item;
    }
    case 'longer': {
      const pairs: { big: { ro: string; en: string }; small: { ro: string; en: string } }[] = [
        { big: { ro: 'o săptămână', en: 'a week' }, small: { ro: 'o zi', en: 'a day' } },
        { big: { ro: 'un an', en: 'a year' }, small: { ro: 'o lună', en: 'a month' } },
        { big: { ro: 'o lună', en: 'a month' }, small: { ro: 'o săptămână', en: 'a week' } },
        { big: { ro: 'un an', en: 'a year' }, small: { ro: 'o săptămână', en: 'a week' } },
        { big: { ro: 'o zi', en: 'a day' }, small: { ro: 'o oră', en: 'an hour' } },
      ];
      const p = pick(rng, pairs);
      const longer = chance(rng, 0.5);
      const { options, correctId } = textOptions(rng, longer ? p.big : p.small, [longer ? p.small : p.big], 2);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          longer
            ? { ro: `Ce durează mai mult: ${p.big.ro} sau ${p.small.ro}?`, en: `Which lasts longer: ${p.big.en} or ${p.small.en}?` }
            : { ro: `Ce durează mai puțin: ${p.big.ro} sau ${p.small.ro}?`, en: `Which is shorter: ${p.big.en} or ${p.small.en}?` },
        ),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
  }
}

type HmKind = 'toMin' | 'toHours' | 'fact' | 'duration' | 'half' | 'tf';

function hm(ctx: Parameters<GeneratorFn>[1]): Item {
  const { rng, difficulty: d } = ctx;
  const kind = weighted<HmKind>(rng, [['toMin', 22], ['toHours', 16], ['fact', 16], ['duration', 22], ['half', 14], ['tf', 12]]);
  switch (kind) {
    case 'toMin': {
      const h = randInt(rng, 1, d >= 3 ? 5 : 3);
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Transformă în minute (min).', en: 'Convert to minutes (min).' }),
        type: 'fill-gap',
        template: { ro: `${hoursText(h).ro} = {{gap}} min`, en: `${hoursText(h).en} = {{gap}} min` },
        options: stringOptions(rng, String(h * 60), [h * 10, h * 100, h * 60 + 30, h * 60 - 30, (h + 1) * 60, h * 30].filter((x) => x > 0 && x !== h * 60).map(String), optionCount(d)),
        correct: String(h * 60),
      };
      return item;
    }
    case 'toHours': {
      const h = randInt(rng, 1, d >= 3 ? 5 : 3);
      const { options, correctId } = textOptions(
        rng,
        hoursText(h),
        [hoursText(h + 1), hoursText(Math.max(1, h - 1)), hoursText(h * 6), hoursText(h + 2), hoursText(h * 2 + 1)],
        optionCount(d),
      );
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Câte ore sunt ${minutesText(h * 60).ro}?`, en: `How many hours are ${minutesText(h * 60).en}?` }),
        type: 'choice',
        options,
        correctId,
      };
      return item;
    }
    case 'fact': {
      const facts = [
        { ro: '1 oră = {{gap}} min', en: '1 hour = {{gap}} min', n: 60, wrong: [30, 100, 24, 12] },
        { ro: '1 zi = {{gap}} h', en: '1 day = {{gap}} h', n: 24, wrong: [12, 60, 20, 7] },
        { ro: 'O jumătate de oră = {{gap}} min', en: 'Half an hour = {{gap}} min', n: 30, wrong: [15, 60, 20, 50] },
        { ro: 'Un sfert de oră = {{gap}} min', en: 'A quarter of an hour = {{gap}} min', n: 15, wrong: [30, 25, 45, 10] },
      ];
      const f = pick(rng, facts);
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: 'Completează cu numărul potrivit.', en: 'Fill in the right number.' }),
        type: 'fill-gap',
        template: { ro: f.ro, en: f.en },
        options: stringOptions(rng, String(f.n), f.wrong.map(String), optionCount(d)),
        correct: String(f.n),
      };
      return item;
    }
    case 'duration': {
      const start = randInt(rng, 1, 8);
      const len = randInt(rng, 2, d >= 3 ? 5 : 4);
      const end = start + len;
      const activity = pick(rng, [
        { ro: 'Filmul începe la ora', en: 'The film starts at', ro2: 'se termină', en2: 'ends' },
        { ro: 'Lecția de înot începe la ora', en: 'The swimming lesson starts at', ro2: 'se termină', en2: 'ends' },
        { ro: 'Excursia începe la ora', en: 'The trip starts at', ro2: 'se termină', en2: 'ends' },
      ]);
      const item: NumberInputItem = {
        ...baseFields(ctx, {
          ro: `${activity.ro} ${start} și ${activity.ro2} la ora ${end}. Câte ore durează?`,
          en: `${activity.en} ${start} o'clock and ${activity.en2} at ${end} o'clock. How many hours does it last?`,
        }),
        type: 'number-input',
        correct: len,
      };
      return item;
    }
    case 'half': {
      const n = randInt(rng, 1, 3);
      const item: NumberInputItem = {
        ...baseFields(ctx, {
          ro: `Câte minute sunt în ${hoursText(n).ro} și jumătate?`.replace(`în 1 oră și jumătate`, 'într-o oră și jumătate'),
          en: `How many minutes are in ${n} and a half hours?`.replace('in 1 and a half hours', 'in an hour and a half'),
        }),
        type: 'number-input',
        correct: n * 60 + 30,
      };
      return item;
    }
    case 'tf': {
      const m = pick(rng, [30, 45, 60, 90, 100, 120]);
      const hours = m / 60;
      const claims: { ro: string; en: string; ok: boolean }[] = [
        { ro: '1 oră = 60 de minute', en: '1 hour = 60 minutes', ok: true },
        { ro: '1 oră = 100 de minute', en: '1 hour = 100 minutes', ok: false },
        { ro: '2 ore = 120 de minute', en: '2 hours = 120 minutes', ok: true },
        { ro: '30 de minute = o jumătate de oră', en: '30 minutes = half an hour', ok: true },
        { ro: '15 minute = o jumătate de oră', en: '15 minutes = half an hour', ok: false },
        { ro: '3 ore = 180 de minute', en: '3 hours = 180 minutes', ok: true },
        { ro: '3 ore = 130 de minute', en: '3 hours = 130 minutes', ok: false },
        { ro: `${minutesText(m).ro} = ${Number.isInteger(hours) ? hoursText(hours).ro : '1 oră și jumătate'}`, en: `${minutesText(m).en} = ${Number.isInteger(hours) ? hoursText(hours).en : '1 hour and a half'}`, ok: m === 60 || m === 120 || m === 90 },
      ];
      const f = pick(rng, claims);
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Adevărat sau fals: ${f.ro}.`, en: `True or false: ${f.en}.` }),
        type: 'true-false',
        correct: f.ok,
      };
      return item;
    }
  }
}

export const timeUnits: GeneratorFn = (params, ctx): Item => (params.topic === 'hm' ? hm(ctx) : calendar(ctx));
