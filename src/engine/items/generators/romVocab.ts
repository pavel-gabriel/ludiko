/**
 * `word-relations` generator: antonyms and synonyms (Romanian vocabulary, grades I–II).
 * params: { relation: 'antonym' | 'synonym' }
 * Distractors never belong to the same meaning cluster as the target or the answer, so exactly
 * one option is right even when a word has both a synonym and an antonym.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { ANTONYMS, SYNONYMS, type WordPair } from './romData';
import { baseFields, optionCount, pick, shuffle } from './util';

/** word -> id of its connected component over both relations */
function buildClusters(): Map<string, number> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r) as string;
    parent.set(x, r);
    return r;
  };
  for (const [a, b] of [...ANTONYMS, ...SYNONYMS]) parent.set(find(a), find(b));
  const ids = new Map<string, number>();
  const out = new Map<string, number>();
  for (const w of parent.keys()) {
    const root = find(w);
    if (!ids.has(root)) ids.set(root, ids.size);
    out.set(w, ids.get(root) as number);
  }
  return out;
}

const CLUSTER = buildClusters();
const ALL_WORDS: string[] = [...CLUSTER.keys()];
const isVerb = (w: string): boolean => w.startsWith('a ');

export const wordRelations: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const relation = params.relation === 'synonym' ? 'synonym' : 'antonym';
  const pairs: readonly WordPair[] = relation === 'synonym' ? SYNONYMS : ANTONYMS;

  const [x, y] = pick(rng, pairs);
  const [given, answer] = rng() < 0.5 ? [x, y] : [y, x];

  const cluster = CLUSTER.get(given);
  const sameKind = ALL_WORDS.filter((w) => isVerb(w) === isVerb(given) && CLUSTER.get(w) !== cluster);
  const need = optionCount(d) - 1;
  const poolWords = sameKind.length >= need ? sameKind : ALL_WORDS.filter((w) => CLUSTER.get(w) !== cluster);
  const wrong: string[] = [];
  for (const w of shuffle(rng, poolWords)) {
    if (wrong.length >= need) break;
    if (CLUSTER.get(w) !== cluster && !wrong.some((o) => CLUSTER.get(o) === CLUSTER.get(w))) wrong.push(w);
  }

  const prompt =
    relation === 'antonym'
      ? { ro: `Care cuvânt are sens opus cu „${given}”?`, en: `Which word means the opposite of “${given}”?` }
      : { ro: `Care cuvânt are același sens cu „${given}”?`, en: `Which word means the same as “${given}”?` };

  const item: ChoiceItem = {
    ...baseFields(ctx, prompt),
    type: 'choice',
    options: shuffle(rng, [answer, ...wrong]).map((w) => ({ id: `v_${w}`, text: { ro: w } })),
    correctId: `v_${answer}`,
  };
  return item;
};

registerGenerator('word-relations', wordRelations);
