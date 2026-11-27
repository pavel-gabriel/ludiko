/**
 * Exact rational arithmetic + decimal helpers for the grade V-VIII math generators.
 * Every displayed answer is computed here with integers (no floating point): fractions are always
 * reduced with a positive denominator, decimals are scaled integers (value = scaled / 10^k).
 */

/** Typographic minus used in every text shown to the child (typed answers use the plain "-"). */
export const MINUS = '−';

export interface Fr {
  n: number;
  d: number;
}

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
};

export const lcm = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : Math.abs((a / gcd(a, b)) * b));

/** Reduced fraction with positive denominator */
export function fr(n: number, d = 1): Fr {
  if (d === 0) throw new Error('zero denominator');
  const s = d < 0 ? -1 : 1;
  const g = gcd(n, d) || 1;
  return { n: (s * n) / g, d: (s * d) / g };
}

const safe = (v: number): number => {
  if (!Number.isSafeInteger(v)) throw new Error('rational overflow');
  return v;
};

export const frAdd = (a: Fr, b: Fr): Fr => fr(safe(a.n * b.d + b.n * a.d), safe(a.d * b.d));
export const frSub = (a: Fr, b: Fr): Fr => fr(safe(a.n * b.d - b.n * a.d), safe(a.d * b.d));
export const frMul = (a: Fr, b: Fr): Fr => fr(safe(a.n * b.n), safe(a.d * b.d));
export const frDiv = (a: Fr, b: Fr): Fr => {
  if (b.n === 0) throw new Error('division by zero');
  return fr(safe(a.n * b.d), safe(a.d * b.n));
};
export const frNeg = (a: Fr): Fr => ({ n: -a.n, d: a.d });
export const frCmp = (a: Fr, b: Fr): number => Math.sign(a.n * b.d - b.n * a.d);
export const frEq = (a: Fr, b: Fr): boolean => a.n === b.n && a.d === b.d;
export const frIsInt = (a: Fr): boolean => a.d === 1;

/** "3/4", "−3/4" (typographic minus), "5" for integers. */
export const frText = (a: Fr): string => `${a.n < 0 ? MINUS : ''}${Math.abs(a.n)}${a.d === 1 ? '' : `/${a.d}`}`;

/** Unreduced "n/d" exactly as given (used for the "forgot to simplify" distractors) */
export const rawFrText = (n: number, d: number): string => `${n < 0 ? MINUS : ''}${Math.abs(n)}/${d}`;

/** Terminating decimal expansion of a fraction as scaled integer, or null (denominator has a prime factor other than 2, 5) */
export function frToDecimal(a: Fr): { scaled: number; k: number } | null {
  let d = a.d;
  let twos = 0;
  let fives = 0;
  while (d % 2 === 0) {
    d /= 2;
    twos++;
  }
  while (d % 5 === 0) {
    d /= 5;
    fives++;
  }
  if (d !== 1) return null;
  const k = Math.max(twos, fives);
  return { scaled: (a.n * 10 ** k) / a.d, k };
}

/** value = scaled / 10^k -> fraction */
export const decToFr = (scaled: number, k: number): Fr => fr(scaled, 10 ** k);

/** Decimal text: Romanian comma ("2,5") or English point; no trailing zeros; typographic minus. */
export function decText(scaled: number, k: number, lang: 'ro' | 'en' = 'ro'): string {
  let s = scaled;
  let kk = k;
  while (kk > 0 && s % 10 === 0) {
    s /= 10;
    kk--;
  }
  const abs = String(Math.abs(s)).padStart(kk + 1, '0');
  const int = abs.slice(0, abs.length - kk);
  const frac = abs.slice(abs.length - kk);
  const body = kk > 0 ? `${int}${lang === 'ro' ? ',' : '.'}${frac}` : int;
  return `${s < 0 ? MINUS : ''}${body}`;
}

/** Decimal text of a rational with a terminating expansion (throws otherwise) */
export function frDecText(a: Fr, lang: 'ro' | 'en' = 'ro'): string {
  const d = frToDecimal(a);
  if (!d) throw new Error('non-terminating');
  return decText(d.scaled, d.k, lang);
}

export const isqrt = (n: number): number => {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
};

export const isSquare = (n: number): boolean => n >= 0 && isqrt(n) ** 2 === n;

export const isPrime = (n: number): boolean => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};

/** Prime factorisation as [prime, exponent] pairs */
export function factorise(n: number): [number, number][] {
  const out: [number, number][] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    let e = 0;
    while (m % p === 0) {
      m /= p;
      e++;
    }
    if (e) out.push([p, e]);
  }
  if (m > 1) out.push([m, 1]);
  return out;
}

export const divisorsOf = (n: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
};
