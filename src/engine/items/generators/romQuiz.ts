/**
 * `rom-quiz` generator (grades V-VIII): curated multiple-choice questions on a topic
 * (noun, caps, punct, sense, lexfamily, compound, comma, dialog, phrase, verse, verse2).
 * params: { topic: string }
 * Each entry has one correct answer and 1-3 wrong ones; the item shows the correct answer plus
 * 2 (easiest level) or up to 3 wrong ones, shuffled.
 */
import type { ChoiceItem, Item } from '../../types';
import { registerGenerator, type GeneratorFn } from './registry';
import { QUIZ } from './romGimnaziuData';
import { baseFields, optionCount, pick, shuffle } from './util';

export const romQuiz: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty } = ctx;
  const topic = typeof params.topic === 'string' ? params.topic : '';
  const pool = QUIZ[topic];
  if (!pool || pool.length === 0) throw new Error(`rom-quiz: unknown topic "${topic}" (skill ${ctx.skill.id})`);
  const e = pick(rng, pool);
  const wrong = shuffle(rng, e.wrong).slice(0, optionCount(difficulty) - 1);
  const texts = shuffle(rng, [e.correct, ...wrong]);
  const item: ChoiceItem = {
    ...baseFields(ctx, { ro: e.prompt }),
    type: 'choice',
    options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: t } })),
    correctId: `o${texts.indexOf(e.correct)}`,
  };
  return item;
};

registerGenerator('rom-quiz', romQuiz);
