/**
 * Item builders shared by the English (eng-gim-*) generators.
 * Instructions are bilingual (ro + en); the English content (sentences, words) sits inside the prompt.
 */
import type { CardContent, ChoiceItem, FillGapItem, LocalizedText, MatchItem, OrderItem, SortItem, TrueFalseItem } from '../../types';
import type { GeneratorContext } from './registry';
import { baseFields, optionCount, shuffle } from './util';

export const L = (ro: string, en?: string): LocalizedText => (en ? { ro, en } : { ro });

/** Instruction texts; a choice/true-false prompt is "<instruction>: <English content>" in both languages */
export const INSTR = {
  verb: L('Completează cu forma corectă a verbului din paranteză.', 'Complete with the correct form of the verb in brackets.'),
  gap: L('Completează propoziția.', 'Complete the sentence.'),
  choose: L('Alege varianta corectă', 'Choose the correct option'),
  tf: L('Adevărat sau fals? Propoziția este corectă', 'True or false? The sentence is correct'),
  tfFact: L('Adevărat sau fals', 'True or false'),
  order: L('Pune cuvintele în ordinea corectă.', 'Put the words in the correct order.'),
  match: L('Potrivește perechile.', 'Match the pairs.'),
  sort: L('Așază fiecare cuvânt în grupa lui.', 'Put each word in its group.'),
} as const;

/** "instruction: content" for both languages (content is English) */
export const withContent = (instr: LocalizedText, content: string): LocalizedText => ({
  ro: `${instr.ro}: ${content}`,
  en: `${instr.en ?? instr.ro}: ${content}`,
});

/** Distinct wrong options, never equal to the correct one, first `n` after shuffling */
export function pickWrong(ctx: GeneratorContext, correct: string, pool: readonly string[], n: number): string[] {
  const out: string[] = [];
  for (const w of shuffle(ctx.rng, [...new Set(pool)])) {
    if (out.length >= n) break;
    if (w !== correct && w.trim() !== '') out.push(w);
  }
  if (out.length < n) throw new Error(`eng-gim: only ${out.length} distinct wrong options for "${correct}" (skill ${ctx.skill.id})`);
  return out;
}

export function gapItem(ctx: GeneratorContext, template: string, correct: string, wrongPool: readonly string[], instr: LocalizedText = INSTR.verb): FillGapItem {
  const wrong = pickWrong(ctx, correct, wrongPool, optionCount(ctx.difficulty) - 1);
  return {
    ...baseFields(ctx, instr),
    type: 'fill-gap',
    template: L(template, template),
    options: shuffle(ctx.rng, [correct, ...wrong]),
    correct,
  };
}

export function choiceItem(ctx: GeneratorContext, instr: LocalizedText, content: string, correct: string, wrongPool: readonly string[]): ChoiceItem {
  const wrong = pickWrong(ctx, correct, wrongPool, optionCount(ctx.difficulty) - 1);
  const all = shuffle(ctx.rng, [correct, ...wrong]);
  return {
    ...baseFields(ctx, withContent(instr, content)),
    type: 'choice',
    options: all.map((o, i) => ({ id: `o${i}`, text: L(o, o) })),
    correctId: `o${all.indexOf(correct)}`,
  };
}

export const tfItem = (ctx: GeneratorContext, instr: LocalizedText, content: string, correct: boolean): TrueFalseItem => ({
  ...baseFields(ctx, withContent(instr, content)),
  type: 'true-false',
  correct,
});

export function matchItem(ctx: GeneratorContext, pairs: { l: string; r: string; rEn?: boolean }[], instr: LocalizedText = INSTR.match): MatchItem {
  return {
    ...baseFields(ctx, instr),
    type: 'match',
    pairs: pairs.map((p, i) => ({ left: { id: `l${i}`, text: L(p.l, p.l) }, right: { id: `r${i}`, text: p.rEn ? L(p.r, p.r) : L(p.r) } })),
  };
}

export function sortItem(ctx: GeneratorContext, instr: LocalizedText, cats: { id: string; label: LocalizedText }[], cards: { text: string; cat: string }[]): SortItem {
  return {
    ...baseFields(ctx, instr),
    type: 'sort',
    categories: cats,
    cards: shuffle(ctx.rng, cards).map((c, i) => ({ id: `k${i}`, text: L(c.text, c.text), categoryId: c.cat })),
  };
}

/** Order item: cards are the tokens; a shuffle equal to the answer is re-drawn */
export function orderItem(ctx: GeneratorContext, tokens: string[], instr: LocalizedText = INSTR.order): OrderItem {
  const ids = tokens.map((_, i) => `c${i}`);
  let idx = ids;
  for (let tries = 0; tries < 20; tries++) {
    idx = shuffle(ctx.rng, ids);
    if (idx.join() !== ids.join()) break;
  }
  const cards: CardContent[] = idx.map((id) => ({ id, text: L(tokens[Number(id.slice(1))], tokens[Number(id.slice(1))]) }));
  return { ...baseFields(ctx, instr), type: 'order', cards, correctOrder: ids };
}

/** Template text with the blank shown as ___ (for choice/true-false prompts) */
export const blank = (template: string): string => template.replace('{{gap}}', '___');
