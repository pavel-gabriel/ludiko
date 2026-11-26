/**
 * Logic puzzles: odd one out (`logic-odd-one`, own framework LUDIKO-LOGIC).
 *   params: { sets?: string[] }  set ids from ODD_SETS (fruits, animals, shapes, vehicles, food, fly, parity)
 * Three options belong to one group, one does not; groups of a set are curated and disjoint, so the answer is unique.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, pick, shuffle } from './util';

export interface OddGroup {
  id: string;
  ro: string;
  en: string;
  members: string[];
}

const ANIMALS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐸'];
const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐', '🍒', '🍉'];
const VEHICLES = ['🚗', '🚌', '🚲', '🚂', '✈️', '⛵'];

/** A set = groups that make good "odd one out" pairs. Groups inside one set share no member. */
export const ODD_SETS: Record<string, OddGroup[]> = {
  fruits: [
    { id: 'fruit', ro: 'fructe', en: 'fruits', members: FRUITS },
    { id: 'animal', ro: 'animale', en: 'animals', members: ANIMALS },
  ],
  animals: [
    { id: 'animal', ro: 'animale', en: 'animals', members: ANIMALS },
    { id: 'vehicle', ro: 'vehicule', en: 'vehicles', members: VEHICLES },
    { id: 'fruit', ro: 'fructe', en: 'fruits', members: FRUITS },
  ],
  shapes: [
    { id: 'circle', ro: 'cercuri', en: 'circles', members: ['🔴', '🔵', '🟢', '🟡', '🟣', '🟠'] },
    { id: 'square', ro: 'pătrate', en: 'squares', members: ['🟥', '🟦', '🟩', '🟨', '🟪', '🟧'] },
  ],
  vehicles: [
    { id: 'vehicle', ro: 'vehicule', en: 'vehicles', members: VEHICLES },
    { id: 'animal', ro: 'animale', en: 'animals', members: ANIMALS },
    { id: 'clothes', ro: 'haine', en: 'clothes', members: ['👕', '👖', '🧦', '🧢', '🧤', '👗'] },
  ],
  // closer categories (harder)
  food: [
    { id: 'fruit', ro: 'fructe', en: 'fruits', members: ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐'] },
    { id: 'vegetable', ro: 'legume', en: 'vegetables', members: ['🥕', '🌽', '🍅', '🥦', '🥔', '🍆'] },
  ],
  fly: [
    { id: 'flying', ro: 'zboară', en: 'fly', members: ['🦅', '🦆', '🦋', '🐝', '🦉', '🐞'] },
    { id: 'walking', ro: 'umblă pe pământ', en: 'walk on the ground', members: ['🐶', '🐱', '🐴', '🐄', '🐑', '🐢'] },
  ],
  parity: [], // numbers, handled in code
};

export const PARITY_RANGES: Record<number, [number, number]> = { 1: [1, 20], 2: [1, 50], 3: [10, 99], 4: [10, 199], 5: [100, 999] };

export function groupOf(set: OddGroup[], member: string): string | undefined {
  return set.find((g) => g.members.includes(member))?.id;
}

export const logicOddOne: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const wanted = Array.isArray(params.sets) ? (params.sets as string[]).filter((s) => s in ODD_SETS) : [];
  const setId = pick(rng, wanted.length ? wanted : ['fruits']);
  const total = d <= 1 ? 3 : 4;

  if (setId === 'parity') {
    const [lo, hi] = PARITY_RANGES[d] ?? PARITY_RANGES[2];
    const oddOneIsOdd = rng() < 0.5; // an odd number among evens, or an even number among odds
    const want = oddOneIsOdd ? 1 : 0;
    const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const same = shuffle(rng, pool.filter((n) => n % 2 === 1 - want)).slice(0, total - 1);
    const odd = pick(rng, pool.filter((n) => n % 2 === want));
    const nums = shuffle(rng, [odd, ...same]);
    return {
      ...baseFields(ctx, {
        ro: `Ghicitoarea lui Ludi: care număr nu se potrivește cu celelalte? (celelalte sunt ${oddOneIsOdd ? 'pare' : 'impare'})`,
        en: `Ludi's riddle: which number does not fit? (the others are ${oddOneIsOdd ? 'even' : 'odd'})`,
      }),
      type: 'choice',
      options: nums.map((n) => ({ id: `n${n}`, text: { ro: String(n) } })),
      correctId: `n${odd}`,
    } as ChoiceItem;
  }

  const groups = ODD_SETS[setId];
  const majority = pick(rng, groups);
  const minority = pick(rng, groups.filter((g) => g.id !== majority.id));
  const same = shuffle(rng, majority.members).slice(0, total - 1);
  const odd = pick(rng, minority.members);
  const emojis = shuffle(rng, [odd, ...same]);
  return {
    ...baseFields(ctx, {
      ro: 'Ghicitoarea lui Ludi: care desen nu se potrivește cu celelalte?',
      en: "Ludi's riddle: which picture does not fit with the others?",
    }),
    type: 'choice',
    options: emojis.map((e, i) => ({ id: `o${i}`, text: { ro: e } })),
    correctId: `o${emojis.indexOf(odd)}`,
  } as ChoiceItem;
};

registerGenerator('logic-odd-one', logicOddOne);
