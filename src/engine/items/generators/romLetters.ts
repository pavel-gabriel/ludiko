/**
 * `letters` generator (Romanian letters and sounds, grades 0–I).
 * params: { kinds: LetterKind[] }
 *   initial-letter  choose the first letter of a pictured word
 *   initial-picture choose the picture whose word starts with a given letter
 *   final-letter    choose the last letter of a word (harder)
 *   vowel-pick      which letter is a vowel / a consonant
 *   vowel-sort      sort letters into vowels and consonants
 *   vowel-count     how many vowels does a word have
 *   case-choice     uppercase <-> lowercase pick
 *   case-match      match lowercase with uppercase letters
 *   digraph         fill in ce/ci/che/chi/ge/gi/ghe/ghi
 */
import type {
  CardContent, ChoiceItem, FillGapItem, Item, MatchItem, PictureChoiceItem, SortItem,
} from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { CONSONANTS_COMMON, CONSONANTS_RARE, PICTURE_WORDS, VOWELS, isVowel, wordCard, wordVisual, type RomWord } from './romData';
import { baseFields, chance, numberCards, numberOptions, optionCount, pick, shuffle } from './util';

export type LetterKind =
  | 'initial-letter'
  | 'initial-picture'
  | 'final-letter'
  | 'vowel-pick'
  | 'vowel-sort'
  | 'vowel-count'
  | 'case-choice'
  | 'case-match'
  | 'digraph';

const ALL_KINDS: LetterKind[] = [
  'initial-letter', 'initial-picture', 'final-letter', 'vowel-pick', 'vowel-sort', 'vowel-count',
  'case-choice', 'case-match', 'digraph',
];

/** Letters a 6-year-old meets first (no k, q, w, x, y) */
const CORE_LETTERS: readonly string[] = [...VOWELS, ...CONSONANTS_COMMON];
const ALL_LETTERS: readonly string[] = [...CORE_LETTERS, ...CONSONANTS_RARE];

/** Look-alike / sound-alike letters, used for plausible distractors */
const CONFUSABLE: readonly (readonly string[])[] = [
  ['a', 'ă', 'â'], ['i', 'î', 'â'], ['s', 'ș', 'z'], ['t', 'ț', 'd'], ['b', 'd', 'p'], ['m', 'n'], ['c', 'g'], ['f', 'v'],
];

/** Words safe for "how many vowels" questions (see the vowel-count case) */
const UNAMBIGUOUS_VOWEL_WORDS = PICTURE_WORDS.filter(
  (w) => !/[aeiouăâî]{2}/.test(w.w) && !/[^aeiouăâî]i$/.test(w.w),
);

const letterCard = (l: string): CardContent => ({ id: `l_${l}`, text: { ro: l } });
const upper = (l: string): string => l.toLocaleUpperCase('ro');

/** Distractor letters: confusable ones first at higher difficulty, then random, never `not` and never duplicates */
function distractors(rng: () => number, not: readonly string[], count: number, pool: readonly string[], d: number): string[] {
  const out: string[] = [];
  const ok = (l: string) => !not.includes(l) && !out.includes(l);
  if (d >= 3) {
    const near = shuffle(rng, not.flatMap((n) => CONFUSABLE.filter((g) => g.includes(n)).flat()));
    for (const l of near) if (out.length < count && ok(l) && pool.includes(l)) out.push(l);
  }
  for (const l of shuffle(rng, pool)) if (out.length < count && ok(l)) out.push(l);
  return out;
}

function pool(d: number): readonly string[] {
  return d >= 4 ? ALL_LETTERS : CORE_LETTERS;
}

/* ---- digraph words -------------------------------------------------- */

const DIGRAPH_RE = /[cg]h?[ei]/g;
/** Words where swapping the group yields another real word (mingi, urechi, foarfeci, șoareci, rachită) */
const DIGRAPH_EXCLUDE = new Set(['minge', 'ureche', 'foarfece', 'șoarece', 'rachetă']);
const C_FAMILY = ['ce', 'ci', 'che', 'chi'];
const G_FAMILY = ['ge', 'gi', 'ghe', 'ghi'];

