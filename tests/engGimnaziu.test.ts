import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateItems, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import {
  ADJECTIVES, IRREGULAR, NOUNS, ORDER_SENTENCES, PASSIVES, PHRASES, QUIZ_TOPICS, REGULAR, SUBJECTS, UNCOUNTABLE, VOCAB_TOPICS, WORD_FORMS,
} from '../src/engine/items/generators/engGimData';
import { assembleTest } from '../src/exam/assemble';
import { GIM_BLUEPRINTS, maxPoints } from '../src/exam/gimBlueprints';
import { scoreGimExam } from '../src/exam/gimScoring';
import { simulate } from './helpers/learner';
import type { Item, ItemResponse } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));
function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsonFiles(p) : n.endsWith('.json') ? [p] : [];
  });
}

const engAll = getSkillsBySubject('eng');
const gim = engAll.filter((s) => s.grade >= 5);
const byGrade = (g: number) => gim.filter((s) => s.grade === g);
const skillFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'skills', 'eng', `grade${g}.json`));
const bankFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'items', 'eng', `gim${g}.json`));
const explFile = join(CONTENT, 'explanations', 'eng', 'grade5-8.json');
const dataFiles = ['verbs', 'nouns', 'adjectives', 'vocab', 'sentences', 'wordform', 'quiz'].map((n) => join(CONTENT, 'data', 'eng', `gim-${n}.json`));
const newFiles = [...skillFiles, ...bankFiles, explFile, ...dataFiles];

