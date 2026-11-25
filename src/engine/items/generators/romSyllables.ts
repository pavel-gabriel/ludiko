/**
 * `syllables` generator (Romanian syllables, grades 0–I).
 * params: { kinds: ('count' | 'split' | 'build')[], maxSyllables?: number }
 *   count  how many syllables does a (pictured) word have
 *   split  choose the correct hyphenation (despărțirea în silabe)
 *   build  put syllable cards in order to form the word
 * Words come from the curated list in content/data/rom/words.json.
 */
import type { ChoiceItem, Item, OrderItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { ROM_WORDS, isVowel, wordVisual, type RomWord } from './romData';
import { baseFields, numberCards, numberOptions, optionCount, paramInt, pick, shuffle } from './util';

type Kind = 'count' | 'split' | 'build';
const KINDS: Kind[] = ['count', 'split', 'build'];

function paramKinds(params: Record<string, unknown>): Kind[] {
  const v = params.kinds;
  const kinds = Array.isArray(v) ? (v.filter((k) => KINDS.includes(k as Kind)) as Kind[]) : [];
  return kinds.length ? kinds : ['count'];
}

/** Wrong hyphenations of `syl`: move a boundary by one letter, merge two syllables, or cut a syllable in two. */
export function wrongSplits(syl: readonly string[]): string[] {
  const plain = syl.join('');
  const cuts: number[] = [];
  let at = 0;
  for (const s of syl.slice(0, -1)) {
    at += s.length;
    cuts.push(at);
  }
  const render = (cs: number[]): string | null => {
    const sorted = [...new Set(cs)].sort((a, b) => a - b);
    const parts: string[] = [];
    let prev = 0;
    for (const c of [...sorted, plain.length]) {
      if (c <= prev) return null;
      parts.push(plain.slice(prev, c));
      prev = c;
    }
    /* every syllable needs a vowel and we never cut through ch/gh */
    if (!parts.every((p) => [...p].some(isVowel))) return null;
    for (const cut of sorted) if (/^(?:ch|gh)$/.test(plain.slice(cut - 1, cut + 1))) return null;
    return parts.join('-');
  };

  const out = new Set<string>();
  const correct = syl.join('-');
  cuts.forEach((_c, i) => {
    for (const delta of [-1, 1]) {
      const r = render(cuts.map((x, j) => (j === i ? x + delta : x)));
      if (r) out.add(r);
    }
    const merged = render(cuts.filter((_, j) => j !== i));
    if (merged?.includes('-')) out.add(merged); // never offer the unsplit word
  });
  /* cutting a syllable in two */
  let pos = 0;
  for (const s of syl) {
    for (let k = 1; k < s.length; k++) {
      const r = render([...cuts, pos + k]);
      if (r) out.add(r);
    }
    pos += s.length;
  }
  out.delete(correct);
  return [...out];
}

const maxSyl = (params: Record<string, unknown>, d: number): number => paramInt(params, 'maxSyllables', d <= 1 ? 3 : d <= 3 ? 4 : 5);

export const syllables: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const kind = pick(rng, paramKinds(params));
  const limit = maxSyl(params, d);

  switch (kind) {
    case 'count': {
      /* easy levels prefer words with a picture */
      const pool = ROM_WORDS.filter((w) => w.syl.length <= limit && (d >= 3 || w.e));
      const w = pick(rng, pool);
      const n = w.syl.length;
      const values = numberOptions(rng, n, [n - 1, n + 1, n + 2, n - 2], optionCount(d), 1, Math.max(4, limit + 1));
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          {
            ro: `Bate din palme! Câte silabe are cuvântul „${w.w}”?`,
            en: `Clap it out! How many syllables does the word “${w.w}” (${w.en}) have?`,
          },
          w.e ? wordVisual(w) : undefined,
        ),
        type: 'choice',
        options: numberCards(values),
        correctId: `n${n}`,
      };
      return item;
    }

    case 'split': {
      const pool = ROM_WORDS.filter((w) => w.syl.length >= 2 && w.syl.length <= limit);
      const w = pick(rng, pool.filter((x) => wrongSplits(x.syl).length >= optionCount(d) - 1));
      const wrong = shuffle(rng, wrongSplits(w.syl)).slice(0, optionCount(d) - 1);
      const item: ChoiceItem = {
        ...baseFields(
          ctx,
          { ro: `Cum se desparte în silabe cuvântul „${w.w}”?`, en: `How is the word “${w.w}” (${w.en}) split into syllables?` },
          w.e ? wordVisual(w) : undefined,
        ),
        type: 'choice',
        options: shuffle(rng, [w.s, ...wrong]).map((s) => ({ id: `s_${s}`, text: { ro: s } })),
        correctId: `s_${w.s}`,
      };
      return item;
    }

    case 'build': {
      const ok = (w: RomWord) =>
        w.syl.length >= 2 && w.syl.length <= limit && new Set(w.syl).size === w.syl.length && (d >= 3 || !!w.e);
      const w = pick(rng, ROM_WORDS.filter(ok));
      const cards = w.syl.map((s, i) => ({ id: `y${i}`, text: { ro: s } }));
      let shuffled = shuffle(rng, cards);
      if (shuffled.every((c, i) => c.id === cards[i].id)) shuffled = [...shuffled.slice(1), shuffled[0]];
      const item: OrderItem = {
        ...baseFields(
          ctx,
          { ro: 'Pune silabele în ordine și formează cuvântul.', en: `Put the syllables in order to build the word (${w.en}).` },
          w.e ? wordVisual(w) : undefined,
        ),
        type: 'order',
        cards: shuffled,
        correctOrder: cards.map((c) => c.id),
      };
      return item;
    }
  }
};

registerGenerator('syllables', syllables);