interface DigraphWord { word: RomWord; group: string; index: number }

export const DIGRAPH_WORDS: readonly DigraphWord[] = PICTURE_WORDS.flatMap((word) => {
  if (DIGRAPH_EXCLUDE.has(word.w)) return [];
  const found = [...word.w.matchAll(DIGRAPH_RE)];
  if (found.length !== 1) return [];
  return [{ word, group: found[0][0], index: found[0].index as number }];
});

/* ---- generator ------------------------------------------------------ */

function paramKinds(params: Record<string, unknown>): LetterKind[] {
  const v = params.kinds;
  const kinds = Array.isArray(v) ? (v.filter((k) => ALL_KINDS.includes(k as LetterKind)) as LetterKind[]) : [];
  return kinds.length ? kinds : ['initial-letter'];
}

const firstLetter = (w: RomWord): string => [...w.w][0];
const lastLetter = (w: RomWord): string => [...w.w].slice(-1)[0];

export const letters: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kinds = paramKinds(params);
  let kind = pick(rng, kinds);
  if (kind === 'final-letter' && d < 3 && kinds.length > 1) kind = pick(rng, kinds.filter((k) => k !== 'final-letter'));
  if (kind === 'final-letter' && d < 3) kind = 'initial-letter';
  const letterPool = pool(d);

  switch (kind) {
    case 'initial-letter': {
      const w = pick(rng, PICTURE_WORDS);
      const correct = firstLetter(w);
      const wrong = distractors(rng, [correct], optionCount(d) - 1, letterPool.filter((l) => l !== correct), d);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          { ro: `Cu ce literă începe cuvântul „${w.w}”?`, en: `Which letter does the word “${w.w}” (${w.en}) start with?` },
          wordVisual(w),
        ),
        type: 'choice',
        options: shuffle(rng, [correct, ...wrong]).map(letterCard),
        correctId: `l_${correct}`,
      };
      return item;
    }

    case 'final-letter': {
      const w = pick(rng, PICTURE_WORDS.filter((x) => x.w.length >= 3));
      const correct = lastLetter(w);
      const wrong = distractors(rng, [correct], optionCount(d) - 1, letterPool.filter((l) => l !== correct), d);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          { ro: `Cu ce literă se termină cuvântul „${w.w}”?`, en: `Which letter does the word “${w.w}” (${w.en}) end with?` },
          wordVisual(w),
        ),
        type: 'choice',
        options: shuffle(rng, [correct, ...wrong]).map(letterCard),
        correctId: `l_${correct}`,
      };
      return item;
    }

    case 'initial-picture': {
      const target = pick(rng, PICTURE_WORDS);
      const letter = firstLetter(target);
      const others = shuffle(
        rng,
        PICTURE_WORDS.filter((x) => firstLetter(x) !== letter && !(target.g && x.g === target.g)),
      );
      const chosen: RomWord[] = [];
      for (const x of others) {
        if (chosen.length >= optionCount(d) - 1) break;
        if (!chosen.some((c) => firstLetter(c) === firstLetter(x))) chosen.push(x);
      }
      const item: PictureChoiceItem = {
        ...baseFields(ctx, {
          ro: `Care cuvânt începe cu litera „${upper(letter)}”?`,
          en: `Which word starts with the letter “${upper(letter)}”?`,
        }),
        type: 'picture-choice',
        options: shuffle(rng, [target, ...chosen]).map((x) => ({ ...wordCard(x), visual: wordVisual(x) })),
        correctId: `w_${target.w}`,
      };
      return item;
    }

    case 'vowel-pick': {
      const wantVowel = chance(rng, 0.5);
      const total = optionCount(d);
      const correctPool = wantVowel ? VOWELS : CONSONANTS_COMMON;
      const wrongPool = wantVowel ? CONSONANTS_COMMON : VOWELS;
      const correct = pick(rng, correctPool);
      const wrong = shuffle(rng, wrongPool).slice(0, total - 1);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          wantVowel
            ? { ro: 'Care dintre aceste litere este o vocală?', en: 'Which of these letters is a vowel?' }
            : { ro: 'Care dintre aceste litere este o consoană?', en: 'Which of these letters is a consonant?' },
        ),
        type: 'choice',
        options: shuffle(rng, [correct, ...wrong]).map(letterCard),
        correctId: `l_${correct}`,
      };
      return item;
    }

    case 'vowel-sort': {
      const each = d >= 3 ? 3 : 2;
      const v = shuffle(rng, VOWELS).slice(0, each);
      const c = shuffle(rng, CONSONANTS_COMMON).slice(0, each);
      const cards = shuffle(rng, [
        ...v.map((l) => ({ ...letterCard(l), categoryId: 'vowel' })),
        ...c.map((l) => ({ ...letterCard(l), categoryId: 'consonant' })),
      ]);
      const item: SortItem = {
        ...baseFields(ctx, { ro: 'Pune fiecare literă în grupa potrivită.', en: 'Put each letter in the right group.' }),
        type: 'sort',
        categories: [
          { id: 'vowel', label: { ro: 'Vocale', en: 'Vowels' } },
          { id: 'consonant', label: { ro: 'Consoane', en: 'Consonants' } },
        ],
        cards,
      };
      return item;
    }

    case 'vowel-count': {
      /* Only words where every vowel letter is clearly its own sound: no adjacent vowels
         (diphthongs like oa, ia, ie make the count ambiguous for a child) and no final
         short "i" after a consonant (azi, ochi). */
      const w = pick(rng, UNAMBIGUOUS_VOWEL_WORDS);
      const n = [...w.w].filter(isVowel).length;
      const values = numberOptions(rng, n, [n - 1, n + 1, n + 2, n - 2], optionCount(d), 0, 8);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          { ro: `Câte litere-vocale are cuvântul „${w.w}”?`, en: `How many vowel letters does the word “${w.w}” (${w.en}) have?` },
          wordVisual(w),
        ),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${n}`,
      };
      return item;
    }

    case 'case-choice': {
      const toUpper = chance(rng, 0.5);
      const src = pick(rng, letterPool);
      const target = toUpper ? upper(src) : src;
      const given = toUpper ? src : upper(src);
      const wrongSrc = distractors(rng, [src], optionCount(d) - 1, letterPool.filter((l) => l !== src), d);
      const options = shuffle(rng, [target, ...wrongSrc.map((l) => (toUpper ? upper(l) : l))]);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          toUpper
            ? { ro: `Care este litera mare pentru „${given}”?`, en: `Which capital letter goes with “${given}”?` }
            : { ro: `Care este litera mică pentru „${given}”?`, en: `Which small letter goes with “${given}”?` },
        ),
        type: 'choice',
        options: options.map((l) => ({ id: `l_${l}`, text: { ro: l } })),
        correctId: `l_${target}`,
      };
      return item;
    }

    case 'case-match': {
      const count = d >= 3 ? 4 : 3;
      const picked = shuffle(rng, letterPool).slice(0, count);
      const item: MatchItem = {
        ...baseFields(ctx, { ro: 'Potrivește litera mică cu litera mare.', en: 'Match each small letter with its capital letter.' }),
        type: 'match',
        pairs: picked.map((l) => ({
          left: { id: `s_${l}`, text: { ro: l } },
          right: { id: `u_${l}`, text: { ro: upper(l) } },
        })),
      };
      return item;
    }

    case 'digraph': {
      const { word, group, index } = pick(rng, DIGRAPH_WORDS);
      const family = group.startsWith('c') ? C_FAMILY : G_FAMILY;
      const wrong = shuffle(rng, family.filter((g) => g !== group)).slice(0, optionCount(d) - 1);
      const template = `${word.w.slice(0, index)}{{gap}}${word.w.slice(index + group.length)}`;
      const item: FillGapItem = {
        ...baseFields(
          ctx,
          { ro: 'Ce grup de litere lipsește din cuvânt?', en: `Which group of letters is missing from the word (${word.en})?` },
          wordVisual(word),
        ),
        type: 'fill-gap',
        template: { ro: template, en: template },
        options: shuffle(rng, [group, ...wrong]),
        correct: group,
      };
      return item;
    }
  }
};

registerGenerator('letters', letters);
