/**
 * `segments-units` generator (grade V): segments on a line and units of measurement. params:
 *   modes:  any of 'segment' | 'midpoint' | 'line' | 'convert'
 *   groups: for 'convert': any of 'length' | 'mass' | 'capacity' | 'area' | 'volume' (default: length, mass, capacity)
 *
 * Segment problems use collinear points with the middle one between the others, midpoints, and points on a number
 * line (`number-line` visual with the two points marked). Conversions are computed with integer powers of ten
 * (decimal results written with the Romanian comma); the classic mistakes (x10 instead of x100 for areas, x100 instead
 * of x1000 for volumes, multiplying instead of dividing) are offered as distractors.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, build, L, sInt } from './mathKit';
import { aDec } from './decimals';

const same = (s: string) => L(s, s);
const MODES = ['segment', 'midpoint', 'line', 'convert'] as const;
type Mode = (typeof MODES)[number];

interface UnitPair {
  big: string;
  small: string;
  /** big = factor * small */
  pow: number;
  group: string;
}
const UNITS: UnitPair[] = [
  { big: 'km', small: 'm', pow: 3, group: 'length' },
  { big: 'm', small: 'cm', pow: 2, group: 'length' },
  { big: 'cm', small: 'mm', pow: 1, group: 'length' },
  { big: 'm', small: 'dm', pow: 1, group: 'length' },
  { big: 't', small: 'kg', pow: 3, group: 'mass' },
  { big: 'kg', small: 'g', pow: 3, group: 'mass' },
  { big: 'l', small: 'ml', pow: 3, group: 'capacity' },
  { big: 'hl', small: 'l', pow: 2, group: 'capacity' },
  { big: 'm²', small: 'dm²', pow: 2, group: 'area' },
  { big: 'dm²', small: 'cm²', pow: 2, group: 'area' },
  { big: 'm²', small: 'cm²', pow: 4, group: 'area' },
  { big: 'ha', small: 'm²', pow: 4, group: 'area' },
  { big: 'm³', small: 'dm³', pow: 3, group: 'volume' },
  { big: 'dm³', small: 'cm³', pow: 3, group: 'volume' },
];

