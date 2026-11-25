/**
 * Sentence generators (Romanian, grade I).
 *   `sentence-order`  put word cards in order to form a sentence (params: { maxWords? })
 *   `punctuation`     choose the closing mark . ? ! (params: { marks?: ('.' | '?' | '!')[] })
 * Sentences come from the original list in content/data/rom/sentences.json.
 */
import type { ChoiceItem, FillGapItem, Item, OrderItem } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { EXCLAMATIONS, ORDER_SENTENCES, QUESTIONS, STATEMENTS } from './romData';
import { baseFields, chance, paramInt, pick, shuffle } from './util';

/* ---- sentence order ------------------------------------------------ */

const wordsOf = (s: string): string[] => s.split(' ');

export const sentenceOrder: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const cap = paramInt(params, 'maxWords', d <= 1 ? 4 : d <= 2 ? 5 : d <= 3 ? 6 : 8);
  const fitting = ORDER_SENTENCES.filter((s) => wordsOf(s).length <= cap);
  const sentence = pick(rng, fitting.length ? fitting : ORDER_SENTENCES);
  const words = wordsOf(sentence);
  const cards = words.map((w, i) => ({ id: `w${i}`, text: { ro: w } }));
  let shuffled = shuffle(rng, cards);
  if (shuffled.every((c, i) => c.id === cards[i].id)) shuffled = [...shuffled.slice(1), shuffled[0]];
  const item: OrderItem = {
    ...baseFields(ctx, {
      ro: 'Pune cuvintele în ordine și formează propoziția.',
      en: 'Put the words in order to make a sentence.',
    }),
    type: 'order',
    cards: shuffled,
    correctOrder: cards.map((c) => c.id),
  };
  return item;
};

/* ---- punctuation --------------------------------------------------- */

type Mark = '.' | '?' | '!';
const MARKS: Mark[] = ['.', '?', '!'];

const SOURCES: Record<Mark, readonly string[]> = { '.': STATEMENTS, '?': QUESTIONS, '!': EXCLAMATIONS };
/** A mark that is clearly wrong for a sentence of the given kind */
const WRONG_MARK: Record<Mark, Mark> = { '.': '?', '?': '.', '!': '?' };

function paramMarks(params: Record<string, unknown>): Mark[] {
  const v = params.marks;
  const marks = Array.isArray(v) ? (v.filter((m) => MARKS.includes(m as Mark)) as Mark[]) : [];
  return marks.length >= 2 ? marks : MARKS;
}

export const punctuation: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  /* at the easiest level only statements and questions */
  const marks = d <= 1 ? paramMarks(params).filter((m) => m !== '!') : paramMarks(params);
  const usable = marks.length >= 2 ? marks : paramMarks(params);

  if (d >= 3 && usable.length >= 3 && chance(rng, 0.5)) {
    /* "Which sentence is written correctly?" — one correct, two with a wrong mark */
    const order = shuffle(rng, usable);
    const texts = order.map((m) => pick(rng, SOURCES[m]));
    const correctIdx = Math.floor(rng() * order.length);
    const options = order.map((m, i) => {
      const mark = i === correctIdx ? m : WRONG_MARK[m];
      return { id: `o${i}`, text: { ro: `${texts[i]}${mark}` } };
    });
    const item: ChoiceItem = {
      ...baseFields(ctx, {
        ro: 'Care propoziție este scrisă corect?',
        en: 'Which sentence is written correctly?',
      }),
      type: 'choice',
      options,
      correctId: `o${correctIdx}`,
    };
    return item;
  }

  const mark = pick(rng, usable);
  const text = pick(rng, SOURCES[mark]);
  const template = `${text}{{gap}}`;
  const item: FillGapItem = {
    ...baseFields(ctx, {
      ro: 'Ce semn punem la sfârșitul propoziției: . ? sau !',
      en: 'Which mark goes at the end of the sentence: . ? or !',
    }),
    type: 'fill-gap',
    template: { ro: template, en: template },
    options: usable,
    correct: mark,
  };
  return item;
};

registerGenerator('sentence-order', sentenceOrder);
registerGenerator('punctuation', punctuation);
