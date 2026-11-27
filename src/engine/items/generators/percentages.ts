/**
 * `percentages` generator (grades V-VII). params:
 *   modes: any of 'of' | 'whatPercent' | 'whole' | 'increase' | 'decrease' | 'chain' | 'fracToPct' | 'pctToFrac' | 'decToPct'
 *   hard:  allow percentages like 15%, 35%, 12% (default: from difficulty 3 up)
 *
 * Numbers are chosen so that every result is a whole number (computed with integer arithmetic only), hence
 * answers can be typed on the numpad. Distractors: forgetting to divide by 100, subtracting the percent as
 * if it were lei, taking the discount instead of the new price, the complement (100 − p), a successive
 * increase and decrease that "cancel out".
 */
import type { Item, LocalizedText } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, roCount, sInt } from './mathKit';
import { fr, frText, gcd } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['of', 'whatPercent', 'whole', 'increase', 'decrease', 'chain', 'fracToPct', 'pctToFrac', 'decToPct'] as const;
type Mode = (typeof MODES)[number];

const EASY = [10, 20, 25, 50, 75, 5, 40, 60, 30, 80, 90];
const HARD = [15, 35, 12, 45, 8, 65, 24, 36, 18, 55];

/** multiplier m such that n = m * (100 / gcd(p, 100)) makes p% of n a whole number */
const unit = (p: number): number => 100 / gcd(p, 100);

