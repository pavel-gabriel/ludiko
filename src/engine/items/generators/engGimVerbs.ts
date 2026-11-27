/**
 * English verb-tense generator for grades V-VIII (curated verb phrases + morphology rules, answers computed by code).
 *
 *   eng-gim-verb { mode }   mode: present | present-q | continuous | past | past-q | past-cont | future | perfect | perfect-vs | tense-mix
 *
 * Every random draw uses the seeded rng. Instructions are bilingual; the sentences are English.
 * Distractors are always malformed or tense-inconsistent with the cue, never an equally good answer.
 */
import type { Item } from '../../types';
import {
  PHRASES, SUBJECTS, beForm, capitalise, doForm, haveForm, ingForm, naivePast, pastParticiple, pastSimple, presentForm, thirdPerson,
  type Phrase, type Subject,
} from './engGimData';
import { INSTR, L, choiceItem, gapItem, tfItem, withContent } from './engGimKit';
import { registerGenerator, type GeneratorContext, type GeneratorFn } from './registry';
import { baseFields, pick, shuffle } from './util';

/** Verbs that are not used in the continuous */
export const STATIVE = new Set(['like', 'want', 'need', 'know', 'have', 'hear']);
/** Verbs that describe something finished (already / so far) */
export const PERFECT_DONE = new Set(['write', 'eat', 'make', 'cook', 'buy', 'visit', 'read', 'paint', 'drink', 'sing', 'send', 'take', 'meet', 'fix', 'wash', 'do', 'give', 'hear', 'choose', 'watch', 'enjoy', 'try', 'plan']);
/** Verbs that go with since / for */
export const PERFECT_DURATION = new Set(['live', 'have', 'know', 'like', 'study', 'work', 'play', 'collect', 'speak', 'teach', 'wear', 'travel', 'swim', 'ride', 'shop']);

const PAST_CUES = ['yesterday', 'last week', 'two days ago', 'last summer', 'in 2019'];
const PERFECT_DURATION_CUES = ['since 2019', 'since last year', 'since Monday'];
const PERFECT_DONE_CUES = ['so far', 'so far this week'];
const PRESENT_CUES = ['every day', 'on Sundays', 'every week'];
const NOW_CUES = ['now', 'at the moment'];

const clean = (t: string) => t.replace(/\s+/g, ' ').trim();

function subjectFor(ctx: GeneratorContext): Subject {
  return pick(ctx.rng, ctx.difficulty <= 1 ? SUBJECTS.slice(0, 6) : SUBJECTS);
}

function phraseFor(ctx: GeneratorContext, ok: (v: string) => boolean): Phrase {
  return pick(ctx.rng, PHRASES.filter((p) => ok(p.v)));
}

/** "He plays football." -> text of the filled-in template without the "(verb)" hint */
const filled = (template: string, text: string): string => clean(template.replace('{{gap}}', text).replace(/\s*\([^)]*\)\s*$/, ''));

/**
 * One gap item in a randomly chosen shape: fill-gap with options (60 %), choice (20 %), true/false (20 %).
 * `template` contains {{gap}} (and usually a trailing "(verb)" hint).
 */
export function blankItem(ctx: GeneratorContext, template: string, correct: string, wrongPool: readonly string[], instr = INSTR.verb): Item {
  const r = ctx.rng();
  if (r < 0.6) return gapItem(ctx, template, correct, wrongPool, instr);
  if (r < 0.8) return choiceItem(ctx, INSTR.choose, template.replace('{{gap}}', '___'), correct, wrongPool);
  const truth = ctx.rng() < 0.5;
  const wrong = shuffle(ctx.rng, [...new Set(wrongPool)].filter((w) => w !== correct))[0];
  return tfItem(ctx, INSTR.tf, filled(template, truth ? correct : wrong), truth);
}

const wrongBe = (s: Subject, past: boolean): string => (past ? (s.first || s.third ? 'were' : 'was') : s.third ? 'are' : 'is');
const wrongDo = (s: Subject): string => (s.third ? 'do' : 'does');
const wrongHave = (s: Subject): string => (s.third ? 'have' : 'has');

/* ---- present simple ------------------------------------------------ */

