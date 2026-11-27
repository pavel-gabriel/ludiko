/**
 * `proportions` generator (grades VI-VII). params:
 *   modes: any of 'ratio' | 'prop' | 'propTf' | 'direct' | 'inverse' | 'scale' | 'split' | 'similar'
 *
 * All problems are built backwards from whole numbers (unit rate, product, scale factor), so every answer is an
 * exact whole number that can be typed. Distractors: the additive slip (adding the same difference instead of
 * multiplying), using direct proportionality for an inverse problem, a reversed ratio, a unit slip (x10, /10),
 * the smaller part instead of the larger one.
 */
import type { Item, LocalizedText } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, roCount, sInt, tfItem } from './mathKit';
import { fr, frText, gcd, rawFrText } from './rational';

const same = (s: string) => L(s, s);
const MODES = ['ratio', 'prop', 'propTf', 'direct', 'inverse', 'scale', 'split', 'similar'] as const;
type Mode = (typeof MODES)[number];

const TRIANGLES: [number, number, number][] = [[3, 4, 5], [4, 5, 6], [5, 6, 7], [5, 12, 13], [6, 8, 10], [4, 6, 8], [6, 7, 9], [7, 8, 10], [8, 10, 12]];

export const proportions: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['direct']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['direct'] as Mode[]));

  switch (mode) {
    case 'ratio': {
      let a = 6;
      let b = 8;
      for (let t = 0; t < 60; t++) {
        const g = randInt(rng, 2, 9);
        const p = randInt(rng, 1, 9);
        const q = randInt(rng, 1, 9);
        if (p !== q && gcd(p, q) === 1) {
          a = g * p;
          b = g * q;
          break;
        }
      }
      const f = fr(a, b);
      const word = chance(rng, 0.5);
      const prompt: LocalizedText = word
        ? L(`Într-o clasă sunt ${roCount(a, 'fete')} și ${roCount(b, 'băieți')}. Care este raportul dintre numărul fetelor și numărul băieților, în forma ireductibilă?`, `A class has ${a} girls and ${b} boys. What is the ratio of girls to boys, in lowest terms?`)
        : L(`Scrie raportul numerelor ${a} și ${b} ca fracție ireductibilă.`, `Write the ratio of ${a} to ${b} as a fraction in lowest terms.`);
      const wrongs = [aT(rawFrText(a, b)), aT(frText(fr(b, a))), aT(frText(fr(a - gcd(a, b) + 1, b))), aT(frText(fr(a + 1, b))), aT(frText(fr(a, b + 1)))].filter((w) => w.ro !== frText(f));
      return build(ctx, {
        prompt,
        answer: aT(frText(f)),
        wrong: wrongs,
        must: [aT(rawFrText(a, b)), aT(frText(fr(b, a)))].filter((w) => w.ro !== frText(f)),
        tf: (x) => same(`raportul numerelor ${a} și ${b} este ${x.ro} (forma ireductibilă)`),
        tfWrong: [aT(frText(fr(b, a))), aT(frText(fr(a + 1, b)))].filter((w) => w.ro !== frText(f)),
      });
    }

    case 'prop': {
      let a = 0;
      let b = 0;
      let c = 0;
      let dd = 0;
      for (let t = 0; t < 100; t++) {
        const p = randInt(rng, 1, 7);
        const q = randInt(rng, 2, 9);
        if (p >= q || gcd(p, q) !== 1) continue;
        const k1 = randInt(rng, 1, d <= 2 ? 4 : 8);
        const k2 = randInt(rng, 1, d <= 2 ? 4 : 8);
        if (k1 === k2) continue;
        [a, b, c, dd] = [p * k1, q * k1, p * k2, q * k2];
        break;
      }
      const vals = [a, b, c, dd];
      const pos = randInt(rng, 0, 3);
      const ans = vals[pos];
      const sh = vals.map((v, i) => (i === pos ? '?' : String(v)));
      const eq = `${sh[0]}/${sh[1]} = ${sh[2]}/${sh[3]}`;
      const tpl = `${vals.map((v, i) => (i === pos ? '{{gap}}' : String(v))).slice(0, 2).join('/')} = ${vals.map((v, i) => (i === pos ? '{{gap}}' : String(v))).slice(2).join('/')}`;
      // additive slip: keep the same difference
      const add = pos === 0 ? c - dd + b : pos === 1 ? a - c + dd : pos === 2 ? a - b + dd : c - a + b;
      const wrongs = [add, vals[(pos + 1) % 4] * vals[(pos + 3) % 4], ans + 1, ans - 1, ans * 2, a + b].filter((w) => w !== ans && w > 0);
      return build(ctx, {
        prompt: L(`Află numărul necunoscut din proporția ${eq}.`, `Find the unknown number in the proportion ${eq}.`),
        answer: aInt(ans),
        wrong: wrongs.map(aInt),
        must: [aInt(add)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        gap: same(tpl),
        gapPrompt: L('Completează proporția.', 'Complete the proportion.'),
        tf: (x) => same(eq.replace('?', x.ro)),
      });
    }

    case 'propTf': {
      const p = randInt(rng, 1, 5);
      const q = randInt(rng, p + 1, 9);
      const k1 = randInt(rng, 1, 5);
      const k2 = randInt(rng, 1, 5);
      const truth = chance(rng, 0.5);
      const a = p * k1;
      const b = q * k1;
      const c = p * k2;
      const dd = q * k2 + (truth ? 0 : pick(rng, [1, -1, 2]));
      const holds = a * dd === b * c;
      return tfItem(ctx, same(`${a}/${b} = ${c}/${dd}`), holds);
    }

    case 'direct': {
      const u = randInt(rng, 2, d <= 2 ? 12 : 25);
      const a = randInt(rng, 2, 12);
      let b = randInt(rng, 2, 14);
      if (a === b) b = a + 1;
      const c = a * u;
      const ans = b * u;
      const kind = pick(rng, [0, 1, 2, 3]);
      const prompt: LocalizedText =
        kind === 0 ? L(`${a} caiete costă ${roCount(c, 'lei')}. Cât costă ${b} caiete (în lei)?`, `${a} notebooks cost ${c} lei. How much do ${b} notebooks cost (in lei)?`)
        : kind === 1 ? L(`${a} kg de mere costă ${roCount(c, 'lei')}. Cât costă ${b} kg (în lei)?`, `${a} kg of apples cost ${c} lei. How much do ${b} kg cost (in lei)?`)
        : kind === 2 ? L(`Un automobil parcurge ${c} km în ${a} ore, cu viteză constantă. Câți kilometri parcurge în ${b} ore?`, `A car travels ${c} km in ${a} hours at a constant speed. How many kilometres does it travel in ${b} hours?`)
        : L(`O imprimantă tipărește ${c} de pagini în ${a} minute. Câte pagini tipărește în ${b} minute?`, `A printer prints ${c} pages in ${a} minutes. How many pages does it print in ${b} minutes?`);
      const wrongs = [c + (b - a), u, c * b, ans + u, ans - u, c + b].filter((w) => w !== ans && w > 0);
      return build(ctx, {
        prompt,
        answer: aInt(ans),
        wrong: wrongs.map(aInt),
        must: [aInt(c + (b - a))].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        tf: (x) => L(`${prompt.ro} Răspuns: ${x.ro}`, `${prompt.en} Answer: ${x.ro}`),
        tfWrong: [aInt(c + (b - a)), aInt(ans + u)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        only: ['choice', 'typed', 'tf'],
      });
    }

    case 'inverse': {
      const kind = pick(rng, [0, 1, 2]);
      for (let t = 0; t < 200; t++) {
        const w1 = randInt(rng, 2, 12);
        const w2 = randInt(rng, 2, 12);
        const t1 = randInt(rng, 2, 24);
        if (w1 === w2 || (w1 * t1) % w2 !== 0) continue;
        const t2 = (w1 * t1) / w2;
        const direct = (t1 * w2) % w1 === 0 ? (t1 * w2) / w1 : t1 + (w2 - w1);
        const prompt: LocalizedText =
          kind === 0 ? L(`${w1} muncitori termină o lucrare în ${t1} zile. În câte zile ar termina aceeași lucrare ${w2} muncitori (același ritm)?`, `${w1} workers finish a job in ${t1} days. In how many days would ${w2} workers finish the same job (same pace)?`)
          : kind === 1 ? L(`${w1} robinete identice umplu un bazin în ${t1} ore. În câte ore îl umplu ${w2} robinete?`, `${w1} identical taps fill a pool in ${t1} hours. In how many hours do ${w2} taps fill it?`)
          : L(`Cu viteza de ${w1} km/h un drum se parcurge în ${t1} ore. În câte ore se parcurge același drum cu ${w2} km/h?`, `At ${w1} km/h a road is covered in ${t1} hours. In how many hours is the same road covered at ${w2} km/h?`);
        const wrongs = [direct, t1 + (w1 - w2), t1 * w1, t1 * w2, t2 + 1, t2 - 1, w1 * t1 + w2].filter((w) => w !== t2 && w > 0);
        return build(ctx, {
          prompt,
          answer: aInt(t2),
          wrong: wrongs.map(aInt),
          must: [aInt(direct)].filter((w) => w.int !== t2),
          tf: (x) => L(`${prompt.ro} Răspuns: ${x.ro}`, `${prompt.en} Answer: ${x.ro}`),
          tfWrong: [aInt(direct), aInt(t1 * w1)].filter((w) => w.int !== t2),
          only: ['choice', 'typed', 'tf'],
        });
      }
      return build(ctx, { prompt: L('4 muncitori termină o lucrare în 12 zile. În câte zile o termină 6 muncitori?', '4 workers finish a job in 12 days. How many days do 6 workers need?'), answer: aInt(8), wrong: [aInt(18), aInt(10), aInt(6)] });
    }

    case 'scale': {
      for (let t = 0; t < 200; t++) {
        const k = pick(rng, [50000, 100000, 200000, 250000, 500000]);
        const cm = randInt(rng, 2, 20);
        if ((cm * k) % 100000 !== 0) continue;
        const km = (cm * k) / 100000;
        const kText = sInt(k);
        return build(ctx, {
          prompt: L(`Pe o hartă cu scara 1:${kText}, distanța dintre două localități este ${cm} cm. Care este distanța reală, în km?`, `On a map with scale 1:${kText}, the distance between two towns is ${cm} cm. What is the real distance, in km?`),
          answer: aInt(km),
          wrong: [aInt(km * 10), aInt(km * 100), aInt(cm * 10), aInt(km + cm), aInt(cm * k > 999999 ? km + 1 : cm * k)].filter((w) => w.int !== km && (w.int ?? 0) > 0),
          must: [aInt(km * 10)],
          gap: L(`${cm} cm pe hartă (1:${kText}) = {{gap}} km în realitate`, `${cm} cm on the map (1:${kText}) = {{gap}} km in reality`),
        });
      }
      return build(ctx, { prompt: L('Pe o hartă cu scara 1:100 000, 3 cm reprezintă în realitate câți km?', 'On a map with scale 1:100 000, 3 cm stands for how many km?'), answer: aInt(3), wrong: [aInt(30), aInt(300), aInt(33)] });
    }

    case 'split': {
      for (let t = 0; t < 100; t++) {
        const a = randInt(rng, 1, 8);
        const b = randInt(rng, 1, 8);
        if (a === b) continue;
        const k = randInt(rng, 2, d <= 2 ? 9 : 25);
        const S = (a + b) * k;
        const big = Math.max(a, b) * k;
        const small = Math.min(a, b) * k;
        return build(ctx, {
          prompt: L(`Numărul ${S} se împarte în două părți direct proporționale cu ${a} și ${b}. Care este partea mai mare?`, `The number ${S} is split into two parts directly proportional to ${a} and ${b}. What is the larger part?`),
          answer: aInt(big),
          wrong: [aInt(small), aInt(Math.floor(S / 2) + k), aInt(Math.max(a, b) * (a + b)), aInt(S - k), aInt(big + k)].filter((w) => w.int !== big && (w.int ?? 0) > 0),
          must: [aInt(small)],
        });
      }
      return build(ctx, { prompt: L('Numărul 30 se împarte direct proporțional cu 2 și 3. Care este partea mai mare?', 'The number 30 is split in the ratio 2 : 3. What is the larger part?'), answer: aInt(18), wrong: [aInt(12), aInt(15), aInt(20)] });
    }

    case 'similar': {
      const [a, b, c] = pick(rng, TRIANGLES);
      const k = randInt(rng, 2, d <= 2 ? 4 : 6);
      if (d >= 3 && chance(rng, 0.35)) {
        const A1 = randInt(rng, 2, 12);
        return build(ctx, {
          prompt: L(`Două triunghiuri sunt asemenea, cu raportul de asemănare ${k}. Aria triunghiului mic este ${A1} cm². Care este aria triunghiului mare (în cm²)?`, `Two triangles are similar with similarity ratio ${k}. The small triangle has area ${A1} cm². What is the area of the large triangle (in cm²)?`),
          answer: aInt(A1 * k * k),
          wrong: [aInt(A1 * k), aInt(A1 + k), aInt(A1 * k * 2), aInt(A1 * k * k * k), aInt(A1 * k * k + k)].filter((w) => w.int !== A1 * k * k && (w.int ?? 0) > 0),
          must: [aInt(A1 * k)],
        });
      }
      const which = pick(rng, [0, 1, 2]);
      const sides = [a, b, c];
      const [s0, s1] = [(which + 1) % 3, (which + 2) % 3];
      const big = ['MN', 'NP', 'PM'];
      const known = sides[s0];
      const unknown = sides[s1];
      const bigKnown = known * k;
      const ans = unknown * k;
      const add = unknown + (bigKnown - known);
      return build(ctx, {
        prompt: L(
          `Triunghiurile ABC și MNP sunt asemenea (AB↔MN, BC↔NP, CA↔PM). În triunghiul ABC, AB = ${a}, BC = ${b}, CA = ${c}. În triunghiul MNP, ${big[s0]} = ${bigKnown}. Cât este ${big[s1]}?`,
          `Triangles ABC and MNP are similar (AB↔MN, BC↔NP, CA↔PM). In ABC, AB = ${a}, BC = ${b}, CA = ${c}. In MNP, ${big[s0]} = ${bigKnown}. What is ${big[s1]}?`,
        ),
        visual: { kind: 'shape', shape: 'triangle', sides: [a, b, c], unit: 'cm' },
        answer: aInt(ans),
        wrong: [aInt(add), aInt(unknown * (k + 1)), aInt(unknown + k), aInt(ans + k), aInt(bigKnown)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(add)].filter((w) => w.int !== ans),
      });
    }
  }
};

registerGenerator('proportions', proportions);
