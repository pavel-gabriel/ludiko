/**
 * `nat-quiz` generator (bio, fiz, chim): curated conceptual questions of one topic (= skill id).
 * params: { topic?: string }  (default: the skill id)
 * Entry kinds in the topic table: q (multiple choice), tf (true/false), m (match groups), s (sort into two
 * categories), o (put in order). Each draw picks a kind that the topic has, weighted towards choice.
 */
import type { CardContent, ChoiceItem, Item, MatchItem, OrderItem, SortItem, TrueFalseItem } from '../../types';
import { NAT_TOPICS } from './natData';
import { registerGenerator, type GeneratorFn } from './registry';
import { baseFields, optionCount, pick, shuffle, weighted } from './util';

export const natQuiz: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty: d } = ctx;
  const topicId = typeof params.topic === 'string' ? params.topic : ctx.skill.id;
  const topic = NAT_TOPICS[topicId];
  if (!topic) throw new Error(`nat-quiz: unknown topic "${topicId}" (skill ${ctx.skill.id})`);
  const kinds: [string, number][] = [];
  if (topic.q?.length) kinds.push(['q', 5]);
  if (topic.tf?.length) kinds.push(['tf', 3]);
  if (topic.m?.length) kinds.push(['m', 1.2]);
  if (topic.s?.length) kinds.push(['s', 1.2]);
  if (topic.o?.length) kinds.push(['o', 1.2]);
  if (kinds.length === 0) throw new Error(`nat-quiz: topic "${topicId}" is empty`);
  const kind = weighted(rng, kinds);

  if (kind === 'q') {
    const [prompt, correct, ...wrongAll] = pick(rng, topic.q!);
    const wrong = shuffle(rng, wrongAll).slice(0, optionCount(d) - 1);
    const texts = shuffle(rng, [correct, ...wrong]);
    const item: ChoiceItem = {
      ...baseFields(ctx, { ro: prompt }),
      type: 'choice',
      options: texts.map((t, i) => ({ id: `o${i}`, text: { ro: t } })),
      correctId: `o${texts.indexOf(correct)}`,
    };
    return item;
  }
  if (kind === 'tf') {
    const [statement, truth] = pick(rng, topic.tf!);
    const item: TrueFalseItem = { ...baseFields(ctx, { ro: `Adevărat sau fals? ${statement}` }), type: 'true-false', correct: truth };
    return item;
  }
  if (kind === 'm') {
    const group = pick(rng, topic.m!);
    const pairs = shuffle(rng, group).slice(0, d <= 1 ? 3 : 4);
    const item: MatchItem = {
      ...baseFields(ctx, { ro: 'Potrivește fiecare element din stânga cu perechea lui din dreapta.' }),
      type: 'match',
      pairs: pairs.map(([l, r], i) => ({ left: { id: `l${i}`, text: { ro: l } }, right: { id: `r${i}`, text: { ro: r } } })),
    };
    return item;
  }
  if (kind === 's') {
    const [prompt, labelA, labelB, a, b] = pick(rng, topic.s!);
    const per = d <= 1 ? 2 : 3;
    const cards: (CardContent & { categoryId: string })[] = [
      ...shuffle(rng, a).slice(0, per).map((t) => ({ id: '', text: { ro: t }, categoryId: 'a' })),
      ...shuffle(rng, b).slice(0, per).map((t) => ({ id: '', text: { ro: t }, categoryId: 'b' })),
    ];
    const item: SortItem = {
      ...baseFields(ctx, { ro: prompt }),
      type: 'sort',
      categories: [
        { id: 'a', label: { ro: labelA } },
        { id: 'b', label: { ro: labelB } },
      ],
      cards: shuffle(rng, cards.map((c, i) => ({ ...c, id: `c${i}` }))),
    };
    return item;
  }
  const [prompt, ...steps] = pick(rng, topic.o!);
  const cards: CardContent[] = steps.map((s, i) => ({ id: `s${i}`, text: { ro: s } }));
  const correctOrder = cards.map((c) => c.id);
  let shuffled = shuffle(rng, cards);
  for (let k = 0; k < 8 && shuffled.every((c, i) => c.id === correctOrder[i]); k++) shuffled = shuffle(rng, cards);
  if (shuffled.every((c, i) => c.id === correctOrder[i])) shuffled = [...cards].reverse();
  const item: OrderItem = { ...baseFields(ctx, { ro: prompt }), type: 'order', cards: shuffled, correctOrder };
  return item;
};

registerGenerator('nat-quiz', natQuiz);
