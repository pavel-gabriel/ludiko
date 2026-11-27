/**
 * `statistics` generator (grades VI and VIII): arithmetic mean, median, mode, range, a missing value, weighted mean
 * from a frequency table. params: modes: any of 'mean' | 'median' | 'mode' | 'range' | 'missing' | 'weighted' | 'freq'
 *
 * Data sets are built so that the answers are exact: the mean is a whole number (the last value is solved for), the
 * mode is unique, a median of an even-sized set may be a half (shown with the Romanian decimal comma, "6,5").
 * Small sets are drawn as a `grid` strip. Distractors: the unsorted middle, the mean given for the median, the sum
 * (forgot to divide), the count of the mode instead of the value, the maximum for the range.
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { pick, randInt, shuffle } from './util';
import { aInt, build, L } from './mathKit';
import { decText } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['mean', 'median', 'mode', 'range', 'missing', 'weighted', 'freq'] as const;
type Mode = (typeof MODES)[number];

const strip = (vals: number[]): VisualSpec | undefined => (vals.length <= 10 ? { kind: 'grid', rows: 1, cols: vals.length, cells: vals.map(String) } : undefined);

/** n values in [lo, hi] with an exact whole-number mean m */
function withMean(rng: () => number, n: number, m: number, lo: number, hi: number): number[] {
  for (let t = 0; t < 200; t++) {
    const vals = Array.from({ length: n - 1 }, () => randInt(rng, lo, hi));
    const last = m * n - vals.reduce((s, v) => s + v, 0);
    if (last >= lo && last <= hi) return shuffle(rng, [...vals, last]);
  }
  return Array.from({ length: n }, () => m);
}

const halfText = (twice: number, lang: 'ro' | 'en'): string => (twice % 2 === 0 ? String(twice / 2) : decText(twice * 5, 1, lang));