export const segmentsUnits: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['segment']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['segment'] as Mode[]));
  const groups = Array.isArray(params.groups) ? (params.groups as string[]) : ['length', 'mass', 'capacity'];

  switch (mode) {
    case 'segment': {
      const x = randInt(rng, 2, d <= 2 ? 20 : 60);
      const y = randInt(rng, 2, d <= 2 ? 20 : 60);
      const total = x + y;
      const kind = pick(rng, ['sum', 'rest']);
      if (kind === 'sum') {
        return build(ctx, {
          prompt: L(`Punctele A, B și C sunt coliniare, iar B se află între A și C. Dacă AB = ${x} cm și BC = ${y} cm, cât este AC (în cm)?`, `Points A, B and C are collinear and B lies between A and C. If AB = ${x} cm and BC = ${y} cm, what is AC (in cm)?`),
          answer: aInt(total),
          wrong: [aInt(Math.abs(x - y)), aInt(x * y), aInt(total + 1), aInt(Math.max(1, total - 1)), aInt(total + 10)].filter((w) => w.int !== total && (w.int ?? 0) > 0),
          must: [aInt(Math.abs(x - y))].filter((w) => w.int !== total),
          gap: same(`AC = {{gap}} cm`),
        });
      }
      return build(ctx, {
        prompt: L(`Punctele A, B și C sunt coliniare, iar B se află între A și C. Dacă AC = ${total} cm și AB = ${x} cm, cât este BC (în cm)?`, `Points A, B and C are collinear and B lies between A and C. If AC = ${total} cm and AB = ${x} cm, what is BC (in cm)?`),
        answer: aInt(y),
        wrong: [aInt(total + x), aInt(x), aInt(total), aInt(y + 1), aInt(Math.max(1, y - 1))].filter((w) => w.int !== y && (w.int ?? 0) > 0),
        must: [aInt(total + x)],
        gap: same(`BC = {{gap}} cm`),
      });
    }

    case 'midpoint': {
      const k = randInt(rng, 2, d <= 2 ? 15 : 40);
      const kind = pick(rng, ['half', 'whole', 'quarter']);
      if (kind === 'half') {
        return build(ctx, {
          prompt: L(`Punctul M este mijlocul segmentului AB. Dacă AB = ${2 * k} cm, cât este AM (în cm)?`, `Point M is the midpoint of segment AB. If AB = ${2 * k} cm, what is AM (in cm)?`),
          answer: aInt(k),
          wrong: [aInt(2 * k), aInt(k + 2), aInt(Math.max(1, k - 2)), aInt(4 * k)].filter((w) => w.int !== k && (w.int ?? 0) > 0),
          must: [aInt(2 * k)],
          gap: same(`AM = {{gap}} cm`),
        });
      }
      if (kind === 'whole') {
        return build(ctx, {
          prompt: L(`Punctul M este mijlocul segmentului AB. Dacă AM = ${k} cm, cât este AB (în cm)?`, `Point M is the midpoint of segment AB. If AM = ${k} cm, what is AB (in cm)?`),
          answer: aInt(2 * k),
          wrong: [aInt(k), aInt(k + 2), aInt(4 * k), aInt(Math.max(1, 2 * k - 2))].filter((w) => w.int !== 2 * k && (w.int ?? 0) > 0),
          must: [aInt(k)],
          gap: same(`AB = {{gap}} cm`),
        });
      }
      return build(ctx, {
        prompt: L(`M este mijlocul segmentului AB, iar N este mijlocul segmentului AM. Dacă AB = ${4 * k} cm, cât este AN (în cm)?`, `M is the midpoint of AB and N is the midpoint of AM. If AB = ${4 * k} cm, what is AN (in cm)?`),
        answer: aInt(k),
        wrong: [aInt(2 * k), aInt(4 * k), aInt(3 * k), aInt(k + 1)].filter((w) => w.int !== k && (w.int ?? 0) > 0),
        must: [aInt(2 * k)],
      });
    }

    case 'line': {
      const a = randInt(rng, 0, 8);
      const b = a + randInt(rng, 2, 9);
      const [p, q] = chance(rng, 0.5) ? [a, b] : [b, a];
      const len = b - a;
      return build(ctx, {
        prompt: L(`Pe axa numerelor sunt marcate punctele A(${p}) și B(${q}). Care este lungimea segmentului AB (în unități)?`, `Points A(${p}) and B(${q}) are marked on the number line. What is the length of segment AB (in units)?`),
        visual: { kind: 'number-line', from: 0, to: Math.max(10, b + 1), step: 1, marks: [a, b] },
        answer: aInt(len),
        wrong: [aInt(a + b), aInt(len + 1), aInt(Math.max(1, len - 1)), aInt(b), aInt(a || len + 2)].filter((w) => w.int !== len && (w.int ?? 0) > 0),
        must: [aInt(a + b)].filter((w) => w.int !== len),
        gap: same(`AB = {{gap}}`),
      });
    }

    case 'convert': {
      const pool = UNITS.filter((u) => groups.includes(u.group));
      const u = pick(rng, pool.length ? pool : UNITS);
      const f = 10 ** u.pow;
      // the classic slip: 10 per length step used for areas / volumes, or a shift by one place
      const slipPow = u.group === 'area' ? u.pow / 2 : u.group === 'volume' ? u.pow / 3 : u.pow - 1;
      const slip = 10 ** slipPow;
      if (chance(rng, 0.55)) {
        // big -> small: multiply
        const v = randInt(rng, 1, d <= 1 ? 9 : u.pow >= 3 || u.group === 'area' || u.group === 'volume' ? 40 : 99);
        const res = v * f;
        return build(ctx, {
          prompt: L(`Transformă: ${v} ${u.big} = ? ${u.small}`, `Convert: ${v} ${u.big} = ? ${u.small}`),
          answer: aInt(res),
          wrong: [aInt(v * slip), aInt(v * f * 10), aInt(v * (f / 10)), aInt(v + f), aInt(v * f * 100)].filter((w) => w.int !== res && (w.int ?? 0) > 0),
          must: [aInt(v * slip)].filter((w) => w.int !== res),
          gap: same(`${v} ${u.big} = {{gap}} ${u.small}`),
        });
      }
      // small -> big: divide (whole or decimal result, written with the Romanian comma)
      const amount = randInt(rng, 1, d <= 1 ? 9 : 99) * 10 ** Math.max(0, u.pow - (chance(rng, 0.5) ? 1 : 0));
      const right = aDec(amount, u.pow);
      const wrongs = [aDec(amount, slipPow), aDec(amount, u.pow + 1), aDec(amount, Math.max(0, u.pow - 1)), aDec(amount * 10, u.pow), aDec(amount, u.pow + 2)].filter((w) => w.ro !== right.ro);
      return build(ctx, {
        prompt: L(`Transformă: ${sInt(amount)} ${u.small} = ? ${u.big}`, `Convert: ${sInt(amount)} ${u.small} = ? ${u.big}`),
        answer: right,
        wrong: wrongs,
        must: wrongs.slice(0, 1),
        gap: same(`${sInt(amount)} ${u.small} = {{gap}} ${u.big}`),
        noPad: true,
      });
    }
  }
};

registerGenerator('segments-units', segmentsUnits);
