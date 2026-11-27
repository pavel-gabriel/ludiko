import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import { numberWord as engineNumberWord, timePhrase as engineTimePhrase } from '../src/engine/items/generators/engPrimaryData';
import { availableSubjects, isSubjectAvailable, subjectMinGrade } from '../src/learner/availability';
import { LEARN_SUBJECTS } from '../src/ui/learn/subjects';
import { extractEnglishSpeech, frameEnglishSpeech, itemEnglishSpeech } from '../src/ui/speech/englishSpeech';
import { useReadAloud } from '../src/ui/speech/useReadAloud';
import i18n from '../src/i18n/config';
import { simulate } from './helpers/learner';
import type { Item, ItemResponse, Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));

const engAll = getSkillsBySubject('eng');
const prim = engAll.filter((s) => s.grade <= 4);
const byGrade = (g: number) => prim.filter((s) => s.grade === g);

const skillFiles = [0, 1, 2, 3, 4].map((g) => join(CONTENT, 'skills', 'eng', `grade${g}.json`));
const explFiles = [0, 1, 2, 3, 4].map((g) => join(CONTENT, 'explanations', 'eng', `grade${g}.json`));
const dataFiles = ['vocab', 'lists', 'grammar', 'reading'].map((n) => join(CONTENT, 'data', 'eng', `primary-${n}.json`));

/* ------------------------------------------------------------------ */
/*  Independent reference data (read straight from the JSON files)      */
/* ------------------------------------------------------------------ */

const vocab = readJson(dataFiles[0]);
const lists = readJson(dataFiles[1]);
const grammar = readJson(dataFiles[2]);
const reading = readJson(dataFiles[3]);
interface W { en: string; ro: string; e: string; topic: string; group: string; grade: number }
const WORDS: W[] = vocab.words;
const wordByEn = new Map(WORDS.map((w) => [w.en, w]));
const wordByRo = new Map(WORDS.map((w) => [w.ro, w]));
const wordByEmoji = new Map(WORDS.map((w) => [w.e, w]));
interface Greet { intent: string; en: string; ro: string; grade: number; avoid?: string[]; situation?: { ro: string; en: string } }
const GREETS: Greet[] = lists.greetings;
const DAYS: { en: string; ro: string }[] = lists.days;
const MONTHS: { en: string; ro: string; season: string }[] = lists.months;

/** Independent English number words 0-100 (tables, not the engine's helper) */
const UNITS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const DECADES: Record<number, string> = { 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety' };
function words(n: number): string {
  if (n <= 19) return UNITS[n];
  if (n === 100) return 'one hundred';
  const tens = n - (n % 10);
  return n % 10 === 0 ? DECADES[tens] : `${DECADES[tens]}-${UNITS[n % 10]}`;
}
const fromWords = (w: string): number => {
  for (let n = 0; n <= 100; n++) if (words(n) === w) return n;
  throw new Error(`not a number word: ${w}`);
};
const clockPhrase = (h: number, m: number): string => {
  const hh = ((h + 11) % 12) + 1;
  const nx = (hh % 12) + 1;
  if (m === 0) return `${words(hh)} o'clock`;
  if (m === 15) return `a quarter past ${words(hh)}`;
  if (m === 30) return `half past ${words(hh)}`;
  if (m === 45) return `a quarter to ${words(nx)}`;
  return m < 30 ? `${words(m)} past ${words(hh)}` : `${words(60 - m)} to ${words(nx)}`;
};

/** The response a perfect child would give */
function correctResponse(item: Item): ItemResponse {
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer':
    case 'hotspot':
      return { type: item.type, selectedId: item.correctId };
    case 'true-false':
      return { type: 'true-false', value: item.correct };
    case 'number-input':
      return { type: 'number-input', value: item.correct };
    case 'fill-gap':
      return { type: 'fill-gap', value: item.correct };
    case 'order':
      return { type: 'order', order: item.correctOrder };
    case 'sort':
      return { type: 'sort', placement: Object.fromEntries(item.cards.map((c) => [c.id, c.categoryId])) };
    case 'match':
      return { type: 'match', pairs: Object.fromEntries(item.pairs.map((p) => [p.left.id, p.right.id])) };
    case 'read-and-answer':
      return { type: 'read-and-answer', answers: Object.fromEntries(item.questions.map((q) => [q.id, correctResponse(q)])) };
  }
}