export const percentages: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['of']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['of'] as Mode[]));
  const hard = params.hard === true || d >= 3;
  const p = pick(rng, hard ? [...EASY, ...HARD] : EASY.slice(0, d <= 1 ? 4 : EASY.length));
  const u = unit(p);
  const word = chance(rng, d <= 1 ? 0.3 : 0.55);

  switch (mode) {
    case 'of': {
      const n = u * randInt(rng, 1, Math.max(1, Math.floor(400 / u)));
      const ans = (n * p) / 100;
      const prompt: LocalizedText = word
        ? L(`O școală are ${roCount(n, 'elevi')}. ${p}% dintre ei participă la un concurs. Câți elevi participă?`, `A school has ${n} pupils. ${p}% of them take part in a contest. How many pupils take part?`)
        : L(`Calculează ${p}% din ${n}.`, `Work out ${p}% of ${n}.`);
      return build(ctx, {
        prompt,
        answer: aInt(ans),
        wrong: [aInt(n * p), aInt(n - ans), aInt(Math.floor(n / p)), aInt(ans + p), aInt(ans * 2)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(n - ans)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        gap: same(`${p}% din ${n} = {{gap}}`),
        tf: (x) => same(`${p}% din ${n} este ${x.ro}`),
      });
    }

    case 'whatPercent': {
      const total = u * randInt(rng, 1, Math.max(1, Math.floor(300 / u)));
      const part = (total * p) / 100;
      const prompt: LocalizedText = word
        ? L(`Într-o clasă sunt ${roCount(total, 'elevi')}, iar ${part} dintre ei sunt fete. Ce procent din clasă reprezintă fetele?`, `A class has ${total} pupils, ${part} of them are girls. What percent of the class are girls?`)
        : L(`Ce procent reprezintă ${part} din ${total}?`, `What percent is ${part} of ${total}?`);
      return build(ctx, {
        prompt,
        answer: aInt(p),
        wrong: [aInt(100 - p), aInt(Math.floor((total * 100) / part)), aInt(part), aInt(p + 5), aInt(Math.max(1, p - 5))].filter((w) => w.int !== p && (w.int ?? 0) > 0),
        must: [aInt(100 - p)].filter((w) => w.int !== p),
        gap: same(`${part} din ${total} reprezintă {{gap}}%`),
        tf: (x) => same(`${part} din ${total} reprezintă ${x.ro}%`),
      });
    }

    case 'whole': {
      const total = u * randInt(rng, 1, Math.max(1, Math.floor(400 / u)));
      const part = (total * p) / 100;
      return build(ctx, {
        prompt: L(`${p}% dintr-un număr este ${part}. Care este numărul?`, `${p}% of a number is ${part}. What is the number?`),
        answer: aInt(total),
        wrong: [aInt(Math.floor((part * p) / 100)), aInt(part * p), aInt(total - part), aInt(part + p), aInt(part * 2)].filter((w) => w.int !== total && (w.int ?? 0) > 0),
        gap: same(`${p}% din {{gap}} = ${part}`),
      });
    }

    case 'increase':
    case 'decrease': {
      const up = mode === 'increase';
      const n = 100 * randInt(rng, 1, d <= 2 ? 6 : 20);
      const delta = (n * p) / 100;
      const ans = up ? n + delta : n - delta;
      const prompt = up
        ? word ? L(`Un obiect costă ${roCount(n, 'lei')} și se scumpește cu ${p}%. Care este prețul nou, în lei?`, `An item costs ${n} lei and its price goes up by ${p}%. What is the new price, in lei?`) : L(`Mărește ${n} cu ${p}%.`, `Increase ${n} by ${p}%.`)
        : word ? L(`Un obiect costă ${roCount(n, 'lei')} și are o reducere de ${p}%. Cât costă după reducere, în lei?`, `An item costs ${n} lei with a ${p}% discount. What does it cost after the discount, in lei?`) : L(`Micșorează ${n} cu ${p}%.`, `Decrease ${n} by ${p}%.`);
      return build(ctx, {
        prompt,
        answer: aInt(ans),
        wrong: [aInt(delta), aInt(up ? n - delta : n + delta), aInt(up ? n + p : n - p), aInt(ans + p), aInt(n)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(delta), aInt(up ? n + p : n - p)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        gap: same(`${sInt(n)} ${up ? '+' : '−'} ${p}% = {{gap}}`),
      });
    }

    case 'chain': {
      for (let t = 0; t < 100; t++) {
        const q = pick(rng, [10, 20, 25, 50]);
        const m = randInt(rng, 1, 40);
        const n = 100 * m;
        const first = (n * (100 + q)) / 100;
        const second = (first * (100 - q)) / 100;
        if (!Number.isInteger(second) || second === n) continue;
        return build(ctx, {
          prompt: L(
            `Un obiect costă ${roCount(n, 'lei')}. Prețul crește cu ${q}%, apoi noul preț scade cu ${q}%. Care este prețul final, în lei?`,
            `An item costs ${n} lei. The price goes up by ${q}%, then the new price goes down by ${q}%. What is the final price, in lei?`,
          ),
          answer: aInt(second),
          wrong: [aInt(n), aInt(first), aInt(second + q), aInt(n - q), aInt(n + (n * q) / 100)].filter((w) => w.int !== second && (w.int ?? 0) > 0),
          must: [aInt(n)],
        });
      }
      return build(ctx, { prompt: L('Calculează 10% din 200.', 'Work out 10% of 200.'), answer: aInt(20), wrong: [aInt(2), aInt(180), aInt(200)] });
    }

    case 'fracToPct': {
      const den = pick(rng, [2, 4, 5, 10, 20, 25, 50]);
      const num = randInt(rng, 1, den - 1);
      const pct = (num * 100) / den;
      return build(ctx, {
        prompt: L(`Scrie fracția ${num}/${den} sub formă de procent. Câte procente reprezintă?`, `Write the fraction ${num}/${den} as a percent. How many percent is it?`),
        visual: den <= 12 ? { kind: 'fraction', numerator: num, denominator: den, shape: 'bar' } : undefined,
        answer: aInt(pct),
        wrong: [aInt(num * den), aInt(100 - pct), aInt(Math.floor(100 / den)), aInt(pct + 10), aInt(Math.round(pct / 10))].filter((w) => w.int !== pct && (w.int ?? 0) > 0),
        gap: same(`${num}/${den} = {{gap}}%`),
        tf: (x) => same(`${num}/${den} = ${x.ro}%`),
      });
    }

    case 'pctToFrac': {
      const f = fr(p, 100);
      const raw = `${p}/100`;
      const wrongs = [fr(100, p), fr(p, 10), fr(100 - p, 100), fr(1, p), fr(p + 5, 100)].filter((w) => !(w.n === f.n && w.d === f.d));
      const seen = new Set<string>();
      const uniq = wrongs.filter((w) => !seen.has(frText(w)) && seen.add(frText(w)));
      return build(ctx, {
        prompt: L(`Scrie ${p}% ca fracție ireductibilă.`, `Write ${p}% as a fraction in lowest terms.`),
        visual: f.n <= f.d && f.d <= 12 ? { kind: 'fraction', numerator: f.n, denominator: f.d, shape: 'bar' } : undefined,
        answer: aT(frText(f)),
        wrong: [...(gcd(p, 100) > 1 ? [aT(raw)] : []), ...uniq.map((w) => aT(frText(w)))],
        must: gcd(p, 100) > 1 ? [aT(raw)] : [],
        tf: (x) => same(`${p}% = ${x.ro} (fracție ireductibilă)`),
        tfWrong: uniq.map((w) => aT(frText(w))),
      });
    }

    case 'decToPct': {
      const v = randInt(rng, 1, 99);
      const ro = `0,${String(v).padStart(2, '0')}`;
      const en = `0.${String(v).padStart(2, '0')}`;
      return build(ctx, {
        prompt: L(`Scrie numărul ${ro} sub formă de procent. Câte procente reprezintă?`, `Write ${en} as a percent. How many percent is it?`),
        answer: aInt(v),
        wrong: [aInt(v * 10), aInt(Math.floor(v / 10) || v + 1), aInt(100 - v), aInt(v + 10), aInt(v * 100 > 999999 ? v + 1 : v * 100)].filter((w) => w.int !== v && (w.int ?? 0) > 0),
        gap: L(`${ro} = {{gap}}%`, `${en} = {{gap}}%`),
      });
    }
  }
};

registerGenerator('percentages', percentages);
