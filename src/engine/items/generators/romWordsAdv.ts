/**
 * Upgrade of the `word-relations` generator for grades V-VIII (called from romVocab.ts).
 *   { relation: 'synonym' | 'antonym', level: 'gimnaziu' }  harder word pairs
 *   { relation: 'paronym' }  pick the right look-alike word for a sentence (fill-gap)
 *   { relation: 'homonym' }  "in which sentence does the word have the same meaning as in ...?"
 * Curated data: content/data/rom/vocab-gimnaziu.json.
 */
import type { ChoiceItem, FillGapItem, Item } from '../../types';
import type { GeneratorFn } from './registry';
import { GIM_ANTONYMS, GIM_SYNONYMS, HOMONYMS, PARONYMS, capitalize, type WordPair } from './romGimVocabData';
import { baseFields, optionCount, pick, shuffle } from './util';

/* ---- synonyms / antonyms (gimnaziu) -------------------------------- */

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
  for (const [a, b] of [...GIM_ANTONYMS, ...GIM_SYNONYMS]) parent.set(find(a), find(b));
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

const relationItem: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const relation = params.relation === 'synonym' ? 'synonym' : 'antonym';
  const pairs: readonly WordPair[] = relation === 'synonym' ? GIM_SYNONYMS : GIM_ANTONYMS;

  const [x, y] = pick(rng, pairs);
  const [given, answer] = rng() < 0.5 ? [x, y] : [y, x];

  const cluster = CLUSTER.get(given);
  const sameKind = ALL_WORDS.filter((w) => isVerb(w) === isVerb(given) && CLUSTER.get(w) !== cluster);
  const need = optionCount(d) - 1;
  const poolWords = sameKind.length >= need ? sameKind : ALL_WORDS.filter((w) => CLUSTER.get(w) !== cluster);
  const wrong: string[] = [];
  for (const w of shuffle(rng, poolWords)) {
    if (wrong.length >= need) break;
    if (!wrong.some((o) => CLUSTER.get(o) === CLUSTER.get(w))) wrong.push(w);
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

/* ---- paronyms ------------------------------------------------------ */

const paronymItem: GeneratorFn = (_params, ctx): Item => {
  const { rng } = ctx;
  const e = pick(rng, PARONYMS);
  const upper = e.t.startsWith('{{gap}}');
  const fix = (w: string) => (upper ? capitalize(w) : w);
  const item: FillGapItem = {
    ...baseFields(ctx, {
      ro: 'Alege cuvântul potrivit pentru propoziție.',
      en: 'Choose the word that fits the sentence.',
    }),
    type: 'fill-gap',
    template: { ro: e.t, en: e.t },
    options: shuffle(rng, [fix(e.correct), fix(e.wrong)]),
    correct: fix(e.correct),
  };
  return item;
};

/* ---- homonyms ------------------------------------------------------ */

const homonymItem: GeneratorFn = (_params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const h = pick(rng, HOMONYMS);
  const senseIdx = Math.floor(rng() * h.senses.length);
  const [ref, answer] = shuffle(rng, h.senses[senseIdx]);
  const others = h.senses.flatMap((s, i) => (i === senseIdx ? [] : s));
  const want = Math.min(optionCount(d) - 1, others.length);
  const wrong = shuffle(rng, others).slice(0, want);
  const options = shuffle(rng, [answer, ...wrong]);
  const item: ChoiceItem = {
    ...baseFields(ctx, {
      ro: `În care propoziție cuvântul „${h.w}” are același sens ca în propoziția: „${ref}”?`,
      en: `In which sentence does the word “${h.w}” have the same meaning as in: “${ref}”?`,
    }),
    type: 'choice',
    options: options.map((t, i) => ({ id: `s${i}`, text: { ro: t } })),
    correctId: `s${options.indexOf(answer)}`,
  };
  return item;
};

/** Entry point used by `word-relations` when params ask for the V-VIII relations */
export const wordRelationsAdv: GeneratorFn = (params, ctx): Item => {
  if (params.relation === 'paronym') return paronymItem(params, ctx);
  if (params.relation === 'homonym') return homonymItem(params, ctx);
  return relationItem(params, ctx);
};

/** True when `word-relations` params belong to the V-VIII upgrade */
export const isAdvancedRelation = (params: Record<string, unknown>): boolean =>
  params.level === 'gimnaziu' || params.relation === 'paronym' || params.relation === 'homonym';
