/** Number formatting + digit helpers shared by the grade III-IV number generators. */
import type { CardContent } from '../../types';

/**
 * Display form of a natural number: plain digits below 10 000, otherwise groups of three separated by a
 * non-breaking space (Romanian convention: "12 345", "1 000 000"). Use for TEXT SHOWN to the child only;
 * typed/stored answers (`fill-gap.correct`, `number-input.correct`) stay plain digits.
 */
export function fmt(n: number): string {
  const s = String(Math.abs(Math.trunc(n)));
  const sign = n < 0 ? '-' : '';
  if (s.length < 5) return sign + s;
  return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Inverse of `fmt` (also accepts ordinary spaces) */
export const unfmt = (s: string): number => Number(s.replace(/[\s ]/g, ''));

/** Choice cards for numbers: id `n<value>`, formatted text */
export const fmtCards = (values: readonly number[]): CardContent[] =>
  values.map((v) => ({ id: `n${v}`, text: { ro: fmt(v) } }));

export const numDigits = (n: number): number => String(Math.abs(Math.trunc(n))).length;

/** Decimal digit of n at position i (0 = ones) */
export const digitAt = (n: number, i: number): number => Math.floor(n / 10 ** i) % 10;

export const pow10 = (i: number): number => 10 ** i;

/** Romanian count form of a plural noun: "7 cutii", "20 de cutii", "105 cutii", "100 de cutii" */
export function roNum(n: number, plural: string): string {
  const r = n % 100;
  return r === 0 || r >= 20 ? `${fmt(n)} de ${plural}` : `${fmt(n)} ${plural}`;
}
