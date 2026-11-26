/**
 * Geography generator (grade IV): compass directions.
 *   `geo-directions`  params: { eight?: boolean }  (eight = also the intermediate directions)
 * Modes: direction of a city relative to another (computed from real coordinates, with a safety margin
 * so the answer is never ambiguous), "facing north, what is on your right", opposite direction,
 * and the direction between two cardinal points. The answers are computed by code.
 */
import citiesFile from '../../../../content/data/geo/cities.json';
import type { ChoiceItem, Item, LocalizedText } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, pick, shuffle } from './util';

interface City { id: string; ro: string; en: string; lon: number; lat: number }
const CITIES = citiesFile.cities as City[];

/** Directions clockwise from north; index * 45 = bearing in degrees */
export const DIRECTIONS: { ro: string; en: string }[] = [
  { ro: 'nord', en: 'north' },
  { ro: 'nord-est', en: 'north-east' },
  { ro: 'est', en: 'east' },
  { ro: 'sud-est', en: 'south-east' },
  { ro: 'sud', en: 'south' },
  { ro: 'sud-vest', en: 'south-west' },
  { ro: 'vest', en: 'west' },
  { ro: 'nord-vest', en: 'north-west' },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const COS = Math.cos((45.8 * Math.PI) / 180);
const MAP_VISUAL = {
  kind: 'image' as const,
  media: {
    kind: 'image' as const,
    src: 'content/media/geo/romania.svg',
    alt: { ro: 'Harta României cu orașele principale', en: 'Map of Romania with the main cities' },
    provenanceId: 'data-natural-earth',
  },
};

/** Direction index (0-7) of `to` seen from `from`, or null when too close to a sector border. */
export function directionBetween(from: City, to: City, eight: boolean): number | null {
  const dx = (to.lon - from.lon) * COS;
  const dy = to.lat - from.lat;
  const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  const step = eight ? 45 : 90;
  const sector = Math.round(bearing / step);
  const off = Math.abs(bearing - sector * step);
  const margin = eight ? 14 : 28; // sector half-width is 22.5 / 45 degrees
  if (off > margin || Math.hypot(dx, dy) < 0.8) return null;
  return ((sector * step) / 45) % 8;
}

function choice(
  ctx: Parameters<GeneratorFn>[1],
  prompt: LocalizedText,
  correct: number,
  pool: number[],
  count: number,
  visual?: typeof MAP_VISUAL,
): ChoiceItem {
  const wrong = shuffle(ctx.rng, pool.filter((d) => d !== correct)).slice(0, count - 1);
  const ids = shuffle(ctx.rng, [correct, ...wrong]);
  return {
    ...baseFields(ctx, prompt, visual),
    type: 'choice',
    options: ids.map((d) => ({ id: `d${d}`, text: { ro: cap(DIRECTIONS[d].ro), en: cap(DIRECTIONS[d].en) } })),
    correctId: `d${correct}`,
  };
}

const CARDINALS = [0, 2, 4, 6];
const ALL = [0, 1, 2, 3, 4, 5, 6, 7];

export const geoDirections: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const eight = params.eight === true || d >= 4;
  const pool = eight ? ALL : CARDINALS;
  const count = d <= 1 ? 3 : 4;
  const mode = pick(rng, d <= 1 ? ['facing', 'opposite', 'sun'] : d <= 2 ? ['facing', 'opposite', 'city', 'city'] : ['city', 'city', 'facing', 'opposite', 'between']);

  if (mode === 'city') {
    for (let tries = 0; tries < 60; tries++) {
      const a = pick(rng, CITIES);
      const b = pick(rng, CITIES);
      if (a.id === b.id) continue;
      const dir = directionBetween(a, b, eight);
      if (dir === null) continue;
      return choice(
        ctx,
        { ro: `În ce direcție se află ${b.ro} față de ${a.ro}?`, en: `In which direction is ${b.en} from ${a.en}?` },
        dir,
        pool,
        count,
        MAP_VISUAL,
      );
    }
  }
  if (mode === 'between') {
    const c = pick(rng, [1, 3, 5, 7]);
    const a = DIRECTIONS[(c + 7) % 8], b = DIRECTIONS[(c + 1) % 8];
    return choice(
      ctx,
      { ro: `Ce direcție se află între ${a.ro} și ${b.ro}?`, en: `Which direction lies between ${a.en} and ${b.en}?` },
      c,
      ALL,
      count,
    );
  }
  if (mode === 'sun') {
    const rises = rng() < 0.5;
    return choice(
      ctx,
      { ro: `Soarele ${rises ? 'răsare' : 'apune'} în partea de...`, en: `The sun ${rises ? 'rises' : 'sets'} in the...` },
      rises ? 2 : 6,
      CARDINALS,
      count,
    );
  }
  if (mode === 'opposite') {
    const from = pick(rng, pool);
    return choice(
      ctx,
      { ro: `Care este direcția opusă lui ${DIRECTIONS[from].ro}?`, en: `Which direction is opposite to ${DIRECTIONS[from].en}?` },
      (from + 4) % 8,
      pool,
      count,
    );
  }
  // facing: turning right adds 90 degrees, left subtracts, behind adds 180
  const facing = pick(rng, CARDINALS);
  const side = pick(rng, [
    { turn: 2, ro: 'în dreapta ta', en: 'on your right' },
    { turn: 6, ro: 'în stânga ta', en: 'on your left' },
    { turn: 4, ro: 'în spatele tău', en: 'behind you' },
  ]);
  return choice(
    ctx,
    {
      ro: `Stai cu fața spre ${DIRECTIONS[facing].ro}. Ce direcție este ${side.ro}?`,
      en: `You face ${DIRECTIONS[facing].en}. Which direction is ${side.en}?`,
    },
    (facing + side.turn) % 8,
    CARDINALS,
    count,
  );
};

registerGenerator('geo-directions', geoDirections);
