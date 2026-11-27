/**
 * `divisibility` generator (grades V-VI). params:
 *   modes: any of 'criteria' | 'criteriaTf' | 'digitFind' | 'primeSelect' | 'primeTf' | 'countPrimes' |
 *          'divisorCount' | 'notDivisor' | 'multiples' | 'factor' | 'factorCount' | 'gcd' | 'lcm' | 'coprime'
 *   max:   largest number used (default 100; criteria use up to 100 x max... capped at 9999)
 *   criteria: divisors used by the criteria modes (default [2, 3, 5, 9, 10])
 *
 * All facts are recomputed by brute force (divisors, primality, gcd, lcm, factorisation), so the answers are exact.
 * Distractors are chosen to be tempting: numbers divisible by 3 but not 9, divisible by 5 but not 10, odd composites
 * for primes, lcm for gcd (and the other way round), the plain product for lcm.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, paramInt, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L, sInt, sup, tfItem } from './mathKit';
import { divisorsOf, factorise, gcd, isPrime, lcm } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['criteria', 'criteriaTf', 'digitFind', 'primeSelect', 'primeTf', 'countPrimes', 'divisorCount', 'notDivisor', 'multiples', 'factor', 'factorCount', 'gcd', 'lcm', 'coprime'] as const;
type Mode = (typeof MODES)[number];

const ODD_COMPOSITES = [9, 15, 21, 25, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 75, 77, 81, 85, 87, 91, 93, 95, 99];

/** A number NOT divisible by c that tempts the child (shares a weaker criterion) */
function trap(rng: () => number, c: number, lo: number, hi: number): number {
  const weaker = (n: number): boolean => {
    if (c === 9) return n % 3 === 0;
    if (c === 10) return n % 5 === 0;
    if (c === 4) return n % 2 === 0;
    if (c === 6) return n % 2 === 0 || n % 3 === 0;
    return true;
  };
  for (let t = 0; t < 400; t++) {
    const n = randInt(rng, lo, hi);
    if (n % c !== 0 && weaker(n)) return n;
  }
  for (let n = lo; n <= hi; n++) if (n % c !== 0) return n;
  return lo + 1;
}

const facText = (f: [number, number][]): string => f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : String(p))).join(' · ');