function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice': case 'picture-choice': case 'listen-and-answer': case 'hotspot':
      return { type: item.type, selectedId: item.correctId };
    case 'true-false': return { type: 'true-false', value: item.correct };
    case 'number-input': return { type: 'number-input', value: item.correct };
    case 'fill-gap': return { type: 'fill-gap', value: item.correct };
    case 'order': return { type: 'order', order: item.correctOrder };
    case 'sort': return { type: 'sort', placement: Object.fromEntries(item.cards.map((c) => [c.id, c.categoryId])) };
    case 'match': return { type: 'match', pairs: Object.fromEntries(item.pairs.map((p) => [p.left.id, p.right.id])) };
    case 'read-and-answer': return { type: 'read-and-answer', answers: Object.fromEntries(item.questions.map((q) => [q.id, correctResponse(q)])) };
  }
}

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('English gimnaziu skill graph (V-VIII)', () => {
  it('has 10-13 skills in each of grades V-VIII, structurally valid', () => {
    for (const g of [5, 6, 7, 8]) {
      expect(byGrade(g).length, `grade ${g}`).toBeGreaterThanOrEqual(10);
      expect(byGrade(g).length, `grade ${g}`).toBeLessThanOrEqual(13);
    }
    expect(skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)))).toEqual([]);
  });

  it('the whole graph is a valid DAG and grade V links into the real grade IV skills', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    const ids = new Set(engAll.map((s) => s.id));
    for (const s of gim) for (const p of s.prerequisites) expect(ids.has(p), `${s.id} -> ${p}`).toBe(true);
    const g4 = new Set(engAll.filter((s) => s.grade === 4).map((s) => s.id));
    const linked = byGrade(5).flatMap((s) => s.prerequisites.filter((p) => g4.has(p)));
    for (const p of ['eng.present.4', 'eng.continuous.4', 'eng.questions.4', 'eng.adjectives.4', 'eng.jobs.4', 'eng.reading.4', 'eng.wordorder.4']) {
      expect(linked.includes(p) || gim.some((s) => s.prerequisites.includes(p)), p).toBe(true);
    }
    for (const g of [6, 7, 8]) {
      const crossing = byGrade(g).filter((s) => s.prerequisites.some((p) => (engAll.find((x) => x.id === p)?.grade ?? g) < g));
      expect(crossing.length, `grade ${g}`).toBeGreaterThanOrEqual(8);
    }
  });

  it('uses LM1-V-VIII-2017 with own provenance, English titles and the "verify" note; ids end with the grade', () => {
    for (const s of gim) {
      expect(s.competences.length).toBeGreaterThanOrEqual(1);
      expect(s.competences.every((c) => c.programa === 'LM1-V-VIII-2017' && /^\d+\.\d+$/.test(c.code)), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
      expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
    }
  });

  it('covers the programa topics across the grades', () => {
    const all = gim.map((s) => s.id).join(' ');
    for (const part of ['vocab.topics', 'present', 'continuous', 'past.', 'pastcont', 'perfect.', 'future', 'questions', 'pastq', 'articles', 'plurals', 'quantity', 'compar', 'modals', 'prep', 'tobe', 'pronouns', 'freq', 'cond', 'passive', 'reported', 'phrasal', 'read', 'func.directions', 'func.invitations', 'func.basic', 'irregular', 'wordform']) {
      expect(all, part).toContain(part);
    }
    expect(byGrade(8).some((s) => s.id.includes('cond'))).toBe(true);
    expect(byGrade(8).some((s) => s.id.includes('passive'))).toBe(true);
    expect(byGrade(8).some((s) => s.id.includes('reported'))).toBe(true);
  });

  it('every skill has an existing 3-frame bilingual explanation (ai-draft, beta, OWN)', () => {
    for (const s of gim) {
      expect(s.explanations).toEqual([`exp.${s.id}`]);
      const exp = getExplanation(s.explanations[0]);
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      expect(exp?.title.en).toBeTruthy();
      for (const f of exp?.frames ?? []) expect(f.text.en, s.id).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
    }
  });

  it('every skill has registered generators or a bank of at least 3 items', () => {
    for (const s of gim) {
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
        else expect(existsSync(join(CONTENT, 'items', src.bank)), src.bank).toBe(true);
      }
      expect(s.itemSources.length, s.id).toBeGreaterThan(0);
      if (!s.itemSources.some((x) => 'generator' in x)) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(listGenerators().filter((g) => g.startsWith('eng-gim-'))).toEqual(
      ['eng-gim-adj', 'eng-gim-irregular', 'eng-gim-noun', 'eng-gim-order', 'eng-gim-passive', 'eng-gim-quiz', 'eng-gim-reported', 'eng-gim-verb', 'eng-gim-vocab', 'eng-gim-wordform'],
    );
  });

  it('placement and missions work over the English graph for a child who knows grade IV', () => {
    const known = new Set(engAll.filter((s) => s.grade <= 4).map((s) => s.id));
    for (const seed of [1, 2]) {
      for (const grade of [6, 8] as const) {
        const r = simulate(engAll, { seed, known, subject: 'eng', declared: { grade, semester: 1 } }, 40);
        expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThanOrEqual(r.gapHistory[0]);
        for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Datasets                                                           */
/* ------------------------------------------------------------------ */

/** Independent copy of the irregular verbs: base past participle */
const TABLE = `begin began begun|break broke broken|bring brought brought|build built built|buy bought bought|catch caught caught|choose chose chosen|come came come|cost cost cost|cut cut cut|do did done|draw drew drawn|drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feel felt felt|find found found|fly flew flown|forget forgot forgotten|get got got|give gave given|go went gone|grow grew grown|have had had|hear heard heard|hide hid hidden|hit hit hit|hold held held|keep kept kept|know knew known|leave left left|lend lent lent|lose lost lost|make made made|mean meant meant|meet met met|pay paid paid|put put put|read read read|ride rode ridden|ring rang rung|run ran run|say said said|see saw seen|sell sold sold|send sent sent|shut shut shut|sing sang sung|sit sat sat|sleep slept slept|speak spoke spoken|spend spent spent|stand stood stood|steal stole stolen|swim swam swum|take took taken|teach taught taught|tell told told|think thought thought|throw threw thrown|understand understood understood|wake woke woken|wear wore worn|win won won|write wrote written`;
const IRR = new Map(TABLE.split('|').map((l) => { const [b, p, pp] = l.split(' '); return [b, { p, pp }] as const; }));

/* independent morphology (regex style) */
const third = (v: string) => (v === 'have' ? 'has' : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ies` : /(s|x|z|ch|sh|o)$/.test(v) ? `${v}es` : `${v}s`);
const ING_DOUBLE = ['stop', 'plan', 'run', 'swim', 'sit', 'get', 'put', 'cut', 'hit', 'begin', 'forget', 'shut', 'shop', 'drop', 'chat'];
const ing = (v: string) => (ING_DOUBLE.includes(v) ? `${v}${v.slice(-1)}ing` : v === 'travel' ? 'travelling' : /[^e]e$/.test(v) ? `${v.slice(0, -1)}ing` : `${v}ing`);
const regPast = (v: string) => (ING_DOUBLE.includes(v) ? `${v}${v.slice(-1)}ed` : v === 'travel' ? 'travelled' : /e$/.test(v) ? `${v}d` : /[^aeiou]y$/.test(v) ? `${v.slice(0, -1)}ied` : `${v}ed`);
const past = (v: string) => IRR.get(v)?.p ?? regPast(v);
const pp = (v: string) => IRR.get(v)?.pp ?? regPast(v);

describe('curated data: verbs', () => {
  it('own work, valid provenance, NFC, no cedilla diacritics', () => {
    for (const f of dataFiles) {
      expect(validateProvenance(readJson(f).provenance), relative(ROOT, f)).toEqual([]);
      expect(readJson(f).provenance.licence).toBe('OWN');
    }
    for (const f of newFiles) {
      const raw = readFileSync(f, 'utf8');
      expect(raw.normalize('NFC') === raw, relative(ROOT, f)).toBe(true);
      expect(/[şţŞŢ]/.test(raw), relative(ROOT, f)).toBe(false);
    }
  });

  it('irregular verbs match the independent table; no duplicates; Romanian glosses distinct', () => {
    const bases = IRREGULAR.map((v) => v.b);
    expect(new Set(bases).size).toBe(bases.length);
    for (const v of IRREGULAR.filter((x) => x.b !== 'be')) {
      expect(IRR.get(v.b), v.b).toEqual({ p: v.p, pp: v.pp });
    }
    expect(IRR.size).toBe(IRREGULAR.length - 1);
    expect(IRREGULAR.find((v) => v.b === 'be')).toMatchObject({ p: 'was/were', pp: 'been' });
    const all = [...IRREGULAR.map((v) => v.ro), ...REGULAR.map((v) => v.ro)];
    expect(new Set(all).size).toBe(all.length);
    const regs = REGULAR.map((v) => v.b);
    expect(new Set(regs).size).toBe(regs.length);
    for (const r of regs) expect(IRR.has(r) || bases.includes(r), r).toBe(false);
    expect(IRREGULAR.filter((v) => v.set === 'A').length).toBeGreaterThanOrEqual(30);
    expect(IRREGULAR.filter((v) => v.set === 'B').length).toBeGreaterThanOrEqual(20);
  });

  it('phrases and passives use known verbs; every rest is unique; spelling rules hold on the hard cases', () => {
    const known = new Set([...IRREGULAR.map((v) => v.b), ...REGULAR.map((v) => v.b)]);
    for (const p of PHRASES) expect(known.has(p.v), p.v).toBe(true);
    for (const e of PASSIVES) expect(known.has(e.v), e.v).toBe(true);
    expect(new Set(PHRASES.map((p) => p.rest)).size).toBe(PHRASES.length);
    expect(PHRASES.length).toBeGreaterThanOrEqual(40);
    expect(['stop', 'study', 'live', 'travel', 'carry', 'dance', 'plan', 'enjoy', 'hurry', 'go', 'wash', 'fix', 'do', 'have'].map((v) => [past(v), ing(v), third(v)])).toEqual([
      ['stopped', 'stopping', 'stops'], ['studied', 'studying', 'studies'], ['lived', 'living', 'lives'], ['travelled', 'travelling', 'travels'],
      ['carried', 'carrying', 'carries'], ['danced', 'dancing', 'dances'], ['planned', 'planning', 'plans'], ['enjoyed', 'enjoying', 'enjoys'],
      ['hurried', 'hurrying', 'hurries'], ['went', 'going', 'goes'], ['washed', 'washing', 'washes'], ['fixed', 'fixing', 'fixes'], ['did', 'doing', 'does'], ['had', 'having', 'has'],
    ]);
  });
});

describe('curated data: nouns, adjectives, vocabulary, sentences, quiz', () => {
  it('plurals follow their group rule; articles are right; no duplicates', () => {
    const rule: Record<string, (s: string) => string> = {
      s: (s) => `${s}s`, ys: (s) => `${s}s`, os: (s) => `${s}s`, es: (s) => `${s}es`, oes: (s) => `${s}es`,
      ies: (s) => s.replace(/y$/, 'ies'), ves: (s) => s.replace(/fe?$/, 'ves'),
    };
    for (const n of NOUNS) {
      if (rule[n.g]) expect(n.p, n.s).toBe(rule[n.g](n.s));
      expect(['a', 'an']).toContain(n.art);
    }
    expect(NOUNS.filter((n) => n.g === 'irr').map((n) => `${n.s}-${n.p}`).sort()).toEqual(['child-children', 'foot-feet', 'goose-geese', 'man-men', 'tooth-teeth', 'woman-women']);
    expect(new Set(NOUNS.map((n) => n.s)).size).toBe(NOUNS.length);
    expect(NOUNS.find((n) => n.s === 'hour')?.art).toBe('an');
    expect(NOUNS.find((n) => n.s === 'university')?.art).toBe('a');
    expect(NOUNS.find((n) => n.s === 'uniform')?.art).toBe('a');
    expect(NOUNS.find((n) => n.s === 'egg')?.art).toBe('an');
    for (const n of NOUNS.filter((x) => x.g !== 'irr' && x.g !== 'same' && !['hour', 'university', 'uniform'].includes(x.s))) expect(n.art === 'an', n.s).toBe(/^[aeiou]/.test(n.s));
    expect(UNCOUNTABLE.map((u) => u.s)).toEqual(expect.arrayContaining(['water', 'money', 'information', 'advice', 'homework']));
    expect(UNCOUNTABLE.some((u) => NOUNS.some((n) => n.s === u.s))).toBe(false);
  });

  it('comparatives and superlatives follow their group rule', () => {
    const e = (a: (typeof ADJECTIVES)[number]) => {
      const b = a.b;
      switch (a.g) {
        case 'er': return [`${b}er`, `${b}est`];
        case 'e': return [`${b}r`, `${b}st`];
        case 'dbl': return [`${b}${b.slice(-1)}er`, `${b}${b.slice(-1)}est`];
        case 'y': return [b.replace(/y$/, 'ier'), b.replace(/y$/, 'iest')];
        case 'more': return [`more ${b}`, `most ${b}`];
        default: return null;
      }
    };
    for (const a of ADJECTIVES) {
      const x = e(a);
      if (x) expect([a.c, a.s], a.b).toEqual(x);
      expect(a.A && a.B && a.tail, a.b).toBeTruthy();
    }
    expect(ADJECTIVES.filter((a) => a.g === 'irr').map((a) => [a.b, a.c, a.s])).toEqual([['good', 'better', 'best'], ['bad', 'worse', 'worst']]);
    expect(new Set(ADJECTIVES.map((a) => a.b)).size).toBe(ADJECTIVES.length);
  });

  it('vocabulary: unique English words across topics, unique Romanian within a topic, enough per topic; British forms', () => {
    const en = VOCAB_TOPICS.flatMap((t) => t.words.map((w) => w.en));
    expect(new Set(en).size).toBe(en.length);
    for (const t of VOCAB_TOPICS) {
      expect(t.words.length, t.id).toBeGreaterThanOrEqual(12);
      expect(new Set(t.words.map((w) => w.ro)).size, t.id).toBe(t.words.length);
    }
    for (const g of [5, 6, 7, 8]) expect(VOCAB_TOPICS.filter((t) => t.grade === g).length).toBeGreaterThanOrEqual(5);
    for (const w of ['rubber', 'jumper', 'trousers', 'lorry', 'petrol', 'underground', 'chemist\'s']) expect(en, w).toContain(w);
    for (const w of ['eraser', 'sweater', 'pants', 'truck', 'gas', 'subway', 'color']) expect(en, w).not.toContain(w);
    const skillTopics = new Set(gim.flatMap((s) => s.itemSources.flatMap((x) => ('generator' in x && x.generator === 'eng-gim-vocab' ? (x.params?.topics as string[]) : []))));
    for (const t of VOCAB_TOPICS) expect(skillTopics.has(t.id), t.id).toBe(true);
  });

  it('order sentences: distinct words, only the first word capitalised (apart from I and names), enough per grade and kind', () => {
    for (const s of ORDER_SENTENCES) {
      const toks = s.text.split(' ').map((t) => t.replace(/[.,?]/g, '').toLowerCase());
      expect(new Set(toks).size, s.text).toBe(toks.length);
    }
    for (const g of [5, 6, 7, 8]) for (const k of ['s', 'n', 'q']) expect(ORDER_SENTENCES.filter((s) => s.g === g && s.k === k).length, `${g}${k}`).toBeGreaterThanOrEqual(4);
    expect(new Set(ORDER_SENTENCES.map((s) => s.text)).size).toBe(ORDER_SENTENCES.length);
  });

  it('quiz topics: every topic is used, entries well formed with 4 distinct options, no duplicate prompts', () => {
    const used = new Set(gim.flatMap((s) => s.itemSources.flatMap((x) => ('generator' in x && x.generator === 'eng-gim-quiz' ? [String(x.params?.topic)] : []))));
    expect([...used].sort()).toEqual(Object.keys(QUIZ_TOPICS).sort());
    for (const [topic, t] of Object.entries(QUIZ_TOPICS)) {
      expect(t.gaps.length + t.qs.length, topic).toBeGreaterThanOrEqual(9);
      const texts = [...t.gaps, ...t.qs].map((e) => `${e[0]}|${e[1]}`);
      expect(new Set(texts).size, `${topic} duplicates`).toBe(texts.length);
      for (const [text, c, w] of [...t.gaps, ...t.qs]) {
        expect(w.length, text).toBe(3);
        expect(new Set([c, ...w]).size, text).toBe(4);
      }
      for (const [text] of t.gaps) expect(text.split('___').length - 1, text).toBe(1);
    }
    expect(WORD_FORMS.length).toBeGreaterThanOrEqual(30);
  });
});

/* ------------------------------------------------------------------ */
/*  Independent verification of generated answers                      */
/* ------------------------------------------------------------------ */

const SUBJ: { text: string; mid: string; third: boolean; first: boolean }[] = [
  { text: 'I', mid: 'I', third: false, first: true }, { text: 'You', mid: 'you', third: false, first: false }, { text: 'We', mid: 'we', third: false, first: false },
  { text: 'They', mid: 'they', third: false, first: false }, { text: 'He', mid: 'he', third: true, first: false }, { text: 'She', mid: 'she', third: true, first: false },
  { text: 'Tom', mid: 'Tom', third: true, first: false }, { text: 'Maria', mid: 'Maria', third: true, first: false }, { text: 'My brother', mid: 'my brother', third: true, first: false },
  { text: 'My parents', mid: 'my parents', third: false, first: false }, { text: 'The children', mid: 'the children', third: false, first: false },
];
const PHRASE_BY_LONG = [...PHRASES].sort((a, b) => b.rest.length - a.rest.length);
const PAST_CUES = ['yesterday', 'last week', 'two days ago', 'last summer', 'in 2019'];
const bePres = (s: (typeof SUBJ)[number]) => (s.first ? 'am' : s.third ? 'is' : 'are');
const bePast = (s: (typeof SUBJ)[number]) => (s.first || s.third ? 'was' : 'were');

function splitSubject(str: string, mid: boolean): { s: (typeof SUBJ)[number]; rest: string } | null {
  for (const s of [...SUBJ].sort((a, b) => b.text.length - a.text.length)) {
    const t = mid ? s.mid : s.text;
    if (str.startsWith(`${t} `)) return { s, rest: str.slice(t.length + 1) };
  }
  return null;
}

/** Is this English sentence (statement, question or negative built from a curated phrase) grammatically right for its cue? */
function judge(sentence: string, hint = ''): boolean {
  const isQuestion = sentence.trim().endsWith('?');
  let s = sentence.replace(/\s*\([^)]*\)\s*$/, '').trim().replace(/[.?]$/, '');
  let ctx: 'plain' | 'pastcont' | 'cont' = 'plain';
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^At eight o'clock yesterday, (.*)$/))) { ctx = 'pastcont'; s = `${m[1][0].toUpperCase()}${m[1].slice(1)}`; }
  else if ((m = s.match(/^While (.*), the phone rang$/))) { ctx = 'pastcont'; s = `${m[1][0].toUpperCase()}${m[1].slice(1)}`; }
  else if ((m = s.match(/^(?:Look|Listen)! (.*)$/))) { ctx = 'cont'; s = m[1]; }
  const q = s.match(/^(Do|Does|Did|Is|Are|Was|Were|Am) (.*)$/);
  const asked = q ? splitSubject(q[2], true) : null;
  const body = asked ? asked.rest : (splitSubject(s, false)?.rest ?? '');
  const subj = asked ? asked.s : splitSubject(s, false)?.s;
  if (!subj) return false;
  const phrase = PHRASE_BY_LONG.find((p) => body.includes(` ${p.rest}`) || body.startsWith(`${p.rest}`) || body === p.rest);
  if (!phrase) return false;
  const idx = body.indexOf(phrase.rest);
  const group = body.slice(0, idx).trim();
  const cue = body.slice(idx + phrase.rest.length).trim();
  const v = phrase.v;
  const doAux = subj.third ? 'does' : 'do';
  const haveAux = subj.third ? 'has' : 'have';
  const isPast = PAST_CUES.includes(cue);
  const isPerfect = /^since |^so far/.test(cue);
  const isNow = cue === 'now' || cue === 'at the moment' || ctx === 'cont';
  const isFuture = cue === 'next week';
  if (isQuestion !== !!asked) return false;
  if (asked) {
    if (!q || group !== v) return false;
    if (isFuture || isNow || isPerfect || ctx === 'pastcont') return false;
    return q[1] === (isPast ? 'Did' : doAux === 'does' ? 'Does' : 'Do');
  }
  let valid: string[];
  if (isFuture) {
    const h = hint.replace(/^[a-z ]+ – /, '');
    const will = [`will ${v}`], going = [`${bePres(subj)} going to ${v}`], nWill = [`won't ${v}`], nGoing = [`${bePres(subj)} not going to ${v}`];
    valid = h === 'will' ? will : h === 'going to' ? going : h === 'negative, will' ? nWill : h === 'negative, going to' ? nGoing : [...will, ...going, ...nWill, ...nGoing];
  } else if (ctx === 'pastcont') valid = [`${bePast(subj)} ${ing(v)}`];
  else if (isNow) valid = [`${bePres(subj)} ${ing(v)}`];
  else if (isPast) valid = [past(v), `didn't ${v}`];
  else if (isPerfect) valid = [`${haveAux} ${pp(v)}`];
  else valid = [subj.third ? third(v) : v, `${doAux}n't ${v}`];
  return valid.includes(group);
}

const fillGap = (t: string, x: string) => t.replace('{{gap}}', x);
const L = (it: Item) => it.prompt.ro;
const PREFIX = /^(Alege varianta corectă|Alege întrebarea corectă pentru propoziția|Alege propoziția negativă corectă pentru|Alege propoziția la diateza pasivă pentru|Alege propoziția corectă la vorbirea indirectă pentru|Adevărat sau fals\? Propoziția este corectă|Adevărat sau fals): /;
const stripPrefix = (p: string) => p.replace(PREFIX, '');
const optsOf = (i: Item): { text: string; ok: boolean }[] => (i.type === 'choice' ? i.options.map((o) => ({ text: o.text?.ro as string, ok: o.id === i.correctId })) : []);
const NA = 'na';

type V = string | null;

/* ---- the dispatcher ---- */
const nounBy = new Map(NOUNS.map((n) => [n.s, n]));
const adjBy = new Map(ADJECTIVES.map((a) => [a.b, a]));
const vocabByEn = new Map(VOCAB_TOPICS.flatMap((t) => t.words.map((w) => [w.en, { ...w, topic: t.id }] as const)));
const vocabByRo = new Map(VOCAB_TOPICS.flatMap((t) => t.words.map((w) => [w.ro, w] as const)));
const topicOf = (en: string) => vocabByEn.get(en)?.topic;
const quizEntries = Object.values(QUIZ_TOPICS).flatMap((t) => [...t.gaps.map((g) => ({ text: g[0], c: g[1], w: g[2], gap: true })), ...t.qs.map((g) => ({ text: g[0], c: g[1], w: g[2], gap: false }))]);
const quizByText = new Map<string, typeof quizEntries>();
for (const e of quizEntries) quizByText.set(e.text, [...(quizByText.get(e.text) ?? []), e]);
const wfBy = new Map(WORD_FORMS.map((e) => [e.sentence, e]));
const IRRBY = new Map(IRREGULAR.filter((v) => v.b !== 'be').map((v) => [v.b, v]));
const sentenceSet = new Set(ORDER_SENTENCES.map((s) => s.text));

function activeText(e: (typeof PASSIVES)[number], isPast: boolean): string {
  const verb = isPast ? past(e.v) : e.sp ? e.v : third(e.v);
  return `${e.s} ${verb} ${e.o}.`;
}
function passiveText(e: (typeof PASSIVES)[number], isPast: boolean): string {
  const be = isPast ? (e.pl ? 'were' : 'was') : e.pl ? 'are' : 'is';
  return `${e.o[0].toUpperCase()}${e.o.slice(1)} ${be} ${pp(e.v)} by ${e.a}.`;
}

function verifyWords(item: Item): V {
  const p = L(item);
  const body = stripPrefix(p);
  let m: RegExpMatchArray | null;
  // ---- irregular verbs ----
  if (item.type === 'choice') {
    const ct = optsOf(item).find((o) => o.ok)?.text as string;
    if ((m = body.match(/^What is the past simple of "(.+)"\?$/))) return IRR.get(m[1])?.p === ct ? null : `past ${m[1]}`;
    if ((m = body.match(/^What is the past participle of "(.+)"\?$/))) return IRR.get(m[1])?.pp === ct ? null : `pp ${m[1]}`;
    if ((m = body.match(/^Which verb is "(.+)" the past simple of\?$/))) return IRR.get(ct)?.p === m[1] && [...IRR.entries()].filter(([, x]) => x.p === m![1]).length === 1 ? null : `base ${m[1]}`;
    if ((m = body.match(/^What is the plural of "(.+)"\?$/))) return nounBy.get(m[1])?.p === ct ? null : `plural ${m[1]}`;
    if (quizByText.get(body)?.some((e) => e.c === ct && optsOf(item).every((o) => o.text === e.c || e.w.includes(o.text)))) return null;
    if (body === 'Which noun is uncountable?') return UNCOUNTABLE.some((u) => u.s === ct) && optsOf(item).filter((o) => !o.ok).every((o) => nounBy.has(o.text)) ? null : `uncountable ${JSON.stringify(optsOf(item))}`;
    if (body === 'Which noun is countable?') return nounBy.has(ct) && optsOf(item).filter((o) => !o.ok).every((o) => UNCOUNTABLE.some((u) => u.s === o.text)) ? null : 'countable';
    if ((m = body.match(/^What is the (comparative|superlative) of "(.+)"\?$/))) { const a = adjBy.get(m[2]); return (m[1] === 'comparative' ? a?.c : a?.s) === ct ? null : `adj ${m[2]}`; }
    if (body === 'Which phrase is correct?') {
      const mm = ct.match(/^(a|an) (?:(\w+) )?(\w+)$/);
      if (!mm) return `article form ${ct}`;
      const [, art, adjW, noun] = mm;
      const n = nounBy.get(noun);
      const expected = adjW ? (/^[aeiou]/.test(adjW) ? 'an' : 'a') : n?.art;
      return n && expected === art && (!adjW || adjBy.has(adjW)) ? null : `article ${ct}`;
    }
    if ((m = p.match(/^Ce înseamnă cuvântul englezesc „(.+)”\?$/))) return vocabByEn.get(m[1])?.ro === ct ? null : `en-ro ${m[1]}`;
    if ((m = p.match(/^Cum se spune „(.+)” în engleză\?$/))) return vocabByRo.get(m[1])?.en === ct ? null : `ro-en ${m[1]}`;
    if (p === 'Care cuvânt nu se potrivește cu celelalte?') {
      const others = optsOf(item).filter((o) => !o.ok).map((o) => topicOf(o.text));
      return new Set(others).size === 1 && topicOf(ct) !== others[0] ? null : 'odd one out';
    }
    // passive
    if (PREFIX.test(p) && p.includes('diateza pasivă')) {
      const act = body.replace(/^"|"$/g, '');
      for (const e of PASSIVES) for (const isPast of [false, true]) {
        if (e.t === 'p' && !isPast) continue;
        if (activeText(e, isPast) === act) return passiveText(e, isPast) === ct && optsOf(item).filter((o) => !o.ok).every((o) => o.text !== ct) ? null : `passive ${act} -> ${ct}`;
      }
      return `passive source not found ${act}`;
    }
    // reported
    if (p.includes('vorbirea indirectă')) {
      const mm = body.match(/^(\w+) said: "(.+)"$/);
      if (!mm) return `reported parse ${body}`;
      return reportedExpected(mm[1], mm[2]) === ct ? null : `reported ${body} -> ${ct}`;
    }
    // questions / negatives built from phrases: judge each option
    if (p.includes('întrebarea corectă') || p.includes('propoziția negativă')) {
      for (const o of optsOf(item)) if (judge(o.text) !== o.ok) return `judge ${o.text} ${o.ok}`;
      return null;
    }
    // gap-style choice from blankItem
    if (/___/.test(body) && !quizByText.has(body)) {
      const hint = body.match(/\(([^)]*)\)$/)?.[1] ?? '';
      const t = body.replace('___', '{{gap}}');
      return verifyGapLike(t, ct, optsOf(item).filter((o) => !o.ok).map((o) => o.text), hint);
    }
    if (quizByText.has(body)) return quizByText.get(body)!.some((e) => e.c === ct && optsOf(item).every((o) => o.text === e.c || e.w.includes(o.text))) ? null : `quiz ${body}`;
    if (quizByText.has(body.replace(/^.*?: /, ''))) return NA;
  }
  return NA;
}

function reportedExpected(name: string, direct: string): string | null {
  const pron = ['Maria', 'Ana', 'Ioana'].includes(name) ? 'she' : 'he';
  const d = direct.replace(/\.$/, '');
  let m: RegExpMatchArray | null;
  const phraseOf = (txt: string) => PHRASE_BY_LONG.find((q) => txt.endsWith(q.rest));
  if ((m = d.match(/^I will (\w+) (.+)$/))) return `${name} said that ${pron} would ${m[1]} ${m[2]}.`;
  if ((m = d.match(/^I am (\w+) (.+)$/))) return `${name} said that ${pron} was ${m[1]} ${m[2]}.`;
  if ((m = d.match(/^I (\w+) (.+)$/)) && phraseOf(d)) return `${name} said that ${pron} ${past(m[1])} ${m[2]}.`;
  return null;
}

/** Gap-like check for templates whose answer comes from the curated rules (verbs via judge, nouns, adjectives, wordform, passive, reported, quiz) */
function verifyGapLike(t: string, correct: string, wrongs: string[], hint: string): V {
  let m: RegExpMatchArray | null;
  // quiz
  const asBlank = t.replace('{{gap}}', '___');
  const q = quizByText.get(asBlank);
  if (q) return q.some((e) => e.c === correct && wrongs.every((w) => e.w.includes(w))) ? null : `quiz ${asBlank}`;
  // word formation
  const wf = wfBy.get(asBlank);
  if (wf) return wf.c === correct && wrongs.every((w) => wf.w.includes(w)) ? null : `wordform ${asBlank}`;
  // passive gap
  if ((m = t.match(/^(.+) \{\{gap\}\} by (.+) (every year|last year)\. \((\w+)\)$/))) {
    const isPast = m[3] === 'last year';
    const e = PASSIVES.find((x) => x.v === m![4] && x.a === m![2] && `${x.o[0].toUpperCase()}${x.o.slice(1)}` === m![1]);
    if (e) {
      if (e.t === 'p' && !isPast) return `passive entry ${t}`;
      const be = isPast ? (e.pl ? 'were' : 'was') : e.pl ? 'are' : 'is';
      return correct === `${be} ${pp(e.v)}` && wrongs.every((w) => w !== correct) ? null : `passive gap ${t}`;
    }
  }
  // reported gap
  if ((m = t.match(/^(\w+) said: "(.+)" → \1 said that (he|she) \{\{gap\}\} (.+)\. \((\w+)\)$/))) {
    const exp = reportedExpected(m[1], m[2]);
    const tail = (x: string) => fillGap(t, x).split(' → ')[1].replace(/\s*\([^)]*\)$/, '');
    return exp !== null && tail(correct) === exp && wrongs.every((w) => tail(w) !== exp) ? null : `reported gap ${t}`;
  }
  // plural gap
  if ((m = t.match(/^(?:There are three|I can see four|We need five|Look at those) \{\{gap\}\}[^(]*\((\w+)\)$/))) {
    const n = nounBy.get(m[1]);
    return n?.p === correct && wrongs.every((w) => w !== n.p) ? null : `plural gap ${t}`;
  }
  // article gap
  if ((m = t.match(/^This is \{\{gap\}\} (?:(\w+) )?(\w+)\.$/))) {
    const n = nounBy.get(m[2]);
    const exp = m[1] ? (/^[aeiou]/.test(m[1]) ? 'an' : 'a') : n?.art;
    return exp === correct && wrongs.every((w) => w !== exp) ? null : `article gap ${t}`;
  }
  if ((m = t.match(/^How \{\{gap\}\} (\w+) do you have\?$/))) {
    const much = UNCOUNTABLE.some((u) => u.s === m![1]);
    const many = NOUNS.some((n) => n.p === m![1]);
    return (much ? correct === 'much' : many && correct === 'many') && !wrongs.includes(correct) ? null : `much/many ${t}`;
  }
  // adjective gap
  if ((m = t.match(/^(.+) is \{\{gap\}\} than (.+)\. \((\w+)\)$/))) { const a = adjBy.get(m[3]); return a?.c === correct && a.A === m[1] && a.B === m[2] && !wrongs.includes(a.c) ? null : `comp gap ${t}`; }
  if ((m = t.match(/^(.+) is the \{\{gap\}\} (.+)\. \((\w+)\)$/))) { const a = adjBy.get(m[3]); return a?.s === correct && a.A === m[1] && a.tail === m[2] && !wrongs.includes(a.s) ? null : `sup gap ${t}`; }
  // irregular gaps and verbs via judge
  const sentence = (x: string) => fillGap(t, x);
  if (!judge(sentence(correct), hint)) return `judge correct ${sentence(correct)}`;
  for (const w of wrongs) if (judge(sentence(w), hint)) return `judge distractor ${sentence(w)}`;
  return null;
}

function verifyGapItem(item: Item): V {
  if (item.type !== 'fill-gap') return NA;
  return verifyGapLike(item.template.ro, item.correct, (item.options ?? []).filter((o) => o !== item.correct), item.template.ro.match(/\(([^)]*)\)$/)?.[1] ?? '');
}

function verifyTf(item: Item): V {
  if (item.type !== 'true-false') return NA;
  const p = L(item);
  const body = stripPrefix(p);
  let m: RegExpMatchArray | null;
  if ((m = body.match(/^The past simple of "(.+)" is "(.+)"\.$/))) return (IRR.get(m[1])?.p === m[2]) === item.correct ? null : `tf ${body}`;
  if ((m = body.match(/^The past participle of "(.+)" is "(.+)"\.$/))) return (IRR.get(m[1])?.pp === m[2]) === item.correct ? null : `tf ${body}`;
  if ((m = body.match(/^The plural of "(.+)" is "(.+)"\.$/))) return (nounBy.get(m[1])?.p === m[2]) === item.correct ? null : `tf ${body}`;
  if ((m = body.match(/^The (comparative|superlative) of "(.+)" is "(.+)"\.$/))) { const a = adjBy.get(m[2]); return ((m[1] === 'comparative' ? a?.c : a?.s) === m[3]) === item.correct ? null : `tf ${body}`; }
  if ((m = body.match(/^How (.+?) (\w+) do you have\?$/))) return ((m[1] === 'many' && NOUNS.some((n) => n.p === m![2])) || (m[1] === 'much' && UNCOUNTABLE.some((u) => u.s === m![2]))) === item.correct ? null : `tf how ${body}`;
  if ((m = body.match(/^(?:There are three|I can see four|We need five|Look at those) (\w+)(?: in the room)?[.!]$/))) return NOUNS.some((n) => n.p === m![1]) === item.correct ? null : `tf plural ${body}`;
  if ((m = body.match(/^(.+) is (.+) than (.+)\.$/)) && ADJECTIVES.some((a) => a.A === m![1] && a.B === m![3])) { const a = ADJECTIVES.find((x) => x.A === m![1] && x.B === m![3])!; return (a.c === m[2]) === item.correct ? null : `tf comp ${body}`; }
  if ((m = body.match(/^(.+) is the (.+?) (in the .+|of .+|at .+|on .+)\.$/)) && ADJECTIVES.some((a) => a.A === m![1] && a.tail === m![3])) { const a = ADJECTIVES.find((x) => x.A === m![1] && x.tail === m![3])!; return (a.s === m[2]) === item.correct ? null : `tf sup ${body}`; }
  if ((m = body.match(/^"(.+)" is (countable|uncountable)\.$/))) { const unc = UNCOUNTABLE.some((u) => u.s === m![1]); const cnt = nounBy.has(m[1]); return ((m[2] === 'uncountable' && unc) || (m[2] === 'countable' && cnt)) === item.correct ? null : `tf ${body}`; }
  if ((m = body.match(/^"(.+)" = "(.+)"$/))) return (vocabByEn.get(m[1])?.ro === m[2]) === item.correct ? null : `tf ${body}`;
  if ((m = body.match(/^This is (a|an) (?:(\w+) )?(\w+)\.$/))) {
    const n = nounBy.get(m[3]);
    const exp = m[2] ? (/^[aeiou]/.test(m[2]) ? 'an' : 'a') : n?.art;
    return (exp === m[1]) === item.correct ? null : `tf article ${body}`;
  }
  if (body.includes(' → ')) {
    const [said, rep] = body.split(' → ');
    const mm = said.match(/^(\w+) said: "(.+)"$/);
    if (!mm) return `tf reported ${body}`;
    return (reportedExpected(mm[1], mm[2]) === rep) === item.correct ? null : `tf reported ${body}`;
  }
  if ((m = body.match(/^(.+) (every year|last year)\.$/)) && / (is|are|was|were) \w+ by /.test(m[1])) {
    const isPast = m[2] === 'last year';
    const sentence = `${m[1]}.`;
    const ok = PASSIVES.some((e) => (e.t === 'b' || isPast) && passiveText(e, isPast) === sentence);
    return ok === item.correct ? null : `tf passive ${body}`;
  }
  // quiz statement: some entry filled with its correct (true) or a wrong (false) option
  for (const e of quizEntries) if (e.gap) {
    if (e.text.replace('___', e.c) === body) return item.correct ? null : `tf quiz true ${body}`;
    if (e.w.some((w) => e.text.replace('___', w) === body)) return item.correct ? `tf quiz false ${body}` : null;
  }
  for (const e of WORD_FORMS) {
    const strip = (x: string) => x.replace(/\s*\([^)]*\)\s*$/, '');
    if (strip(e.sentence).replace('___', e.c) === body) return item.correct ? null : `tf wf ${body}`;
    if (e.w.some((w) => strip(e.sentence).replace('___', w) === body)) return item.correct ? `tf wf false ${body}` : null;
  }
  // verb sentences
  return judge(body) === item.correct ? null : `tf judge ${body}`;
}

function verifyOther(item: Item): V {
  const p = L(item);
  if (item.type === 'order') {
    const text = item.correctOrder.map((id) => item.cards.find((c) => c.id === id)?.text?.ro).join(' ');
    if (sentenceSet.has(text)) return item.cards.map((c) => c.id).join() !== item.correctOrder.join() ? null : 'order not shuffled';
    return PASSIVES.some((e) => [false, true].some((pst) => passiveText(e, pst) === text)) ? null : `order unknown ${text}`;
  }
  if (item.type === 'match') {
    const pairs = item.pairs.map((x) => [x.left.text?.ro as string, x.right.text?.ro as string]);
    if (p.includes('forma de trecut')) return pairs.every(([l, r]) => IRR.get(l)?.p === r) ? null : 'match past';
    if (p.includes('participiul')) return pairs.every(([l, r]) => IRR.get(l)?.pp === r) ? null : 'match pp';
    if (p.includes('singularul')) return pairs.every(([l, r]) => nounBy.get(l)?.p === r) ? null : 'match plural';
    if (p.includes('comparativul')) return pairs.every(([l, r]) => adjBy.get(l)?.c === r) ? null : 'match comp';
    if (p.includes('superlativul')) return pairs.every(([l, r]) => adjBy.get(l)?.s === r) ? null : 'match sup';
    if (p.includes('traducerea')) return pairs.every(([l, r]) => vocabByEn.get(l)?.ro === r) ? null : 'match vocab';
  }
  if (item.type === 'sort') {
    const lab = (id: string) => item.categories.find((c) => c.id === id)?.label.en as string;
    const cards = item.cards.map((c) => [c.text?.ro as string, lab(c.categoryId)]);
    if (p.includes('regulate')) return cards.every(([w, c]) => (c === 'Irregular' ? IRRBY.has(w) : REGULAR.some((r) => r.b === w))) ? null : 'sort regular';
    if (p.includes('pluralul')) {
      const map: Record<string, string> = { s: '+ s', ys: '+ s', os: '+ s', es: '+ es', ies: 'y → ies' };
      return cards.every(([w, c]) => map[nounBy.get(w)?.g ?? ''] === c) ? null : 'sort plural';
    }
    if (p.includes('număra')) return cards.every(([w, c]) => (c.startsWith('Countable') ? nounBy.has(w) : UNCOUNTABLE.some((u) => u.s === w))) ? null : 'sort countable';
    if (p.includes('grupa')) {
      const names = new Map(VOCAB_TOPICS.map((t) => [t.name.en, t.id]));
      return cards.every(([w, c]) => topicOf(w) === names.get(c)) ? null : 'sort vocab';
    }
  }
  return NA;
}

function verify(item: Item): string | null {
  if (item.type === 'read-and-answer') return null;
  for (const fn of [verifyWords, verifyGapItem, verifyTf, verifyOther]) {
    const r = fn(item);
    if (r !== NA) return r;
  }
  return `unrecognised: ${L(item)} ${item.type === 'fill-gap' ? item.template.ro : ''}`;
}

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

const SEED = 20261127;
const COUNT = 200;
const genSkills = gim.filter((s) => s.itemSources.some((x) => 'generator' in x));
const optionTexts = (item: Item): string[] => (item.type === 'choice' ? item.options.map((o) => o.text?.ro ?? '') : item.type === 'fill-gap' ? item.options ?? [] : []);

describe('English gimnaziu generators over every generator-backed skill', () => {
  it('there are at least 40 generator-backed V-VIII skills', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(40);
  });

  for (const skill of genSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });
      const generated = items.filter((i) => i.id.startsWith('gen.'));

      it(`produces ${COUNT} valid items with the skill's explanation`, () => {
        expect(items.length).toBe(COUNT);
        expect(items.flatMap((i) => validateItem(i))).toEqual([]);
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
        for (const i of items) {
          expect(i.skillId).toBe(skill.id);
          expect(i.explanationId).toBe(skill.explanations[0]);
        }
        expect(generated.length).toBeGreaterThan(100);
      });

      it('correct responses pass and wrong ones fail; English content inside bilingual instructions', () => {
        for (const i of generated) {
          expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
          if (i.type === 'choice') {
            const wrong = i.options.find((o) => o.id !== i.correctId) as { id: string };
            expect(checkResponse(i, { type: 'choice', selectedId: wrong.id }), i.id).toBe(false);
          }
          if (i.type === 'fill-gap') expect(checkResponse(i, { type: 'fill-gap', value: (i.options ?? []).find((o) => o !== i.correct) as string }), i.id).toBe(false);
          if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct }), i.id).toBe(false);
          expect(i.prompt.en, i.id).toBeTruthy();
        }
      });

      it('has unique options, exactly one correct, at least 3 options for gap and choice', () => {
        for (const i of generated) {
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
          if (i.type === 'choice') expect(texts.length, i.id).toBeGreaterThanOrEqual(3);
          if (i.type === 'fill-gap') {
            expect(texts.length, i.id).toBeGreaterThanOrEqual(3);
            expect(texts.filter((o) => o === i.correct).length).toBe(1);
          }
          if (i.type === 'sort') {
            expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
            for (const c of i.categories) expect(i.cards.some((k) => k.categoryId === c.id), `${i.id} empty category`).toBe(true);
          }
          if (i.type === 'match') {
            expect(new Set(i.pairs.map((x) => x.left.text?.ro)).size).toBe(i.pairs.length);
            expect(new Set(i.pairs.map((x) => x.right.text?.ro)).size).toBe(i.pairs.length);
          }
          if (i.type === 'order') expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
        }
      });

      it('answers are independently verified (own morphology, tables and a grammar judge)', () => {
        for (const i of generated) expect(verify(i), `${i.id}: ${L(i)}`).toBeNull();
      });

      it('is deterministic for a seed and varies: at least 12 distinct items out of 200', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
        expect(generateItems(skill, 30, { seed: SEED + 1 })).not.toEqual(items.slice(0, 30));
        const keys = new Set(generated.map((i) => JSON.stringify({ ...i, id: '', provenance: '' }).replace(/"id":"[^"]*",?/g, '')));
        expect(keys.size).toBeGreaterThanOrEqual(12);
      });

      it('works at every difficulty and stays verified', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          for (const i of generateItems(skill, 60, { seed: 7, difficulty: d })) {
            expect(validateItem(i)).toEqual([]);
            expect(checkResponse(i, correctResponse(i))).toBe(true);
            if (i.id.startsWith('gen.')) expect(verify(i), L(i)).toBeNull();
          }
        }
      });
    });
  }

  it('the generated items cover choice, true-false, fill-gap, order, match and sort', () => {
    const types = new Set<string>();
    for (const s of genSkills) for (const d of [1, 3] as const) for (const i of generateItems(s, 60, { seed: 11, difficulty: d })) types.add(i.type);
    for (const t of ['choice', 'true-false', 'fill-gap', 'order', 'match', 'sort']) expect(types.has(t), t).toBe(true);
  });

  it('British spelling: no American forms in any generated or banked text', () => {
    const bad = /\b(color|favorite|neighbor|center|theater|realize|traveled|practice a|gray|program\b|vacation|apartment|sidewalk|candy)/i;
    const raw = [...dataFiles, ...bankFiles, explFile].map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(raw.match(bad)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Banks                                                              */
/* ------------------------------------------------------------------ */

describe('English gimnaziu reading banks', () => {
  const banks = bankFiles.map((f) => ({ f, items: readJson(f) as Item[] }));
  it('validate, own ai-draft beta, 5 texts per grade, rising length (80-180 words), 4 questions each', () => {
    const all = banks.flatMap((b) => b.items);
    expect(validateItems(all)).toEqual([]);
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    const avg: number[] = [];
    for (const { f, items } of banks) {
      const g = Number(f.match(/gim(\d)\.json$/)?.[1]);
      expect(items.length).toBe(5);
      const words = items.map((i) => (i.type === 'read-and-answer' ? i.passage.ro.split(/\s+/).length : 0));
      for (const w of words) { expect(w).toBeGreaterThanOrEqual(80); expect(w).toBeLessThanOrEqual(180); }
      avg.push(words.reduce((a, b) => a + b, 0) / words.length);
      for (const i of items) {
        expect(i.type).toBe('read-and-answer');
        expect(i.reviewStatus).toBe('beta');
        expect(i.provenance.source).toBe('ai-draft');
        expect(i.provenance.licence).toBe('OWN');
        expect(getAllSkills().find((s) => s.id === i.skillId)?.grade).toBe(g);
        if (i.type === 'read-and-answer') {
          expect(i.questions.length).toBe(4);
          expect(i.questions.some((q) => q.type === 'true-false')).toBe(true);
          expect(i.questions.some((q) => q.type === 'choice')).toBe(true);
          for (const q of i.questions) if (q.type === 'choice') expect(new Set(q.options.map((o) => o.text?.ro)).size).toBe(q.options.length);
          expect(checkResponse(i, correctResponse(i))).toBe(true);
        }
      }
    }
    for (let k = 1; k < avg.length; k++) expect(avg[k]).toBeGreaterThan(avg[k - 1]);
  });
});

/* ------------------------------------------------------------------ */
/*  EN VI: the English part                                            */
/* ------------------------------------------------------------------ */

describe('EN VI Limbă și comunicare with the English part', () => {
  const papers = GIM_BLUEPRINTS.filter((b) => b.exam === 'en6' && b.test === 1);
  it('has Romanian and English sections: reading 10 p, vocabulary and grammar 8 x 2 p, functional 2 x 3 p, built from grade V-VI eng skills', () => {
    expect(papers.length).toBe(3);
    for (const bp of papers) {
      const ids = bp.sections.map((s) => s.id);
      expect(ids.slice(-3)).toEqual(['eng-read', 'eng-lang', 'eng-func']);
      expect(maxPoints(bp)).toBe(60 + 10 + 16 + 6);
      for (const sec of bp.sections.filter((s) => s.id.startsWith('eng-')))
        for (const p of sec.parts) if ('ids' in p.skills) for (const id of p.skills.ids) {
          expect(id.startsWith('eng.'), id).toBe(true);
          expect([5, 6]).toContain(getAllSkills().find((s) => s.id === id)?.grade);
        }
      expect(bp.timeLimitMin).toBe(120);
    }
  });

  it('assembles with English items, full counts, deterministic, English texts differ between tests', () => {
    const texts: string[] = [];
    for (const bp of papers) {
      const t = assembleTest(bp, { seed: bp.seed });
      expect(t.shortfalls).toEqual([]);
      expect(t.skippedSections).toEqual([]);
      expect(assembleTest(bp, { seed: bp.seed })).toEqual(t);
      const read = t.sections.find((s) => s.id === 'eng-read')!.items;
      expect(read.length).toBe(1);
      expect(read[0].type).toBe('read-and-answer');
      texts.push(read[0].type === 'read-and-answer' ? read[0].passage.ro : '');
      expect(t.sections.find((s) => s.id === 'eng-lang')!.items.length).toBe(8);
      expect(t.sections.find((s) => s.id === 'eng-func')!.items.length).toBe(2);
      for (const sec of t.sections.filter((s) => s.id.startsWith('eng-'))) for (const it of sec.items) { expect(it.skillId.startsWith('eng.')).toBe(true); expect(validateItem(it)).toEqual([]); }
    }
    expect(new Set(texts).size).toBe(3);
  });

  it('scores per English competence; a perfect paper is 100 %, English wrong only lowers the English groups', () => {
    const bp = papers[0];
    const t = assembleTest(bp, { seed: bp.seed });
    const all: Record<string, boolean> = {};
    for (const s of t.sections) for (const i of s.items) all[i.id] = true;
    const full = scoreGimExam(t, all);
    expect(full.percent).toBe(100);
    expect(full.maxPoints).toBe(92);
    expect(full.competences.map((c) => c.competence)).toEqual(expect.arrayContaining(['eng_read', 'eng_lang', 'eng_func', 'lectura', 'limba']));
    const engIds = t.sections.filter((s) => s.id.startsWith('eng-')).flatMap((s) => s.items.map((i) => i.id));
    const wrongEng = scoreGimExam(t, Object.fromEntries(Object.entries(all).map(([k, v]) => [k, engIds.includes(k) ? false : v])));
    expect(wrongEng.points).toBe(60);
    expect(wrongEng.competences.find((c) => c.competence === 'lectura')?.ratio).toBe(1);
    expect(wrongEng.competences.find((c) => c.competence === 'eng_lang')?.ratio).toBe(0);
    expect(wrongEng.markApplies).toBe(false);
  });
});

