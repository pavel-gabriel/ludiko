/**
 * Pure time helpers for the history (`ist`) generators and tests: Roman numerals for centuries,
 * century of a year (years before Christ are negative, there is no year 0), formatted years and centuries.
 */

const ROMAN: readonly (readonly [number, string])[] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** 1 -> "I", 19 -> "XIX", 21 -> "XXI" (n >= 1) */
export function toRoman(n: number): string {
  let rest = Math.floor(n);
  let out = '';
  for (const [v, s] of ROMAN) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** Century number of a year: 1..100 -> 1, 101..200 -> 2; -100..-1 (î.Hr.) -> 1, -200..-101 -> 2. There is no year 0. */
export function centuryNumber(year: number): number {
  if (!Number.isInteger(year) || year === 0) throw new Error(`invalid year ${year}`);
  return Math.ceil(Math.abs(year) / 100);
}

/** Century as a Roman numeral: 1859 -> "XIX", 2000 -> "XX", 2001 -> "XXI" */
export function centuryRoman(year: number): string {
  return toRoman(centuryNumber(year));
}

/** Century with era: 1859 -> "XIX", -44 -> "I î.Hr." */
export function centuryWithEra(year: number): string {
  return year < 0 ? `${centuryRoman(year)} î.Hr.` : centuryRoman(year);
}

/** First and last year of century `n` (1-based) in the given era */
export function centuryRange(n: number, bc: boolean): { from: number; to: number } {
  return bc ? { from: -n * 100, to: -(n - 1) * 100 - 1 } : { from: (n - 1) * 100 + 1, to: n * 100 };
}

/** "secolul I", "secolul al XV-lea", "secolul al III-lea î.Hr." */
export function centuryLabelRo(n: number, bc: boolean, markAd = false): string {
  const base = n === 1 ? 'secolul I' : `secolul al ${toRoman(n)}-lea`;
  return bc ? `${base} î.Hr.` : markAd ? `${base} d.Hr.` : base;
}

function ordinalEn(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** "the 15th century", "the 1st century BC" */
export function centuryLabelEn(n: number, bc: boolean, markAd = false): string {
  return `the ${ordinalEn(n)} century${bc ? ' BC' : markAd ? ' AD' : ''}`;
}

/** "1859", "82 î.Hr." / "82 BC" */
export function formatYear(year: number, lang: 'ro' | 'en' = 'ro'): string {
  if (year < 0) return `${-year} ${lang === 'ro' ? 'î.Hr.' : 'BC'}`;
  return String(year);
}
