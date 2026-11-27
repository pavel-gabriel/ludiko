/**
 * `pythagoras` generator (grade VII). params:
 *   modes: any of 'hyp' | 'leg' | 'converse' | 'converseSelect' | 'diagonalRect' | 'diagonalSquare' | 'perimeter' |
 *                 'height' | 'ladder' | 'eqHeight'
 *
 * Whole-number Pythagorean triples (primitive ones times a factor) keep every answer exact. Triangles are drawn with
 * the `shape` visual: sides [leg, leg, hypotenuse] (drawn with the right angle at the base-right corner) and
 * `hideSide` marks the unknown side with "?". Distractors: a + b for the hypotenuse, a² + b² (forgot the root),
 * c − a for the other leg, c² − a², near-miss triples for the converse.
 */
import type { Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { chance, pick, randInt, shuffle } from './util';
import { aInt, aT, build, L, tfItem } from './mathKit';

const same = (s: string) => L(s, s);
const MODES = ['hyp', 'leg', 'converse', 'converseSelect', 'diagonalRect', 'diagonalSquare', 'perimeter', 'height', 'ladder', 'eqHeight'] as const;
type Mode = (typeof MODES)[number];

export const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]];

/** a random right triangle with whole sides, legs in random order */
function triple(rng: () => number, d: number): [number, number, number] {
  const [a, b, c] = pick(rng, d <= 1 ? TRIPLES.slice(0, 2) : TRIPLES);
  const maxK = Math.max(1, Math.floor((d <= 2 ? 30 : 100) / c));
  const k = randInt(rng, 1, Math.min(maxK, d <= 1 ? 3 : 6));
  return chance(rng, 0.5) ? [a * k, b * k, c * k] : [b * k, a * k, c * k];
}