const optionTexts = (i: Item): string[] => {
  if (i.type === 'choice') return i.options.map((o) => o.text?.ro ?? '');
  if (i.type === 'picture-choice') return i.options.map((o) => JSON.stringify(o.visual));
  if (i.type === 'fill-gap') return i.options ?? [];
  return [];
};

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('eng primary skill graph (0-IV)', () => {
  it('has 8-9 structurally valid skills in each of grades 0-IV', () => {
    for (const g of [0, 1, 2, 3, 4]) {
      expect(byGrade(g).length, `grade ${g}`).toBeGreaterThanOrEqual(8);
      expect(byGrade(g).length, `grade ${g}`).toBeLessThanOrEqual(9);
    }
    expect(skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)))).toEqual([]);
    expect(prim.length).toBe(41);
  });

  it('is a valid DAG; prerequisites stay inside eng and never point to a later grade', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    const byId = new Map(engAll.map((s) => [s.id, s]));
    for (const s of prim) {
      for (const p of s.prerequisites) {
        const pre = byId.get(p);
        expect(pre, `${s.id} -> ${p}`).toBeDefined();
        expect(pre!.grade, `${s.id} -> ${p}`).toBeLessThanOrEqual(s.grade);
      }
    }
  });

  it('roots (no prerequisites) are grade 0 skills only; grade 0 has the entry roots', () => {
    const roots = prim.filter((s) => s.prerequisites.length === 0);
    expect(roots.length).toBeGreaterThanOrEqual(2);
    for (const r of roots) expect(r.grade, r.id).toBe(0);
    expect(roots.map((r) => r.id)).toEqual(expect.arrayContaining(['eng.greet.0', 'eng.colours.0', 'eng.numbers.10.0']));
    // every later skill is reachable from a root
    for (const s of prim.filter((x) => x.grade > 0)) expect(s.prerequisites.length, s.id).toBeGreaterThanOrEqual(1);
  });

  it('every grade has prerequisites reaching back to the previous grade', () => {
    for (const g of [1, 2, 3, 4]) {
      const prevIds = new Set(byGrade(g - 1).map((s) => s.id));
      expect(byGrade(g).some((s) => s.prerequisites.some((p) => prevIds.has(p))), `grade ${g}`).toBe(true);
    }
  });

  it('uses LM1-CP-IV-2013 with own provenance, an English title and the "verify" note; ids end with the grade', () => {
    for (const s of prim) {
      expect(s.subject).toBe('eng');
      expect(s.competences.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.competences.every((c) => c.programa === 'LM1-CP-IV-2013' && /^\d+\.\d+$/.test(c.code)), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
      expect(s.id.startsWith('eng.'), s.id).toBe(true);
      expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
      expect(s.itemSources.some((x) => 'generator' in x), s.id).toBe(true);
      for (const src of s.itemSources) if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
    }
  });

  it('follows the primary programa progression: oral/vocabulary early, reading and grammar from III', () => {
    const ids = (g: number) => byGrade(g).map((s) => s.id).join(' ');
    for (const part of ['greet', 'colours', 'numbers.10', 'family', 'animals', 'body', 'food', 'toys']) expect(ids(0), part).toContain(part);
    for (const part of ['clothes', 'weather', 'house', 'numbers.20', 'actions', 'school', 'farm', 'greet']) expect(ids(1), part).toContain(part);
    for (const part of ['numbers.100', 'days', 'months', 'prepositions', 'likes', 'tobe', 'can', 'food']) expect(ids(2), part).toContain(part);
    for (const part of ['havegot', 'plurals', 'articles', 'present', 'daily', 'time', 'wordorder', 'reading']) expect(ids(3), part).toContain(part);
    for (const part of ['time', 'present', 'continuous', 'questions', 'adjectives', 'jobs', 'wordorder', 'reading']) expect(ids(4), part).toContain(part);
    // no reading skills before grade III
    for (const g of [0, 1, 2]) expect(ids(g)).not.toContain('reading');
  });

  it('ids are unique and the generators are named eng-primary-*', () => {
    expect(new Set(prim.map((s) => s.id)).size).toBe(prim.length);
    const used = new Set(prim.flatMap((s) => s.itemSources.flatMap((x) => ('generator' in x ? [x.generator] : []))));
    for (const g of used) expect(g.startsWith('eng-primary-'), g).toBe(true);
    expect(listGenerators()).toEqual(expect.arrayContaining(['eng-primary-vocab', 'eng-primary-number', 'eng-primary-calendar', 'eng-primary-time', 'eng-primary-grammar', 'eng-primary-greet', 'eng-primary-read']));
  });
});

describe('eng primary explanations', () => {
  it('every skill has one existing 3-frame explanation (ai-draft, beta, OWN, with English) with balanced markers', () => {
    for (const s of prim) {
      expect(s.explanations).toEqual([`exp.${s.id}`]);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      expect(exp?.title.en).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
      for (const f of exp?.frames ?? []) {
        expect(f.text.en, s.id).toBeTruthy();
        expect(f.visual, s.id).toBeDefined();
        for (const t of [f.text.ro, f.text.en as string]) {
          expect((t.match(/«/g) ?? []).length, `${s.id}: ${t}`).toBe((t.match(/»/g) ?? []).length);
          if (s.grade <= 2) expect(extractEnglishSpeech(t).length, `${s.id}: ${t}`).toBeGreaterThan(0);
        }
      }
      // every explanation marks at least one English word (listen button in the frame player)
      expect(exp!.frames.some((f) => extractEnglishSpeech(f.text.ro).length > 0), s.id).toBe(true);
    }
    const all = explFiles.flatMap((f) => readJson(f) as { skillId: string }[]);
    expect(new Set(all.map((e) => e.skillId)).size).toBe(prim.length);
  });
});

/* ------------------------------------------------------------------ */
/*  Curated data                                                       */
/* ------------------------------------------------------------------ */

