/**
 * English word-level generators for grades V-VIII (curated datasets in content/data/eng/gim-*.json).
 *
 *   eng-gim-irregular { set: 'A'|'B'|'AB', ask?: ('past'|'pp')[] }   irregular verbs: past / participle / match / sort / true-false
 *   eng-gim-noun      { mode: 'plural'|'article'|'countable' }       plurals, a/an, countable vs uncountable, much/many
 *   eng-gim-adj       { mode?: 'comparative'|'superlative'|'mix' }   comparatives and superlatives
 *   eng-gim-vocab     { topics: string[] }                           vocabulary by topic: choice, match, odd-one-out, sort, true-false
 *   eng-gim-order     { grades: number[], kinds?: ('s'|'n'|'q')[] }  put the words of a sentence in order
 * Every random draw uses the seeded rng.
 */
import type { Item } from '../../types';
import {
  ADJECTIVES, IRREGULAR, NOUNS, ORDER_SENTENCES, PHRASES, REGULAR, SUBJECTS, UNCOUNTABLE, VOCAB_TOPICS, articleForAdjective,
  haveForm, ingForm, naivePast, pastParticiple, pastSimple, thirdPerson, type Adjective, type IrregularVerb, type Noun, type VocabTopic,
} from './engGimData';
import { INSTR, L, choiceItem, matchItem, orderItem, sortItem, tfItem } from './engGimKit';
import { blankItem } from './engGimVerbs';
import { registerGenerator, type GeneratorContext, type GeneratorFn } from './registry';
import { optionCount, pick, shuffle } from './util';

const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/* ------------------------------------------------------------------ */
/*  Irregular verbs                                                    */
/* ------------------------------------------------------------------ */

function irregularPool(set: string): IrregularVerb[] {
  return IRREGULAR.filter((v) => v.b !== 'be' && (set === 'AB' || v.set === set));
}

export const engGimIrregular: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const set = typeof params.set === 'string' ? params.set : 'AB';
  const ask = strArray(params.ask);
  const askPp = ask.includes('pp');
  const askPast = ask.length === 0 || ask.includes('past');
  const pool = irregularPool(set);
  const v = pick(rng, pool);
  const others = pool.filter((o) => o.b !== v.b);
  const modes: string[] = [];
  if (askPast) modes.push('past-choice', 'past-gap', 'tf', 'match', 'sort', 'base-choice');
  if (askPp) modes.push('pp-choice', 'pp-gap', 'tf-pp', 'match-pp');
  const mode = pick(rng, modes);

  if (mode === 'past-choice') {
    return choiceItem(ctx, INSTR.choose, `What is the past simple of "${v.b}"?`, v.p, [naivePast(v.b), v.pp, ...others.map((o) => o.p), v.b]);
  }
  if (mode === 'pp-choice') {
    return choiceItem(ctx, INSTR.choose, `What is the past participle of "${v.b}"?`, v.pp, [naivePast(v.b), v.p, ...others.map((o) => o.pp), v.b]);
  }
  if (mode === 'base-choice') {
    const unique = pool.filter((o) => o.p !== o.b && IRREGULAR.filter((x) => x.p === o.p).length === 1);
    const w = pick(rng, unique);
    return choiceItem(ctx, INSTR.choose, `Which verb is "${w.p}" the past simple of?`, w.b, unique.filter((o) => o.b !== w.b).map((o) => o.b));
  }
  if (mode === 'past-gap' || mode === 'pp-gap') {
    const withPhrase = PHRASES.filter((p) => pool.some((o) => o.b === p.v));
    const p = pick(rng, withPhrase);
    const verb = pool.find((o) => o.b === p.v) as IrregularVerb;
    const s = pick(rng, SUBJECTS);
    if (mode === 'past-gap') {
      return blankItem(ctx, `${s.text} {{gap}} ${p.rest} yesterday. (${verb.b})`, verb.p, [naivePast(verb.b), verb.pp, thirdPerson(verb.b), ingForm(verb.b), verb.b].filter((x) => x !== verb.p));
    }
    return blankItem(ctx, `${s.text} ${haveForm(s)} {{gap}} ${p.rest} so far. (${verb.b})`, verb.pp, [naivePast(verb.b), verb.p, verb.b, ingForm(verb.b)].filter((x) => x !== verb.pp));
  }
  if (mode === 'tf' || mode === 'tf-pp') {
    const pp = mode === 'tf-pp';
    const truth = rng() < 0.5;
    const right = pp ? v.pp : v.p;
    const wrong = shuffle(rng, [naivePast(v.b), pp ? v.p : v.pp, pp ? pick(rng, others).pp : pick(rng, others).p, v.b].filter((x) => x !== right))[0];
    const shown = truth ? right : wrong;
    return tfItem(ctx, INSTR.tfFact, `The ${pp ? 'past participle' : 'past simple'} of "${v.b}" is "${shown}".`, truth);
  }
  if (mode === 'match' || mode === 'match-pp') {
    const pp = mode === 'match-pp';
    const picked: IrregularVerb[] = [];
    for (const o of shuffle(rng, pool)) {
      const form = pp ? o.pp : o.p;
      if (picked.some((x) => (pp ? x.pp : x.p) === form)) continue;
      picked.push(o);
      if (picked.length === 4) break;
    }
    return matchItem(ctx, picked.map((o) => ({ l: o.b, r: pp ? o.pp : o.p, rEn: true })), pp ? L('Potrivește verbul cu participiul trecut.', 'Match each verb with its past participle.') : L('Potrivește verbul cu forma de trecut.', 'Match each verb with its past simple.'));
  }
  // sort: regular vs irregular
  const irr = shuffle(rng, pool).slice(0, 3).map((o) => o.b);
  const reg = shuffle(rng, REGULAR.filter((r) => !IRREGULAR.some((i) => i.b === r.b))).slice(0, 3).map((r) => r.b);
  return sortItem(
    ctx,
    L('Care verbe sunt regulate (-ed) și care neregulate?', 'Which verbs are regular (-ed) and which are irregular?'),
    [
      { id: 'reg', label: L('Regulate (-ed)', 'Regular (-ed)') },
      { id: 'irr', label: L('Neregulate', 'Irregular') },
    ],
    [...irr.map((text) => ({ text, cat: 'irr' })), ...reg.map((text) => ({ text, cat: 'reg' }))],
  );
};