export const pythagoras: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const modes = (Array.isArray(params.modes) ? (params.modes as string[]) : ['hyp']).filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  const mode = pick(rng, modes.length ? modes : (['hyp'] as Mode[]));
  const [a, b, c] = triple(rng, d);

  switch (mode) {
    case 'hyp': {
      return build(ctx, {
        prompt: L(`Într-un triunghi dreptunghic catetele au ${a} cm și ${b} cm. Care este lungimea ipotenuzei (în cm)?`, `In a right triangle the legs are ${a} cm and ${b} cm. What is the length of the hypotenuse (in cm)?`),
        visual: { kind: 'shape', shape: 'triangle', sides: [a, b, c], unit: 'cm', hideSide: 2 },
        answer: aInt(c),
        wrong: [aInt(a + b), aInt(a * a + b * b), aInt(Math.abs(a - b)), aInt(c + 1), aInt(c - 1), aInt(c * 2)].filter((w) => w.int !== c && (w.int ?? 0) > 0),
        must: [aInt(a + b), aInt(a * a + b * b)].filter((w) => w.int !== c),
        gap: same(`ipotenuza = {{gap}} cm`),
        tf: (x) => L(`un triunghi dreptunghic cu catetele ${a} cm și ${b} cm are ipotenuza ${x.ro} cm`, `a right triangle with legs ${a} cm and ${b} cm has hypotenuse ${x.ro} cm`),
      });
    }

    case 'leg': {
      const hide = chance(rng, 0.5) ? 0 : 1;
      const known = hide === 0 ? b : a;
      const ans = hide === 0 ? a : b;
      return build(ctx, {
        prompt: L(`Într-un triunghi dreptunghic ipotenuza are ${c} cm, iar un catet are ${known} cm. Care este lungimea celuilalt catet (în cm)?`, `In a right triangle the hypotenuse is ${c} cm and one leg is ${known} cm. What is the length of the other leg (in cm)?`),
        visual: { kind: 'shape', shape: 'triangle', sides: [a, b, c], unit: 'cm', hideSide: hide },
        answer: aInt(ans),
        wrong: [aInt(c - known), aInt(c * c - known * known), aInt(c + known), aInt(ans + 1), aInt(Math.max(1, ans - 1))].filter((w) => w.int !== ans && (w.int ?? 0) > 0),
        must: [aInt(c - known), aInt(c * c - known * known)].filter((w) => w.int !== ans),
        gap: same(`celălalt catet = {{gap}} cm`),
      });
    }

    case 'converse': {
      const truth = chance(rng, 0.5);
      let sides = [a, b, c];
      if (!truth) {
        for (let t = 0; t < 30; t++) {
          const cand = [a, b, c];
          cand[pick(rng, [0, 1, 2])] += pick(rng, [1, -1]);
          const srt = [...cand].sort((x, y) => x - y);
          if (srt.every((v) => v > 0) && srt[0] + srt[1] > srt[2] && srt[0] ** 2 + srt[1] ** 2 !== srt[2] ** 2) {
            sides = cand;
            break;
          }
        }
      }
      const srt = [...sides].sort((x, y) => x - y);
      const holds = srt[0] ** 2 + srt[1] ** 2 === srt[2] ** 2;
      const list = shuffle(rng, sides).join(', ');
      return tfItem(ctx, L(`un triunghi cu laturile de ${list} cm este dreptunghic.`, `a triangle with sides ${list} cm is a right triangle.`), holds);
    }

    case 'converseSelect': {
      const right = [a, b, c].sort((x, y) => x - y).join(', ');
      const wrongs = new Set<string>();
      for (let t = 0; t < 60 && wrongs.size < 3; t++) {
        const [p, q, r] = triple(rng, d);
        const cand = [p, q, r];
        cand[randInt(rng, 0, 2)] += pick(rng, [1, 2, -1]);
        const srt = [...cand].sort((x, y) => x - y);
        if (srt.every((v) => v > 0) && srt[0] + srt[1] > srt[2] && srt[0] ** 2 + srt[1] ** 2 !== srt[2] ** 2 && srt.join(', ') !== right) wrongs.add(srt.join(', '));
      }
      return build(ctx, {
        prompt: L('Care dintre seturile de lungimi (în cm) sunt laturile unui triunghi dreptunghic?', 'Which set of lengths (in cm) gives the sides of a right triangle?'),
        answer: aT(right),
        wrong: [...wrongs].map((w) => aT(w)),
        only: ['choice'],
      });
    }

    case 'diagonalRect': {
      return build(ctx, {
        prompt: L(`Un dreptunghi are dimensiunile ${a} cm și ${b} cm. Care este lungimea diagonalei (în cm)?`, `A rectangle measures ${a} cm by ${b} cm. What is the length of its diagonal (in cm)?`),
        visual: { kind: 'shape', shape: 'rectangle', sides: [a, b], unit: 'cm' },
        answer: aInt(c),
        wrong: [aInt(a + b), aInt(a * a + b * b), aInt(2 * (a + b)), aInt(a * b), aInt(c + 1)].filter((w) => w.int !== c && (w.int ?? 0) > 0),
        must: [aInt(a + b), aInt(a * a + b * b)].filter((w) => w.int !== c),
        gap: same(`diagonala = {{gap}} cm`),
      });
    }

    case 'diagonalSquare': {
      const s = randInt(rng, 2, 12);
      if (d >= 3 && chance(rng, 0.4)) {
        return build(ctx, {
          prompt: L(`Un pătrat are diagonala de ${s}√2 cm. Care este latura pătratului (în cm)?`, `A square has a diagonal of ${s}√2 cm. What is the side of the square (in cm)?`),
          answer: aInt(s),
          wrong: [aInt(s * 2), aInt(s * s), aInt(s + 1), aInt(Math.max(1, s - 1))].filter((w) => w.int !== s),
          must: [aInt(s * 2)],
          gap: same(`latura = {{gap}} cm`),
        });
      }
      return build(ctx, {
        prompt: L(`Un pătrat are latura de ${s} cm. Care este lungimea diagonalei?`, `A square has a side of ${s} cm. What is the length of its diagonal?`),
        visual: { kind: 'shape', shape: 'square', sides: [s], unit: 'cm' },
        answer: aT(`${s}√2 cm`),
        wrong: [aT(`${2 * s} cm`), aT(`${s * s} cm`), aT(`${s}√3 cm`), aT(`${s}√2/2 cm`), aT(`${s + 2} cm`)].filter((w) => w.ro !== `${s}√2 cm`),
        must: [aT(`${2 * s} cm`)],
        only: ['choice'],
      });
    }

    case 'perimeter': {
      return build(ctx, {
        prompt: L(`Un triunghi dreptunghic are catetele de ${a} cm și ${b} cm. Care este perimetrul lui (în cm)?`, `A right triangle has legs of ${a} cm and ${b} cm. What is its perimeter (in cm)?`),
        visual: { kind: 'shape', shape: 'triangle', sides: [a, b, c], unit: 'cm', hideSide: 2 },
        answer: aInt(a + b + c),
        wrong: [aInt(a + b), aInt(a + b + a * a + b * b), aInt(a * b), aInt(2 * (a + b)), aInt(a + b + c + 1)].filter((w) => w.int !== a + b + c && (w.int ?? 0) > 0),
        must: [aInt(a + b)],
        gap: same(`P = {{gap}} cm`),
      });
    }

    case 'height': {
      return build(ctx, {
        prompt: L(
          `Un triunghi isoscel are baza de ${2 * a} cm și laturile congruente de ${c} cm. Care este înălțimea corespunzătoare bazei (în cm)?`,
          `An isosceles triangle has a base of ${2 * a} cm and equal sides of ${c} cm. What is the height to the base (in cm)?`,
        ),
        answer: aInt(b),
        wrong: [aInt(c - a), aInt(c * c - a * a), aInt(c - 2 * a > 0 ? c - 2 * a : c + a), aInt(a), aInt(b + 1)].filter((w) => w.int !== b && (w.int ?? 0) > 0),
        must: [aInt(c - a), aInt(c * c - a * a)].filter((w) => w.int !== b),
        gap: same(`înălțimea = {{gap}} cm`),
      });
    }

    case 'ladder': {
      return build(ctx, {
        prompt: L(`O scară de ${c} m este sprijinită de un zid vertical, cu baza la ${a} m de zid. La ce înălțime (în m) atinge scara zidul?`, `A ${c} m ladder leans against a vertical wall with its foot ${a} m from the wall. At what height (in m) does it touch the wall?`),
        answer: aInt(b),
        wrong: [aInt(c - a), aInt(c * c - a * a), aInt(c + a), aInt(b + 1), aInt(Math.max(1, b - 1))].filter((w) => w.int !== b && (w.int ?? 0) > 0),
        must: [aInt(c - a)].filter((w) => w.int !== b),
      });
    }

    case 'eqHeight': {
      const k = randInt(rng, 1, 9);
      const rt = (m: number, n: number): string => (m === 1 ? `√${n} cm` : `${m}√${n} cm`);
      return build(ctx, {
        prompt: L(`Un triunghi echilateral are latura de ${2 * k} cm. Care este înălțimea lui?`, `An equilateral triangle has a side of ${2 * k} cm. What is its height?`),
        answer: aT(rt(k, 3)),
        wrong: [aT(rt(k, 2)), aT(rt(2 * k, 3)), aT(`${k} cm`), aT(`${rt(k, 3).replace(' cm', '')}/2 cm`), aT(rt(k + 1, 3))].filter((w) => w.ro !== rt(k, 3)),
        must: [aT(rt(2 * k, 3))],
        only: ['choice'],
      });
    }
  }
};

registerGenerator('pythagoras', pythagoras);