describe('eng primary curated data', () => {
  it('own work with valid provenance; NFC text; comma-below diacritics only', () => {
    for (const f of dataFiles) {
      const raw = readFileSync(f, 'utf8');
      const prov = JSON.parse(raw).provenance;
      expect(validateProvenance(prov), relative(ROOT, f)).toEqual([]);
      expect(prov.licence).toBe('OWN');
      expect(prov.source).toBe('ai-draft');
    }
    for (const f of [...dataFiles, ...skillFiles, ...explFiles]) {
      const raw = readFileSync(f, 'utf8');
      expect(raw.normalize('NFC') === raw, `${relative(ROOT, f)} is NFC`).toBe(true);
      expect(/[şţŞŢ]/.test(raw), `${relative(ROOT, f)} has cedilla diacritics`).toBe(false);
    }
  });

  it('vocabulary: unique English words, Romanian meanings and emoji; every word has an emoji, topic, group and grade', () => {
    const seen = { en: new Set<string>(), ro: new Set<string>(), e: new Set<string>() };
    for (const w of WORDS) {
      expect(w.e && w.e.length > 0, w.en).toBe(true);
      expect(/^[a-zA-Z ]+$/.test(w.en), w.en).toBe(true);
      expect(w.ro.trim().length, w.en).toBeGreaterThan(0);
      expect(w.topic && w.group).toBeTruthy();
      expect([0, 1, 2, 3, 4]).toContain(w.grade);
      for (const k of ['en', 'ro', 'e'] as const) {
        expect(seen[k].has(w[k]), `duplicate ${k}: ${w[k]}`).toBe(false);
        seen[k].add(w[k]);
      }
    }
    expect(WORDS.length).toBeGreaterThanOrEqual(130);
  });

  it('every vocabulary topic is used by a skill, and every skill topic has enough words', () => {
    const topics = new Set(WORDS.map((w) => w.topic));
    const used = new Set<string>();
    for (const s of prim) {
      for (const src of s.itemSources) {
        if ('generator' in src && src.generator === 'eng-primary-vocab') {
          for (const t of (src.params?.topics as string[]) ?? []) {
            used.add(t);
            const inTopic = WORDS.filter((w) => w.topic === t);
            expect(inTopic.length, `${s.id}:${t}`).toBeGreaterThanOrEqual(4);
            // words are taught no later than the skill's grade
            expect(inTopic.every((w) => w.grade <= s.grade), `${s.id}:${t}`).toBe(true);
          }
        }
      }
    }
    for (const t of topics) expect(used.has(t), `topic ${t} unused`).toBe(true);
  });

  it('British spelling: no American forms in any new content file or generator', () => {
    const american = /\b(color|colors|colored|favorite|favorites|gray|neighbor|neighbors|center|theater|mom|moms|cookie|cookies|candy|vacation|sneakers|pants|soccer|fall season|program|organize|realize)\b/i;
    const files = [...dataFiles, ...skillFiles, ...explFiles];
    for (const f of files) {
      const raw = readFileSync(f, 'utf8');
      const hit = american.exec(raw);
      expect(hit, `${relative(ROOT, f)}: ${hit?.[0]}`).toBeNull();
    }
    // British forms are present
    const all = readFileSync(dataFiles[0], 'utf8') + readFileSync(dataFiles[3], 'utf8');
    expect(all).toMatch(/trousers/);
    expect(all).toMatch(/biscuit/);
    expect(all).toMatch(/autumn/);
    expect(all).toMatch(/favourite/);
  });

  it('greetings: unique intents, English phrases and Romanian meanings; a situation for every item of grade 0-1 used as a question', () => {
    expect(new Set(GREETS.map((g) => g.intent)).size).toBe(GREETS.length);
    expect(new Set(GREETS.map((g) => g.en)).size).toBe(GREETS.length);
    expect(new Set(GREETS.map((g) => g.ro)).size).toBe(GREETS.length);
    for (const g of GREETS.filter((x) => x.situation)) expect(g.situation!.en.length, g.intent).toBeGreaterThan(5);
    for (const grade of [0, 1, 2]) expect(GREETS.filter((g) => g.grade === grade && g.situation).length, `grade ${grade}`).toBeGreaterThanOrEqual(3);
    for (const g of GREETS) for (const a of g.avoid ?? []) expect(GREETS.some((x) => x.intent === a), `${g.intent} avoids unknown ${a}`).toBe(true);
  });

  it('calendar: 7 days from Monday and 12 months with the right seasons', () => {
    expect(DAYS.map((d) => d.en)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(DAYS.map((d) => d.ro)).toEqual(['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică']);
    expect(MONTHS.map((m) => m.en)).toEqual(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
    expect(MONTHS.map((m) => m.season)).toEqual(['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']);
  });

  it('number and time helpers agree with the independent reference for every value', () => {
    for (let n = 0; n <= 100; n++) expect(engineNumberWord(n), String(n)).toBe(words(n));
    expect(words(21)).toBe('twenty-one');
    expect(words(100)).toBe('one hundred');
    for (let h = 1; h <= 12; h++) for (const m of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) expect(engineTimePhrase(h, m), `${h}:${m}`).toBe(clockPhrase(h, m));
    expect(clockPhrase(12, 45)).toBe('a quarter to one');
  });

  it('grammar sentences: one gap, answer not among the wrong options, wrong options really change the sentence', () => {
    const S = grammar.sentences as { t: string; g: number; en: string; ro: string; x: string[] }[];
    expect(S.length).toBeGreaterThanOrEqual(170);
    const fulls = new Set<string>();
    for (const s of S) {
      expect((s.en.match(/\[/g) ?? []).length, s.en).toBe(1);
      expect((s.en.match(/\]/g) ?? []).length, s.en).toBe(1);
      const answer = /\[([^\]]+)\]/.exec(s.en)![1];
      const full = s.en.replace(/[[\]]/g, '');
      expect(fulls.has(full), `duplicate sentence ${full}`).toBe(false);
      fulls.add(full);
      expect(s.x.length, s.en).toBeGreaterThanOrEqual(1);
      expect(new Set(s.x).size, s.en).toBe(s.x.length);
      expect(s.x.includes(answer), s.en).toBe(false);
      expect(s.ro.trim().length, s.en).toBeGreaterThan(3);
      for (const w of s.x) expect(s.en.replace(/\[[^\]]+\]/, w), s.en).not.toBe(full);
    }
    // a wrong option is never the right answer of an identical sentence with another gap word
    const topics = new Set(S.map((s) => s.t));
    for (const t of ['tobe', 'can', 'likes', 'prepositions', 'havegot', 'present', 'daily', 'plurals', 'articles', 'continuous', 'questions']) expect(topics.has(t), t).toBe(true);
    // each skill topic has at least 10 sentences at its grade
    for (const s of prim) {
      for (const src of s.itemSources) {
        if ('generator' in src && src.generator === 'eng-primary-grammar' && !(src.params?.topics as string[]).includes('opposites')) {
          const [lo, hi] = src.params?.grades as [number, number];
          const n = S.filter((x) => (src.params?.topics as string[]).includes(x.t) && x.g >= lo && x.g <= hi).length;
          expect(n, s.id).toBeGreaterThanOrEqual(10);
        }
      }
    }
  });

  it('opposites: no word is a partner of two pairs and Romanian meanings are unique', () => {
    const O = grammar.opposites as { a: string; b: string; ro: [string, string] }[];
    const all = O.flatMap((o) => [o.a, o.b]);
    expect(new Set(all).size).toBe(all.length);
    const ro = O.flatMap((o) => o.ro);
    expect(new Set(ro).size).toBe(ro.length);
    expect(O.length).toBeGreaterThanOrEqual(12);
  });

  it('reading texts: 30-70 words, 5-6 questions, answers found in the text, valid options', () => {
    const T = reading.texts as { id: string; g: number; text: string; q: any[] }[];
    expect(T.filter((t) => t.g === 3).length).toBeGreaterThanOrEqual(5);
    expect(T.filter((t) => t.g === 4).length).toBeGreaterThanOrEqual(5);
    expect(new Set(T.map((t) => t.id)).size).toBe(T.length);
    for (const t of T) {
      const n = t.text.trim().split(/\s+/).length;
      expect(n, `${t.id}: ${n} words`).toBeGreaterThanOrEqual(30);
      expect(n, `${t.id}: ${n} words`).toBeLessThanOrEqual(70);
      expect(t.q.length, t.id).toBeGreaterThanOrEqual(5);
      expect(t.q.some((q) => 'tf' in q), t.id).toBe(true);
      expect(t.q.some((q) => 'a' in q), t.id).toBe(true);
      for (const q of t.q) {
        if ('a' in q) {
          const lit = q.a.replace(/^an? /, '').toLowerCase();
          expect(t.text.toLowerCase(), `${t.id}: "${q.a}"`).toContain(lit);
          expect(q.x.includes(q.a), `${t.id}: ${q.ro}`).toBe(false);
          expect(new Set(q.x).size).toBe(q.x.length);
          expect(q.x.length).toBeGreaterThanOrEqual(2);
          expect(q.ro && q.en).toBeTruthy();
        } else {
          expect(typeof q.tf).toBe('boolean');
          expect(q.s.endsWith('.'), q.s).toBe(true);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Independent verification of generated items                        */
/* ------------------------------------------------------------------ */

type Verdict = string | null;
const fail = (msg: string): Verdict => msg;
const optText = (i: any, id: string): string => (i.options.find((o: any) => o.id === id)?.text?.ro as string) ?? '';
const correctText = (i: any): string => optText(i, i.correctId);
const romToEn = new Map<string, string>([...WORDS.map((w) => [w.ro, w.en] as const), ...GREETS.map((g) => [g.ro, g.en] as const), ...DAYS.map((d) => [d.ro, d.en] as const), ...MONTHS.map((m) => [m.ro, m.en] as const)]);
const enToRo = new Map<string, string>([...WORDS.map((w) => [w.en, w.ro] as const), ...GREETS.map((g) => [g.en, g.ro] as const), ...DAYS.map((d) => [d.en, d.ro] as const), ...MONTHS.map((m) => [m.en, m.ro] as const)]);
const clash = (a: string, b: string) => a === b || (a === 'place' && (b === 'house' || b === 'school')) || (b === 'place' && (a === 'house' || a === 'school')) || (a === 'animal' && b === 'toy') || (a === 'toy' && b === 'animal');
const clashG = (a: Greet, b: Greet) => a.intent === b.intent || !!a.avoid?.includes(b.intent) || !!b.avoid?.includes(a.intent);

const S = grammar.sentences as { t: string; g: number; en: string; ro: string; x: string[] }[];
const SENT = S.map((s) => ({ ...s, answer: /\[([^\]]+)\]/.exec(s.en)![1], full: s.en.replace(/[[\]]/g, ''), template: s.en.replace(/\[[^\]]+\]/, '{{gap}}') }));
const fillT = (s: (typeof SENT)[number], w: string) => s.template.replace('{{gap}}', w);

function verify(item: Item, skill: Skill): Verdict {
  const p = item.prompt.ro;
  const any = item as any;
  let m: RegExpExecArray | null;

  /* ---- vocabulary ---- */
  if (p.startsWith('Ce arată imaginea?')) {
    const icon = any.visual?.icon as string;
    const w = wordByEmoji.get(icon);
    if (!w) return fail(`unknown emoji ${icon}`);
    return correctText(item) === w.en ? null : fail(`picture ${icon} is ${w.en}, correct says ${correctText(item)}`);
  }
  if ((m = /^Ascultă și alege imaginea: «(.+)»\.$/.exec(p))) {
    const w = wordByEn.get(m[1]);
    if (!w) return fail(`unknown word ${m[1]}`);
    const opt = any.options.find((o: any) => o.id === any.correctId);
    if (opt.visual.icon !== w.e) return fail(`correct picture is ${opt.visual.icon}, expected ${w.e}`);
    const icons = any.options.map((o: any) => o.visual.icon);
    if (new Set(icons).size !== icons.length) return fail('repeated picture');
    if (icons.some((ic: string) => !wordByEmoji.has(ic))) return fail('unknown picture');
    return null;
  }
  if ((m = /^Cum se spune „(.+)” în engleză\?$/.exec(p))) {
    const en = romToEn.get(m[1]);
    if (!en) return fail(`unknown romanian ${m[1]}`);
    return correctText(item) === en ? null : fail(`${m[1]} is ${en}, correct says ${correctText(item)}`);
  }
  if ((m = /^Ce înseamnă «(.+)»\?$/.exec(p))) {
    const ro = enToRo.get(m[1]);
    if (!ro) return fail(`unknown english ${m[1]}`);
    return correctText(item) === ro ? null : fail(`${m[1]} means ${ro}, correct says ${correctText(item)}`);
  }
  if (p === 'Care cuvânt nu face parte din grup?') {
    const ws = any.options.map((o: any) => wordByEn.get(o.text.ro) as W);
    if (ws.some((w: W | undefined) => !w)) return fail('unknown option');
    const odd = wordByEn.get(correctText(item)) as W;
    const rest = ws.filter((w: W) => w.en !== odd.en);
    if (rest.length !== 3) return fail('not 3 mates');
    if (!rest.every((w: W) => w.group === rest[0].group)) return fail('mates differ');
    if (clash(odd.group, rest[0].group)) return fail(`odd word ${odd.en} (${odd.group}) clashes with ${rest[0].group}`);
    if (ws.some((w: W) => w.grade > skill.grade)) return fail('word not taught yet');
    return null;
  }
  if (p === 'Potrivește fiecare cuvânt cu imaginea lui.') {
    for (const pr of any.pairs) {
      const w = wordByEn.get(pr.left.text.ro);
      if (!w || pr.right.visual.icon !== w.e) return fail(`pair ${pr.left.text.ro}`);
    }
    return null;
  }
  if (p === 'Potrivește fiecare cuvânt englezesc cu sensul lui.') {
    for (const pr of any.pairs) if (enToRo.get(pr.left.text.ro) !== pr.right.text.ro) return fail(`pair ${pr.left.text.ro}`);
    return null;
  }
  if (p === 'Potrivește fiecare expresie englezească cu sensul ei.') {
    for (const pr of any.pairs) if (enToRo.get(pr.left.text.ro) !== pr.right.text.ro) return fail(`pair ${pr.left.text.ro}`);
    const gs = any.pairs.map((pr: any) => GREETS.find((g) => g.en === pr.left.text.ro) as Greet);
    for (const a of gs) for (const b of gs) if (a !== b && clashG(a, b)) return fail(`clashing greetings ${a.intent}/${b.intent}`);
    return null;
  }
  if (p === 'Pune fiecare cuvânt în grupa potrivită.') {
    const groups = new Map<string, string>();
    for (const c of any.categories) {
      const g = Object.keys(groupNames).find((k) => groupNames[k] === c.label.ro);
      if (!g) return fail(`unknown category ${c.label.ro}`);
      groups.set(c.id, g);
    }
    const [g1, g2] = [...groups.values()];
    if (clash(g1, g2)) return fail(`groups clash ${g1}/${g2}`);
    for (const c of any.cards) {
      const w = wordByEn.get(c.text.ro);
      if (!w) return fail(`unknown card ${c.text.ro}`);
      if (groups.get(c.categoryId) !== w.group) return fail(`${w.en} is ${w.group}`);
    }
    return null;
  }
  if ((m = /^Imaginea arată «(.+)»\. Adevărat sau fals\?$/.exec(p))) {
    const shown = wordByEn.get(m[1]);
    const real = wordByEmoji.get(any.visual.icon);
    if (!shown || !real) return fail('unknown word');
    return any.correct === (shown.en === real.en) ? null : fail(`true-false wrong for ${shown.en}/${real.en}`);
  }

  /* ---- greetings (situations) ---- */
  const sit = GREETS.find((g) => g.situation?.ro === p);
  if (sit) {
    if (correctText(item) !== sit.en) return fail(`situation expects ${sit.en}`);
    for (const o of any.options as any[]) {
      const g = GREETS.find((x) => x.en === o.text.ro);
      if (!g) return fail(`unknown phrase ${o.text.ro}`);
      if (g.intent !== sit.intent && clashG(sit, g)) return fail(`clashing option ${g.intent} for ${sit.intent}`);
      if (g.grade > skill.grade) return fail('phrase not taught yet');
    }
    return null;
  }

  /* ---- numbers ---- */
  if ((m = /^Cum se scrie în engleză numărul (\d+)\?$/.exec(p))) return correctText(item) === words(Number(m[1])) ? null : fail(`${m[1]} -> ${correctText(item)}`);
  if ((m = /^Ce număr este «(.+)»\?$/.exec(p))) return correctText(item) === String(fromWords(m[1])) ? null : fail(`${m[1]} -> ${correctText(item)}`);
  if ((m = /^Scrie numărul «(.+)» cu cifre\.$/.exec(p))) return any.correct === fromWords(m[1]) ? null : fail(`${m[1]} -> ${any.correct}`);
  if (p.startsWith('Câte obiecte sunt?')) return correctText(item) === words(any.visual.count) ? null : fail(`count ${any.visual.count} -> ${correctText(item)}`);
  if ((m = /^Ce număr urmează după «(.+)»\?$/.exec(p))) return fromWords(correctText(item)) === fromWords(m[1]) + 1 ? null : fail(`after ${m[1]} -> ${correctText(item)}`);
  if ((m = /^Ce număr este înainte de «(.+)»\?$/.exec(p))) return fromWords(correctText(item)) === fromWords(m[1]) - 1 ? null : fail(`before ${m[1]} -> ${correctText(item)}`);
  if (p === 'Pune numerele în ordine, de la cel mai mic la cel mai mare.') {
    const vals = any.correctOrder.map((id: string) => fromWords(any.cards.find((c: any) => c.id === id).text.ro));
    return vals.every((v: number, k: number) => k === 0 || vals[k - 1] < v) ? null : fail(`order ${vals}`);
  }
  if ((m = /^«(.+)» \+ «(.+)» = \?$/.exec(p))) return fromWords(correctText(item)) === fromWords(m[1]) + fromWords(m[2]) ? null : fail(`${m[1]}+${m[2]} -> ${correctText(item)}`);

  /* ---- days and months ---- */
  const cal = (list: { en: string; ro: string }[]) => list.map((x) => x.en);
  if ((m = /^Care (zi|lună) urmează după «(.+)»\?$/.exec(p))) {
    const l = cal(m[1] === 'zi' ? DAYS : MONTHS);
    return correctText(item) === l[(l.indexOf(m[2]) + 1) % l.length] ? null : fail(`after ${m[2]}`);
  }
  if ((m = /^Care (zi|lună) este înainte de «(.+)»\?$/.exec(p))) {
    const l = cal(m[1] === 'zi' ? DAYS : MONTHS);
    return correctText(item) === l[(l.indexOf(m[2]) + l.length - 1) % l.length] ? null : fail(`before ${m[2]}`);
  }
  if ((m = /^Care este (.+) (zi a săptămânii|lună din an)\?$/.exec(p))) {
    const ord = ['prima', 'a doua', 'a treia', 'a patra', 'a cincea', 'a șasea', 'a șaptea', 'a opta', 'a noua', 'a zecea', 'a unsprezecea', 'a douăsprezecea'].indexOf(m[1]);
    const l = cal(m[2].startsWith('zi') ? DAYS : MONTHS);
    return correctText(item) === l[ord] ? null : fail(`position ${m[1]}`);
  }
  if (p === 'Pune lunile în ordinea din an.' || p === 'Pune zilele în ordinea din săptămână (începe cu luni).') {
    const l = cal(p.includes('lunile') ? MONTHS : DAYS);
    const idx = any.correctOrder.map((id: string) => l.indexOf(any.cards.find((c: any) => c.id === id).text.ro));
    return idx.every((v: number, k: number) => v >= 0 && (k === 0 || idx[k - 1] < v)) ? null : fail(`calendar order ${idx}`);
  }
  if ((m = /^În ce anotimp este luna «(.+)»\?$/.exec(p))) {
    const mo = MONTHS.find((x) => x.en === m![1]);
    return mo && correctText(item) === mo.season ? null : fail(`season of ${m[1]}`);
  }

  /* ---- time ---- */
  if (p.startsWith('Cât este ceasul?')) {
    const v = any.visual;
    return correctText(item) === `It's ${clockPhrase(v.hours, v.minutes)}.` ? null : fail(`clock ${v.hours}:${v.minutes} -> ${correctText(item)}`);
  }
  if ((m = /^Care ceas arată «It's (.+)\.»\?$/.exec(p))) {
    const opt = any.options.find((o: any) => o.id === any.correctId).visual;
    if (opt.kind !== 'clock') return fail('not a clock');
    const keys = any.options.map((o: any) => `${o.visual.hours}:${o.visual.minutes}`);
    if (new Set(keys).size !== keys.length) return fail('repeated clock');
    return clockPhrase(opt.hours, opt.minutes) === m[1] ? null : fail(`clock for ${m[1]}`);
  }
  if ((m = /^Ce oră este «It's (.+)\.»\?$/.exec(p))) {
    const [h, mi] = correctText(item).split(':').map(Number);
    return clockPhrase(h, mi) === m[1] ? null : fail(`digital for ${m[1]}`);
  }

  /* ---- grammar ---- */
  if ((m = /^Care este opusul lui «(.+)»\?$/.exec(p))) {
    const pairs = grammar.opposites as { a: string; b: string }[];
    const pr = pairs.find((x) => x.a === m![1] || x.b === m![1]);
    if (!pr) return fail(`unknown adjective ${m[1]}`);
    return correctText(item) === (pr.a === m[1] ? pr.b : pr.a) ? null : fail(`opposite of ${m[1]}`);
  }
  if ((m = /^Completează propoziția\. Sens: „(.+)”$/.exec(p))) {
    const s = SENT.find((x) => x.ro === m![1] && x.template === any.template.ro);
    if (!s) return fail(`unknown sentence ${m[1]}`);
    if (any.correct !== s.answer) return fail(`gap answer ${any.correct} vs ${s.answer}`);
    for (const o of any.options as string[]) if (o !== s.answer && !s.x.includes(o)) return fail(`option ${o} not curated as wrong`);
    return null;
  }
  if ((m = /^Care propoziție înseamnă „(.+)”\?$/.exec(p))) {
    const s = SENT.filter((x) => x.ro === m![1]).find((x) => x.full === correctText(item));
    if (!s) return fail(`translate: ${correctText(item)} is not the sentence for ${m[1]}`);
    for (const o of any.options as any[]) if (o.text.ro !== s.full && !s.x.some((w) => fillT(s, w) === o.text.ro)) return fail(`option ${o.text.ro} not a curated wrong variant`);
    return null;
  }
  if ((m = /^„(.+)” înseamnă „(.+)”\. Adevărat sau fals\?$/.exec(p))) {
    const cands = SENT.filter((x) => x.ro === m![2]);
    const exact = cands.find((x) => x.full === m![1]);
    if (any.correct) return exact ? null : fail(`tf true but ${m[1]} is not the sentence`);
    const wrongVariant = cands.some((x) => x.x.some((w) => fillT(x, w) === m![1]));
    return wrongVariant && !exact ? null : fail(`tf false but ${m[1]} is not a curated wrong variant`);
  }
  if ((m = /^Pune cuvintele în ordine ca să formezi o propoziție\. Sens: „(.+)”$/.exec(p))) {
    const built = any.correctOrder.map((id: string) => any.cards.find((c: any) => c.id === id).text.ro).join(' ');
    const s = SENT.filter((x) => x.ro === m![1]).find((x) => x.full === built);
    if (!s) return fail(`order builds "${built}" which is not the sentence for ${m[1]}`);
    const keys = any.cards.map((c: any) => c.text.ro.toLowerCase().replace(/[.,!?]/g, ''));
    return new Set(keys).size === keys.length ? null : fail('repeated word in order item');
  }

  /* ---- reading ---- */
  if (item.type === 'read-and-answer') {
    const t = (reading.texts as any[]).find((x) => x.text === any.passage.ro && p.includes(x.title));
    if (!t) return fail('unknown passage');
    if (!skill.id.endsWith(`.${t.g}`)) return fail('text of another grade');
    for (const q of any.questions) {
      if (q.type === 'true-false') {
        const mm = /^Adevărat sau fals\? „(.+)”$/.exec(q.prompt.ro);
        const src = t.q.find((x: any) => 's' in x && x.s === mm?.[1]);
        if (!src) return fail(`unknown statement ${q.prompt.ro}`);
        if (q.correct !== src.tf) return fail(`statement "${src.s}" is ${src.tf}`);
      } else {
        const src = t.q.find((x: any) => 'a' in x && x.ro === q.prompt.ro);
        if (!src) return fail(`unknown question ${q.prompt.ro}`);
        if (correctText(q) !== src.a) return fail(`answer to "${src.ro}" is ${src.a}`);
        for (const o of q.options) if (o.text.ro !== src.a && !src.x.includes(o.text.ro)) return fail(`option ${o.text.ro}`);
        if (!t.text.toLowerCase().includes(src.a.replace(/^an? /, '').toLowerCase())) return fail('answer not in text');
      }
    }
    return null;
  }

  return fail(`unrecognised prompt: ${p}`);
}

const groupNames: Record<string, string> = {
  animal: 'animale', food: 'mâncare și băuturi', colour: 'culori', family: 'familie', body: 'corpul', toy: 'jucării', school: 'lucruri de la școală',
  clothes: 'haine', weather: 'vremea', season: 'anotimpuri', house: 'lucruri din casă', action: 'acțiuni', job: 'meserii', place: 'locuri',
};

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

const COUNT = 200;
const SEED = 20261127;

describe('eng primary generators over every skill', () => {
  it('every skill is generator-backed', () => {
    expect(prim.filter((s) => s.itemSources.some((x) => 'generator' in x)).length).toBe(41);
  });

  for (const skill of prim) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it(`produces ${COUNT} valid items`, () => {
        expect(items.length).toBe(COUNT);
        expect(items.flatMap((i) => validateItem(i))).toEqual([]);
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
        for (const i of items) {
          expect(i.skillId).toBe(skill.id);
          expect(i.explanationId).toBe(skill.explanations[0]);
        }
      });

      it('correct responses pass, wrong ones fail', () => {
        for (const i of items) {
          expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
          expect(checkResponse(i, { type: 'number-input', value: -1 } as ItemResponse), i.id).toBe(false);
          if (i.type === 'choice' || i.type === 'picture-choice') {
            const wrong = i.options.find((o) => o.id !== i.correctId) as { id: string };
            expect(checkResponse(i, { type: i.type, selectedId: wrong.id }), i.id).toBe(false);
          }
          if (i.type === 'fill-gap') {
            const wrong = (i.options ?? []).find((o) => o !== i.correct) as string;
            expect(checkResponse(i, { type: 'fill-gap', value: wrong }), i.id).toBe(false);
          }
          if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct }), i.id).toBe(false);
        }
      });

      it('has unique options, exactly one correct, at least 2 options', () => {
        for (const i of items) {
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
          if (i.type === 'choice' || i.type === 'picture-choice') {
            expect(i.options.length, i.id).toBeGreaterThanOrEqual(2);
            expect(i.options.filter((o) => o.id === i.correctId).length).toBe(1);
            expect(new Set(i.options.map((o) => o.id)).size).toBe(i.options.length);
          }
          if (i.type === 'fill-gap') {
            expect(texts.length, i.id).toBeGreaterThanOrEqual(2);
            expect(texts.filter((o) => o === i.correct).length).toBe(1);
          }
          if (i.type === 'sort') {
            expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
            for (const c of i.categories) expect(i.cards.some((k) => k.categoryId === c.id), `${i.id} empty category`).toBe(true);
          }
          if (i.type === 'match') {
            expect(new Set(i.pairs.map((x) => x.left.text?.ro)).size, i.id).toBe(i.pairs.length);
            expect(new Set(i.pairs.map((x) => x.right.text?.ro ?? JSON.stringify(x.right.visual))).size, i.id).toBe(i.pairs.length);
          }
          if (i.type === 'order') {
            expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
            expect(i.cards.length, i.id).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('answers are independently verified against the curated data', () => {
        for (const i of items) expect(verify(i, skill), `${i.id}: ${i.prompt.ro}`).toBeNull();
      });

      it('is deterministic for a seed', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
        expect(generateItems(skill, 30, { seed: SEED + 1 })).not.toEqual(items.slice(0, 30));
      });

      it('varies: at least 12 distinct items out of 200', () => {
        const keys = new Set(items.map((i) => JSON.stringify({ ...i, id: '', provenance: '' }).replace(/"id":"[^"]*",?/g, '')));
        expect(keys.size).toBeGreaterThanOrEqual(12);
      });

      it('works at every difficulty and stays verified', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          const batch = generateItems(skill, 40, { seed: 7, difficulty: d });
          expect(batch.flatMap((i) => validateItem(i))).toEqual([]);
          for (const i of batch) {
            expect(checkResponse(i, correctResponse(i))).toBe(true);
            expect(verify(i, skill), i.prompt.ro).toBeNull();
          }
        }
      });

      it('has a prompt in both languages that shows the English with matching markers', () => {
        for (const i of items) {
          expect(i.prompt.en, i.id).toBeTruthy();
          for (const t of [i.prompt.ro, i.prompt.en as string]) expect((t.match(/«/g) ?? []).length).toBe((t.match(/»/g) ?? []).length);
        }
      });
    });
  }

  it('the generated items cover the item types the task asks for', () => {
    const types = new Set<string>();
    for (const s of prim) for (const d of [1, 3, 4] as const) for (const i of generateItems(s, 60, { seed: 11, difficulty: d })) types.add(i.type);
    for (const t of ['choice', 'picture-choice', 'true-false', 'match', 'sort', 'order', 'fill-gap', 'number-input', 'read-and-answer']) expect(types.has(t), t).toBe(true);
  });

  it('non-readers (grades 0-I) get picture items and every picture option has a visual', () => {
    for (const s of prim.filter((x) => x.grade <= 1)) {
      const batch = generateItems(s, 120, { seed: 5 });
      if (s.id.startsWith('eng.greet')) continue;
      expect(batch.some((i) => i.type === 'picture-choice' || i.visual), s.id).toBe(true);
      for (const i of batch) if (i.type === 'picture-choice') expect(i.options.every((o) => o.visual), i.id).toBe(true);
    }
  });

  it('never offers a word that has not been taught by the skill grade', () => {
    for (const s of prim.filter((x) => x.grade <= 2 && x.itemSources.some((y) => 'generator' in y && y.generator === 'eng-primary-vocab'))) {
      for (const i of generateItems(s, 120, { seed: 9 })) {
        const texts = i.type === 'choice' ? i.options.map((o) => o.text?.ro ?? '') : [];
        for (const t of texts) {
          const w = wordByEn.get(t) ?? wordByRo.get(t);
          if (w) expect(w.grade, `${s.id}: ${t}`).toBeLessThanOrEqual(s.grade);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Placement, missions, availability                                  */
/* ------------------------------------------------------------------ */

describe('eng primary placement, missions and availability', () => {
  it('placement + missions work over the eng graph for children at different levels', () => {
    const known = (g: number) => new Set(prim.filter((s) => s.grade <= g).map((s) => s.id));
    for (const seed of [1, 2, 3]) {
      for (const [grade, knowsUpTo] of [[2, 0], [4, 1], [4, 3]] as const) {
        const r = simulate(prim, { seed, known: known(knowsUpTo), subject: 'eng', declared: { grade, semester: 2 } }, 40);
        expect(r.gapHistory[r.gapHistory.length - 1], `seed ${seed} grade ${grade}`).toBeLessThanOrEqual(r.gapHistory[0]);
        for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
      }
    }
  });

  it('a grade III child who knows only grade 0 closes most of the gaps in about forty missions', () => {
    const known = new Set(prim.filter((s) => s.grade === 0).map((s) => s.id));
    const r = simulate(prim, { seed: 4, known, subject: 'eng', declared: { grade: 3, semester: 2 } }, 60);
    expect(r.gapsAfterPlacement).toBeGreaterThan(10);
    expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThan(r.gapHistory[0] / 2);
  });

  it('English is available to a grade 0 child (min grade 0) and listed among the learner subjects', () => {
    expect(subjectMinGrade('eng')).toBe(0);
    expect(isSubjectAvailable('eng', 0)).toBe(true);
    expect(availableSubjects(LEARN_SUBJECTS, 0)).toContain('eng');
    expect(availableSubjects(LEARN_SUBJECTS, 4)).toContain('eng');
  });
});

/* ------------------------------------------------------------------ */
/*  English speech (listen button)                                     */
/* ------------------------------------------------------------------ */

describe('English speech for the eng subject', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'speechSynthesis');
  });

  it('extracts the text inside «…» (all markers, in order)', () => {
    expect(extractEnglishSpeech('Care imagine este «cat»?')).toBe('cat');
    expect(extractEnglishSpeech('«three» + «four» = ?')).toBe('three. four');
    expect(extractEnglishSpeech('Fără marcaj.')).toBe('');
  });

  it('items of eng grades 0-II offer the listen text; grades III-IV and other subjects do not', () => {
    expect(itemEnglishSpeech('eng.colours.0', 'Ascultă și alege imaginea: «red».')).toBe('red');
    expect(itemEnglishSpeech('eng.days.2', 'Ce înseamnă «Monday»?')).toBe('Monday');
    expect(itemEnglishSpeech('eng.time.3', 'Care ceas arată «It\'s half past four.»?')).toBeNull();
    expect(itemEnglishSpeech('rom.letters.sound.0', 'Care literă este «a»?')).toBeNull();
    expect(itemEnglishSpeech('eng.colours.0', 'Ce arată imaginea?')).toBeNull();
    expect(itemEnglishSpeech(undefined, '«cat»')).toBeNull();
  });

  it('explanation frames of every eng skill offer the listen text', () => {
    expect(frameEnglishSpeech('eng.havegot.3', 'Cu «he» spunem «has got».')).toBe('he. has got');
    expect(frameEnglishSpeech('mat.add.0', 'Cu «he»')).toBeNull();
  });

  it('every grade 0-II generated item with a marker yields speech and every word prompt is speakable', () => {
    const colours = prim.find((s) => s.id === 'eng.colours.0') as Skill;
    const listen = generateItems(colours, 80, { seed: 3 }).filter((i) => i.prompt.ro.startsWith('Ascultă'));
    expect(listen.length).toBeGreaterThan(5);
    for (const i of listen) expect(itemEnglishSpeech(i.skillId, i.prompt.ro), i.prompt.ro).toMatch(/^[a-z ]+$/);
  });

  it('useReadAloud("en") speaks with the British voice at rate 0.9, whatever the UI language', async () => {
    await i18n.changeLanguage('ro');
    const spoken: { text: string; rate: number; lang: string }[] = [];
    const voices = [
      { lang: 'ro-RO', name: 'Romanian' },
      { lang: 'en_US', name: 'US' },
      { lang: 'en-GB', name: 'British' },
    ];
    const synth = {
      getVoices: () => voices,
      speak: vi.fn((u: { text: string; rate: number; lang: string }) => spoken.push(u)),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('speechSynthesis', synth);
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        voice: unknown;
        rate = 1;
        lang = '';
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    const { result } = renderHook(() => useReadAloud('en'));
    expect(result.current.available).toBe(true);
    act(() => result.current.speak('cat'));
    expect(spoken[0]).toMatchObject({ text: 'cat', rate: 0.9, lang: 'en-GB' });
    // the default (no argument) still follows the UI language: Romanian voice for the ro UI
    const ro = renderHook(() => useReadAloud());
    act(() => ro.result.current.speak('Bună'));
    expect(spoken[1].lang).toBe('ro-RO');
  });
});
