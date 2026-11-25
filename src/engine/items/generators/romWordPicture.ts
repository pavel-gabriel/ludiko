/**
 * `word-picture` generator (reading single words, grades 0–I).
 * params: { kinds: ('word-to-picture' | 'picture-to-word' | 'match')[], level?: 1 | 2, maxSyllables?: number }
 *   word-to-picture  read a word, tap its picture
 *   picture-to-word  see a picture, choose the word (level 2: look-alike distractors)
 *   match            match words with pictures
 * Only words with an unambiguous emoji picture are used; words sharing a meaning group (bird, tree, ...)
 * are never offered together, so there is always exactly one right picture.
 */
import type { ChoiceItem, Item, MatchItem, PictureChoiceItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { PICTURE_WORDS, wordVisual, type RomWord } from './romData';
import { baseFields, optionCount, paramInt, pick, shuffle } from './util';

type Kind = 'word-to-picture' | 'picture-to-word' | 'match';
const KINDS: Kind[] = ['word-to-picture', 'picture-to-word', 'match'];

function paramKinds(params: Record<string, unknown>): Kind[] {
  const v = params.kinds;
  const kinds = Array.isArray(v) ? (v.filter((k) => KINDS.includes(k as Kind)) as Kind[]) : [];
  return kinds.length ? kinds : ['word-to-picture'];
}

const compatible = (a: RomWord, b: RomWord): boolean =>
  a.w !== b.w && a.e !== b.e && !(a.g && b.g && a.g === b.g);

/** How alike two words look on the page (higher = harder to tell apart) */
function similarity(a: RomWord, b: RomWord): number {
  let s = 0;
  if (a.w[0] === b.w[0]) s += 3;
  if (Math.abs(a.w.length - b.w.length) <= 1) s += 2;
  if (a.w.slice(-2) === b.w.slice(-2)) s += 2;
  if (a.syl.length === b.syl.length) s += 1;
  return s;
}

function distractorWords(rng: () => number, target: RomWord, count: number, pool: readonly RomWord[], similar: boolean): RomWord[] {
  const candidates = shuffle(rng, pool.filter((x) => compatible(target, x)));
  if (similar) candidates.sort((x, y) => similarity(target, y) - similarity(target, x));
  const out: RomWord[] = [];
  for (const c of candidates) {
    if (out.length >= count) break;
    if (out.every((o) => compatible(o, c))) out.push(c);
  }
  return out;
}

export const wordPicture: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const level = paramInt(params, 'level', 1);
  const limit = paramInt(params, 'maxSyllables', level === 1 ? (d <= 2 ? 2 : 3) : 4);
  const pool = PICTURE_WORDS.filter((w) => w.syl.length <= limit);
  const kind = pick(rng, paramKinds(params));
  const similar = level >= 2 && d >= 2;

  switch (kind) {
    case 'word-to-picture': {
      const target = pick(rng, pool);
      const wrong = distractorWords(rng, target, optionCount(d) - 1, pool, similar);
      const item: PictureChoiceItem = {
        ...baseFields(ctx, { ro: `Care imagine se potrivește cu cuvântul „${target.w}”?`, en: `Which picture matches the word “${target.w}” (${target.en})?` }),
        type: 'picture-choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => ({ id: `w_${w.w}`, visual: wordVisual(w) })),
        correctId: `w_${target.w}`,
      };
      return item;
    }

    case 'picture-to-word': {
      const target = pick(rng, pool);
      const wrong = distractorWords(rng, target, optionCount(d) - 1, pool, similar);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: 'Ce cuvânt se potrivește cu imaginea?', en: 'Which word matches the picture?' }, wordVisual(target)),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((w) => ({ id: `w_${w.w}`, text: { ro: w.w } })),
        correctId: `w_${target.w}`,
      };
      return item;
    }

    case 'match': {
      const count = d >= 3 ? 4 : 3;
      const first = pick(rng, pool);
      const rest = distractorWords(rng, first, count - 1, pool, false);
      const picked = [first, ...rest];
      const item: MatchItem = {
        ...baseFields(ctx, { ro: 'Potrivește fiecare cuvânt cu imaginea lui.', en: 'Match each word with its picture.' }),
        type: 'match',
        pairs: picked.map((w) => ({
          left: { id: `t_${w.w}`, text: { ro: w.w } },
          right: { id: `p_${w.w}`, visual: wordVisual(w) },
        })),
      };
      return item;
    }
  }
};

registerGenerator('word-picture', wordPicture);