/* ------------------------------------------------------------------ */
/*  Nouns                                                              */
/* ------------------------------------------------------------------ */

const PLURAL_FRAMES = ['There are three {{gap}} in the room. ({s})', 'I can see four {{gap}}. ({s})', 'We need five {{gap}}. ({s})', 'Look at those {{gap}}! ({s})'];

/** Wrong plural spellings that are never accepted English plurals for the noun */
function wrongPlurals(n: Noun): string[] {
  const out = [`${n.s}s`, `${n.s}es`, `${n.s}en`, `${n.s}ies`];
  if (n.s.endsWith('y')) out.push(`${n.s.slice(0, -1)}ies`, `${n.s.slice(0, -1)}es`);
  if (n.s.endsWith('f')) out.push(`${n.s.slice(0, -1)}ves`);
  if (n.s.endsWith('fe')) out.push(`${n.s.slice(0, -2)}ves`);
  if (n.g === 'irr' || n.g === 'same') out.push(`${n.s}s`, `${n.s}ies`);
  return out.filter((w) => w !== n.p);
}

const PLURAL_SORT_GROUPS: Record<string, string> = { s: 's', ys: 's', os: 's', es: 'es', ies: 'ies' };

function nounPlural(ctx: GeneratorContext): Item {
  const { rng } = ctx;
  const n = pick(rng, NOUNS);
  const mode = pick(rng, ['choice', 'gap', 'gap', 'match', 'sort', 'tf']);
  if (mode === 'choice') return choiceItem(ctx, INSTR.choose, `What is the plural of "${n.s}"?`, n.p, wrongPlurals(n));
  if (mode === 'gap') return blankItem(ctx, pick(rng, PLURAL_FRAMES).replace('{s}', n.s), n.p, wrongPlurals(n), INSTR.verb);
  if (mode === 'tf') {
    const truth = rng() < 0.5;
    const shown = truth ? n.p : shuffle(rng, wrongPlurals(n))[0];
    return tfItem(ctx, INSTR.tfFact, `The plural of "${n.s}" is "${shown}".`, truth);
  }
  if (mode === 'match') {
    const picked = shuffle(rng, NOUNS).slice(0, 4);
    return matchItem(ctx, picked.map((x) => ({ l: x.s, r: x.p, rEn: true })), L('Potrivește singularul cu pluralul.', 'Match each singular with its plural.'));
  }
  const groups: Record<string, Noun[]> = { s: [], es: [], ies: [] };
  for (const x of NOUNS) if (PLURAL_SORT_GROUPS[x.g]) groups[PLURAL_SORT_GROUPS[x.g]].push(x);
  const cards = (['s', 'es', 'ies'] as const).flatMap((g) => shuffle(rng, groups[g]).slice(0, 2).map((x) => ({ text: x.s, cat: g })));
  return sortItem(
    ctx,
    L('Cum formăm pluralul fiecărui substantiv?', 'How do we make the plural of each noun?'),
    [
      { id: 's', label: L('+ s', '+ s') },
      { id: 'es', label: L('+ es', '+ es') },
      { id: 'ies', label: L('y → ies', 'y → ies') },
    ],
    cards,
  );
}