export const statistics: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['mean']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['mean'] as Mode[]));
  const n = d <= 1 ? 4 : randInt(rng, 5, d <= 3 ? 6 : 8);

  switch (mode) {
    case 'mean': {
      const m = randInt(rng, 4, 12);
      const vals = withMean(rng, n, m, Math.max(1, m - 4), m + 5);
      const sum = m * n;
      const sorted = [...vals].sort((a, b) => a - b);
      const med = sorted.length % 2 === 1 ? sorted[(sorted.length - 1) / 2] : -1;
      const wrongs = [sum, med, Math.max(...vals), Math.min(...vals), m + 1, m - 1, Math.max(...vals) - Math.min(...vals)].filter((w) => w !== m && w > 0);
      const list = vals.join(', ');
      return build(ctx, {
        prompt: L(`Care este media aritmetică a numerelor ${list}?`, `What is the arithmetic mean of the numbers ${list}?`),
        visual: d <= 2 ? strip(vals) : undefined,
        answer: aInt(m),
        wrong: wrongs.map(aInt),
        must: [aInt(sum)].filter((w) => w.int !== m),
        gap: same(`media aritmetică = {{gap}}`),
        tf: (x) => same(`media aritmetică a numerelor ${list} este ${x.ro}`),
      });
    }

    case 'median': {
      const odd = n % 2 === 1 || d <= 1;
      const k = odd ? (n % 2 === 1 ? n : n + 1) : n;
      const vals = Array.from({ length: k }, () => randInt(rng, 1, 15));
      const sorted = [...vals].sort((a, b) => a - b);
      const mid = k % 2 === 1 ? sorted[(k - 1) / 2] : null;
      const twice = mid !== null ? mid * 2 : sorted[k / 2 - 1] + sorted[k / 2];
      const list = vals.join(', ');
      const meanTwice = Math.round((vals.reduce((s, v) => s + v, 0) * 2) / k); // distractor only: rounded double of the mean
      const unsortedMid = k % 2 === 1 ? vals[(k - 1) / 2] : vals[k / 2 - 1];
      const cand = [unsortedMid * 2, meanTwice, twice + 2, twice - 2, sorted[k - 1] * 2, sorted[0] * 2, sorted[Math.floor(k / 2)] * 2 + 1].filter((w) => w !== twice && w > 0);
      const right = { ro: halfText(twice, 'ro'), en: halfText(twice, 'en'), ...(twice % 2 === 0 ? { int: twice / 2 } : {}) };
      const mk = (w: number) => ({ ro: halfText(w, 'ro'), en: halfText(w, 'en'), ...(w % 2 === 0 ? { int: w / 2 } : {}) });
      return build(ctx, {
        prompt: L(`Care este mediana valorilor ${list}? (ordonează mai întâi valorile)`, `What is the median of the values ${list}? (sort the values first)`),
        visual: d <= 2 ? strip(vals) : undefined,
        answer: right,
        wrong: cand.map(mk),
        must: [mk(unsortedMid * 2)].filter((w) => w.ro !== right.ro),
        gap: same(`mediana = {{gap}}`),
        noPad: true,
      });
    }

    case 'mode': {
      for (let t = 0; t < 100; t++) {
        const k = n + 1;
        const base = Array.from({ length: k - 3 }, () => randInt(rng, 1, 12));
        const mv = randInt(rng, 1, 12);
        const vals = shuffle(rng, [...base, mv, mv, mv]);
        const counts = new Map<number, number>();
        vals.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
        const top = Math.max(...counts.values());
        const modes2 = [...counts.entries()].filter(([, c]) => c === top);
        if (modes2.length !== 1) continue;
        const wrongs = [3, Math.max(...vals), Math.min(...vals), Math.round(vals.reduce((s, v) => s + v, 0) / k), [...vals].sort((a, b) => a - b)[Math.floor(k / 2)]].filter((w) => w !== mv && w > 0);
        const list = vals.join(', ');
        return build(ctx, {
          prompt: L(`Care este modulul (valoarea care apare cel mai des) în șirul ${list}?`, `What is the mode (the value that appears most often) in ${list}?`),
          visual: d <= 2 ? strip(vals) : undefined,
          answer: aInt(mv),
          wrong: wrongs.map(aInt),
          must: [aInt(3)].filter((w) => w.int !== mv),
          gap: same(`modulul = {{gap}}`),
          tf: (x) => same(`modulul șirului ${list} este ${x.ro}`),
        });
      }
      return build(ctx, { prompt: L('Care este modulul șirului 2, 3, 3, 3, 5?', 'What is the mode of 2, 3, 3, 3, 5?'), answer: aInt(3), wrong: [aInt(2), aInt(5), aInt(4)] });
    }

    case 'range': {
      const vals = Array.from({ length: n }, () => randInt(rng, 1, 30));
      const mx = Math.max(...vals);
      const mn = Math.min(...vals);
      if (mx === mn) vals[0] += 3;
      const mx2 = Math.max(...vals);
      const rg = mx2 - mn;
      const list = vals.join(', ');
      return build(ctx, {
        prompt: L(`Care este amplitudinea (diferența dintre cea mai mare și cea mai mică valoare) pentru ${list}?`, `What is the range (largest minus smallest value) of ${list}?`),
        visual: d <= 2 ? strip(vals) : undefined,
        answer: aInt(rg),
        wrong: [aInt(mx2), aInt(mn), aInt(mx2 + mn), aInt(rg + 1), aInt(Math.max(1, rg - 1))].filter((w) => w.int !== rg && (w.int ?? 0) > 0),
        must: [aInt(mx2)].filter((w) => w.int !== rg),
        gap: same(`amplitudinea = {{gap}}`),
      });
    }

    case 'missing': {
      const k = randInt(rng, 4, 6);
      const m = randInt(rng, 5, 12);
      const vals = withMean(rng, k, m, 2, 18);
      const last = vals[k - 1];
      const known = vals.slice(0, k - 1);
      const sum = known.reduce((s, v) => s + v, 0);
      const word = (c: number): [string, string] => (c === 3 ? ['Trei', 'Three'] : c === 4 ? ['Patru', 'Four'] : ['Cinci', 'Five']);
      const [wr, we] = word(k - 1);
      return build(ctx, {
        prompt: L(`Media aritmetică a ${k} numere este ${m}. ${wr} dintre ele sunt ${known.join(', ')}. Care este ultimul număr?`, `The arithmetic mean of ${k} numbers is ${m}. ${we} of them are ${known.join(', ')}. What is the last number?`),
        answer: aInt(last),
        wrong: [aInt(m), aInt(m * k), aInt(sum), aInt(Math.abs(m - sum)), aInt(last + 1), aInt(Math.max(1, last - 1))].filter((w) => w.int !== last && (w.int ?? 0) > 0),
        must: [aInt(m)].filter((w) => w.int !== last),
      });
    }

    case 'weighted':
    case 'freq': {
      for (let t = 0; t < 300; t++) {
        const grades = [randInt(rng, 5, 7), randInt(rng, 7, 9), randInt(rng, 9, 10)];
        if (new Set(grades).size < 3) continue;
        const freqs = grades.map(() => randInt(rng, 1, 8));
        const total = freqs.reduce((s, f) => s + f, 0);
        const wsum = grades.reduce((s, g, i) => s + g * freqs[i], 0);
        const table = grades.map((g, i) => L(`nota ${g}: ${freqs[i]} ${freqs[i] === 1 ? 'elev' : 'elevi'}`, `mark ${g}: ${freqs[i]} ${freqs[i] === 1 ? 'pupil' : 'pupils'}`));
        const tableRo = table.map((x) => x.ro).join('; ');
        const tableEn = table.map((x) => x.en).join('; ');
        if (mode === 'freq') {
          return build(ctx, {
            prompt: L(`La o lucrare s-au obținut: ${tableRo}. Câți elevi au scris lucrarea?`, `In a test the results were: ${tableEn}. How many pupils took the test?`),
            answer: aInt(total),
            wrong: [aInt(freqs[0]), aInt(grades.reduce((s, g) => s + g, 0)), aInt(total + 1), aInt(Math.max(1, total - 1)), aInt(wsum)].filter((w) => w.int !== total),
          });
        }
        if (wsum % total !== 0) continue;
        const mean = wsum / total;
        const plain = Math.round(grades.reduce((s, g) => s + g, 0) / 3);
        return build(ctx, {
          prompt: L(`La o lucrare s-au obținut: ${tableRo}. Care este media notelor clasei?`, `In a test the results were: ${tableEn}. What is the class mean mark?`),
          answer: aInt(mean),
          wrong: [aInt(plain), aInt(wsum), aInt(mean + 1), aInt(Math.max(1, mean - 1)), aInt(total)].filter((w) => w.int !== mean && (w.int ?? 0) > 0),
          must: [aInt(plain)].filter((w) => w.int !== mean),
        });
      }
      return build(ctx, { prompt: L('Care este media numerelor 4 și 8?', 'What is the mean of 4 and 8?'), answer: aInt(6), wrong: [aInt(12), aInt(4), aInt(5)] });
    }
  }
};

registerGenerator('statistics', statistics);