export const divisibility: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const max = Math.min(9999, Math.max(30, paramInt(params, 'max', 100)));
  const crit = (Array.isArray(params.criteria) ? (params.criteria as number[]) : [2, 3, 5, 9, 10]).filter((c) => Number.isInteger(c) && c >= 2);
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['criteria']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['criteria'] as Mode[]));
  const cNums = d <= 1 ? 100 : d <= 3 ? 1000 : 9999;

  switch (mode) {
    case 'criteria': {
      const c = pick(rng, crit);
      const lo = 10;
      const hi = Math.max(99, Math.min(cNums, max * 10));
      const right = c * randInt(rng, Math.ceil(lo / c), Math.floor(hi / c));
      const wrongs = new Set<number>();
      for (let t = 0; t < 12 && wrongs.size < 3; t++) wrongs.add(trap(rng, c, lo, hi));
      wrongs.delete(right);
      return build(ctx, {
        prompt: L(`Care dintre numere se divide cu ${c}?`, `Which of these numbers is divisible by ${c}?`),
        answer: aInt(right),
        wrong: [...wrongs].map(aInt),
        only: ['choice'],
        noPad: true,
      });
    }

    case 'criteriaTf': {
      const c = pick(rng, crit);
      const hi = Math.max(99, Math.min(cNums, max * 10));
      const truth = chance(rng, 0.5);
      const n = truth ? c * randInt(rng, Math.ceil(10 / c), Math.floor(hi / c)) : trap(rng, c, 10, hi);
      return tfItem(ctx, L(`numărul ${sInt(n)} se divide cu ${c}.`, `the number ${sInt(n)} is divisible by ${c}.`), n % c === 0);
    }

    case 'digitFind': {
      // smallest digit that makes the number divisible
      for (let t = 0; t < 100; t++) {
        const cs = crit.filter((x) => [2, 3, 4, 5, 9].includes(x));
        const c = pick(rng, cs.length ? cs : [3]);
        const a = randInt(rng, 1, 9);
        const b = randInt(rng, 0, 9);
        const gapMiddle = c !== 2 && c !== 5 && c !== 4 ? chance(rng, 0.6) : false;
        const text = gapMiddle ? `${a}□${b}` : `${a}${b}□`;
        const num = (x: number) => (gapMiddle ? a * 100 + x * 10 + b : a * 100 + b * 10 + x);
        const good = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => num(x) % c === 0);
        if (good.length === 0 || good.length > 5) continue;
        const ans = good[0];
        return build(ctx, {
          prompt: L(
            `Care este cea mai mică cifră care poate înlocui □ astfel încât numărul ${text} să se dividă cu ${c}?`,
            `What is the smallest digit that can replace □ so that the number ${text} is divisible by ${c}?`,
          ),
          answer: aInt(ans),
          wrong: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== ans && !good.includes(x)).map(aInt),
          noPad: true,
          gap: same(`${text} se divide cu ${c} pentru □ = {{gap}}`),
          gapPrompt: L('Alege cea mai mică cifră potrivită.', 'Pick the smallest suitable digit.'),
        });
      }
      return tfItem(ctx, same('120 se divide cu 3.'), true);
    }

    case 'primeSelect': {
      const lim = Math.min(99, max);
      const primes = Array.from({ length: lim - 1 }, (_, i) => i + 2).filter(isPrime);
      const right = pick(rng, primes.filter((p) => p > 10));
      const wrongs = shuffle(rng, ODD_COMPOSITES.filter((x) => x <= lim)).slice(0, 3);
      return build(ctx, {
        prompt: L('Care dintre numere este număr prim?', 'Which of these numbers is prime?'),
        answer: aInt(right),
        wrong: wrongs.map(aInt),
        only: ['choice'],
        noPad: true,
      });
    }

    case 'primeTf': {
      const lim = Math.min(99, max);
      const truth = chance(rng, 0.5);
      const pool = truth ? Array.from({ length: lim - 1 }, (_, i) => i + 2).filter(isPrime) : [...ODD_COMPOSITES.filter((x) => x <= lim), 4, 6, 8, 10, 12, 14, 16, 18, 20, 1];
      const n = pick(rng, pool);
      const verb = isPrime(n);
      return tfItem(ctx, L(`${n} este număr prim.`, `${n} is a prime number.`), verb);
    }

    case 'countPrimes': {
      let lo = 10;
      let hi = 40;
      for (let t = 0; t < 100; t++) {
        lo = randInt(rng, 4, 60);
        hi = lo + randInt(rng, 8, 30);
        if (!isPrime(lo) && !isPrime(hi) && hi <= 100) break;
      }
      const inside = Array.from({ length: hi - lo - 1 }, (_, i) => lo + 1 + i).filter(isPrime);
      const k = inside.length;
      return build(ctx, {
        prompt: L(`Câte numere prime sunt între ${lo} și ${hi}?`, `How many prime numbers are there between ${lo} and ${hi}?`),
        answer: aInt(k),
        wrong: [aInt(k + 1), aInt(k - 1), aInt(k + 2), aInt(Math.floor((hi - lo) / 2))].filter((w) => w.int !== k && (w.int ?? 0) >= 0),
        gap: same(`Între ${lo} și ${hi} sunt {{gap}} numere prime`),
      });
    }

    case 'divisorCount': {
      const n = pick(rng, [12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48, 50, 54, 60, 63, 64, 72, 75, 80, 90, 96, 100].filter((x) => x <= Math.max(max, 30)));
      const divs = divisorsOf(n);
      if (chance(rng, 0.35)) {
        const biggest = n / factorise(n)[0][0];
        const others = divisorsOf(n).filter((x) => x !== biggest);
        const wrongs = [n, 1, ...shuffle(rng, others.filter((x) => x !== n && x !== 1))];
        return build(ctx, {
          prompt: L(
            `Care este cel mai mare divizor propriu al numărului ${n}? (divizor propriu = diferit de 1 și de ${n})`,
            `What is the largest proper divisor of ${n}? (proper = different from 1 and from ${n})`,
          ),
          answer: aInt(biggest),
          wrong: wrongs.slice(0, 4).map(aInt),
          only: ['choice'],
          noPad: true,
        });
      }
      return build(ctx, {
        prompt: L(`Câți divizori are numărul ${n}?`, `How many divisors does ${n} have?`),
        answer: aInt(divs.length),
        wrong: [aInt(divs.length - 2), aInt(divs.length - 1), aInt(divs.length + 1), aInt(factorise(n).length), aInt(divs.length + 2)].filter((w) => w.int !== divs.length && (w.int ?? 0) > 0),
        gap: same(`Numărul ${n} are {{gap}} divizori`),
      });
    }

    case 'notDivisor': {
      const n = pick(rng, [24, 30, 36, 40, 42, 48, 54, 60, 72, 84, 90, 120].filter((x) => x <= Math.max(max, 30)));
      const divs = divisorsOf(n).filter((x) => x > 1 && x < n);
      const non = shuffle(rng, Array.from({ length: n - 1 }, (_, i) => i + 2).filter((x) => n % x !== 0 && x < 30));
      const right = non[0];
      return build(ctx, {
        prompt: L(`Care dintre numere NU este divizor al lui ${n}?`, `Which of these numbers is NOT a divisor of ${n}?`),
        answer: aInt(right),
        wrong: shuffle(rng, divs).slice(0, 3).map(aInt),
        only: ['choice'],
        noPad: true,
      });
    }

    case 'multiples': {
      const m = randInt(rng, 3, 12);
      const kind = pick(rng, ['nth', 'count', 'select']);
      if (kind === 'nth') {
        const k = randInt(rng, 5, 12);
        return build(ctx, {
          prompt: L(`Care este al ${k}-lea multiplu nenul al lui ${m}?`, `What is the ${k}th non-zero multiple of ${m}?`),
          answer: aInt(m * k),
          wrong: [aInt(m + k), aInt(m * (k - 1)), aInt(m * (k + 1)), aInt(m * k + m + 1), aInt(m * k - 1)].filter((w) => w.int !== m * k),
        });
      }
      if (kind === 'count') {
        const top = randInt(rng, 4, 12) * m + randInt(rng, 1, m - 1);
        return build(ctx, {
          prompt: L(`Câți multipli nenuli ai lui ${m} sunt mai mici decât ${top + 1}?`, `How many non-zero multiples of ${m} are less than ${top + 1}?`),
          answer: aInt(Math.floor(top / m)),
          wrong: [aInt(Math.floor(top / m) + 1), aInt(Math.floor(top / m) - 1), aInt(m), aInt(top - m)].filter((w) => w.int !== Math.floor(top / m)),
        });
      }
      const right = m * randInt(rng, 4, 14);
      const wrongs = new Set<number>();
      for (let t = 0; t < 40 && wrongs.size < 3; t++) {
        const w = right + pick(rng, [-2, -1, 1, 2, m - 1, m + 1, -(m - 1), -(m + 1)]);
        if (w % m !== 0 && w > 0) wrongs.add(w);
      }
      return build(ctx, {
        prompt: L(`Care dintre numere este multiplu al lui ${m}?`, `Which of these numbers is a multiple of ${m}?`),
        answer: aInt(right),
        wrong: [...wrongs].map(aInt),
        only: ['choice'],
        noPad: true,
      });
    }

    case 'factor': {
      const primes = [2, 3, 5, 7, 11, 13];
      for (let t = 0; t < 200; t++) {
        const count = randInt(rng, 2, d <= 2 ? 3 : 4);
        const chosen = shuffle(rng, primes).slice(0, count).sort((a, b) => a - b);
        const exps = chosen.map((p) => (p === 2 ? randInt(rng, 1, 4) : p === 3 ? randInt(rng, 1, 3) : randInt(rng, 1, 2)));
        const f: [number, number][] = chosen.map((p, i) => [p, exps[i]]);
        const n = f.reduce((acc, [p, e]) => acc * p ** e, 1);
        if (n > 2000 || n < 20) continue;
        const right = facText(f);
        const bump = f.map((_, i) => facText(f.map(([q, g], j) => [q, j === i ? g + 1 : g] as [number, number])));
        const composite = (() => {
          // not fully decomposed: merge the two smallest prime powers into one factor
          const parts = f.map(([p, e]) => (e > 1 ? `${p}${sup(e)}` : String(p)));
          if (f[0][1] > 1) return [`${f[0][0] ** f[0][1]}`, ...parts.slice(1)].join(' · ');
          return [`${f[0][0] * f[1][0] ** f[1][1]}`, ...parts.slice(2)].join(' · ');
        })();
        const wrongs = [...bump, composite].filter((w) => w !== right);
        if (new Set(wrongs).size < 3) continue;
        return build(ctx, {
          prompt: L(`Descompune numărul ${sInt(n)} în factori primi.`, `Write ${sInt(n)} as a product of prime factors.`),
          answer: aT(right),
          wrong: [...new Set(wrongs)].map((w) => aT(w)),
          must: [aT(composite)],
          only: ['choice'],
        });
      }
      return tfItem(ctx, same('60 = 2² · 3 · 5'), true);
    }

    case 'factorCount': {
      for (let t = 0; t < 100; t++) {
        const n = randInt(rng, 12, Math.min(max * 3, 500));
        const f = factorise(n);
        if (f.length < 2) continue;
        return build(ctx, {
          prompt: L(`Câți factori primi distincți apar în descompunerea lui ${n}?`, `How many distinct prime factors appear in the factorisation of ${n}?`),
          answer: aInt(f.length),
          wrong: [aInt(f.length + 1), aInt(f.reduce((s, [, e]) => s + e, 0)), aInt(f.length - 1 || 1), aInt(f.length + 2)].filter((w) => w.int !== f.length && (w.int ?? 0) > 0),
        });
      }
      return tfItem(ctx, same('12 = 2² · 3'), true);
    }

    case 'gcd':
    case 'lcm': {
      const isGcd = mode === 'gcd';
      for (let t = 0; t < 200; t++) {
        const g = randInt(rng, 2, d <= 2 ? 9 : 14);
        const p = randInt(rng, 2, 9);
        const q = randInt(rng, 2, 9);
        if (p === q || gcd(p, q) !== 1) continue;
        const a = g * p;
        const b = g * q;
        const l = lcm(a, b);
        if (a > 200 || b > 200 || l > 999) continue;
        const ans = isGcd ? g : l;
        const wrongs = isGcd ? [l, Math.min(a, b), g * 2, g + 1, Math.abs(a - b)] : [g, a * b, a + b, Math.max(a, b), l + g, l - g];
        const word = d >= 2 && chance(rng, 0.4);
        const name = isGcd ? 'cmmdc' : 'cmmmc';
        const nameEn = isGcd ? 'gcd' : 'lcm';
        const prompt = word
          ? isGcd
            ? L(`O placă dreptunghiulară de ${a} cm pe ${b} cm se taie în pătrate egale, cât mai mari, fără rest. Care este latura pătratelor (în cm)?`, `A rectangular board ${a} cm by ${b} cm is cut into equal squares, as large as possible, with no waste. What is the side of a square (in cm)?`)
            : L(`Două autobuze pleacă împreună din stație. Unul revine la ${a} minute, celălalt la ${b} minute. După câte minute se află din nou împreună în stație (prima dată)?`, `Two buses leave a stop together. One returns every ${a} minutes, the other every ${b} minutes. After how many minutes are they at the stop together again (first time)?`)
          : L(`Calculează ${name}(${a}, ${b}).`, `Find ${nameEn}(${a}, ${b}).`);
        return build(ctx, {
          prompt,
          answer: aInt(ans),
          wrong: wrongs.filter((w) => w !== ans && w > 0).map(aInt),
          must: [aInt(isGcd ? l : a * b)].filter((w) => w.int !== ans),
          gap: word ? undefined : same(`${name}(${a}, ${b}) = {{gap}}`),
          tf: word ? undefined : (x) => same(`${name}(${a}, ${b}) = ${x.ro}`),
        });
      }
      return tfItem(ctx, same('cmmdc(12, 18) = 6'), true);
    }

    case 'coprime': {
      const truth = chance(rng, 0.5);
      for (let t = 0; t < 200; t++) {
        const a = randInt(rng, 4, 60);
        const b = randInt(rng, 4, 60);
        if (a === b || (gcd(a, b) === 1) !== truth) continue;
        return tfItem(ctx, L(`${a} și ${b} sunt numere prime între ele.`, `${a} and ${b} are coprime.`), gcd(a, b) === 1);
      }
      return tfItem(ctx, same('8 și 15 sunt numere prime între ele.'), true);
    }
  }
};

registerGenerator('divisibility', divisibility);
