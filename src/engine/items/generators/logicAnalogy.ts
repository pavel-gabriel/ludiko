/**
 * Logic puzzles: analogies (`logic-analogy`, own framework LUDIKO-LOGIC): "pisică : pisoi = câine : ?".
 * Curated relations (our own word pairs). Inside one relation every left word and every right word is unique,
 * and the distractors are right words of the same relation, so exactly one option fits.
 *   params: { relations?: string[] }  limit to some relation ids (otherwise chosen by difficulty)
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, pick, shuffle } from './util';

/** [left ro, left en, right ro, right en] */
export type AnalogyPair = readonly [string, string, string, string];

export interface AnalogyRelation {
  id: string;
  /** minimum difficulty at which the relation appears */
  minDifficulty: number;
  pairs: readonly AnalogyPair[];
}

export const ANALOGIES: readonly AnalogyRelation[] = [
  {
    id: 'young',
    minDifficulty: 1,
    pairs: [
      ['pisică', 'cat', 'pisoi', 'kitten'],
      ['câine', 'dog', 'cățel', 'puppy'],
      ['vacă', 'cow', 'vițel', 'calf'],
      ['oaie', 'sheep', 'miel', 'lamb'],
      ['cal', 'horse', 'mânz', 'foal'],
      ['găină', 'hen', 'pui', 'chick'],
      ['rață', 'duck', 'boboc', 'duckling'],
      ['capră', 'goat', 'ied', 'kid'],
      ['porc', 'pig', 'purcel', 'piglet'],
      ['broască', 'frog', 'mormoloc', 'tadpole'],
    ],
  },
  {
    id: 'sound',
    minDifficulty: 1,
    pairs: [
      ['câine', 'dog', 'latră', 'barks'],
      ['pisică', 'cat', 'miaună', 'meows'],
      ['vacă', 'cow', 'muge', 'moos'],
      ['oaie', 'sheep', 'behăie', 'bleats'],
      ['rață', 'duck', 'măcăie', 'quacks'],
      ['broască', 'frog', 'orăcăie', 'croaks'],
      ['porc', 'pig', 'grohăie', 'grunts'],
      ['cocoș', 'rooster', 'cântă', 'crows'],
      ['leu', 'lion', 'răcnește', 'roars'],
    ],
  },
  {
    id: 'home',
    minDifficulty: 2,
    pairs: [
      ['pasăre', 'bird', 'cuib', 'nest'],
      ['albină', 'bee', 'stup', 'hive'],
      ['câine', 'dog', 'cușcă', 'kennel'],
      ['cal', 'horse', 'grajd', 'stable'],
      ['porc', 'pig', 'cocină', 'pigsty'],
      ['vulpe', 'fox', 'vizuină', 'burrow'],
      ['păianjen', 'spider', 'pânză', 'web'],
      ['pește', 'fish', 'acvariu', 'aquarium'],
    ],
  },
  {
    id: 'opposite',
    minDifficulty: 2,
    pairs: [
      ['cald', 'hot', 'rece', 'cold'],
      ['mare', 'big', 'mic', 'small'],
      ['zi', 'day', 'noapte', 'night'],
      ['sus', 'up', 'jos', 'down'],
      ['deschis', 'open', 'închis', 'closed'],
      ['plin', 'full', 'gol', 'empty'],
      ['rapid', 'fast', 'lent', 'slow'],
      ['greu', 'heavy', 'ușor', 'light'],
      ['lung', 'long', 'scurt', 'short'],
      ['vesel', 'happy', 'trist', 'sad'],
    ],
  },
  {
    id: 'tool',
    minDifficulty: 3,
    pairs: [
      ['doctor', 'doctor', 'stetoscop', 'stethoscope'],
      ['pictor', 'painter', 'pensulă', 'brush'],
      ['bucătar', 'cook', 'oală', 'pot'],
      ['fermier', 'farmer', 'tractor', 'tractor'],
      ['pompier', 'firefighter', 'furtun', 'hose'],
      ['croitor', 'tailor', 'ac', 'needle'],
      ['frizer', 'barber', 'pieptene', 'comb'],
      ['învățător', 'teacher', 'cretă', 'chalk'],
      ['poștaș', 'postman', 'scrisoare', 'letter'],
      ['fotograf', 'photographer', 'aparat foto', 'camera'],
    ],
  },
  {
    id: 'part',
    minDifficulty: 3,
    pairs: [
      ['roată', 'wheel', 'mașină', 'car'],
      ['pagină', 'page', 'carte', 'book'],
      ['frunză', 'leaf', 'copac', 'tree'],
      ['deget', 'finger', 'mână', 'hand'],
      ['literă', 'letter', 'cuvânt', 'word'],
      ['petală', 'petal', 'floare', 'flower'],
      ['cărămidă', 'brick', 'zid', 'wall'],
      ['clapă', 'key', 'pian', 'piano'],
    ],
  },
];

export const logicAnalogy: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const only = Array.isArray(params.relations) ? (params.relations as string[]) : null;
  let pool = ANALOGIES.filter((r) => (only ? only.includes(r.id) : r.minDifficulty <= d));
  if (!pool.length) pool = ANALOGIES.filter((r) => r.minDifficulty <= 1);
  const relation = pick(rng, pool);
  const [first, target, ...rest] = shuffle(rng, relation.pairs);
  const total = d <= 1 ? 3 : 4;
  const opts = shuffle(rng, [target, ...rest.slice(0, total - 1)]);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `Ghicitoarea lui Ludi: ${first[0]} : ${first[2]} = ${target[0]} : ?`,
      en: `Ludi's riddle: ${first[1]} : ${first[3]} = ${target[1]} : ?`,
    }),
    type: 'choice',
    options: opts.map((p, i) => ({ id: `o${i}`, text: { ro: p[2], en: p[3] } })),
    correctId: `o${opts.indexOf(target)}`,
  };
  return item;
};

registerGenerator('logic-analogy', logicAnalogy);
