/**
 * English primary (`eng`, grades 0-IV) generators for numbers, the calendar and telling the time.
 *
 * `eng-primary-number`   params: { max: 10 | 20 | 100, kinds?: ('digit-to-word'|'word-to-digit'|'count'|'next'|'order'|'sum')[] }
 * `eng-primary-calendar` params: { list: 'days' | 'months', kinds?: ('en-to-ro'|'ro-to-en'|'after'|'before'|'order'|'position'|'season')[] }
 * `eng-primary-time`     params: { level: 3 | 4, kinds?: ('clock-to-text'|'text-to-clock'|'text-to-digital')[] }
 *   level 3: o'clock and half past; level 4 adds a quarter past/to and the five-minute steps ("ten past four").
 * British English: "half past four", "a quarter to five". The week starts on Monday.
 */
import type { ChoiceItem, Item, NumberInputItem, OrderItem, PictureChoiceItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import {
  ENG_DAYS,
  ENG_MONTHS,
  ENG_WORDS,
  ORDINALS_EN,
  ORDINALS_RO,
  digitalTime,
  numberWord,
  timePhrase,
  type NamedItem,
} from './engPrimaryData';
import { baseFields, chance, numberOptions, optionCount, paramInt, pick, randInt, shuffle } from './util';
import { objectsSpec } from './visuals';

const marked = (s: string) => `«${s}»`;
const wordCard = (w: string) => ({ id: `w_${w}`, text: { ro: w } });

/* ------------------------------------------------------------------ */
/*  Numbers                                                            */
/* ------------------------------------------------------------------ */

type NKind = 'digit-to-word' | 'word-to-digit' | 'count' | 'next' | 'order' | 'sum';
const NKINDS: NKind[] = ['digit-to-word', 'word-to-digit', 'count', 'next', 'order', 'sum'];

/** Wrong numbers a child plausibly mixes up with n: neighbours, teen/ty (14/40), swapped digits (24/42), +-10 */
function confusions(n: number): number[] {
  const out = [n - 1, n + 1, n - 2, n + 2, n - 10, n + 10];
  if (n >= 13 && n <= 19) out.push((n - 10) * 10);
  if (n >= 30 && n % 10 === 0) out.push(n / 10 + 10);
  if (n > 20 && n % 11 !== 0 && n < 100) out.push((n % 10) * 10 + Math.floor(n / 10));
  return out;
}

export const engPrimaryNumber: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = paramInt(params, 'max', 10);
  const v = params.kinds;
  const asked = (Array.isArray(v) ? v.filter((k) => NKINDS.includes(k as NKind)) : ['digit-to-word', 'word-to-digit']) as NKind[];
  const kinds = asked.filter((k) => !(k === 'count' && max > 20) && !(k === 'sum' && max < 20));
  const kind = pick(rng, kinds.length ? kinds : (['digit-to-word'] as NKind[]));
  const total = optionCount(d);
  /* easy levels stay within the first 20 (or the round tens); harder ones use the whole range */
  const draw = (lo = 1, hi = max): number => {
    if (max === 100 && d <= 1) return Math.max(lo, Math.min(hi, chance(rng, 0.5) ? randInt(rng, lo, Math.min(hi, 20)) : randInt(rng, 1, 10) * 10));
    return randInt(rng, lo, hi);
  };

  switch (kind) {
    case 'digit-to-word': {
      const n = draw();
      const nums = numberOptions(rng, n, confusions(n), total, 1, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Cum se scrie în engleză numărul ${n}?`, en: `How do you write the number ${n} in English?` }),
        type: 'choice',
        options: nums.map((x) => ({ id: `n${x}`, text: { ro: numberWord(x) } })),
        correctId: `n${n}`,
      };
      return item;
    }

    case 'word-to-digit': {
      const n = draw();
      if (d >= 3 && max >= 20) {
        const item: NumberInputItem = {
          ...baseFields(ctx, { ro: `Scrie numărul ${marked(numberWord(n))} cu cifre.`, en: `Write the number ${marked(numberWord(n))} using digits.` }),
          type: 'number-input',
          correct: n,
        };
        return item;
      }
      const nums = numberOptions(rng, n, confusions(n), total, 1, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Ce număr este ${marked(numberWord(n))}?`, en: `Which number is ${marked(numberWord(n))}?` }),
        type: 'choice',
        options: nums.map((x) => ({ id: `n${x}`, text: { ro: String(x) } })),
        correctId: `n${n}`,
      };
      return item;
    }

    case 'count': {
      const n = max <= 10 ? randInt(rng, 1, 10) : randInt(rng, 3, 20);
      const icon = pick(rng, ENG_WORDS.filter((w) => w.grade === 0 && w.group !== 'colour')).e;
      const nums = numberOptions(rng, n, [n - 1, n + 1, n - 2, n + 2], total, 1, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Câte obiecte sunt? Alege numărul în engleză.', en: 'How many things are there? Choose the number in English.' }, objectsSpec(icon, n)),
        type: 'choice',
        options: nums.map((x) => ({ id: `n${x}`, text: { ro: numberWord(x) } })),
        correctId: `n${n}`,
      };
      return item;
    }

    case 'next': {
      const before = chance(rng, 0.35);
      const n = before ? draw(2, max) : draw(1, max - 1);
      const answer = before ? n - 1 : n + 1;
      const near = [answer - 1, answer + 1, answer - 2, answer + 2, answer - 10, answer + 10].filter((x) => x >= 1 && x <= max && x !== n && x !== answer);
      const rest = Array.from({ length: max }, (_, k) => k + 1).filter((x) => x !== n && x !== answer && !near.includes(x));
      const cands = [...shuffle(rng, near), ...shuffle(rng, rest)];
      const opts = [answer, ...cands.slice(0, total - 1)];
      const item: ChoiceItem = {
        ...baseFields(ctx, before ? { ro: `Ce număr este înainte de ${marked(numberWord(n))}?`, en: `Which number comes before ${marked(numberWord(n))}?` } : { ro: `Ce număr urmează după ${marked(numberWord(n))}?`, en: `Which number comes after ${marked(numberWord(n))}?` }),
        type: 'choice',
        options: shuffle(rng, opts).map((x) => ({ id: `n${x}`, text: { ro: numberWord(x) } })),
        correctId: `n${answer}`,
      };
      return item;
    }

    case 'order': {
      const count = d >= 3 ? 4 : 3;
      const set = new Set<number>();
      while (set.size < count) set.add(draw());
      const nums = [...set];
      const sorted = [...nums].sort((a, b) => a - b);
      const item: OrderItem = {
        ...baseFields(ctx, { ro: 'Pune numerele în ordine, de la cel mai mic la cel mai mare.', en: 'Put the numbers in order, smallest first.' }),
        type: 'order',
        cards: shuffle(rng, nums).map((x) => ({ id: `n${x}`, text: { ro: numberWord(x) } })),
        correctOrder: sorted.map((x) => `n${x}`),
      };
      return item;
    }

    case 'sum': {
      const cap = max === 20 ? 10 : 90;
      const a = max === 100 ? randInt(rng, 1, 9) * 10 : randInt(rng, 1, cap);
      const b = max === 100 ? randInt(rng, 1, Math.min(9, (100 - a) / 10)) * 10 : randInt(rng, 1, Math.min(cap, max - a));
      const answer = a + b;
      const nums = numberOptions(rng, answer, [answer - 1, answer + 1, answer - 10, answer + 10, a, b], total, 1, max);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `${marked(numberWord(a))} + ${marked(numberWord(b))} = ?`, en: `${marked(numberWord(a))} + ${marked(numberWord(b))} = ?` }),
        type: 'choice',
        options: nums.map((x) => ({ id: `n${x}`, text: { ro: numberWord(x) } })),
        correctId: `n${answer}`,
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-number', engPrimaryNumber);