function present(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = pick(ctx.rng, PHRASES);
  const v = p.v;
  const correct = presentForm(s, v);
  const wrong = [s.third ? v : thirdPerson(v), ingForm(v), pastSimple(v), `${v}s`, `${v}es`];
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest}. (${v})`, correct, wrong.filter((w) => w !== correct));
}

/* ---- present questions and negatives ------------------------------- */

function presentQ(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, (v) => v !== 'have');
  const v = p.v;
  const stmt = `${s.text} ${presentForm(s, v)} ${p.rest}.`;
  const Do = capitalise(doForm(s));
  const mode = pick(ctx.rng, ['q-choice', 'n-choice', 'q-gap', 'n-gap']);
  if (mode === 'q-choice') {
    const correct = `${Do} ${s.mid} ${v} ${p.rest}?`;
    const wrong = [
      `${capitalise(wrongDo(s))} ${s.mid} ${v} ${p.rest}?`,
      `${Do} ${s.mid} ${thirdPerson(v)} ${p.rest}?`,
      `${capitalise(s.mid)} ${v} ${p.rest}?`,
      `${Do} ${s.mid} ${ingForm(v)} ${p.rest}?`,
      `${capitalise(beForm(s, false))} ${s.mid} ${v} ${p.rest}?`,
    ];
    return choiceItem(ctx, L('Alege întrebarea corectă pentru propoziția', 'Choose the correct question for the sentence'), `"${stmt}"`, correct, wrong);
  }
  if (mode === 'n-choice') {
    const aux = `${doForm(s)}n't`;
    const correct = `${s.text} ${aux} ${v} ${p.rest}.`;
    const wrong = [
      `${s.text} ${wrongDo(s)}n't ${v} ${p.rest}.`,
      `${s.text} ${aux} ${thirdPerson(v)} ${p.rest}.`,
      `${s.text} not ${v} ${p.rest}.`,
      `${s.text} ${aux} ${ingForm(v)} ${p.rest}.`,
      `${s.text} ${beForm(s, false)}n't ${v} ${p.rest}.`,
    ];
    return choiceItem(ctx, L('Alege propoziția negativă corectă pentru', 'Choose the correct negative sentence for'), `"${stmt}"`, correct, wrong);
  }
  if (mode === 'q-gap') {
    return blankItem(ctx, `{{gap}} ${s.mid} ${v} ${p.rest}?`, Do, ['Do', 'Does', 'Is', 'Are'].filter((x) => x !== Do), INSTR.gap);
  }
  return blankItem(ctx, `${s.text} {{gap}} ${v} ${p.rest}.`, `${doForm(s)}n't`, [`${wrongDo(s)}n't`, `${beForm(s, false)}n't`, `${wrongBe(s, false)}n't`, 'not'], INSTR.gap);
}

/* ---- present continuous -------------------------------------------- */

function continuous(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, (v) => !STATIVE.has(v));
  const v = p.v;
  const be = beForm(s, false);
  const correct = `${be} ${ingForm(v)}`;
  const wrong = [`${wrongBe(s, false)} ${ingForm(v)}`, presentForm(s, v), `${be} ${v}`, ingForm(v), `${be} ${thirdPerson(v)}`];
  const lead = pick(ctx.rng, ['Look!', 'Listen!', 'now', 'at the moment']);
  const template = lead.endsWith('!') ? `${lead} ${s.text} {{gap}} ${p.rest}. (${v})` : `${s.text} {{gap}} ${p.rest} ${lead}. (${v})`;
  return blankItem(ctx, template, correct, wrong);
}

/* ---- past simple ---------------------------------------------------- */