function nounArticle(ctx: GeneratorContext): Item {
  const { rng, difficulty } = ctx;
  const n = pick(rng, NOUNS);
  const mode = pick(rng, ['gap', 'gap', 'choice', 'tf']);
  const withAdj = difficulty >= 2 && rng() < 0.5;
  const adj = withAdj ? pick(rng, ADJECTIVES).b : '';
  const art = withAdj ? articleForAdjective(adj) : n.art;
  const alt = art === 'a' ? 'an' : 'a';
  const phrase = withAdj ? `${adj} ${n.s}` : n.s;
  if (mode === 'gap') return blankItem(ctx, `This is {{gap}} ${phrase}.`, art, [alt, 'some', 'many'], INSTR.gap);
  if (mode === 'choice') return choiceItem(ctx, INSTR.choose, 'Which phrase is correct?', `${art} ${phrase}`, [`${alt} ${phrase}`, `some ${phrase}`, `many ${phrase}`]);
  const truth = rng() < 0.5;
  return tfItem(ctx, INSTR.tf, `This is ${truth ? art : alt} ${phrase}.`, truth);
}

function nounCountable(ctx: GeneratorContext): Item {
  const { rng } = ctx;
  const mode = pick(rng, ['sort', 'odd-unc', 'odd-cnt', 'gap-many', 'gap-much', 'tf']);
  const cnt = NOUNS.filter((x) => x.g !== 'same' && x.g !== 'irr');
  const unc = UNCOUNTABLE;
  if (mode === 'sort') {
    const a = shuffle(rng, cnt).slice(0, 3).map((x) => ({ text: x.s, cat: 'c' }));
    const b = shuffle(rng, unc).slice(0, 3).map((x) => ({ text: x.s, cat: 'u' }));
    return sortItem(
      ctx,
      L('Care substantive se pot număra și care nu?', 'Which nouns can we count and which can we not?'),
      [
        { id: 'c', label: L('Numărabile (a, two…)', 'Countable (a, two…)') },
        { id: 'u', label: L('Nenumărabile (some…)', 'Uncountable (some…)') },
      ],
      [...a, ...b],
    );
  }
  if (mode === 'odd-unc') {
    const w = pick(rng, unc);
    return choiceItem(ctx, INSTR.choose, 'Which noun is uncountable?', w.s, cnt.map((x) => x.s));
  }
  if (mode === 'odd-cnt') {
    const w = pick(rng, cnt);
    return choiceItem(ctx, INSTR.choose, 'Which noun is countable?', w.s, unc.map((x) => x.s));
  }
  if (mode === 'gap-many') {
    const n = pick(rng, cnt);
    return blankItem(ctx, `How {{gap}} ${n.p} do you have?`, 'many', ['much', 'some', 'a'], INSTR.gap);
  }
  if (mode === 'gap-much') {
    const n = pick(rng, unc);
    return blankItem(ctx, `How {{gap}} ${n.s} do you have?`, 'much', ['many', 'some', 'a'], INSTR.gap);
  }
  const w = pick(rng, [...cnt.map((x) => ({ s: x.s, c: true })), ...unc.map((x) => ({ s: x.s, c: false }))]);
  const truth = rng() < 0.5;
  return tfItem(ctx, INSTR.tfFact, `"${w.s}" is ${truth === w.c ? 'countable' : 'uncountable'}.`, truth);
}

