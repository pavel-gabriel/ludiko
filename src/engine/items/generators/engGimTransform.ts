/**
 * English curated-bank and sentence-transformation generators for grades V-VIII.
 *
 *   eng-gim-quiz     { topic }                  curated gap-fill / multiple-choice entries (content/data/eng/gim-quiz.json)
 *   eng-gim-passive  { tenses?: ('present'|'past')[] }   active -> passive (simple present and simple past)
 *   eng-gim-reported { shifts?: ('simple'|'continuous'|'will')[] }   direct -> reported speech (basic backshift)
 *   eng-gim-wordform {}                         prefixes and suffixes in context
 * Answers are computed from the verb data by the same morphology rules as eng-gim-verb. Every random draw uses the seeded rng.
 */
import type { Item } from '../../types';
import {
  PASSIVES, PHRASES, QUIZ_TOPICS, WORD_FORMS, capitalise, ingForm, naivePast, pastParticiple, pastSimple, thirdPerson,
  type PassiveEntry,
} from './engGimData';
import { INSTR, L, choiceItem, gapItem, orderItem, tfItem } from './engGimKit';
import { STATIVE, blankItem } from './engGimVerbs';
import { registerGenerator, type GeneratorContext, type GeneratorFn } from './registry';
import { pick, shuffle } from './util';

const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/* ------------------------------------------------------------------ */
/*  Quiz banks                                                         */
/* ------------------------------------------------------------------ */

export const engGimQuiz: GeneratorFn = (params, ctx): Item => {
  const topic = typeof params.topic === 'string' ? params.topic : '';
  const t = QUIZ_TOPICS[topic];
  if (!t) throw new Error(`eng-gim-quiz: unknown topic "${topic}" (skill ${ctx.skill.id})`);
  const { rng } = ctx;
  const n = t.gaps.length + t.qs.length;
  const idx = Math.floor(rng() * n);
  if (idx >= t.gaps.length) {
    const [q, c, w] = t.qs[idx - t.gaps.length];
    return choiceItem(ctx, INSTR.choose, q, c, w);
  }
  const [text, c, w] = t.gaps[idx];
  const r = rng();
  if (r < 0.5) return gapItem(ctx, text.replace('___', '{{gap}}'), c, w, INSTR.gap);
  if (r < 0.75) return choiceItem(ctx, INSTR.choose, text, c, w);
  const truth = rng() < 0.5;
  const wrong = shuffle(rng, w)[0];
  return tfItem(ctx, INSTR.tf, text.replace('___', truth ? c : wrong), truth);
};

/* ------------------------------------------------------------------ */
/*  Passive voice                                                      */
/* ------------------------------------------------------------------ */

const beP = (e: PassiveEntry, past: boolean): string => (past ? (e.pl ? 'were' : 'was') : e.pl ? 'are' : 'is');
const activeText = (e: PassiveEntry, past: boolean): string => `${e.s} ${past ? pastSimple(e.v) : e.sp ? e.v : thirdPerson(e.v)} ${e.o}.`;
const passiveText = (e: PassiveEntry, past: boolean): string => `${capitalise(e.o)} ${beP(e, past)} ${pastParticiple(e.v)} by ${e.a}.`;

export const engGimPassive: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const tenses = strArray(params.tenses);
  const allowed = tenses.length ? tenses : ['present', 'past'];
  const e = pick(rng, PASSIVES);
  const past = e.t === 'p' || !allowed.includes('present') || (allowed.includes('past') && rng() < 0.5);
  const v = e.v;
  const be = beP(e, past);
  const otherBe = past ? (e.pl ? 'are' : 'is') : e.pl ? 'were' : 'was';
  const wrongBe = e.pl ? (past ? 'was' : 'is') : past ? 'were' : 'are';
  const O = capitalise(e.o);
  const mode = pick(rng, ['choice', 'gap', 'gap', 'order', 'tf']);
  const correct = passiveText(e, past);

  if (mode === 'choice') {
    const swapped = `${capitalise(e.a)} ${e.sp ? (past ? 'were' : 'are') : past ? 'was' : 'is'} ${pastParticiple(v)} by ${e.o}.`;
    const wrong = [
      `${O} ${wrongBe} ${pastParticiple(v)} by ${e.a}.`,
      `${O} ${be} ${v} by ${e.a}.`,
      `${O} ${otherBe} ${pastParticiple(v)} by ${e.a}.`,
      `${O} ${be} ${ingForm(v)} by ${e.a}.`,
      swapped,
    ];
    return choiceItem(ctx, L('Alege propoziția la diateza pasivă pentru', 'Choose the passive sentence for'), `"${activeText(e, past)}"`, correct, wrong);
  }
  if (mode === 'order') {
    const tokens = correct.split(' ');
    if (new Set(tokens.map((t) => t.replace('.', '').toLowerCase())).size === tokens.length) return orderItem(ctx, tokens);
  }
  const cue = past ? 'last year' : 'every year';
  if (mode === 'tf') {
    const truth = rng() < 0.5;
    const shown = truth ? correct : `${O} ${wrongBe} ${pastParticiple(v)} by ${e.a}.`;
    return tfItem(ctx, INSTR.tf, `${shown.replace(/\.$/, '')} ${cue}.`, truth);
  }
  const wrongPool = [`${wrongBe} ${pastParticiple(v)}`, `${be} ${v}`, `${otherBe} ${pastParticiple(v)}`, `${be} ${ingForm(v)}`];
  return blankItem(ctx, `${O} {{gap}} by ${e.a} ${cue}. (${v})`, `${be} ${pastParticiple(v)}`, wrongPool.filter((w) => w !== `${be} ${pastParticiple(v)}`), L('Completează cu forma pasivă a verbului din paranteză.', 'Complete with the passive form of the verb in brackets.'));
};