function past(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = pick(ctx.rng, PHRASES);
  const v = p.v;
  const correct = pastSimple(v);
  const pp = pastParticiple(v);
  const wrong = [naivePast(v), thirdPerson(v), ingForm(v), v, pp];
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest} ${pick(ctx.rng, PAST_CUES)}. (${v})`, correct, wrong.filter((w) => w !== correct));
}

function pastQ(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, (v) => v !== 'have' && v !== 'do');
  const v = p.v;
  const cue = pick(ctx.rng, PAST_CUES);
  const stmt = `${s.text} ${pastSimple(v)} ${p.rest} ${cue}.`;
  const mode = pick(ctx.rng, ['q-choice', 'n-choice', 'q-gap', 'n-gap']);
  if (mode === 'q-choice') {
    const correct = `Did ${s.mid} ${v} ${p.rest} ${cue}?`;
    const wrong = [
      `Did ${s.mid} ${pastSimple(v)} ${p.rest} ${cue}?`,
      `${capitalise(doForm(s))} ${s.mid} ${v} ${p.rest} ${cue}?`,
      `${capitalise(wrongDo(s))} ${s.mid} ${v} ${p.rest} ${cue}?`,
      `${capitalise(s.mid)} ${v} ${p.rest} ${cue}?`,
      `${capitalise(beForm(s, true))} ${s.mid} ${v} ${p.rest} ${cue}?`,
    ];
    return choiceItem(ctx, L('Alege întrebarea corectă pentru propoziția', 'Choose the correct question for the sentence'), `"${stmt}"`, correct, wrong);
  }
  if (mode === 'n-choice') {
    const correct = `${s.text} didn't ${v} ${p.rest} ${cue}.`;
    const wrong = [
      `${s.text} didn't ${pastSimple(v)} ${p.rest} ${cue}.`,
      `${s.text} not ${pastSimple(v)} ${p.rest} ${cue}.`,
      `${s.text} ${doForm(s)}n't ${v} ${p.rest} ${cue}.`,
      `${s.text} ${beForm(s, true)}n't ${v} ${p.rest} ${cue}.`,
    ];
    return choiceItem(ctx, L('Alege propoziția negativă corectă pentru', 'Choose the correct negative sentence for'), `"${stmt}"`, correct, wrong);
  }
  if (mode === 'q-gap') {
    return blankItem(ctx, `{{gap}} ${s.mid} ${v} ${p.rest} ${cue}?`, 'Did', ['Do', 'Does', 'Was', 'Were', 'Is'], INSTR.gap);
  }
  return blankItem(ctx, `${s.text} {{gap}} ${v} ${p.rest} ${cue}.`, "didn't", [`${doForm(s)}n't`, `${wrongDo(s)}n't`, `${beForm(s, true)}n't`, 'not'], INSTR.gap);
}

/* ---- past continuous ------------------------------------------------ */

function pastCont(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, (v) => !STATIVE.has(v));
  const v = p.v;
  const be = beForm(s, true);
  const correct = `${be} ${ingForm(v)}`;
  const wrong = [`${wrongBe(s, true)} ${ingForm(v)}`, `${beForm(s, false)} ${ingForm(v)}`, `${be} ${v}`, ingForm(v), `${be} ${thirdPerson(v)}`];
  const form = pick(ctx.rng, ['at', 'while']);
  const template = form === 'at'
    ? `At eight o'clock yesterday, ${s.mid} {{gap}} ${p.rest}. (${v})`
    : `While ${s.mid} {{gap}} ${p.rest}, the phone rang. (${v})`;
  return blankItem(ctx, template, correct, wrong);
}

/* ---- future (will / be going to) ----------------------------------- */

