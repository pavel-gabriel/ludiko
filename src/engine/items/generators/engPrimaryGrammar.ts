/**
 * English primary (`eng`, grades 0-IV) generators over curated banks:
 *
 * `eng-primary-grammar`  params: { topics: string[], grades?: [min, max], kinds?: ('gap'|'translate'|'tf'|'order')[] }
 *   gap        fill-gap with options (to be, can, likes, prepositions, have got, present, plurals, articles, ...)
 *   translate  choose the English sentence that means a given Romanian sentence (wrong ones are the same
 *              sentence with a wrong word)
 *   tf         "does this English sentence mean ...?" true or false
 *   order      put the words in order (only sentences whose words are all different)
 *   opposites  (topic 'opposites') choose the opposite of an adjective
 * `eng-primary-greet`    params: { grades?: [min, max], kinds?: ('situation'|'en-to-ro'|'ro-to-en'|'match')[] }
 * `eng-primary-read`     params: { grades?: [min, max] }  short text + 3 questions (read-and-answer)
 *
 * Every wrong option is wrong for the Romanian meaning shown with the sentence (see the notes in
 * content/data/eng/primary-grammar.json).
 */
import type { ChoiceItem, FillGapItem, Item, MatchItem, OrderItem, ReadAndAnswerItem, TrueFalseItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import {
  ENG_GREETINGS,
  ENG_OPPOSITES,
  ENG_READING,
  ENG_SENTENCES,
  greetingsClash,
  type EngGreeting,
  type EngSentence,
} from './engPrimaryData';
import { baseFields, chance, optionCount, pick, shuffle, type Rng } from './util';

type GKind = 'gap' | 'translate' | 'tf' | 'order';
const GKINDS: GKind[] = ['gap', 'translate', 'tf', 'order'];

function paramGrades(params: Record<string, unknown>, fallbackMax: number): [number, number] {
  const v = params.grades;
  if (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number')) return [v[0] as number, v[1] as number];
  return [0, fallbackMax];
}

function paramGKinds(params: Record<string, unknown>): GKind[] {
  const v = params.kinds;
  const kinds = Array.isArray(v) ? (v.filter((k) => GKINDS.includes(k as GKind)) as GKind[]) : [];
  return kinds.length ? kinds : ['gap'];
}

const fill = (s: EngSentence, word: string): string => s.template.replace('{{gap}}', word);

/** Tokens of a sentence, or null when a word repeats (the order would be ambiguous) */
export function orderTokens(full: string): string[] | null {
  const tokens = full.split(' ');
  const keys = tokens.map((t) => t.toLowerCase().replace(/[.,!?]/g, ''));
  return new Set(keys).size === keys.length ? tokens : null;
}

export const engPrimaryGrammar: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d, skill } = ctx;

  /* adjective opposites (grade IV) */
  if (params.topics && Array.isArray(params.topics) && params.topics.includes('opposites')) {
    const pairs = ENG_OPPOSITES.filter((p) => p.g <= skill.grade);
    const p = pick(rng, pairs);
    const [given, answer] = chance(rng, 0.5) ? [p.a, p.b] : [p.b, p.a];
    const words = pairs.flatMap((x) => [x.a, x.b]).filter((w) => w !== given && w !== answer);
    // never offer a word that is itself a pair partner of the given word
    const partners = pairs.filter((x) => x.a === given || x.b === given).flatMap((x) => [x.a, x.b]);
    const wrong = shuffle(rng, words.filter((w) => !partners.includes(w))).slice(0, optionCount(d) - 1);
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: `Care este opusul lui «${given}»?`, en: `What is the opposite of «${given}»?` }),
      type: 'choice',
      options: shuffle(rng, [answer, ...wrong]).map((w) => ({ id: `o_${w}`, text: { ro: w } })),
      correctId: `o_${answer}`,
    };
    return item;
  }

  const topics = Array.isArray(params.topics) ? (params.topics as string[]) : [];
  const [lo, hi] = paramGrades(params, skill.grade);
  const pool = ENG_SENTENCES.filter((s) => topics.includes(s.topic) && s.grade >= lo && s.grade <= hi);
  const kind = pick(rng, paramGKinds(params));
  let s = pick(rng, pool);

  switch (kind) {
    case 'gap': {
      const options = shuffle(rng, [s.answer, ...shuffle(rng, s.wrong).slice(0, optionCount(d) - 1)]);
      const item: FillGapItem = {
        ...baseFields(ctx, { ro: `Completează propoziția. Sens: „${s.ro}”`, en: `Complete the sentence. Meaning: “${s.ro}”` }),
        type: 'fill-gap',
        template: { ro: s.template, en: s.template },
        options,
        correct: s.answer,
      };
      return item;
    }

    case 'translate': {
      const wrong = shuffle(rng, s.wrong).slice(0, optionCount(d) - 1).map((w) => fill(s, w));
      const options = shuffle(rng, [s.full, ...wrong]);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Care propoziție înseamnă „${s.ro}”?`, en: `Which sentence means “${s.ro}”?` }),
        type: 'choice',
        options: options.map((o) => ({ id: `s_${o}`, text: { ro: o } })),
        correctId: `s_${s.full}`,
      };
      return item;
    }

    case 'tf': {
      const isTrue = chance(rng, 0.5);
      const shown = isTrue ? s.full : fill(s, pick(rng, s.wrong));
      const item: TrueFalseItem = {
        ...baseFields(ctx, { ro: `„${shown}” înseamnă „${s.ro}”. Adevărat sau fals?`, en: `“${shown}” means “${s.ro}”. True or false?` }),
        type: 'true-false',
        correct: isTrue,
      };
      return item;
    }

    case 'order': {
      // only sentences with all-different words; prefer short ones at the easiest levels
      const orderable = pool.filter((x) => {
        const t = orderTokens(x.full);
        return t !== null && t.length >= 3 && t.length <= 8 && (d > 1 || t.length <= 5);
      });
      if (orderable.length) s = pick(rng, orderable);
      const tokens = orderTokens(s.full) ?? s.full.split(' ');
      const cards = tokens.map((t, i) => ({ id: `w${i}`, text: { ro: t } }));
      const item: OrderItem = {
        ...baseFields(ctx, { ro: `Pune cuvintele în ordine ca să formezi o propoziție. Sens: „${s.ro}”`, en: `Put the words in order to make a sentence. Meaning: “${s.ro}”` }),
        type: 'order',
        cards: shuffle(rng, cards),
        correctOrder: cards.map((c) => c.id),
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-grammar', engPrimaryGrammar);

/* ------------------------------------------------------------------ */
/*  Greetings and introductions                                        */
/* ------------------------------------------------------------------ */

type RKind = 'situation' | 'en-to-ro' | 'ro-to-en' | 'match';
const RKINDS: RKind[] = ['situation', 'en-to-ro', 'ro-to-en', 'match'];

function greetDistractors(rng: Rng, target: EngGreeting, count: number, known: readonly EngGreeting[]): EngGreeting[] {
  const out: EngGreeting[] = [];
  for (const g of shuffle(rng, known)) {
    if (out.length >= count) break;
    if (!greetingsClash(target, g)) out.push(g);
  }
  return out;
}

export const engPrimaryGreet: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d, skill } = ctx;
  const [lo, hi] = paramGrades(params, skill.grade);
  const known = ENG_GREETINGS.filter((g) => g.grade <= skill.grade);
  const pool = ENG_GREETINGS.filter((g) => g.grade >= lo && g.grade <= hi);
  const v = params.kinds;
  const kinds = (Array.isArray(v) ? v.filter((k) => RKINDS.includes(k as RKind)) : ['situation']) as RKind[];
  const kind = pick(rng, kinds.length ? kinds : (['situation'] as RKind[]));
  const n = optionCount(d);

  switch (kind) {
    case 'situation': {
      const target = pick(rng, pool.filter((g) => g.situation));
      const wrong = greetDistractors(rng, target, n - 1, known);
      const sit = target.situation as { ro: string; en: string };
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: sit.ro, en: sit.en }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((g) => ({ id: `g_${g.intent}`, text: { ro: g.en } })),
        correctId: `g_${target.intent}`,
      };
      return item;
    }
    case 'en-to-ro': {
      const target = pick(rng, pool);
      const wrong = greetDistractors(rng, target, n - 1, known);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Ce înseamnă «${target.en}»?`, en: `What does «${target.en}» mean?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((g) => ({ id: `g_${g.intent}`, text: { ro: g.ro } })),
        correctId: `g_${target.intent}`,
      };
      return item;
    }
    case 'ro-to-en': {
      const target = pick(rng, pool);
      const wrong = greetDistractors(rng, target, n - 1, known);
      const item: ChoiceItem = {
        ...baseFields(ctx, { ro: `Cum se spune „${target.ro}” în engleză?`, en: `How do you say “${target.ro}” in English?` }),
        type: 'choice',
        options: shuffle(rng, [target, ...wrong]).map((g) => ({ id: `g_${g.intent}`, text: { ro: g.en } })),
        correctId: `g_${target.intent}`,
      };
      return item;
    }
    case 'match': {
      const first = pick(rng, pool);
      const rest: EngGreeting[] = [];
      for (const g of shuffle(rng, known)) {
        if (rest.length >= (d >= 3 ? 3 : 2)) break;
        if (g.intent !== first.intent && [first, ...rest].every((o) => !greetingsClash(o, g))) rest.push(g);
      }
      const item: MatchItem = {
        ...baseFields(ctx, { ro: 'Potrivește fiecare expresie englezească cu sensul ei.', en: 'Match each English phrase with its meaning.' }),
        type: 'match',
        pairs: [first, ...rest].map((g) => ({ left: { id: `t_${g.intent}`, text: { ro: g.en } }, right: { id: `r_${g.intent}`, text: { ro: g.ro } } })),
      };
      return item;
    }
  }
};

registerGenerator('eng-primary-greet', engPrimaryGreet);

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

export const engPrimaryRead: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d, skill } = ctx;
  const [lo, hi] = paramGrades(params, skill.grade);
  const text = pick(rng, ENG_READING.filter((t) => t.g >= lo && t.g <= hi));
  const chosen = shuffle(rng, text.q.map((q, i) => ({ q, i }))).slice(0, d <= 1 ? 2 : 3);
  chosen.sort((a, b) => a.i - b.i);

  const questions = chosen.map(({ q, i }) => {
    const common = {
      id: `q${i}`,
      skillId: skill.id,
      difficulty: ctx.difficulty,
      reviewStatus: 'auto-checked' as const,
      provenance: { id: `gen.${skill.id}.q${i}`, kind: 'item' as const, title: 'Generated question', author: 'Ludiko', source: 'generated' as const, licence: 'OWN' as const },
    };
    if ('tf' in q) {
      const tf: TrueFalseItem = {
        ...common,
        type: 'true-false',
        prompt: { ro: `Adevărat sau fals? „${q.s}”`, en: `True or false? “${q.s}”` },
        correct: q.tf,
      };
      return tf;
    }
    const answers = shuffle(rng, [q.a, ...shuffle(rng, q.x).slice(0, optionCount(d) - 1)]);
    const choice: ChoiceItem = {
      ...common,
      type: 'choice',
      prompt: { ro: q.ro, en: q.en },
      options: answers.map((a, k) => ({ id: `o${k}`, text: { ro: a } })),
      correctId: `o${answers.indexOf(q.a)}`,
    };
    return choice;
  });

  const item: ReadAndAnswerItem = {
    ...baseFields(ctx, { ro: `Citește textul „${text.title}” și răspunde la întrebări.`, en: `Read the text “${text.title}” and answer the questions.` }),
    type: 'read-and-answer',
    passage: { ro: text.text, en: text.text },
    questions,
  };
  return item;
};

registerGenerator('eng-primary-read', engPrimaryRead);