/* ------------------------------------------------------------------ */
/*  Days and months                                                    */
/* ------------------------------------------------------------------ */

type CKind = 'en-to-ro' | 'ro-to-en' | 'after' | 'before' | 'order' | 'position' | 'season';
const CKINDS: CKind[] = ['en-to-ro', 'ro-to-en', 'after', 'before', 'order', 'position', 'season'];

export const engPrimaryCalendar: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const months = params.list === 'months';
  const list: readonly NamedItem[] = months ? ENG_MONTHS : ENG_DAYS;
  const v = params.kinds;
  const asked = (Array.isArray(v) ? v.filter((k) => CKINDS.includes(k as CKind)) : ['en-to-ro', 'ro-to-en', 'after']) as CKind[];
  const kinds = asked.filter((k) => !(k === 'season' && !months));
  const kind = pick(rng, kinds.length ? kinds : (['en-to-ro'] as CKind[]));
  const i = randInt(rng, 0, list.length - 1);
  const target = list[i];
  const total = optionCount(d);
  const others = (except: number[]) => shuffle(rng, list.filter((_, k) => !except.includes(k)));
  const len = list.length;

  switch (kind) {
    case 'en-to-ro': {
      const wrong = others([i]).slice(0, total - 1);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Ce înseamnă ${marked(target.en)}?`, en: `What does ${marked(target.en)} mean?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => ({ id: `w_${w.en}`, text: { ro: w.ro } })),
        correctId: `w_${target.en}`,
      };
      return item;
    }
    case 'ro-to-en': {
      const wrong = others([i]).slice(0, total - 1);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Cum se spune „${target.ro}” în engleză?`, en: `How do you say “${target.ro}” in English?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => wordCard(w.en)),
        correctId: `w_${target.en}`,
      };
      return item;
    }
    case 'after':
    case 'before': {
      const step = kind === 'after' ? 1 : len - 1;
      const answerIdx = (i + step) % len;
      const wrong = others([i, answerIdx]).slice(0, total - 1);
      const noun = months ? 'lună' : 'zi';
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          kind === 'after'
            ? { ro: `Care ${noun} urmează după ${marked(target.en)}?`, en: `Which ${months ? 'month' : 'day'} comes after ${marked(target.en)}?` }
            : { ro: `Care ${noun} este înainte de ${marked(target.en)}?`, en: `Which ${months ? 'month' : 'day'} comes before ${marked(target.en)}?` },
        ),
        type: 'choice',
        options: shuffle(rng, [list[answerIdx], ...wrong]).map((w) => wordCard(w.en)),
        correctId: `w_${list[answerIdx].en}`,
      };
      return item;
    }
    case 'order': {
      const count = d >= 3 ? 4 : 3;
      const idx = shuffle(rng, list.map((_, k) => k)).slice(0, count).sort((a, b) => a - b);
      const item: OrderItem = {
        ...baseFields(ctx, { ro: months ? 'Pune lunile în ordinea din an.' : 'Pune zilele în ordinea din săptămână (începe cu luni).', en: months ? 'Put the months in the order of the year.' : 'Put the days in the order of the week (start with Monday).' }),
        type: 'order',
        cards: shuffle(rng, idx).map((k) => ({ id: `w_${list[k].en}`, text: { ro: list[k].en } })),
        correctOrder: idx.map((k) => `w_${list[k].en}`),
      };
      return item;
    }
    case 'position': {
      const wrong = others([i]).slice(0, total - 1);
      const item: ChoiceItem = {
        ...baseFields(ctx, {
          ro: months ? `Care este ${ORDINALS_RO[i]} lună din an?` : `Care este ${ORDINALS_RO[i]} zi a săptămânii?`,
          en: months ? `Which is the ${ORDINALS_EN[i]} month of the year?` : `Which is the ${ORDINALS_EN[i]} day of the week?`,
        }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => wordCard(w.en)),
        correctId: `w_${target.en}`,
      };
      return item;
    }
    case 'season': {
      const seasons = ['spring', 'summer', 'autumn', 'winter'];
      const wrong = seasons.filter((s) => s !== target.season).slice(0, total - 1);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `În ce anotimp este luna ${marked(target.en)}?`, en: `In which season is the month ${marked(target.en)}?` }),
        type: 'choice',
        options: shuffle(rng, [target.season as string, ...wrong]).map(wordCard),
        correctId: `w_${target.season}`,
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-calendar', engPrimaryCalendar);

