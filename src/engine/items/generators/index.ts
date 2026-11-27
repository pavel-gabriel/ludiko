/**
 * Procedural item generators (docs/PLAN.md §5.3).
 *
 *   generateItems(skill, 20, { difficulty: 2, seed: 42 })
 *
 * Reads `skill.itemSources`: every `{ generator, params }` source is run through its registered
 * generator (round-robin), and static bank items (registry `getItemsForSkill`) are mixed in.
 */
import type { Difficulty, Item, Skill } from '../../types';
import { getItemsForSkill } from '../../content/registry';
import { addition, subtraction } from './arithmetic';
import { clock } from './clock';
import { compare } from './compare';
import { counting } from './counting';
import { fraction } from './fraction';
import { measure } from './measure';
import { money } from './money';
import { numberRecognition } from './numberRecognition';
import { placeValue } from './placeValue';
import { getGenerator, registerGenerator } from './registry';
import { shapes } from './shapes';
import { timeUnits } from './timeUnits';
import { mulberry32, randInt, shuffle } from './util';
import { wordProblem } from './wordProblem';
// grade III-IV generators: each module registers itself
import './division';
import './equation';
import './multiplication';
import './numberReading';
import './orderOfOps';
import './rounding';
// Romanian generators register themselves (letters, syllables, word-picture, sentence-order, punctuation, word-relations)
import './romLetters';
import './romSyllables';
import './romWordPicture';
import './romSentences';
import './romVocab';
// Romanian gimnaziu (V-VIII): spelling pairs, parts of speech, verb forms, syntax roles, figures of speech, curated quiz
import './romSpelling';
import './romPos';
import './romVerbs';
import './romSyntax';
import './romFigures';
import './romQuiz';
// science generators (sci-sort, sci-which, sci-tf, sci-relation, sci-order)
import './stiinte';
// history (grade IV) generators
import './istGenerators';
// Geography (geo) generators
import './geoDirections';
// Geography gimnaziu (V-VIII): curated quiz, capitals, sorting, EU, counties, rivers, peaks, orders, world, relief units, map scale
import './geoGimnaziu';
// Logic puzzles (patterns, odd-one-out, analogies, mini-sudoku, robot path, who-lives-where)
import './logicPatterns';
import './logicOddOne';
import './logicAnalogy';
import './logicSudoku';
import './logicRobot';
import './logicWhere';
// Math grades V-VIII (fractions-ops, decimals, powers, divisibility, integers, percentages, proportions, linear-equation,
// system-2x2, sqrt, pythagoras, areas-volumes, algebra, linear-function, probability, statistics, angles, segments-units)
import './fractionsOps';
import './decimals';
import './powers';
import './divisibility';
import './integers';
import './percentages';
import './proportions';
import './linearEquation';
import './system2x2';
import './sqrt';
import './pythagoras';
import './areasVolumes';
import './algebra';
import './linearFunction';
import './probability';
import './statistics';
import './angles';
import './segmentsUnits';

export { getGenerator, listGenerators, registerGenerator } from './registry';
export type { GeneratorContext, GeneratorFn } from './registry';
export { mulberry32 } from './util';

registerGenerator('counting', counting);
registerGenerator('number-recognition', numberRecognition);
registerGenerator('compare', compare);
registerGenerator('addition', addition);
registerGenerator('subtraction', subtraction);
registerGenerator('place-value', placeValue);
registerGenerator('word-problem', wordProblem);
registerGenerator('clock', clock);
registerGenerator('time-units', timeUnits);
registerGenerator('money', money);
registerGenerator('measure', measure);
registerGenerator('fraction', fraction);
registerGenerator('shapes', shapes);

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
    if (!getGenerator(s.generator)) throw new Error(`Unknown generator "${s.generator}" (skill ${skill.id})`);
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
