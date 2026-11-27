/**
 * `areas-volumes` generator (grades VII-VIII): areas and perimeters of plane figures, areas and volumes of solids.
 * params: topics: any of
 *   plane:  'rect' | 'square' | 'tri' | 'para' | 'trap' | 'rhombus' | 'circle'
 *   solids: 'cube' | 'box' | 'prism' | 'pyramid' | 'cylinder' | 'cone' | 'sphere'
 *
 * All formulas are evaluated with integer arithmetic, so every value is exact. Results that involve the number π
 * are written as kπ (never a decimal approximation), for example 36π cm², and are therefore offered as options.
 * Cones / pyramids use Pythagorean triples so the generatrix / apothem is a whole number. Distractors are the
 * typical formula slips: area instead of perimeter, forgetting the factor 1/2 or 1/3, diameter used as radius,
 * the height used instead of the slant height, the volume formula of the cylinder for the cone.
 */
import type { Item, VisualSpec } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, type Ans } from './mathKit';
import { fr } from './rational';

const same = (s: string) => L(s, s);
const TOPICS = ['rect', 'square', 'tri', 'para', 'trap', 'rhombus', 'circle', 'cube', 'box', 'prism', 'pyramid', 'cylinder', 'cone', 'sphere'] as const;
type Topic = (typeof TOPICS)[number];

const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]];
const BOX_DIAG: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [4, 4, 7, 9], [1, 4, 8, 9], [2, 6, 9, 11], [6, 6, 7, 11]];

/** "36π" / "32π/3" — exact coefficient of π (no decimals) */
const piText = (num: number, den = 1): string => {
  const f = fr(num, den);
  return f.d === 1 ? `${f.n}π` : `${f.n}π/${f.d}`;
};
const aPi = (num: number, den = 1): Ans => aT(piText(num, den));
const dedupe = (list: number[], v: number): number[] => [...new Set(list)].filter((w) => w !== v && w > 0 && Number.isInteger(w));

interface Prob {
  prompt: ReturnType<typeof L>;
  visual?: VisualSpec;
  answer: Ans;
  wrong: Ans[];
  must?: Ans[];
  gap?: ReturnType<typeof L>;
}

const num = (v: number, wrongs: number[], must: number[], prompt: Prob['prompt'], visual?: VisualSpec, gap?: string): Prob => ({
  prompt,
  visual,
  answer: aInt(v),
  wrong: dedupe(wrongs, v).map(aInt),
  must: dedupe(must, v).map(aInt),
  gap: gap ? same(gap) : undefined,
});

