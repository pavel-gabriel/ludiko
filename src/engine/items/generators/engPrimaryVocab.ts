/**
 * `eng-primary-vocab` generator: English picture vocabulary for grades 0-IV.
 * params: { topics: string[], kinds?: Kind[] }  topics = vocabulary topics of content/data/eng/primary-vocab.json
 *   picture-to-word  see a picture, choose the English word
 *   word-to-picture  hear/read an English word «cat», choose the picture (picture-choice)
 *   ro-to-en         Romanian word -> English word
 *   en-to-ro         English word -> Romanian meaning
 *   odd              odd one out (three words of one group + one from another)
 *   match            match English words with pictures (or, from grade II, with the Romanian meaning)
 *   sort             sort words into two groups
 *   true-false       "the picture shows «cat»" true or false
 * Distractors only come from words already taught (grade <= the skill's grade). Words are unique by English
 * word, Romanian meaning and emoji, so there is always exactly one right option.
 */
import type { ChoiceItem, Item, MatchItem, PictureChoiceItem, SortItem, TrueFalseItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { ENG_WORDS, GROUP_NAMES, engVisual, groupsClash, type EngWord } from './engPrimaryData';
import { baseFields, chance, optionCount, pick, shuffle } from './util';

type Kind = 'picture-to-word' | 'word-to-picture' | 'ro-to-en' | 'en-to-ro' | 'odd' | 'match' | 'sort' | 'true-false';
const KINDS: Kind[] = ['picture-to-word', 'word-to-picture', 'ro-to-en', 'en-to-ro', 'odd', 'match', 'sort', 'true-false'];

function paramKinds(params: Record<string, unknown>): Kind[] {
  const v = params.kinds;
  const kinds = Array.isArray(v) ? (v.filter((k) => KINDS.includes(k as Kind)) as Kind[]) : [];
  return kinds.length ? kinds : ['picture-to-word', 'word-to-picture'];
}

function paramTopics(params: Record<string, unknown>): string[] {
  const v = params.topics;
  return Array.isArray(v) && v.every((x) => typeof x === 'string') && v.length ? (v as string[]) : ['colours'];
}

/** Wrong words for `target`: easier levels draw from other groups, harder ones from the same topic/group. */
function distractors(rng: () => number, target: EngWord, count: number, known: readonly EngWord[], d: number): EngWord[] {
  const others = known.filter((w) => w.en !== target.en && w.e !== target.e && w.ro !== target.ro);
  const same = shuffle(rng, others.filter((w) => w.topic === target.topic || w.group === target.group));
  const diff = shuffle(rng, others.filter((w) => w.topic !== target.topic && w.group !== target.group));
  const ordered = d >= 2 ? [...same, ...diff] : [...diff.slice(0, count), ...same, ...diff.slice(count)];
  return ordered.slice(0, count);
}

const wordCard = (w: EngWord) => ({ id: `w_${w.en}`, text: { ro: w.en } });
const marked = (en: string) => `«${en}»`;

export const engPrimaryVocab: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d, skill } = ctx;
  const topics = paramTopics(params);
  const kind = pick(rng, paramKinds(params));
  const known = ENG_WORDS.filter((w) => w.grade <= skill.grade);
  const pool = known.filter((w) => topics.includes(w.topic));
  const items = pool.length ? pool : known;
  const target = pick(rng, items);
  const n = optionCount(d);

  switch (kind) {
    case 'picture-to-word': {
      const wrong = distractors(rng, target, n - 1, known, d);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Ce arată imaginea? Alege cuvântul în engleză.', en: 'What does the picture show? Choose the English word.' }, engVisual(target)),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map(wordCard),
        correctId: `w_${target.en}`,
      };
      return item;
    }

    case 'word-to-picture': {
      const wrong = distractors(rng, target, n - 1, known, d);
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Ascultă și alege imaginea: ${marked(target.en)}.`, en: `Listen and choose the picture: ${marked(target.en)}.` }),
        type: 'picture-choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => ({ id: `w_${w.en}`, visual: engVisual(w) })),
        correctId: `w_${target.en}`,
      };
      return item;
    }

    case 'ro-to-en': {
      const wrong = distractors(rng, target, n - 1, known, d);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Cum se spune „${target.ro}” în engleză?`, en: `How do you say “${target.ro}” in English?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map(wordCard),
        correctId: `w_${target.en}`,
      };
      return item;
    }

    case 'en-to-ro': {
      const wrong = distractors(rng, target, n - 1, known, d);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Ce înseamnă ${marked(target.en)}?`, en: `What does ${marked(target.en)} mean?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => ({ id: `w_${w.en}`, text: { ro: w.ro } })),
        correctId: `w_${target.en}`,
      };
      return item;
    }

    case 'odd': {
      const mates = shuffle(rng, known.filter((w) => w.group === target.group && w.en !== target.en && w.e !== target.e));
      const three = [target, ...mates.slice(0, 2)];
      const strangers = shuffle(rng, known.filter((w) => !groupsClash(w.group, target.group)));
      const odd = strangers[0];
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Care cuvânt nu face parte din grup?', en: 'Which word does not belong to the group?' }),
        type: 'choice',
        options: shuffle(rng, [...three, odd]).map(wordCard),
        correctId: `w_${odd.en}`,
      };
      return item;
    }

    case 'match': {
      const count = d >= 3 ? 4 : 3;
      const rest = distractors(rng, target, count - 1, known, 2);
      const picked = [target, ...rest];
      const toRo = skill.grade >= 2 && chance(rng, 0.4);
      const item: MatchItem = {
        ...baseFields(ctx, toRo ? { ro: 'Potrivește fiecare cuvânt englezesc cu sensul lui.', en: 'Match each English word with its meaning.' } : { ro: 'Potrivește fiecare cuvânt cu imaginea lui.', en: 'Match each word with its picture.' }),
        type: 'match',
        pairs: picked.map((w) => ({
          left: { id: `t_${w.en}`, text: { ro: w.en } },
          right: toRo ? { id: `r_${w.en}`, text: { ro: w.ro } } : { id: `p_${w.en}`, visual: engVisual(w) },
        })),
      };
      return item;
    }

    case 'sort': {
      const groupOf = (g: string) => known.filter((w) => w.group === g);
      const main = target.group;
      const others = shuffle(rng, [...new Set(known.map((w) => w.group))].filter((g) => !groupsClash(g, main) && groupOf(g).length >= 2));
      const second = others[0];
      const per = d >= 3 ? 3 : 2;
      const a = shuffle(rng, groupOf(main).filter((w) => w.en !== target.en)).slice(0, per - 1);
      const b = shuffle(rng, groupOf(second)).slice(0, per);
      const label = (g: string) => ({ id: `g_${g}`, label: { ro: GROUP_NAMES[g].ro, en: GROUP_NAMES[g].en } });
      const item: SortItem = {
        ...baseFields(ctx, { ro: 'Pune fiecare cuvânt în grupa potrivită.', en: 'Put each word in the right group.' }),
        type: 'sort',
        categories: shuffle(rng, [label(main), label(second)]),
        cards: shuffle(rng, [
          ...[target, ...a].map((w) => ({ id: `w_${w.en}`, text: { ro: w.en }, categoryId: `g_${main}` })),
          ...b.map((w) => ({ id: `w_${w.en}`, text: { ro: w.en }, categoryId: `g_${second}` })),
        ]),
      };
      return item;
    }

    case 'true-false': {
      const isTrue = chance(rng, 0.5);
      const shown = isTrue ? target : distractors(rng, target, 1, known, d)[0];
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `Imaginea arată ${marked(shown.en)}. Adevărat sau fals?`, en: `The picture shows ${marked(shown.en)}. True or false?` }, engVisual(target)),
        type: 'true-false',
        correct: isTrue,
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-vocab', engPrimaryVocab);
