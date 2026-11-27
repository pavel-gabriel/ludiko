/**
 * Procedural item generators (docs/PLAN.md §5.3).
 *
 *   generateItems(skill, 20, { difficulty: 2, seed: 42 })
 *
 * Reads `skill.itemSources`: every `{ generator, params }` source is run through its registered
 * generator (round-robin), and static bank items (registry `getItemsForSkill`) are mixed in.
 * The skill's content pack must be loaded first (src/engine/content/packs.ts).
 */
import type { Difficulty, Item, Skill } from '../../types';
import { getItemsForSkill } from '../../content/registry';
import { getGenerator } from './registry';
import { mulberry32, randInt, shuffle } from './util';

/*
 * Generator modules register themselves on import. They are NOT imported here: each content pack
 * (src/engine/content/packs/<packId>.ts) imports the generators its skills use, so a grade I child never
 * downloads the grade VIII ones. Load a skill's pack (`ensureContentForSkills`) before `generateItems`.
 */

export { getGenerator, listGenerators, registerGenerator } from './registry';
export type { GeneratorContext, GeneratorFn } from './registry';
export { mulberry32 } from './util';

export interface GenerateOptions {
  /** Fixed difficulty for every item. Omitted: each item is 1-3 (mixed, easier-weighted). */
  difficulty?: Difficulty;
  /** PRNG seed: same seed + skill + count => identical items. Default: random. */
  seed?: number;
}

/** Share of items drawn from the static bank when the skill also has generators. */
const STATIC_SHARE = 0.2;

const isDifficulty = (v: unknown): v is Difficulty => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

function stamp(item: Item, skill: Skill, seed: number, index: number, fallback: Difficulty): Item {
  const id = `gen.${skill.id}.${seed}.${index}`;
  const explanationId = skill.explanations[0];
  return {
    ...item,
    id,
    skillId: skill.id,
    difficulty: isDifficulty(item.difficulty) ? item.difficulty : fallback,
    reviewStatus: 'auto-checked',
    ...(explanationId ? { explanationId } : {}),
    provenance: {
      id,
      kind: 'item',
      title: `Generated item for ${skill.id}`,
      author: 'Ludiko',
      source: 'generated',
      licence: 'OWN',
    },
  } as Item;
}

/** Static items preferred near the requested difficulty (±1), falling back to all of them. */
function staticPool(skill: Skill, difficulty: Difficulty | undefined): Item[] {
  const all = getItemsForSkill(skill.id);
  if (difficulty === undefined) return [...all];
  const near = all.filter((i) => Math.abs(i.difficulty - difficulty) <= 1);
  return near.length ? near : [...all];
}

export function generateItems(skill: Skill, count: number, opts: GenerateOptions = {}): Item[] {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
  const master = mulberry32(seed ^ 0x9e3779b9);

  const sources = skill.itemSources.flatMap((s) => ('generator' in s ? [s] : []));
  for (const s of sources) {
    if (!getGenerator(s.generator)) {
      throw new Error(`Unknown generator "${s.generator}" (skill ${skill.id}; is its content pack loaded?)`);
    }
  }

  let pool = shuffle(master, staticPool(skill, opts.difficulty));
  const out: Item[] = [];

  for (let index = 0; index < count; index++) {
    const useStatic = pool.length > 0 && (sources.length === 0 || master() < STATIC_SHARE);
    if (useStatic) {
      out.push(pool.shift() as Item);
      if (pool.length === 0 && sources.length === 0) pool = shuffle(master, staticPool(skill, opts.difficulty));
      continue;
    }
    if (sources.length === 0) break; // nothing to draw from

    const rng = mulberry32((seed + Math.imul(index + 1, 0x85ebca6b)) >>> 0);
    const difficulty: Difficulty = opts.difficulty ?? ([1, 1, 2, 2, 2, 3, 3][randInt(master, 0, 6)] as Difficulty);
    const source = sources[index % sources.length];
    const item = getGenerator(source.generator)!(source.params ?? {}, { skill, difficulty, rng, index });
    out.push(stamp(item, skill, seed, index, difficulty));
  }
  return out;
}