/* ------------------------------------------------------------------ */
/*  Reported speech                                                    */
/* ------------------------------------------------------------------ */

const SPEAKERS: { name: string; pron: string }[] = [
  { name: 'Tom', pron: 'he' },
  { name: 'Dan', pron: 'he' },
  { name: 'Alex', pron: 'he' },
  { name: 'Maria', pron: 'she' },
  { name: 'Ana', pron: 'she' },
  { name: 'Ioana', pron: 'she' },
];

export const engGimReported: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const shifts = strArray(params.shifts);
  const kinds = shifts.length ? shifts : ['simple', 'continuous', 'will'];
  const kind = pick(rng, kinds);
  const sp = pick(rng, SPEAKERS);
  const p = pick(rng, PHRASES.filter((x) => kind !== 'continuous' || !STATIVE.has(x.v)));
  const v = p.v;
  const intro = `${sp.name} said that ${sp.pron}`;
  let direct: string;
  let correct: string;
  let wrong: string[];
  if (kind === 'simple') {
    direct = `I ${v} ${p.rest}.`;
    correct = `${intro} ${pastSimple(v)} ${p.rest}.`;
    wrong = [`${sp.name} said that I ${pastSimple(v)} ${p.rest}.`, `${intro} ${v} ${p.rest}.`, `${intro} has ${pastParticiple(v)} ${p.rest}.`, `${intro} was ${ingForm(v)} ${p.rest}.`, `${intro} ${naivePast(v)} ${p.rest}.`];
  } else if (kind === 'continuous') {
    direct = `I am ${ingForm(v)} ${p.rest}.`;
    correct = `${intro} was ${ingForm(v)} ${p.rest}.`;
    wrong = [`${intro} ${pastSimple(v)} ${p.rest}.`, `${intro} has been ${ingForm(v)} ${p.rest}.`, `${intro} were ${ingForm(v)} ${p.rest}.`, `${sp.name} said that I was ${ingForm(v)} ${p.rest}.`];
  } else {
    direct = `I will ${v} ${p.rest}.`;
    correct = `${intro} would ${v} ${p.rest}.`;
    wrong = [`${intro} would ${thirdPerson(v)} ${p.rest}.`, `${intro} woulds ${v} ${p.rest}.`, `${intro} would to ${v} ${p.rest}.`, `${sp.name} said that I would ${v} ${p.rest}.`];
  }
  const mode = pick(rng, ['choice', 'choice', 'gap', 'tf']);
  const said = `${sp.name} said: "${direct}"`;
  if (mode === 'choice') return choiceItem(ctx, L('Alege propoziția corectă la vorbirea indirectă pentru', 'Choose the correct reported sentence for'), said, correct, wrong);
  if (mode === 'tf') {
    const truth = rng() < 0.5;
    return tfItem(ctx, INSTR.tf, `${said} → ${truth ? correct : shuffle(rng, wrong)[0]}`, truth);
  }
  // gap on the verb group
  const head = `${intro} `;
  const verbGroup = correct.slice(head.length, correct.length - 1 - p.rest.length).trim();
  const wrongGroups = wrong
    .filter((w) => w.startsWith(head))
    .map((w) => w.slice(head.length, w.length - 1 - p.rest.length).trim());
  return blankItem(ctx, `${said} → ${intro} {{gap}} ${p.rest}. (${v})`, verbGroup, wrongGroups.filter((g) => g !== verbGroup), L('Completează propoziția la vorbirea indirectă.', 'Complete the reported sentence.'));
};

/* ------------------------------------------------------------------ */
/*  Word formation                                                     */
/* ------------------------------------------------------------------ */

export const engGimWordForm: GeneratorFn = (_params, ctx): Item => {
  const e = pick(ctx.rng, WORD_FORMS);
  return blankItem(ctx, e.sentence.replace('___', '{{gap}}'), e.c, e.w, L('Completează cu forma corectă a cuvântului din paranteză.', 'Complete with the correct form of the word in brackets.'));
};

registerGenerator('eng-gim-quiz', engGimQuiz);
registerGenerator('eng-gim-passive', engGimPassive);
registerGenerator('eng-gim-reported', engGimReported);
registerGenerator('eng-gim-wordform', engGimWordForm);

export type { GeneratorContext };