/* ------------------------------------------------------------------ */
/*  Telling the time                                                   */
/* ------------------------------------------------------------------ */

type TKind = 'clock-to-text' | 'text-to-clock' | 'text-to-digital';
const TKINDS: TKind[] = ['clock-to-text', 'text-to-clock', 'text-to-digital'];

interface Time {
  h: number;
  m: number;
}

const MINUTES_L3 = [0, 30];
const MINUTES_L4_EASY = [0, 15, 30, 45];
const MINUTES_L4_ALL = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const engPrimaryTime: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const level = paramInt(params, 'level', 3);
  const minutes = level <= 3 ? MINUTES_L3 : d <= 2 ? MINUTES_L4_EASY : MINUTES_L4_ALL;
  const v = params.kinds;
  const asked = (Array.isArray(v) ? v.filter((k) => TKINDS.includes(k as TKind)) : ['clock-to-text', 'text-to-clock']) as TKind[];
  const kind = pick(rng, asked.length ? asked : (['clock-to-text'] as TKind[]));
  const total = optionCount(d);
  const target: Time = { h: randInt(rng, 1, 12), m: pick(rng, minutes) };
  const keyOf = (t: Time) => `${t.h}:${t.m}`;

  /* wrong times: same hour other minutes, neighbouring hours same minutes, "to" instead of "past" */
  const wrongTimes = (): Time[] => {
    const cands: Time[] = [];
    for (const m of minutes) if (m !== target.m) cands.push({ h: target.h, m });
    for (const dh of [-1, 1, 2]) cands.push({ h: ((target.h - 1 + dh + 12) % 12) + 1, m: target.m });
    if (target.m === 15) cands.push({ h: target.h, m: 45 }, { h: ((target.h) % 12) + 1, m: 45 });
    if (target.m === 45) cands.push({ h: target.h, m: 15 }, { h: ((target.h) % 12) + 1, m: 15 });
    const seen = new Set<string>([keyOf(target)]);
    const uniq = cands.filter((t) => (seen.has(keyOf(t)) ? false : (seen.add(keyOf(t)), true)));
    return shuffle(rng, uniq).slice(0, total - 1);
  };
  const visual = { kind: 'clock' as const, hours: target.h, minutes: target.m };
  const phrase = (t: Time) => `It's ${timePhrase(t.h, t.m)}.`;

  switch (kind) {
    case 'clock-to-text': {
      const options = shuffle(rng, [target, ...wrongTimes()]);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Cât este ceasul? Alege propoziția în engleză.', en: 'What time is it? Choose the English sentence.' }, visual),
        type: 'choice',
        options: options.map((t) => ({ id: `t_${keyOf(t)}`, text: { ro: phrase(t) } })),
        correctId: `t_${keyOf(target)}`,
      };
      return item;
    }
    case 'text-to-clock': {
      const options = shuffle(rng, [target, ...wrongTimes()]);
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Care ceas arată ${marked(phrase(target))}?`, en: `Which clock shows ${marked(phrase(target))}?` }),
        type: 'picture-choice',
        options: options.map((t) => ({ id: `t_${keyOf(t)}`, visual: { kind: 'clock' as const, hours: t.h, minutes: t.m } })),
        correctId: `t_${keyOf(target)}`,
      };
      return item;
    }
    case 'text-to-digital': {
      const options = shuffle(rng, [target, ...wrongTimes()]);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Ce oră este ${marked(phrase(target))}?`, en: `What time is ${marked(phrase(target))}?` }),
        type: 'choice',
        options: options.map((t) => ({ id: `t_${keyOf(t)}`, text: { ro: digitalTime(t.h, t.m) } })),
        correctId: `t_${keyOf(target)}`,
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-time', engPrimaryTime);
