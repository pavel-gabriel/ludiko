/**
 * Romanian/English text helpers shared by the measurement generators (clock, time units, money,
 * measures, fractions, shapes): number-agreement ("1 leu", "2 lei", "20 de lei"), money phrases,
 * Romanian clock phrases, and builders for text choice options.
 */
import type { CardContent, LocalizedText } from '../../types';
import type { Rng } from './util';
import { shuffle } from './util';

/* ---- plurals ------------------------------------------------------- */

/** Romanian "de" rule: from 20 up the noun takes "de", except when the last two digits are 01-19. */
export const needsDe = (n: number): boolean => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

/** "1 leu", "2 lei", "19 lei", "20 de lei", "101 lei", "120 de lei" */
export const roPlural = (n: number, one: string, many: string): string =>
  n === 1 ? `1 ${one}` : `${n}${needsDe(n) ? ' de' : ''} ${many}`;

export const enPlural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

const loc = (n: number, roOne: string, roMany: string, enOne: string, enMany: string): LocalizedText => ({
  ro: roPlural(n, roOne, roMany),
  en: enPlural(n, enOne, enMany),
});

export const leiText = (n: number): LocalizedText => loc(n, 'leu', 'lei', 'leu', 'lei');
export const baniText = (n: number): LocalizedText => loc(n, 'ban', 'bani', 'ban', 'bani');
export const minutesText = (n: number): LocalizedText => loc(n, 'minut', 'minute', 'minute', 'minutes');
export const hoursText = (n: number): LocalizedText => loc(n, 'oră', 'ore', 'hour', 'hours');
export const daysText = (n: number): LocalizedText => loc(n, 'zi', 'zile', 'day', 'days');
export const weeksText = (n: number): LocalizedText => loc(n, 'săptămână', 'săptămâni', 'week', 'weeks');
export const monthsText = (n: number): LocalizedText => loc(n, 'lună', 'luni', 'month', 'months');
export const yearsText = (n: number): LocalizedText => loc(n, 'an', 'ani', 'year', 'years');

/** An amount given in bani as "3 lei și 50 de bani", "1 leu", "5 bani" */
export function moneyText(totalBani: number): LocalizedText {
  const lei = Math.floor(totalBani / 100);
  const bani = totalBani % 100;
  if (lei === 0) return baniText(bani);
  if (bani === 0) return leiText(lei);
  const l = leiText(lei);
  const b = baniText(bani);
  return { ro: `${l.ro} și ${b.ro}`, en: `${l.en} and ${b.en}` };
}

/* ---- clock phrases -------------------------------------------------- */

/** 12-hour clock: the hour after h (12 -> 1) */
export const nextHour = (h: number): number => (h % 12) + 1;

export const digitalTime = (h: number, m: number): string => `${h}:${String(m).padStart(2, '0')}`;

/**
 * Romanian phrase for a time on a 12-hour clock. One consistent form per minute value:
 * 0 "ora 3", 15 "ora 3 și un sfert", 30 "ora 3 și jumătate", 45 "ora 4 fără un sfert",
 * 1-44 otherwise "ora 3 și 10 minute", 46-59 "ora 4 fără 10 minute".
 */
export function timeText(h: number, m: number): LocalizedText {
  const nh = nextHour(h);
  switch (m) {
    case 0:
      return { ro: `ora ${h}`, en: `${h} o'clock` };
    case 15:
      return { ro: `ora ${h} și un sfert`, en: `quarter past ${h}` };
    case 30:
      return { ro: `ora ${h} și jumătate`, en: `half past ${h}` };
    case 45:
      return { ro: `ora ${nh} fără un sfert`, en: `quarter to ${nh}` };
  }
  if (m < 45) return { ro: `ora ${h} și ${roPlural(m, 'minut', 'minute')}`, en: `${m} minutes past ${h}` };
  const left = 60 - m;
  return { ro: `ora ${nh} fără ${roPlural(left, 'minut', 'minute')}`, en: `${left} minutes to ${nh}` };
}

/* ---- option builders --------------------------------------------------- */

/**
 * Shuffled text options: `correct` plus up to `total - 1` distinct wrong answers (compared on the
 * Romanian text). Returns ids "o0".."oN" and the id of the correct one.
 */
export function textOptions(
  rng: Rng,
  correct: LocalizedText,
  wrong: readonly LocalizedText[],
  total: number,
): { options: CardContent[]; correctId: string } {
  const seen = new Set<string>([correct.ro]);
  const picked: LocalizedText[] = [];
  for (const w of shuffle(rng, wrong)) {
    if (picked.length >= total - 1) break;
    if (seen.has(w.ro)) continue;
    seen.add(w.ro);
    picked.push(w);
  }
  const all = shuffle(rng, [{ t: correct, ok: true }, ...picked.map((t) => ({ t, ok: false }))]);
  const options = all.map((o, i) => ({ id: `o${i}`, text: o.t }));
  return { options, correctId: `o${all.findIndex((o) => o.ok)}` };
}

/** Distinct string options (for fill-gap): correct + distractors, shuffled, up to `total`. */
export function stringOptions(rng: Rng, correct: string, wrong: readonly string[], total: number): string[] {
  const out = new Set<string>();
  for (const w of shuffle(rng, wrong)) {
    if (out.size >= total - 1) break;
    if (w !== correct) out.add(w);
  }
  return shuffle(rng, [correct, ...out]);
}