export const engGimNoun: GeneratorFn = (params, ctx): Item => {
  const mode = typeof params.mode === 'string' ? params.mode : '';
  if (mode === 'plural') return nounPlural(ctx);
  if (mode === 'article') return nounArticle(ctx);
  if (mode === 'countable') return nounCountable(ctx);
  throw new Error(`eng-gim-noun: unknown mode "${mode}" (skill ${ctx.skill.id})`);
};

/* ------------------------------------------------------------------ */
/*  Adjectives: comparatives and superlatives                          */
/* ------------------------------------------------------------------ */

/** "more X" is a clearly wrong comparative for these (for "happy", "quiet" it would be acceptable English) */
const MORE_IS_WRONG = new Set(['tall', 'short', 'small', 'long', 'old', 'young', 'fast', 'cheap', 'cold', 'high', 'strong', 'dark', 'loud', 'warm', 'rich', 'deep', 'nice', 'large', 'wide', 'safe', 'brave', 'big', 'hot', 'thin', 'fat', 'sad', 'wet', 'good', 'bad']);

function wrongComparatives(a: Adjective): string[] {
  const out = [a.s, a.b, `${a.b}er`, `${a.b}${a.b.slice(-1)}er`];
  if (a.g === 'more') out.push(`more ${a.b}er`);
  if (MORE_IS_WRONG.has(a.b)) out.push(`more ${a.b}`);
  return out.filter((w) => w !== a.c);
}

function wrongSuperlatives(a: Adjective): string[] {
  const out = [a.c, a.b, `${a.b}est`, `${a.b}${a.b.slice(-1)}est`];
  if (MORE_IS_WRONG.has(a.b)) out.push(`most ${a.b}`);
  return out.filter((w) => w !== a.s);
}

export const engGimAdj: GeneratorFn = (params, ctx): Item => {
  const { rng } = ctx;
  const m = typeof params.mode === 'string' ? params.mode : 'mix';
  const a = pick(rng, ADJECTIVES);
  const wantComp = m === 'comparative' ? true : m === 'superlative' ? false : rng() < 0.5;
  const mode = pick(rng, ['gap', 'gap', 'choice', 'tf', 'match']);
  const form = wantComp ? a.c : a.s;
  const wrong = wantComp ? wrongComparatives(a) : wrongSuperlatives(a);
  if (mode === 'gap') {
    const tpl = wantComp ? `${a.A} is {{gap}} than ${a.B}. (${a.b})` : `${a.A} is the {{gap}} ${a.tail}. (${a.b})`;
    return blankItem(ctx, tpl, form, wrong, L('Completează cu forma corectă a adjectivului din paranteză.', 'Complete with the correct form of the adjective in brackets.'));
  }
  if (mode === 'choice') return choiceItem(ctx, INSTR.choose, `What is the ${wantComp ? 'comparative' : 'superlative'} of "${a.b}"?`, form, wrong);
  if (mode === 'tf') {
    const truth = rng() < 0.5;
    const shown = truth ? form : shuffle(rng, wrong)[0];
    return tfItem(ctx, INSTR.tfFact, `The ${wantComp ? 'comparative' : 'superlative'} of "${a.b}" is "${shown}".`, truth);
  }
  const picked = shuffle(rng, ADJECTIVES).slice(0, 4);
  return matchItem(ctx, picked.map((x) => ({ l: x.b, r: wantComp ? x.c : x.s, rEn: true })), wantComp ? L('Potrivește adjectivul cu comparativul.', 'Match each adjective with its comparative.') : L('Potrivește adjectivul cu superlativul.', 'Match each adjective with its superlative.'));
};

/* ------------------------------------------------------------------ */
/*  Vocabulary by topic                                                */
/* ------------------------------------------------------------------ */

