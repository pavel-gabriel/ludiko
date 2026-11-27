/**
 * `angles` generator (grades V-VII): angle measures and triangles. params:
 *   modes: any of 'types' | 'complement' | 'supplement' | 'opposite' | 'bisector' | 'compose' | 'triangleSum' |
 *          'isosceles' | 'exterior' | 'triangleKind' | 'sidesKind' | 'triangleIneq' | 'parallel' | 'polygon'
 *
 * Measures are whole numbers of degrees, built backwards from the answer. Distractors: the supplement for the
 * complement and the other way round, the same angle instead of the opposite, forgetting to halve for the bisector,
 * the triangle angle sum taken as 360°, equal instead of supplementary angles for parallels.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt } from './util';
import { aInt, aT, build, L, tfItem } from './mathKit';

const same = (s: string) => L(s, s);
const MODES = ['types', 'complement', 'supplement', 'opposite', 'bisector', 'compose', 'triangleSum', 'isosceles', 'exterior', 'triangleKind', 'sidesKind', 'triangleIneq', 'parallel', 'polygon'] as const;
type Mode = (typeof MODES)[number];

const kindOfAngle = (m: number): 'ascuțit' | 'drept' | 'obtuz' | 'alungit' => (m < 90 ? 'ascuțit' : m === 90 ? 'drept' : m < 180 ? 'obtuz' : 'alungit');
const KIND_EN: Record<string, string> = { ascuțit: 'acute', drept: 'right', obtuz: 'obtuse', alungit: 'straight' };

export const angles: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['types']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['types'] as Mode[]));
  const step = d <= 1 ? 5 : 1;

  switch (mode) {
    case 'types': {
      const m = pick(rng, [pick(rng, [90, 180]), randInt(rng, 5, 89), randInt(rng, 91, 179), randInt(rng, 10, 85), randInt(rng, 95, 175)]);
      const kind = kindOfAngle(m);
      return build(ctx, {
        prompt: L(`Un unghi are măsura de ${m}°. Ce fel de unghi este?`, `An angle measures ${m}°. What kind of angle is it?`),
        answer: aT(kind, KIND_EN[kind]),
        wrong: ['ascuțit', 'drept', 'obtuz', 'alungit'].filter((k) => k !== kind).map((k) => aT(k, KIND_EN[k])),
        only: ['choice', 'tf'],
        tf: (x) => L(`unghiul de ${m}° este ${x.ro}`, `the ${m}° angle is ${x.en ?? x.ro}`),
      });
    }

    case 'complement':
    case 'supplement': {
      const total = mode === 'complement' ? 90 : 180;
      const a = randInt(rng, 1, Math.floor((total - 1) / step)) * step;
      const word = mode === 'complement' ? ['complementul', 'complement'] : ['suplementul', 'supplement'];
      const ans = total - a;
      const other = mode === 'complement' ? 180 - a : 90 - a;
      return build(ctx, {
        prompt: L(`Care este măsura ${word[0] === 'complementul' ? 'complementului' : 'suplementului'} unui unghi de ${a}° (în grade)?`, `What is the ${word[1]} of a ${a}° angle (in degrees)?`),
        answer: aInt(ans),
        wrong: [aInt(other), aInt(a), aInt(total + a), aInt(ans + 10), aInt(Math.max(1, ans - 10))].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(other)].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        gap: same(`${a}° + {{gap}}° = ${total}°`),
        gapPrompt: L('Completează cu măsura potrivită.', 'Fill in the right measure.'),
        tf: (x) => L(`${word[0]} unui unghi de ${a}° are ${x.ro}°`, `the ${word[1]} of a ${a}° angle is ${x.ro}°`),
      });
    }

    case 'opposite': {
      const a = randInt(rng, 20, 160);
      const adjacent = chance(rng, 0.4);
      const ans = adjacent ? 180 - a : a;
      return build(ctx, {
        prompt: adjacent
          ? L(`Unghiurile AOB și BOC sunt adiacente suplementare. Dacă m(∠AOB) = ${a}°, cât este m(∠BOC)?`, `Angles AOB and BOC are adjacent supplementary angles. If m(∠AOB) = ${a}°, what is m(∠BOC)?`)
          : L(`Unghiurile AOB și COD sunt opuse la vârf. Dacă m(∠AOB) = ${a}°, cât este m(∠COD)?`, `Angles AOB and COD are vertically opposite. If m(∠AOB) = ${a}°, what is m(∠COD)?`),
        answer: aInt(ans),
        wrong: [aInt(adjacent ? a : 180 - a), aInt(Math.abs(90 - a)), aInt(360 - a), aInt(ans + 10), aInt(Math.max(1, ans - 10))].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(adjacent ? a : 180 - a)].filter((w) => w.int !== ans),
      });
    }

    case 'bisector': {
      const h = randInt(rng, 10, 85);
      return build(ctx, {
        prompt: L(`Semidreapta OM este bisectoarea unghiului AOB. Dacă m(∠AOB) = ${2 * h}°, cât este m(∠AOM)?`, `Ray OM bisects angle AOB. If m(∠AOB) = ${2 * h}°, what is m(∠AOM)?`),
        answer: aInt(h),
        wrong: [aInt(2 * h), aInt(180 - 2 * h), aInt(90 - h), aInt(h + 10), aInt(Math.max(1, h - 10))].filter((w) => w.int !== h && (w.int ?? 0) > 0),
        must: [aInt(2 * h)],
        gap: same(`m(∠AOM) = {{gap}}°`),
      });
    }

    case 'compose': {
      const a = randInt(rng, 10, 80);
      const b = randInt(rng, 10, 90);
      return build(ctx, {
        prompt: L(`Punctul B este în interiorul unghiului AOC. Dacă m(∠AOB) = ${a}° și m(∠BOC) = ${b}°, cât este m(∠AOC)?`, `Point B lies inside angle AOC. If m(∠AOB) = ${a}° and m(∠BOC) = ${b}°, what is m(∠AOC)?`),
        answer: aInt(a + b),
        wrong: [aInt(Math.abs(a - b)), aInt(a + b + 10), aInt(180 - a - b > 0 ? 180 - a - b : a), aInt(Math.max(1, a + b - 10)), aInt(a * 2)].filter((w) => w.int !== a + b && (w.int ?? 0) > 0),
        must: [aInt(Math.abs(a - b))].filter((w) => w.int !== a + b),
      });
    }

    case 'triangleSum': {
      const a = randInt(rng, 20, 80);
      const b = randInt(rng, 20, 160 - a - 10);
      const c = 180 - a - b;
      return build(ctx, {
        prompt: L(`Într-un triunghi două unghiuri au ${a}° și ${b}°. Cât măsoară al treilea unghi?`, `Two angles of a triangle measure ${a}° and ${b}°. How big is the third angle?`),
        answer: aInt(c),
        wrong: [aInt(360 - a - b), aInt(a + b), aInt(90 - a), aInt(c + 10), aInt(Math.max(1, c - 10))].filter((w) => w.int !== c && (w.int ?? 0) > 0),
        must: [aInt(a + b), aInt(360 - a - b)].filter((w) => w.int !== c),
        gap: same(`${a}° + ${b}° + {{gap}}° = 180°`),
      });
    }

    case 'isosceles': {
      const base = randInt(rng, 25, 80);
      const apex = 180 - 2 * base;
      if (chance(rng, 0.5)) {
        return build(ctx, {
          prompt: L(`Un triunghi isoscel are unghiul de la vârf de ${apex}°. Cât măsoară fiecare unghi de la bază?`, `An isosceles triangle has an apex angle of ${apex}°. How big is each base angle?`),
          answer: aInt(base),
          wrong: [aInt(180 - apex), aInt(apex), aInt(90 - apex), aInt(base + 10), aInt(Math.max(1, base - 10))].filter((w) => w.int !== base && (w.int ?? 0) > 0),
          must: [aInt(180 - apex)].filter((w) => w.int !== base),
        });
      }
      return build(ctx, {
        prompt: L(`Un triunghi isoscel are unghiurile de la bază de ${base}° fiecare. Cât măsoară unghiul de la vârf?`, `An isosceles triangle has base angles of ${base}° each. How big is the apex angle?`),
        answer: aInt(apex),
        wrong: [aInt(180 - base), aInt(base), aInt(360 - 2 * base), aInt(apex + 10), aInt(Math.max(1, apex - 10))].filter((w) => w.int !== apex && (w.int ?? 0) > 0),
        must: [aInt(180 - base)].filter((w) => w.int !== apex),
      });
    }

    case 'exterior': {
      const a = randInt(rng, 25, 80);
      const b = randInt(rng, 25, 80);
      return build(ctx, {
        prompt: L(`Într-un triunghi ABC, m(∠A) = ${a}° și m(∠B) = ${b}°. Cât măsoară unghiul exterior din vârful C?`, `In triangle ABC, m(∠A) = ${a}° and m(∠B) = ${b}°. How big is the exterior angle at C?`),
        answer: aInt(a + b),
        wrong: [aInt(180 - a - b), aInt(360 - a - b), aInt(Math.abs(a - b)), aInt(a + b + 10)].filter((w) => w.int !== a + b && (w.int ?? 0) > 0),
        must: [aInt(180 - a - b)].filter((w) => w.int !== a + b),
      });
    }

    case 'triangleKind': {
      const ang = pick(rng, ['ascuțitunghic', 'dreptunghic', 'obtuzunghic']);
      let a: number;
      let b: number;
      if (ang === 'dreptunghic') {
        a = 90;
        b = randInt(rng, 20, 70);
      } else if (ang === 'obtuzunghic') {
        a = randInt(rng, 95, 130);
        b = randInt(rng, 15, 180 - a - 10);
      } else {
        a = randInt(rng, 40, 80);
        b = randInt(rng, 91 - a, 80);
      }
      const c = 180 - a - b;
      const en: Record<string, string> = { ascuțitunghic: 'acute', dreptunghic: 'right', obtuzunghic: 'obtuse' };
      const list = [a, b, c].sort((x, y) => y - x).join('°, ') + '°';
      return build(ctx, {
        prompt: L(`Un triunghi are unghiurile de ${list}. Ce fel de triunghi este (după unghiuri)?`, `A triangle has angles ${list}. What kind of triangle is it (by angles)?`),
        answer: aT(ang, en[ang]),
        wrong: Object.keys(en).filter((k) => k !== ang).map((k) => aT(k, en[k])),
        only: ['choice'],
      });
    }

    case 'sidesKind': {
      const kinds: [string, string, number[]][] = [
        ['echilateral', 'equilateral', (() => { const s = randInt(rng, 3, 9); return [s, s, s]; })()],
        ['isoscel', 'isosceles', (() => { const s = randInt(rng, 4, 9); const t = randInt(rng, 2, s + s - 1); return t === s ? [s, s, s - 1] : [s, s, t]; })()],
        ['scalen', 'scalene', pick(rng, [[3, 4, 5], [4, 5, 6], [5, 6, 7], [6, 7, 9], [5, 7, 9], [4, 6, 7]])],
      ];
      const [ro, en, sides] = pick(rng, kinds);
      return build(ctx, {
        prompt: L('Ce fel de triunghi este cel din desen (după laturi)?', 'What kind of triangle is shown (by its sides)?'),
        visual: { kind: 'shape', shape: 'triangle', sides, unit: 'cm' },
        answer: aT(ro, en),
        wrong: kinds.filter((k) => k[0] !== ro).map((k) => aT(k[0], k[1])),
        only: ['choice'],
      });
    }

    case 'triangleIneq': {
      const ok = chance(rng, 0.5);
      let sides: number[] = [];
      for (let t = 0; t < 100; t++) {
        const a = randInt(rng, 2, 14);
        const b = randInt(rng, 2, 14);
        const c = randInt(rng, 2, 20);
        const srt = [a, b, c].sort((x, y) => x - y);
        const valid = srt[0] + srt[1] > srt[2];
        if (valid === ok && (ok || srt[0] + srt[1] >= srt[2] - 4)) {
          sides = [a, b, c];
          break;
        }
      }
      if (sides.length === 0) sides = ok ? [4, 5, 6] : [3, 4, 9];
      const srt = [...sides].sort((x, y) => x - y);
      return tfItem(ctx, L(`se poate construi un triunghi cu laturile de ${sides.join(', ')} cm.`, `a triangle can be built with sides ${sides.join(', ')} cm.`), srt[0] + srt[1] > srt[2]);
    }

    case 'parallel': {
      const a = randInt(rng, 40, 140);
      const kind = pick(rng, ['alt', 'corr', 'co']);
      const ans = kind === 'co' ? 180 - a : a;
      const name = kind === 'alt' ? ['alterne interne', 'alternate interior'] : kind === 'corr' ? ['corespondente', 'corresponding'] : ['interne de aceeași parte a secantei', 'co-interior (same-side interior)'];
      return build(ctx, {
        prompt: L(`Dreptele paralele a și b sunt tăiate de o secantă. Un unghi măsoară ${a}°. Cât măsoară unghiul care formează cu el o pereche de unghiuri ${name[0]}?`, `Parallel lines a and b are cut by a transversal. One angle measures ${a}°. How big is the angle that forms a pair of ${name[1]} angles with it?`),
        answer: aInt(ans),
        wrong: [aInt(kind === 'co' ? a : 180 - a), aInt(Math.abs(90 - a)), aInt(ans + 10), aInt(Math.max(1, ans - 10))].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(kind === 'co' ? a : 180 - a)].filter((w) => w.int !== ans),
      });
    }

    case 'polygon': {
      if (chance(rng, 0.5)) {
        const n = randInt(rng, 3, 10);
        return build(ctx, {
          prompt: L(`Care este suma măsurilor unghiurilor unui poligon convex cu ${n} laturi (în grade)?`, `What is the sum of the interior angles of a convex polygon with ${n} sides (in degrees)?`),
          answer: aInt((n - 2) * 180),
          wrong: [aInt(n * 180), aInt((n - 1) * 180), aInt((n - 3) * 180 > 0 ? (n - 3) * 180 : 360), aInt(360), aInt(n * 90)].filter((w) => w.int !== (n - 2) * 180 && (w.int ?? 0) > 0),
          must: [aInt(n * 180)].filter((w) => w.int !== (n - 2) * 180),
          noPad: true,
        });
      }
      const n = pick(rng, [3, 4, 5, 6, 8, 9, 10, 12]);
      const each = ((n - 2) * 180) / n;
      return build(ctx, {
        prompt: L(`Cât măsoară fiecare unghi al unui poligon regulat cu ${n} laturi (în grade)?`, `How big is each angle of a regular polygon with ${n} sides (in degrees)?`),
        answer: aInt(each),
        wrong: [aInt(360 / n), aInt(180 - each > 0 ? 180 - each : each + 10), aInt((n - 2) * 180), aInt(each + 10), aInt(Math.max(1, each - 10))].filter((w) => w.int !== each && (w.int ?? 0) > 0 && Number.isInteger(w.int)),
        must: [aInt(Math.round(360 / n))].filter((w) => w.int !== each),
      });
    }
  }
};

registerGenerator('angles', angles);