function future(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, (v) => v !== 'have');
  const v = p.v;
  const be = beForm(s, false);
  const bad = wrongBe(s, false);
  const form = pick(ctx.rng, ['will', 'going', 'wont', 'notgoing']);
  let hint: string;
  let correct: string;
  let wrong: string[];
  if (form === 'will') {
    hint = `${v} – will`;
    correct = `will ${v}`;
    wrong = [`will ${thirdPerson(v)}`, `will to ${v}`, `wills ${v}`, `will ${ingForm(v)}`];
  } else if (form === 'going') {
    hint = `${v} – going to`;
    correct = `${be} going to ${v}`;
    wrong = [`${bad} going to ${v}`, `${be} going ${v}`, `${be} going to ${thirdPerson(v)}`, `${be} go to ${v}`];
  } else if (form === 'wont') {
    hint = `${v} – negative, will`;
    correct = `won't ${v}`;
    wrong = [`won't ${thirdPerson(v)}`, `will not to ${v}`, `don't will ${v}`, `not will ${v}`];
  } else {
    hint = `${v} – negative, going to`;
    correct = `${be} not going to ${v}`;
    wrong = [`${bad} not going to ${v}`, `${be} going not to ${v}`, `${be} not going ${v}`, `${be} not go to ${v}`];
  }
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest} next week. (${hint})`, correct, wrong);
}

/* ---- present perfect ------------------------------------------------ */

function perfectCue(ctx: GeneratorContext, v: string): string {
  if (PERFECT_DURATION.has(v)) return pick(ctx.rng, PERFECT_DURATION_CUES);
  return pick(ctx.rng, PERFECT_DONE_CUES);
}
const perfectVerbOk = (v: string) => PERFECT_DONE.has(v) || PERFECT_DURATION.has(v);

function perfect(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, perfectVerbOk);
  const v = p.v;
  const have = haveForm(s);
  const pp = pastParticiple(v);
  const correct = `${have} ${pp}`;
  const wrong = [`${wrongHave(s)} ${pp}`, `${have} ${v}`, `${have} ${ingForm(v)}`, `${have} ${naivePast(v)}`, `${have} ${pastSimple(v)}`];
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest} ${perfectCue(ctx, v)}. (${v})`, correct, wrong.filter((w) => w !== correct));
}

function perfectVs(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const p = phraseFor(ctx, perfectVerbOk);
  const v = p.v;
  const have = haveForm(s);
  const pp = pastParticiple(v);
  const pastForm = pastSimple(v);
  if (ctx.rng() < 0.5) {
    const cue = pick(ctx.rng, PAST_CUES);
    const wrong = [`${have} ${pp}`, v, thirdPerson(v), ingForm(v), naivePast(v)];
    return blankItem(ctx, `${s.text} {{gap}} ${p.rest} ${cue}. (${v})`, pastForm, wrong.filter((w) => w !== pastForm));
  }
  const correct = `${have} ${pp}`;
  const wrong = [pastForm, `${wrongHave(s)} ${pp}`, `${have} ${v}`, `${have} ${ingForm(v)}`];
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest} ${perfectCue(ctx, v)}. (${v})`, correct, wrong.filter((w) => w !== correct));
}

/* ---- tense mix: present / continuous / past / perfect, decided by the cue ---- */

function tenseMix(ctx: GeneratorContext): Item {
  const s = subjectFor(ctx);
  const kind = pick(ctx.rng, ['present', 'continuous', 'past', 'perfect'] as const);
  const p = phraseFor(ctx, (v) => !STATIVE.has(v) && pastSimple(v) !== v && (kind !== 'perfect' || perfectVerbOk(v)));
  const v = p.v;
  const forms = {
    present: presentForm(s, v),
    continuous: `${beForm(s, false)} ${ingForm(v)}`,
    past: pastSimple(v),
    perfect: `${haveForm(s)} ${pastParticiple(v)}`,
  };
  const cue = kind === 'present' ? pick(ctx.rng, PRESENT_CUES) : kind === 'continuous' ? pick(ctx.rng, NOW_CUES) : kind === 'past' ? pick(ctx.rng, PAST_CUES) : perfectCue(ctx, v);
  const wrong = (Object.keys(forms) as (keyof typeof forms)[]).filter((k) => k !== kind).map((k) => forms[k]);
  return blankItem(ctx, `${s.text} {{gap}} ${p.rest} ${cue}. (${v})`, forms[kind], wrong);
}

const MODES: Record<string, (ctx: GeneratorContext) => Item> = {
  present,
  'present-q': presentQ,
  continuous,
  past,
  'past-q': pastQ,
  'past-cont': pastCont,
  future,
  perfect,
  'perfect-vs': perfectVs,
  'tense-mix': tenseMix,
};

export const engGimVerb: GeneratorFn = (params, ctx): Item => {
  const mode = typeof params.mode === 'string' ? params.mode : '';
  const fn = MODES[mode];
  if (!fn) throw new Error(`eng-gim-verb: unknown mode "${mode}" (skill ${ctx.skill.id})`);
  return fn(ctx);
};

registerGenerator('eng-gim-verb', engGimVerb);

// Re-exported so other eng modules can build prompts the same way
export { baseFields, withContent };