export const engGimVocab: GeneratorFn = (params, ctx): Item => {
  const { rng, difficulty } = ctx;
  const ids = strArray(params.topics);
  const topics = ids.map((id) => VOCAB_TOPICS.find((t) => t.id === id)).filter((t): t is VocabTopic => t !== undefined);
  if (topics.length < 2) throw new Error(`eng-gim-vocab: need at least two known topics (skill ${ctx.skill.id})`);
  const t = pick(rng, topics);
  const w = pick(rng, t.words);
  const mode = pick(rng, difficulty <= 1 ? ['en-ro', 'ro-en', 'tf', 'match'] : ['en-ro', 'ro-en', 'tf', 'match', 'odd', 'sort']);
  const sameTopic = t.words.filter((x) => x.en !== w.en);
  if (mode === 'en-ro') {
    const total = optionCount(difficulty);
    const wrong = shuffle(rng, sameTopic).slice(0, total - 1);
    const all = shuffle(rng, [w, ...wrong]);
    return {
      ...choiceItem(ctx, INSTR.choose, '', w.ro, sameTopic.map((x) => x.ro)),
      prompt: { ro: `Ce înseamnă cuvântul englezesc „${w.en}”?`, en: `What does the English word "${w.en}" mean?` },
      options: all.map((o, i) => ({ id: `o${i}`, text: L(o.ro) })),
      correctId: `o${all.findIndex((o) => o.en === w.en)}`,
    };
  }
  if (mode === 'ro-en') {
    const total = optionCount(difficulty);
    const wrong = shuffle(rng, sameTopic).slice(0, total - 1);
    const all = shuffle(rng, [w, ...wrong]);
    return {
      ...choiceItem(ctx, INSTR.choose, '', w.en, sameTopic.map((x) => x.en)),
      prompt: { ro: `Cum se spune „${w.ro}” în engleză?`, en: `How do you say "${w.ro}" in English?` },
      options: all.map((o, i) => ({ id: `o${i}`, text: L(o.en, o.en) })),
      correctId: `o${all.findIndex((o) => o.en === w.en)}`,
    };
  }
  if (mode === 'tf') {
    const truth = rng() < 0.5;
    const shown = truth ? w : pick(rng, sameTopic);
    return tfItem(ctx, INSTR.tfFact, `"${w.en}" = "${shown.ro}"`, truth);
  }
  if (mode === 'match') {
    const picked = shuffle(rng, t.words).slice(0, 4);
    return matchItem(ctx, picked.map((x) => ({ l: x.en, r: x.ro })), L('Potrivește cuvântul englezesc cu traducerea lui.', 'Match each English word with its Romanian meaning.'));
  }
  const other = pick(rng, topics.filter((x) => x.id !== t.id));
  if (mode === 'odd') {
    const three = shuffle(rng, t.words).slice(0, 3).map((x) => x.en);
    const odd = pick(rng, other.words).en;
    return { ...choiceItem(ctx, INSTR.choose, '', odd, three), prompt: { ro: 'Care cuvânt nu se potrivește cu celelalte?', en: 'Which word does not belong with the others?' } };
  }
  const a = shuffle(rng, t.words).slice(0, 3).map((x) => ({ text: x.en, cat: t.id }));
  const b = shuffle(rng, other.words).slice(0, 3).map((x) => ({ text: x.en, cat: other.id }));
  return sortItem(
    ctx,
    INSTR.sort,
    [t, other].map((x) => ({ id: x.id, label: L(x.name.ro, x.name.en) })),
    [...a, ...b],
  );
};

/* ------------------------------------------------------------------ */
/*  Word order                                                         */
/* ------------------------------------------------------------------ */

export const engGimOrder: GeneratorFn = (params, ctx): Item => {
  const grades = Array.isArray(params.grades) ? (params.grades as number[]) : [5];
  const kinds = strArray(params.kinds);
  const pool = ORDER_SENTENCES.filter((s) => grades.includes(s.g) && (kinds.length === 0 || kinds.includes(s.k)));
  if (pool.length === 0) throw new Error(`eng-gim-order: no sentences for grades ${grades.join(',')} (skill ${ctx.skill.id})`);
  const s = pick(ctx.rng, pool);
  return orderItem(ctx, s.text.split(' '));
};

registerGenerator('eng-gim-irregular', engGimIrregular);
registerGenerator('eng-gim-noun', engGimNoun);
registerGenerator('eng-gim-adj', engGimAdj);
registerGenerator('eng-gim-vocab', engGimVocab);
registerGenerator('eng-gim-order', engGimOrder);

export { pastSimple, pastParticiple };
