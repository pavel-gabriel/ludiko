/**
 * Generator registry: name -> procedural item generator (docs/PLAN.md §5.3).
 * Skills reference generators by name in `itemSources` (`{ generator: 'addition', params }`).
 */
import type { Difficulty, Item, Skill } from '../../types';

export interface GeneratorContext {
  skill: Skill;
  difficulty: Difficulty;
  /** Seeded PRNG returning [0, 1). Generators MUST draw all randomness from it (determinism). */
  rng: () => number;
  /** Position of the item in the batch being generated */
  index: number;
}

/**
 * Builds one item. `id`, `provenance`, `skillId`, `reviewStatus` and `explanationId` are stamped by
 * `generateItems` afterwards, so a generator only has to fill in the pedagogical content.
 */
export type GeneratorFn = (params: Record<string, unknown>, ctx: GeneratorContext) => Item;

const generators = new Map<string, GeneratorFn>();

export function registerGenerator(name: string, fn: GeneratorFn): void {
  generators.set(name, fn);
}

export function getGenerator(name: string): GeneratorFn | undefined {
  return generators.get(name);
}

export function listGenerators(): string[] {
  return [...generators.keys()].sort();
}
