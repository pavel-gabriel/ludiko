/**
 * `number-reading` generator (params: max, mode): reading, writing and understanding numbers up to
 * 1 000 (grade III) or 1 000 000 (grade IV).
 *
 *   mode "words"  digits <-> words in Romanian ("4 305" <-> "patru mii trei sute cinci"),
 *                 with the right forms: "o mie", "două mii", "douăzeci și una de mii", "de" rules.
 *   mode "place"  place value: digit of an order, value of a digit, decomposition, compose, blocks (< 1000),
 *                 ordering numbers.
 *   mode "mixed"  both (default).
 */
import type { CardContent, ChoiceItem, Item, OrderItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import type { Rng } from './util';
import { baseFields, chance, paramInt, pick, randInt, shuffle, weighted } from './util';
import { digitAt, fmt, numDigits, pow10 } from './numfmt';
import { enNumber, roNumber } from './numberWords';
import { numChoice, numGap, numInput, randWithDigits, trueFalse } from './numItems';
import { blocksSpec } from './visuals';

const ORDERS_RO = ['unități', 'zeci', 'sute', 'mii', 'zeci de mii', 'sute de mii'];
const ORDERS_EN = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
/** Singular forms for a digit 1 ("1 sută", "1 zece", "1 mie") */
const ORDERS_RO_ONE = ['unitate', 'zece', 'sută', 'mie', 'zece de mii', 'sută de mii'];
const ORDERS_EN_ONE = ['one', 'ten', 'hundred', 'thousand', 'ten thousand', 'hundred thousand'];
const orderLabel = (digit: number, order: number, lang: 'ro' | 'en'): string =>
  digit === 1 ? (lang === 'ro' ? ORDERS_RO_ONE : ORDERS_EN_ONE)[order] : (lang === 'ro' ? ORDERS_RO : ORDERS_EN)[order];
/** Romanian "cifra ..." names (singular, genitive-free form used in "cifra sutelor") */
const DIGIT_OF_RO = ['unităților', 'zecilor', 'sutelor', 'miilor', 'zecilor de mii', 'sutelor de mii'];
const DIGIT_OF_EN = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands'];

/** A random number below `max` (inclusive of `max` itself now and then), width- and zero-biased by difficulty. */
export function sampleNumber(rng: Rng, max: number, d: number): number {
  if (max >= 1000 && chance(rng, 0.03)) return max; // 1 000 / 1 000 000
  const wMax = numDigits(max - 1);
  const wMin = Math.min(wMax, 3); // at least 3 digits (never trivial)
  const w = d <= 2 ? randInt(rng, Math.max(wMin, wMax - 1), wMax) : chance(rng, 0.7) ? wMax : randInt(rng, wMin, wMax);
  let n = randWithDigits(rng, w, max - 1);
  // zeros inside the number (4 005, 3 040, 20 300): the usual trouble spot, more often when harder
  if (w >= 3 && chance(rng, d >= 3 ? 0.55 : 0.25)) {
    const zeros = randInt(rng, 1, w - 2);
    for (let k = 0; k < zeros; k++) {
      const i = randInt(rng, 0, w - 2);
      n -= digitAt(n, i) * pow10(i);
    }
  }
  return Math.max(n, pow10(w - 1));
}

/** Numbers a child might confuse with n: adjacent digits swapped, a zero moved, off by a unit of an order */
export function nearNumbers(n: number, max: number): number[] {
  const s = String(n);
  const out = new Set<number>();
  for (let i = 0; i + 1 < s.length; i++) {
    const t = s.split('');
    [t[i], t[i + 1]] = [t[i + 1], t[i]];
    if (t[0] !== '0') out.add(Number(t.join('')));
  }
  for (let i = 0; i < s.length; i++) {
    for (const delta of [1, -1]) {
      const t = s.split('');
      const dg = Number(t[i]) + delta;
      if (dg >= 0 && dg <= 9 && !(i === 0 && dg === 0)) {
        t[i] = String(dg);
        out.add(Number(t.join('')));
      }
    }
  }
  // an extra / missing zero (4 305 <-> 43 005 / 435)
  if (s.length > 2) {
    const z = s.indexOf('0', 1);
    if (z > 0) out.add(Number(s.slice(0, z) + s.slice(z + 1)));
  }
  if (s.length < String(max).length) out.add(Number(s.slice(0, 1) + '0' + s.slice(1)));
  out.delete(n);
  return [...out].filter((v) => v > 0 && v <= max);
}

type Kind =
  | 'toWords' | 'toDigits' | 'input' | 'tf'
  | 'digitOf' | 'valueOf' | 'decompose' | 'compose' | 'blocks' | 'order';

const PLACE_KINDS: readonly Kind[] = ['digitOf', 'valueOf', 'decompose', 'compose', 'blocks', 'order'];

export const numberReading: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.max(100, paramInt(params, 'max', 1000));
  const mode = params.mode === 'words' || params.mode === 'place' ? params.mode : 'mixed';
  let n = sampleNumber(rng, max, d);

  const wordsKinds: [Kind, number][] = [['toWords', 34], ['toDigits', 30], ['input', 22], ['tf', 14]];
  const placeKinds: [Kind, number][] = [
    ['digitOf', 22], ['valueOf', 18], ['decompose', 22], ['compose', 14], ['blocks', n < 1000 ? 14 : 0], ['order', 14],
  ];
  const all = mode === 'words' ? wordsKinds : mode === 'place' ? placeKinds : [...wordsKinds, ...placeKinds];
  const kind = weighted<Kind>(rng, all);
  // place-value orders stop at hundreds of thousands: 1 000 000 itself is only read, never decomposed
  if (PLACE_KINDS.includes(kind) && n > 999_999) n = randWithDigits(rng, 6, 999_999);
  const near = nearNumbers(n, max);
  const wide = [n + 1, n - 1, n + 10, n - 10, n + 100, n - 100].filter((v) => v > 0 && v <= max);

  switch (kind) {
    case 'toWords': {
      const cands = shuffle(rng, near).slice(0, 8);
      const values = [...new Set([n, ...cands.concat(wide)])].slice(0, 12);
      const words = new Map(values.map((v) => [v, roNumber(v)]));
      const wrongSet = [...new Set([...words.entries()].filter(([v, w]) => v !== n && w !== words.get(n)).map(([v]) => v))];
      const options = shuffle(rng, [n, ...wrongSet.slice(0, d <= 1 ? 2 : 3)]);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Cum se citește numărul ${fmt(n)}?`, en: `How do you read the number ${fmt(n)}?` }),
        type: 'choice',
        options: options.map((v) => ({ id: `n${v}`, text: { ro: roNumber(v), en: enNumber(v) } })),
        correctId: `n${n}`,
      };
      return item;
    }
    case 'toDigits': {
      const cands = [...new Set([...shuffle(rng, near), ...wide])].filter((v) => roNumber(v) !== roNumber(n));
      return numChoice(
        ctx,
        { ro: `Cum se scrie cu cifre: ${roNumber(n)}?`, en: `How do you write in digits: ${enNumber(n)}?` },
        n,
        cands,
        { hi: max },
      );
    }
    case 'input':
      return numInput(ctx, { ro: `Scrie cu cifre: ${roNumber(n)}.`, en: `Write in digits: ${enNumber(n)}.` }, n);
    case 'tf': {
      const truth = chance(rng, 0.5);
      const shown = truth ? n : pick(rng, near.length ? near : wide);
      return trueFalse(ctx, { ro: `${roNumber(n)} se scrie ${fmt(shown)}`, en: `${enNumber(n)} is written ${fmt(shown)}` }, shown === n);
    }
    case 'digitOf': {
      const order = pickOrder(rng, n);
      const digit = digitAt(n, order);
      const wrongDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== digit);
      // include the digits of neighbouring orders: the typical confusion
      const neighbours = [digitAt(n, order + 1), order > 0 ? digitAt(n, order - 1) : digit].filter((x) => x !== digit);
      return numChoice(
        ctx,
        { ro: `Care este cifra ${DIGIT_OF_RO[order]} din ${fmt(n)}?`, en: `What is the ${DIGIT_OF_EN[order]} digit of ${fmt(n)}?` },
        digit,
        [...neighbours, ...wrongDigits],
        { hi: 9 },
      );
    }
    case 'valueOf': {
      // value of a digit that occurs exactly once (no ambiguity)
      const s = String(n);
      const idxs = [...s].map((_c, i) => i).filter((i) => s[i] !== '0' && [...s].filter((c) => c === s[i]).length === 1);
      if (!idxs.length) return numInput(ctx, { ro: `Scrie cu cifre: ${roNumber(n)}.`, en: `Write in digits: ${enNumber(n)}.` }, n);
      const i = pick(rng, idxs);
      const digit = Number(s[i]);
      const order = s.length - 1 - i;
      const correct = digit * pow10(order);
      const wrong = [digit, digit * pow10(order + 1), digit * pow10(Math.max(0, order - 1)), digit * pow10(order + 2), digit * pow10(Math.max(0, order - 2))];
      return numChoice(
        ctx,
        { ro: `Ce valoare are cifra ${digit} în numărul ${fmt(n)}?`, en: `What is the value of the digit ${digit} in ${fmt(n)}?` },
        correct,
        wrong,
        { hi: max },
      );
    }
    case 'decompose': {
      // n = 3 mii + {{gap}} sute + 8 zeci + 2 unități  (zeros are named too: 0 sute)
      const w = numDigits(n);
      const gapOrder = randInt(rng, 0, w - 1);
      const parts = (lang: 'ro' | 'en') =>
        Array.from({ length: w }, (_, k) => {
          const order = w - 1 - k;
          return order === gapOrder
            ? `{{gap}} ${(lang === 'ro' ? ORDERS_RO : ORDERS_EN)[order]}`
            : `${digitAt(n, order)} ${orderLabel(digitAt(n, order), order, lang)}`;
        }).join(' + ');
      const digit = digitAt(n, gapOrder);
      return numGap(
        ctx,
        { ro: `${fmt(n)} = ${parts('ro')}`, en: `${fmt(n)} = ${parts('en')}` },
        digit,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, digitAt(n, gapOrder + 1), digitAt(n, Math.max(0, gapOrder - 1))],
        chance(rng, 0.6),
      );
    }
    case 'compose': {
      const w = numDigits(n);
      // zero orders are usually left out ("3 mii + 5 unități"), sometimes named ("3 mii + 0 sute + ...")
      const showZeros = chance(rng, 0.25);
      const orders = Array.from({ length: w }, (_, k) => w - 1 - k).filter((o) => digitAt(n, o) !== 0 || showZeros);
      const parts = (lang: 'ro' | 'en') =>
        orders.map((o) => `${digitAt(n, o)} ${orderLabel(digitAt(n, o), o, lang)}`).join(' + ');
      return numInput(ctx, { ro: `Scrie numărul: ${parts('ro')}.`, en: `Write the number: ${parts('en')}.` }, n);
    }
    case 'blocks': {
      const text = { ro: 'Ce număr arată cuburile?', en: 'What number do the blocks show?' };
      return chance(rng, 0.5)
        ? numChoice(ctx, text, n, [...near, ...wide], { visual: blocksSpec(n), hi: 999 })
        : numInput(ctx, { ro: 'Scrie numărul arătat de cuburi.', en: 'Type the number the blocks show.' }, n, blocksSpec(n));
    }
    case 'order': {
      const count = d <= 2 ? 3 : 4;
      const set = new Set<number>([n]);
      for (const v of shuffle(rng, [...near, ...wide])) if (set.size < count) set.add(v);
      const nums = [...set];
      const asc = chance(rng, 0.5);
      const sorted = [...nums].sort((x, y) => (asc ? x - y : y - x));
      const cards: CardContent[] = shuffle(rng, nums).map((v) => ({ id: `n${v}`, text: { ro: fmt(v) } }));
      const item: OrderItem = {
        ...baseFields(ctx, {
          ro: asc ? 'Ordonează numerele de la cel mai mic la cel mai mare.' : 'Ordonează numerele de la cel mai mare la cel mai mic.',
          en: asc ? 'Put the numbers in order, smallest first.' : 'Put the numbers in order, biggest first.',
        }),
        type: 'order',
        cards,
        correctOrder: sorted.map((v) => `n${v}`),
      };
      return item;
    }
  }
};

/** An order (position) to ask about; avoids always asking about the leading digit */
function pickOrder(rng: Rng, n: number): number {
  const w = numDigits(n);
  return randInt(rng, 0, w - 1);
}

registerGenerator('number-reading', numberReading);