export const areasVolumes: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const topics = (Array.isArray(params.topics) ? (params.topics as string[]) : ['rect']).filter((t): t is Topic => (TOPICS as readonly string[]).includes(t));
  const topic = pick(rng, topics.length ? topics : (['rect'] as Topic[]));
  const big = d >= 3 ? 20 : 12;
  let prob: Prob;

  switch (topic) {
    case 'rect': {
      const Lg = randInt(rng, 3, big);
      const l = randInt(rng, 2, Lg - 1 || 2);
      const kind = pick(rng, ['area', 'perimeter', 'missing']);
      const vis: VisualSpec = { kind: 'shape', shape: 'rectangle', sides: [Lg, l], unit: 'cm' };
      if (kind === 'area') prob = num(Lg * l, [2 * (Lg + l), Lg + l, Lg * l * 2, Lg * Lg], [2 * (Lg + l)], L(`Care este aria dreptunghiului cu lungimea ${Lg} cm și lățimea ${l} cm (în cm²)?`, `What is the area of a rectangle of length ${Lg} cm and width ${l} cm (in cm²)?`), vis, `A = {{gap}} cm²`);
      else if (kind === 'perimeter') prob = num(2 * (Lg + l), [Lg * l, Lg + l, 2 * Lg + l, 4 * Lg], [Lg * l, Lg + l], L(`Care este perimetrul dreptunghiului cu lungimea ${Lg} cm și lățimea ${l} cm (în cm)?`, `What is the perimeter of a rectangle of length ${Lg} cm and width ${l} cm (in cm)?`), vis, `P = {{gap}} cm`);
      else prob = num(l, [Lg * l - Lg, Lg, Lg + l, l + 1], [Lg * l - Lg], L(`Un dreptunghi are aria ${Lg * l} cm² și lungimea ${Lg} cm. Care este lățimea (în cm)?`, `A rectangle has area ${Lg * l} cm² and length ${Lg} cm. What is the width (in cm)?`), undefined, `l = {{gap}} cm`);
      break;
    }
    case 'square': {
      const s = randInt(rng, 2, big);
      const kind = pick(rng, ['area', 'perimeter', 'fromPerimeter']);
      const vis: VisualSpec = { kind: 'shape', shape: 'square', sides: [s], unit: 'cm' };
      if (kind === 'area') prob = num(s * s, [4 * s, 2 * s, s * 2, s * s + s], [4 * s], L(`Care este aria pătratului cu latura de ${s} cm (în cm²)?`, `What is the area of a square with side ${s} cm (in cm²)?`), vis, `A = {{gap}} cm²`);
      else if (kind === 'perimeter') prob = num(4 * s, [s * s, 2 * s, s + 4, 8 * s], [s * s], L(`Care este perimetrul pătratului cu latura de ${s} cm (în cm)?`, `What is the perimeter of a square with side ${s} cm (in cm)?`), vis, `P = {{gap}} cm`);
      else prob = num(s * s, [4 * s, s, 2 * s, 16 * s], [4 * s], L(`Un pătrat are perimetrul de ${4 * s} cm. Care este aria lui (în cm²)?`, `A square has perimeter ${4 * s} cm. What is its area (in cm²)?`), undefined, `A = {{gap}} cm²`);
      break;
    }
    case 'tri': {
      let b = randInt(rng, 3, big);
      const h = randInt(rng, 2, big);
      if ((b * h) % 2 !== 0) b += 1;
      const kind = pick(rng, ['area', 'height']);
      if (kind === 'area') prob = num((b * h) / 2, [b * h, b + h, (b * h) / 2 + b, b * h * 2], [b * h], L(`Un triunghi are baza de ${b} cm și înălțimea de ${h} cm. Care este aria lui (în cm²)?`, `A triangle has a base of ${b} cm and a height of ${h} cm. What is its area (in cm²)?`), undefined, `A = {{gap}} cm²`);
      else prob = num(h, [(b * h) / 2, b * h, b - 2, h + 1], [(b * h) / 2], L(`Un triunghi are aria ${(b * h) / 2} cm² și baza de ${b} cm. Care este înălțimea corespunzătoare bazei (în cm)?`, `A triangle has area ${(b * h) / 2} cm² and a base of ${b} cm. What is the height to that base (in cm)?`));
      break;
    }
    case 'para': {
      const b = randInt(rng, 3, big);
      const h = randInt(rng, 2, big);
      prob = num(b * h, [(b * h) / 2 === Math.floor((b * h) / 2) ? (b * h) / 2 : b + h, 2 * (b + h), b + h, b * h + b], [(b * h) / 2 === Math.floor((b * h) / 2) ? (b * h) / 2 : b + h], L(`Un paralelogram are baza de ${b} cm și înălțimea corespunzătoare de ${h} cm. Care este aria lui (în cm²)?`, `A parallelogram has a base of ${b} cm and a corresponding height of ${h} cm. What is its area (in cm²)?`), undefined, `A = {{gap}} cm²`);
      break;
    }
    case 'trap': {
      let B = randInt(rng, 6, big + 4);
      const bb = randInt(rng, 2, B - 2);
      const h = randInt(rng, 2, big);
      if (((B + bb) * h) % 2 !== 0) B += 1;
      const A = ((B + bb) * h) / 2;
      prob = num(A, [(B + bb) * h, B * h, (B * bb * h) / 2 === Math.floor((B * bb * h) / 2) ? (B * bb * h) / 2 : B + bb + h, A + h, ((B - bb) * h) / 2 === Math.floor(((B - bb) * h) / 2) ? ((B - bb) * h) / 2 : A - 1], [(B + bb) * h], L(`Un trapez are bazele de ${B} cm și ${bb} cm și înălțimea de ${h} cm. Care este aria lui (în cm²)?`, `A trapezoid has bases of ${B} cm and ${bb} cm and a height of ${h} cm. What is its area (in cm²)?`), undefined, `A = {{gap}} cm²`);
      break;
    }
    case 'rhombus': {
      if (d >= 3 && chance(rng, 0.4)) {
        const [a, b, c] = pick(rng, TRIPLES);
        prob = num(c, [a + b, 2 * c, a * a + b * b, a + b + 1], [a + b, a * a + b * b], L(`Un romb are diagonalele de ${2 * a} cm și ${2 * b} cm. Care este latura rombului (în cm)?`, `A rhombus has diagonals of ${2 * a} cm and ${2 * b} cm. What is its side (in cm)?`), undefined, `latura = {{gap}} cm`);
        break;
      }
      const d1 = 2 * randInt(rng, 2, 10);
      const d2 = randInt(rng, 2, 14);
      const A = (d1 * d2) / 2;
      prob = num(A, [d1 * d2, d1 + d2, A + d1, 2 * (d1 + d2)], [d1 * d2], L(`Un romb are diagonalele de ${d1} cm și ${d2} cm. Care este aria lui (în cm²)?`, `A rhombus has diagonals of ${d1} cm and ${d2} cm. What is its area (in cm²)?`), undefined, `A = {{gap}} cm²`);
      break;
    }
    case 'circle': {
      const r = randInt(rng, 2, d <= 2 ? 9 : 15);
      const kind = pick(rng, ['area', 'length', 'rFromArea', 'rFromLength']);
      const vis: VisualSpec = { kind: 'shape', shape: 'circle' };
      if (kind === 'area') {
        prob = { prompt: L(`Un cerc are raza de ${r} cm. Care este aria lui (în cm²)?`, `A circle has radius ${r} cm. What is its area (in cm²)?`), visual: d <= 2 ? vis : undefined, answer: aPi(r * r), wrong: [aPi(2 * r), aPi(r), aPi(4 * r * r), aT(String(r * r)), aPi(r * r * 2)], must: [aPi(2 * r), aPi(4 * r * r)], gap: same(`A = {{gap}} cm²`) };
      } else if (kind === 'length') {
        prob = { prompt: L(`Un cerc are raza de ${r} cm. Care este lungimea cercului (în cm)?`, `A circle has radius ${r} cm. What is its circumference (in cm)?`), visual: d <= 2 ? vis : undefined, answer: aPi(2 * r), wrong: [aPi(r * r), aPi(r), aPi(4 * r), aT(String(2 * r)), aPi(2 * r + 2)], must: [aPi(r * r), aPi(r)], gap: same(`L = {{gap}} cm`) };
      } else if (kind === 'rFromArea') {
        prob = num(r, [r * r, 2 * r, r + 1, r * 2 + 1], [r * r], L(`Un cerc are aria de ${r * r}π cm². Care este raza lui (în cm)?`, `A circle has area ${r * r}π cm². What is its radius (in cm)?`), undefined, `r = {{gap}} cm`);
      } else {
        prob = num(r, [2 * r, r * r, r + 1, 4 * r], [2 * r], L(`Un cerc are lungimea de ${2 * r}π cm. Care este raza lui (în cm)?`, `A circle has circumference ${2 * r}π cm. What is its radius (in cm)?`), undefined, `r = {{gap}} cm`);
      }
      break;
    }
    case 'cube': {
      const a = randInt(rng, 2, d <= 2 ? 8 : 12);
      const kind = pick(rng, ['V', 'At', 'Al', 'edge']);
      if (kind === 'V') prob = num(a ** 3, [6 * a * a, a * a, 3 * a, 4 * a * a], [6 * a * a, a * a], L(`Care este volumul unui cub cu muchia de ${a} cm (în cm³)?`, `What is the volume of a cube with edge ${a} cm (in cm³)?`), undefined, `V = {{gap}} cm³`);
      else if (kind === 'At') prob = num(6 * a * a, [a ** 3, 4 * a * a, 12 * a, 6 * a], [a ** 3, 4 * a * a], L(`Care este aria totală a unui cub cu muchia de ${a} cm (în cm²)?`, `What is the total surface area of a cube with edge ${a} cm (in cm²)?`), undefined, `A_t = {{gap}} cm²`);
      else if (kind === 'Al') prob = num(4 * a * a, [6 * a * a, a * a, a ** 3, 4 * a], [6 * a * a], L(`Care este aria laterală a unui cub cu muchia de ${a} cm (în cm²)?`, `What is the lateral area of a cube with edge ${a} cm (in cm²)?`), undefined, `A_l = {{gap}} cm²`);
      else prob = num(a, [a * a, 3 * a, a ** 3 / 2 === Math.floor(a ** 3 / 2) ? a ** 3 / 2 : a + 2, a + 1], [3 * a], L(`Un cub are volumul de ${a ** 3} cm³. Care este muchia lui (în cm)?`, `A cube has volume ${a ** 3} cm³. What is its edge (in cm)?`), undefined, `a = {{gap}} cm`);
      break;
    }
    case 'box': {
      const kind = pick(rng, ['V', 'At', 'Al', 'diag']);
      if (kind === 'diag') {
        const [x, y, z, w] = pick(rng, BOX_DIAG);
        const k = randInt(rng, 1, 3);
        prob = num(w * k, [(x + y + z) * k, (x * x + y * y + z * z) * k * k, w * k + 1, (x + y) * k], [(x + y + z) * k, (x * x + y * y + z * z) * k * k], L(`Un paralelipiped dreptunghic are dimensiunile ${x * k} cm, ${y * k} cm și ${z * k} cm. Care este lungimea diagonalei lui (în cm)?`, `A cuboid measures ${x * k} cm, ${y * k} cm and ${z * k} cm. What is the length of its space diagonal (in cm)?`), undefined, `d = {{gap}} cm`);
        break;
      }
      const Lg = randInt(rng, 3, 10);
      const l = randInt(rng, 2, 8);
      const h = randInt(rng, 2, 9);
      const text = L(`un paralelipiped dreptunghic cu dimensiunile ${Lg} cm, ${l} cm și ${h} cm`, `a cuboid measuring ${Lg} cm, ${l} cm and ${h} cm`);
      if (kind === 'V') prob = num(Lg * l * h, [Lg * l + Lg * h + l * h, 2 * (Lg * l + Lg * h + l * h), Lg + l + h, Lg * l], [2 * (Lg * l + Lg * h + l * h)], L(`Care este volumul pentru ${text.ro} (în cm³)?`, `What is the volume of ${text.en} (in cm³)?`), undefined, `V = {{gap}} cm³`);
      else if (kind === 'At') prob = num(2 * (Lg * l + Lg * h + l * h), [Lg * l * h, Lg * l + Lg * h + l * h, 2 * (Lg + l + h), 2 * h * (Lg + l)], [Lg * l + Lg * h + l * h, 2 * h * (Lg + l)], L(`Care este aria totală pentru ${text.ro} (în cm²)?`, `What is the total surface area of ${text.en} (in cm²)?`), undefined, `A_t = {{gap}} cm²`);
      else prob = num(2 * h * (Lg + l), [2 * (Lg * l + Lg * h + l * h), Lg * l * h, h * (Lg + l), 2 * Lg * l], [2 * (Lg * l + Lg * h + l * h), h * (Lg + l)], L(`Un paralelipiped dreptunghic are baza de ${Lg} cm pe ${l} cm și înălțimea de ${h} cm. Care este aria laterală (în cm²)?`, `A cuboid has a ${Lg} cm by ${l} cm base and a height of ${h} cm. What is its lateral area (in cm²)?`), undefined, `A_l = {{gap}} cm²`);
      break;
    }
    case 'prism': {
      const [a, b, c] = pick(rng, TRIPLES.slice(0, 4));
      const H = randInt(rng, 2, 12);
      const Ab = (a * b) / 2;
      const kind = pick(rng, ['V', 'Al', 'At']);
      const desc = L(`O prismă dreaptă are drept bază un triunghi dreptunghic cu catetele de ${a} cm și ${b} cm (ipotenuza ${c} cm) și înălțimea de ${H} cm.`, `A right prism has a right-triangle base with legs ${a} cm and ${b} cm (hypotenuse ${c} cm) and height ${H} cm.`);
      if (kind === 'V') prob = num(Ab * H, [a * b * H, (a + b + c) * H, Ab + H, Ab * H * 2], [a * b * H, (a + b + c) * H], L(`${desc.ro} Care este volumul (în cm³)?`, `${desc.en} What is the volume (in cm³)?`), undefined, `V = {{gap}} cm³`);
      else if (kind === 'Al') prob = num((a + b + c) * H, [Ab * H, (a + b) * H, a * b * H, (a + b + c) * H + a * b], [Ab * H, (a + b) * H], L(`${desc.ro} Care este aria laterală (în cm²)?`, `${desc.en} What is the lateral area (in cm²)?`), undefined, `A_l = {{gap}} cm²`);
      else prob = num((a + b + c) * H + a * b, [(a + b + c) * H, Ab * H, (a + b + c) * H + Ab, (a + b + c) * H + 2 * a * b], [(a + b + c) * H, (a + b + c) * H + Ab], L(`${desc.ro} Care este aria totală (în cm²)?`, `${desc.en} What is the total area (in cm²)?`), undefined, `A_t = {{gap}} cm²`);
      break;
    }
    case 'pyramid': {
      const [m, h, ap] = pick(rng, [...TRIPLES.slice(0, 4), [7, 24, 25] as [number, number, number]]);
      const k = randInt(rng, 1, m >= 7 ? 2 : 4);
      const a = 2 * m * k;
      const H = h * k;
      const AP = ap * k;
      const kind = pick(rng, ['V', 'Al', 'ap']);
      const desc = L(`O piramidă patrulateră regulată are latura bazei de ${a} cm`, `A regular square pyramid has a base side of ${a} cm`);
      const volumeOk = (a * a * H) % 3 === 0;
      if (kind === 'V' && volumeOk) prob = num((a * a * H) / 3, [a * a * H, (a * a * H) / 3 + a, 4 * a * H, (a * H) / 3 === Math.floor((a * H) / 3) ? (a * H) / 3 : a + H], [a * a * H], L(`${desc.ro} și înălțimea de ${H} cm. Care este volumul (în cm³)?`, `${desc.en} and a height of ${H} cm. What is the volume (in cm³)?`), undefined, `V = {{gap}} cm³`);
      else if (kind === 'ap') prob = num(AP, [H + a / 2, H * H + (a / 2) * (a / 2), H, a], [H + a / 2, H * H + (a / 2) * (a / 2)], L(`${desc.ro} și înălțimea de ${H} cm. Care este apotema piramidei (în cm)?`, `${desc.en} and a height of ${H} cm. What is the slant height (apothem) of the pyramid (in cm)?`), undefined, `apotema = {{gap}} cm`);
      else prob = num(2 * a * AP, [a * AP, 4 * a * AP, a * AP / 2 === Math.floor(a * AP / 2) ? (a * AP) / 2 : a + AP, 2 * a * AP + a * a], [a * AP, 2 * a * AP + a * a], L(`${desc.ro} și apotema piramidei de ${AP} cm. Care este aria laterală (în cm²)?`, `${desc.en} and a slant height of ${AP} cm. What is the lateral area (in cm²)?`), undefined, `A_l = {{gap}} cm²`);
      break;
    }
    case 'cylinder': {
      const r = randInt(rng, 2, d <= 2 ? 6 : 10);
      const h = randInt(rng, 2, 12);
      const kind = pick(rng, ['V', 'Al', 'At']);
      const desc = L(`Un cilindru circular drept are raza bazei de ${r} cm și înălțimea de ${h} cm.`, `A right circular cylinder has a base radius of ${r} cm and a height of ${h} cm.`);
      if (kind === 'V') prob = { prompt: L(`${desc.ro} Care este volumul (în cm³)?`, `${desc.en} What is the volume (in cm³)?`), answer: aPi(r * r * h), wrong: [aPi(r * h), aPi(2 * r * h), aPi(2 * r * h * r), aPi(r * r * h * 2), aPi(r * h * h)], must: [aPi(2 * r * h), aPi(r * h)], gap: same(`V = {{gap}} cm³`) };
      else if (kind === 'Al') prob = { prompt: L(`${desc.ro} Care este aria laterală (în cm²)?`, `${desc.en} What is the lateral area (in cm²)?`), answer: aPi(2 * r * h), wrong: [aPi(r * r * h), aPi(r * h), aPi(2 * r * (r + h)), aPi(2 * r * r), aPi(4 * r * h)], must: [aPi(r * r * h), aPi(2 * r * (r + h))], gap: same(`A_l = {{gap}} cm²`) };
      else prob = { prompt: L(`${desc.ro} Care este aria totală (în cm²)?`, `${desc.en} What is the total area (in cm²)?`), answer: aPi(2 * r * (r + h)), wrong: [aPi(2 * r * h), aPi(r * r * h), aPi(2 * r * h + r * r), aPi(r * (r + h)), aPi(2 * r * r)], must: [aPi(2 * r * h), aPi(2 * r * h + r * r)], gap: same(`A_t = {{gap}} cm²`) };
      break;
    }
    case 'cone': {
      let r = 3;
      let h = 4;
      let g = 5;
      for (let t = 0; t < 40; t++) {
        const [a, b, c] = pick(rng, TRIPLES);
        const swap = chance(rng, 0.5);
        [r, h, g] = swap ? [b, a, c] : [a, b, c];
        if ((r * r * h) % 3 === 0) break;
      }
      const kind = pick(rng, ['V', 'Al', 'At', 'g']);
      const desc = L(`Un con circular drept are raza bazei de ${r} cm și înălțimea de ${h} cm.`, `A right circular cone has a base radius of ${r} cm and a height of ${h} cm.`);
      if (kind === 'g') prob = num(g, [r + h, r * r + h * h, h, Math.abs(h - r) || g + 1], [r + h, r * r + h * h], L(`${desc.ro} Care este generatoarea conului (în cm)?`, `${desc.en} What is the slant height of the cone (in cm)?`), undefined, `g = {{gap}} cm`);
      else if (kind === 'V') prob = { prompt: L(`${desc.ro} Care este volumul (în cm³)?`, `${desc.en} What is the volume (in cm³)?`), answer: aPi((r * r * h) / 3), wrong: [aPi(r * r * h), aPi(r * g), aPi((r * r * g) / 3 === Math.floor((r * r * g) / 3) ? (r * r * g) / 3 : r * h), aPi(r * h), aPi((r * r * h) / 3 + r)], must: [aPi(r * r * h), aPi((r * r * g) / 3 === Math.floor((r * r * g) / 3) ? (r * r * g) / 3 : r * h)], gap: same(`V = {{gap}} cm³`) };
      else if (kind === 'Al') prob = { prompt: L(`${desc.ro} Care este aria laterală (în cm²)?`, `${desc.en} What is the lateral area (in cm²)?`), answer: aPi(r * g), wrong: [aPi(r * h), aPi(r * (r + g)), aPi(2 * r * g), aPi(r * r), aPi(r * g + r)], must: [aPi(r * h), aPi(r * (r + g))], gap: same(`A_l = {{gap}} cm²`) };
      else prob = { prompt: L(`${desc.ro} Care este aria totală (în cm²)?`, `${desc.en} What is the total area (in cm²)?`), answer: aPi(r * (r + g)), wrong: [aPi(r * g), aPi(r * (r + h)), aPi(r * g + 2 * r * r), aPi(r * r + g), aPi(r * (r + g) + r)], must: [aPi(r * g), aPi(r * (r + h))], gap: same(`A_t = {{gap}} cm²`) };
      break;
    }
    case 'sphere': {
      const r = randInt(rng, 2, d <= 2 ? 6 : 12);
      const kind = pick(rng, ['A', 'V', 'rA']);
      if (kind === 'A') prob = { prompt: L(`O sferă are raza de ${r} cm. Care este aria sferei (în cm²)?`, `A sphere has radius ${r} cm. What is its surface area (in cm²)?`), answer: aPi(4 * r * r), wrong: [aPi(r * r), aPi(2 * r * r), aPi(4 * r), aPi(4 * r * r * r), aPi(8 * r * r)], must: [aPi(r * r), aPi(2 * r * r)], gap: same(`A = {{gap}} cm²`) };
      else if (kind === 'V') prob = { prompt: L(`O sferă are raza de ${r} cm. Care este volumul sferei (în cm³)?`, `A sphere has radius ${r} cm. What is its volume (in cm³)?`), answer: aPi(4 * r ** 3, 3), wrong: [aPi(4 * r ** 3), aPi(4 * r * r, 3), aPi(r ** 3, 3), aPi(4 * r * r), aPi(2 * r ** 3, 3)], must: [aPi(4 * r ** 3), aPi(4 * r * r)], gap: same(`V = {{gap}} cm³`) };
      else prob = num(r, [r * r, 2 * r, r + 1, 4 * r], [r * r, 2 * r], L(`O sferă are aria de ${4 * r * r}π cm². Care este raza ei (în cm)?`, `A sphere has surface area ${4 * r * r}π cm². What is its radius (in cm)?`), undefined, `r = {{gap}} cm`);
      break;
    }
  }

  return build(ctx, {
    prompt: prob.prompt,
    visual: prob.visual,
    answer: prob.answer,
    wrong: prob.wrong,
    must: prob.must,
    gap: prob.gap,
  });
};

registerGenerator('areas-volumes', areasVolumes);
