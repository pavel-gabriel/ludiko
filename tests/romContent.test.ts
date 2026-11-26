import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import {
  ANTONYMS, EXCLAMATIONS, ORDER_SENTENCES, PICTURE_WORDS, QUESTIONS, ROM_WORDS, STATEMENTS, SYNONYMS, isVowel,
} from '../src/engine/items/generators/romData';
import { DIGRAPH_WORDS } from '../src/engine/items/generators/romLetters';
import { wrongSplits } from '../src/engine/items/generators/romSyllables';
import { LEARN_SUBJECTS } from '../src/ui/learn/subjects';
import { simulate } from './helpers/learner';
import type { ChoiceItem, Item, ItemResponse, ReadAndAnswerItem, Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return jsonFiles(p);
    return name.endsWith('.json') ? [p] : [];
  });
}

const romSkills = getSkillsBySubject('rom');
const romFiles = [
  ...jsonFiles(join(CONTENT, 'skills', 'rom')),
  ...jsonFiles(join(CONTENT, 'items', 'rom')),
  ...jsonFiles(join(CONTENT, 'explanations', 'rom')),
  ...jsonFiles(join(CONTENT, 'data', 'rom')),
];

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

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('rom skill graph', () => {
  it('has 18-26 skills across grades 0-IV, all valid', () => {
    expect(romSkills.length).toBeGreaterThanOrEqual(18);
    expect(romSkills.length).toBeLessThanOrEqual(26);
    expect(new Set(romSkills.map((s) => s.grade))).toEqual(new Set([0, 1, 2, 3, 4]));
    const errors = jsonFiles(join(CONTENT, 'skills', 'rom')).flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph (with mat) is a valid DAG and prerequisites stay within the subject', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of romSkills) for (const p of s.prerequisites) expect(p.startsWith('rom.'), `${s.id} -> ${p}`).toBe(true);
  });

  it('prerequisites cross grades and there is one root per strand at most', () => {
    const byId = new Map(romSkills.map((s) => [s.id, s]));
    const crossing = romSkills.filter((s) => s.prerequisites.some((p) => (byId.get(p) as Skill).grade < s.grade));
    expect(crossing.length).toBeGreaterThanOrEqual(8);
    const roots = romSkills.filter((s) => s.prerequisites.length === 0);
    expect(roots.length).toBeLessThanOrEqual(3);
  });

  it('covers the strands: letters, syllables, words, sentences, text comprehension, vocabulary', () => {
    const ids = romSkills.map((s) => s.id).join(' ');
    for (const part of ['letters.', 'syll.', 'word.', 'sent.', 'text.literal', 'text.sequence', 'text.mainidea', 'text.inference', 'vocab.', 'text.types', 'text.characters']) {
      expect(ids, part).toContain(part);
    }
  });

  it('uses CLR-2013 for grades 0-II and LLR-III-IV-2014 for III-IV, own provenance, English titles', () => {
    for (const s of romSkills) {
      const want = s.grade <= 2 ? 'CLR-2013' : 'LLR-III-IV-2014';
      expect(s.competences.every((c) => c.programa === want), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en).toBeTruthy();
    }
  });

  it('every skill has an existing 3-4 frame explanation with English text', () => {
    for (const s of romSkills) {
      expect(s.explanations.length, s.id).toBe(1);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBeGreaterThanOrEqual(3);
      expect(exp?.frames.length).toBeLessThanOrEqual(4);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.title.en).toBeTruthy();
      for (const f of exp?.frames ?? []) expect(f.text.en).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
    }
  });

  it('every skill is backed by a registered generator or a static bank with items', () => {
    for (const s of romSkills) {
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
      }
      const hasGen = s.itemSources.some((x) => 'generator' in x);
      if (!hasGen) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(listGenerators()).toEqual(
      expect.arrayContaining(['letters', 'syllables', 'word-picture', 'sentence-order', 'punctuation', 'word-relations']),
    );
  });

  it('the learner area offers the Romanian subject', () => {
    expect(LEARN_SUBJECTS).toContain('rom');
  });

  it('placement + missions work over the rom graph: a child who knows grade 0 closes the gaps', () => {
    const grade0 = new Set(romSkills.filter((s) => s.grade === 0).map((s) => s.id));
    for (const seed of [1, 2, 3]) {
      const r = simulate(romSkills, { seed, known: grade0, subject: 'rom', declared: { grade: 4, semester: 1 } }, 60);
      expect(r.gapsAfterPlacement).toBeGreaterThanOrEqual(3);
      expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThan(r.gapHistory[0]);
      for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Word list                                                          */
/* ------------------------------------------------------------------ */

const STOP = new Set(['b', 'c', 'd', 'f', 'g', 'p', 't', 'ch', 'gh']);
const units = (w: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    const two = w.slice(i, i + 2);
    if (two === 'ch' || two === 'gh') {
      out.push(two);
      i++;
    } else out.push(w[i]);
  }
  return out;
};

/** Checks the standard break rules for consonant runs between vowels; returns the violations */
function hyphenationViolations(word: string, hyphenated: string): string[] {
  const problems: string[] = [];
  const syl = hyphenated.split('-');
  /* unit index at which each syllable (after the first) starts */
  const starts = new Set<number>();
  let consumed = 0;
  for (const s of syl.slice(0, -1)) {
    consumed += units(s).length;
    starts.add(consumed);
  }
  const u = units(word);
  /* A final "i" after a consonant (azi, ochi, ieri) is a short, non-syllabic i: not a vowel here */
  const shortFinalI = u.length >= 2 && u[u.length - 1] === 'i' && !isVowel(u[u.length - 2]);
  const vow = (x: string, k = -1) => x.length === 1 && isVowel(x) && !(shortFinalI && k === u.length - 1);
  let i = 0;
  while (i < u.length) {
    if (vow(u[i], i)) {
      i++;
      continue;
    }
    let j = i;
    while (j < u.length && !vow(u[j], j)) j++;
    const run = j - i;
    if (i > 0 && j < u.length && run <= 3) {
      let expected = i; // one consonant goes with the next vowel
      if (run === 2) expected = STOP.has(u[i]) && (u[i + 1] === 'l' || u[i + 1] === 'r') ? i : i + 1;
      if (run === 3) expected = i + 1;
      const actual: number[] = [];
      for (let k = i; k <= j; k++) if (starts.has(k)) actual.push(k);
      if (actual.length !== 1 || actual[0] !== expected) {
        problems.push(`${hyphenated}: consonants "${u.slice(i, j).join('')}" should break before unit ${expected - i} of the run`);
      }
    }
    i = j;
  }
  return problems;
}

describe('curated word list (content/data/rom/words.json)', () => {
  const raw = readJson(join(CONTENT, 'data', 'rom', 'words.json'));

  it('is own work with valid provenance', () => {
    expect(validateProvenance(raw.provenance)).toEqual([]);
    expect(raw.provenance.source).toBe('own');
    expect(raw.provenance.licence).toBe('OWN');
  });

  it('has at least 150 words, 100 of them with a picture', () => {
    expect(ROM_WORDS.length).toBeGreaterThanOrEqual(150);
    expect(PICTURE_WORDS.length).toBeGreaterThanOrEqual(100);
  });

  it('has no duplicate words and no duplicate pictures', () => {
    const words = ROM_WORDS.map((w) => w.w);
    expect(words.length).toBe(new Set(words).size);
    const pics = PICTURE_WORDS.map((w) => w.e);
    expect(pics.length).toBe(new Set(pics).size);
  });

  it('hyphenation uses only letters and "-", and the syllables rebuild the word', () => {
    for (const w of ROM_WORDS) {
      expect(w.s, w.w).toMatch(/^[a-zăâîșț]+(-[a-zăâîșț]+)*$/);
      expect(w.w, w.w).toMatch(/^[a-zăâîșț]+$/);
      expect(w.s.replace(/-/g, ''), w.w).toBe(w.w);
      expect(w.syl.length, w.w).toBe(w.s.split('-').length);
      expect(w.en, w.w).toBeTruthy();
    }
  });

  it('every syllable has a vowel and the break rules hold (VCV, VCCV, stop+liquid, VCCCV)', () => {
    const problems: string[] = [];
    for (const w of ROM_WORDS) {
      for (const s of w.syl) if (![...s].some(isVowel)) problems.push(`${w.w}: syllable "${s}" has no vowel`);
      problems.push(...hyphenationViolations(w.w, w.s));
    }
    expect(problems).toEqual([]);
  });

  it('covers 1- to 5-syllable words', () => {
    const counts = new Set(ROM_WORDS.map((w) => w.syl.length));
    for (const n of [1, 2, 3, 4, 5]) expect(counts.has(n), `${n} syllables`).toBe(true);
  });

  it('words sharing a meaning group are tagged (bird, tree, flower, fish, person)', () => {
    for (const g of ['bird', 'tree', 'flower', 'fish', 'person']) {
      expect(ROM_WORDS.filter((w) => w.g === g).length, g).toBeGreaterThanOrEqual(3);
    }
  });

  it('wrongSplits never returns the correct split and keeps vowels in every syllable', () => {
    for (const w of ROM_WORDS.filter((x) => x.syl.length >= 2)) {
      for (const s of wrongSplits(w.syl)) {
        expect(s).not.toBe(w.s);
        expect(s.replace(/-/g, '')).toBe(w.w);
        expect(s.split('-').every((p) => [...p].some(isVowel))).toBe(true);
      }
    }
  });
});

describe('sentence and vocabulary lists', () => {
  it('sentences and vocab are own work with valid provenance', () => {
    for (const f of ['sentences.json', 'vocab.json']) {
      const raw = readJson(join(CONTENT, 'data', 'rom', f));
      expect(validateProvenance(raw.provenance), f).toEqual([]);
      expect(raw.provenance.source).toBe('own');
    }
  });

  it('order sentences: capital first, closing mark, no repeated word, 3-8 words', () => {
    expect(ORDER_SENTENCES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ORDER_SENTENCES).size).toBe(ORDER_SENTENCES.length);
    for (const s of ORDER_SENTENCES) {
      const words = s.split(' ');
      expect(words.length, s).toBeGreaterThanOrEqual(3);
      expect(words.length, s).toBeLessThanOrEqual(8);
      expect(s[0], s).toBe(s[0].toLocaleUpperCase('ro'));
      expect(s, s).toMatch(/[.!?]$/);
      const lower = words.map((w) => w.replace(/[.!?,]/g, '').toLowerCase());
      expect(new Set(lower).size, s).toBe(lower.length);
    }
  });

  it('punctuation sentences carry no mark, are unique and cue their kind', () => {
    for (const list of [STATEMENTS, QUESTIONS, EXCLAMATIONS]) {
      expect(list.length).toBeGreaterThanOrEqual(15);
      expect(new Set(list).size).toBe(list.length);
      for (const s of list) {
        expect(s, s).not.toMatch(/[.!?]$/);
        expect(s[0], s).toBe(s[0].toLocaleUpperCase('ro'));
      }
    }
    for (const s of QUESTIONS) expect(s, s).toMatch(/^(Cum|Unde|Ce|Cine|Când|De ce|Câți|Câte|Cât|Cu cine|Pe cine|Care|Oare)\b/);
  });

  it('antonym and synonym pairs are distinct words, no duplicate pairs', () => {
    for (const list of [ANTONYMS, SYNONYMS]) {
      const keys = list.map(([a, b]) => [a, b].sort().join('|'));
      expect(new Set(keys).size).toBe(keys.length);
      for (const [a, b] of list) expect(a).not.toBe(b);
    }
    expect(ANTONYMS.length).toBeGreaterThanOrEqual(25);
    expect(SYNONYMS.length).toBeGreaterThanOrEqual(12);
  });

  it('digraph words exist for every group family', () => {
    const groups = new Set(DIGRAPH_WORDS.map((d) => d.group));
    for (const g of ['ce', 'ci', 'chi', 'che', 'ge', 'gi', 'ghe']) expect(groups.has(g), g).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

const SEED = 20261125;
const COUNT = 200;
const genSkills = romSkills.filter((s) => s.itemSources.some((x) => 'generator' in x));

const optionTexts = (item: Item): string[] => {
  if (item.type === 'choice' || item.type === 'picture-choice') return item.options.map((o) => o.text?.ro ?? JSON.stringify(o.visual));
  if (item.type === 'fill-gap') return item.options ?? [];
  return [];
};

describe('rom generators over every generator-backed skill', () => {
  it('there are at least 12 generator-backed rom skills', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(12);
  });

  for (const skill of genSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it(`produces ${COUNT} valid items`, () => {
        expect(items.length).toBe(COUNT);
        const errors = items.flatMap((i) => validateItem(i));
        expect(errors).toEqual([]);
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
        for (const i of items) {
          expect(i.skillId).toBe(skill.id);
          expect(i.explanationId).toBe(skill.explanations[0]);
        }
      });

      it('correct responses pass and wrong-typed responses fail', () => {
        for (const i of items) {
          expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
          expect(checkResponse(i, { type: 'number-input', value: -1 } as ItemResponse), i.id).toBe(false);
        }
      });

      it('has no duplicate options and exactly one correct option', () => {
        for (const i of items) {
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
          if (i.type === 'choice' || i.type === 'picture-choice') {
            expect(i.options.filter((o) => o.id === i.correctId).length).toBe(1);
            expect(i.options.length).toBeGreaterThanOrEqual(3);
          }
        }
      });

      it('is deterministic for a seed', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
      });

      it('varies: at least 30 distinct items out of 200', () => {
        const keys = new Set(items.map((i) => JSON.stringify({ ...i, id: '', provenance: '' })));
        expect(keys.size).toBeGreaterThanOrEqual(30);
      });

      it('works at every difficulty', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          const batch = generateItems(skill, 40, { seed: 7, difficulty: d });
          expect(batch.flatMap((i) => validateItem(i))).toEqual([]);
          for (const i of batch) expect(checkResponse(i, correctResponse(i))).toBe(true);
        }
      });
    });
  }

  it('syllable items agree with the curated list', () => {
    const syllSkills = genSkills.filter((s) => s.id.startsWith('rom.syll.'));
    expect(syllSkills.length).toBe(3);
    const byWord = new Map(ROM_WORDS.map((w) => [w.w, w]));
    for (const s of syllSkills) {
      for (const i of generateItems(s, COUNT, { seed: 99 })) {
        const quoted = /„([^”]+)”/.exec(i.prompt.ro);
        if (i.type === 'choice' && quoted) {
          const w = byWord.get(quoted[1]);
          expect(w, i.id).toBeDefined();
          const correct = i.options.find((o) => o.id === i.correctId)?.text?.ro;
          if (/Câte silabe/.test(i.prompt.ro)) expect(correct).toBe(String(w?.syl.length));
          else expect(correct).toBe(w?.s);
        }
        if (i.type === 'order') {
          const rebuilt = i.correctOrder.map((id) => i.cards.find((c) => c.id === id)?.text?.ro).join('');
          expect(ROM_WORDS.some((w) => w.w === rebuilt), i.id).toBe(true);
          expect(i.cards.map((c) => c.text?.ro).sort()).toEqual([...new Set(i.cards.map((c) => c.text?.ro))].sort());
        }
      }
    }
  });

  it('letters items agree with the words and the alphabet', () => {
    const skill = getSkillsBySubject('rom').find((s) => s.id === 'rom.letters.sound.0') as Skill;
    for (const i of generateItems(skill, COUNT, { seed: 5 })) {
      const quoted = /„([^”]+)”/.exec(i.prompt.ro)?.[1];
      if (i.type === 'choice' && /începe cuvântul/.test(i.prompt.ro)) {
        const correct = i.options.find((o) => o.id === i.correctId)?.text?.ro;
        expect(correct).toBe([...(quoted as string)][0]);
      }
      if (i.type === 'choice' && /se termină cuvântul/.test(i.prompt.ro)) {
        const correct = i.options.find((o) => o.id === i.correctId)?.text?.ro;
        expect(correct).toBe([...(quoted as string)].slice(-1)[0]);
      }
      if (i.type === 'picture-choice') {
        const letter = (quoted as string).toLowerCase();
        const right = i.options.find((o) => o.id === i.correctId);
        expect(right?.text?.ro?.[0]).toBe(letter);
        for (const o of i.options) if (o.id !== i.correctId) expect(o.text?.ro?.[0]).not.toBe(letter);
      }
    }
  });

  it('digraph items rebuild a real picture word', () => {
    const skill = getSkillsBySubject('rom').find((s) => s.id === 'rom.letters.digraph.1') as Skill;
    const words = new Set(PICTURE_WORDS.map((w) => w.w));
    for (const i of generateItems(skill, COUNT, { seed: 11 })) {
      if (i.type !== 'fill-gap') throw new Error('expected fill-gap');
      expect(words.has(i.template.ro.replace('{{gap}}', i.correct)), i.id).toBe(true);
      for (const o of i.options ?? []) expect(['ce', 'ci', 'che', 'chi', 'ge', 'gi', 'ghe', 'ghi']).toContain(o);
    }
  });

  it('sentence-order items rebuild a listed sentence; punctuation items match their list', () => {
    const order = getSkillsBySubject('rom').find((s) => s.id === 'rom.sent.order.1') as Skill;
    for (const i of generateItems(order, COUNT, { seed: 3 })) {
      if (i.type !== 'order') throw new Error('expected order');
      const sentence = i.correctOrder.map((id) => i.cards.find((c) => c.id === id)?.text?.ro).join(' ');
      expect(ORDER_SENTENCES).toContain(sentence);
    }
    const punct = getSkillsBySubject('rom').find((s) => s.id === 'rom.sent.punct.1') as Skill;
    const lists: Record<string, readonly string[]> = { '.': STATEMENTS, '?': QUESTIONS, '!': EXCLAMATIONS };
    for (const i of generateItems(punct, COUNT, { seed: 4 })) {
      if (i.type === 'fill-gap') {
        expect(lists[i.correct]).toContain(i.template.ro.replace('{{gap}}', ''));
      } else if (i.type === 'choice') {
        const right = (i.options.find((o) => o.id === i.correctId) as ChoiceItem['options'][number]).text?.ro as string;
        const mark = right.slice(-1);
        expect(lists[mark]).toContain(right.slice(0, -1));
        for (const o of i.options) {
          if (o.id === i.correctId) continue;
          const t = o.text?.ro as string;
          expect(lists[t.slice(-1)]?.includes(t.slice(0, -1)) ?? false, t).toBe(false);
        }
      }
    }
  });

  it('word-relations answers come from the pairs and distractors are unrelated', () => {
    for (const [id, pairs] of [['rom.vocab.antonym.2', ANTONYMS], ['rom.vocab.synonym.2', SYNONYMS]] as const) {
      const skill = getSkillsBySubject('rom').find((s) => s.id === id) as Skill;
      for (const i of generateItems(skill, COUNT, { seed: 8 })) {
        const given = /„([^”]+)”/.exec(i.prompt.ro)?.[1] as string;
        if (i.type !== 'choice') throw new Error('expected choice');
        const answer = i.options.find((o) => o.id === i.correctId)?.text?.ro as string;
        expect(pairs.some(([a, b]) => (a === given && b === answer) || (b === given && a === answer)), i.id).toBe(true);
        /* no other option forms a pair with the given word in either list */
        for (const o of i.options) {
          if (o.id === i.correctId) continue;
          const w = o.text?.ro as string;
          const related = [...ANTONYMS, ...SYNONYMS].some(([a, b]) => (a === given && b === w) || (b === given && a === w));
          expect(related, `${given} ~ ${w}`).toBe(false);
        }
      }
    }
  });

  it('picture options never mix words of one meaning group', () => {
    const tag = new Map(ROM_WORDS.map((w) => [`w_${w.w}`, w.g]));
    for (const id of ['rom.word.picture.0', 'rom.word.read.1']) {
      const skill = getSkillsBySubject('rom').find((s) => s.id === id) as Skill;
      for (const i of generateItems(skill, COUNT, { seed: 21 })) {
        if (i.type !== 'picture-choice' && i.type !== 'choice') continue;
        const tags = i.options.map((o) => tag.get(o.id)).filter(Boolean);
        expect(new Set(tags).size, i.id).toBe(tags.length);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Item bank: original short texts                                    */
/* ------------------------------------------------------------------ */

const textFiles = jsonFiles(join(CONTENT, 'items', 'rom'));
const texts: ReadAndAnswerItem[] = textFiles.flatMap((f) => readJson(f));
const sentencesOf = (p: string): string[] => p.split(/(?<=[.!?])\s+/).filter(Boolean);
const wordsOfText = (s: string): string[] => s.split(/\s+/).filter(Boolean);

describe('read-and-answer text bank', () => {
  it('has at least 30 texts, all valid read-and-answer items', () => {
    expect(texts.length).toBeGreaterThanOrEqual(30);
    for (const t of texts) {
      expect(t.type).toBe('read-and-answer');
      expect(validateItem(t), t.id).toEqual([]);
    }
  });

  it('each text references an existing rom skill, and each text skill has several texts', () => {
    const byId = new Map(romSkills.map((s) => [s.id, s]));
    const perSkill = new Map<string, number>();
    for (const t of texts) {
      expect(byId.has(t.skillId), t.id).toBe(true);
      expect(t.skillId.startsWith('rom.')).toBe(true);
      perSkill.set(t.skillId, (perSkill.get(t.skillId) ?? 0) + 1);
      for (const q of t.questions) expect(q.skillId).toBe(t.skillId);
    }
    for (const s of romSkills) {
      if (s.itemSources.some((x) => 'bank' in x)) expect(perSkill.get(s.id) ?? 0, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(getItemsForSkill('rom.text.literal.1').length).toBeGreaterThanOrEqual(5);
  });

  it('bank files named by the skills exist', () => {
    for (const s of romSkills) {
      for (const src of s.itemSources) {
        if ('bank' in src) expect(existsSync(join(CONTENT, 'items', src.bank)), src.bank).toBe(true);
      }
    }
  });

  it('every text has 2-4 choice/true-false questions with English prompts', () => {
    for (const t of texts) {
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.questions.length, t.id).toBeLessThanOrEqual(4);
      expect(t.prompt.en).toBeTruthy();
      for (const q of t.questions) {
        expect(['choice', 'true-false']).toContain(q.type);
        expect(q.prompt.en, q.id).toBeTruthy();
      }
    }
  });

  it('length by grade: 0-I 2-3 sentences, II 4-6, III-IV 6-10', () => {
    const grade = new Map(romSkills.map((s) => [s.id, s.grade]));
    for (const t of texts) {
      const n = sentencesOf(t.passage.ro).length;
      const g = grade.get(t.skillId) as number;
      const [lo, hi] = g <= 1 ? [2, 3] : g === 2 ? [4, 6] : [6, 10];
      expect(n, `${t.id} (${n} sentences)`).toBeGreaterThanOrEqual(lo);
      expect(n, `${t.id} (${n} sentences)`).toBeLessThanOrEqual(hi);
    }
  });

  it('reading level: sentence length stays within the grade ceiling', () => {
    const grade = new Map(romSkills.map((s) => [s.id, s.grade]));
    const ceilingMean: Record<number, number> = { 1: 9, 2: 12, 3: 14, 4: 16 };
    const ceilingMax: Record<number, number> = { 1: 12, 2: 16, 3: 20, 4: 22 };
    for (const t of texts) {
      const g = grade.get(t.skillId) as number;
      const lens = sentencesOf(t.passage.ro).map((s) => wordsOfText(s).length);
      const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
      expect(mean, `${t.id} mean ${mean.toFixed(1)}`).toBeLessThanOrEqual(ceilingMean[g]);
      expect(Math.max(...lens), `${t.id} max`).toBeLessThanOrEqual(ceilingMax[g]);
    }
  });

  it('answers are checkable: correct passes, flipped fails; options are unique; answer positions vary', () => {
    const positions = new Set<number>();
    for (const t of texts) {
      expect(checkResponse(t, correctResponse(t)), t.id).toBe(true);
      for (const q of t.questions) {
        const answers = Object.fromEntries(t.questions.map((x) => [x.id, correctResponse(x)]));
        answers[q.id] =
          q.type === 'true-false'
            ? { type: 'true-false', value: !q.correct }
            : { type: 'choice', selectedId: q.options.find((o) => o.id !== q.correctId)?.id as string };
        expect(checkResponse(t, { type: 'read-and-answer', answers }), `${q.id} flipped`).toBe(false);
        if (q.type === 'choice') {
          const texts2 = q.options.map((o) => o.text?.ro);
          expect(new Set(texts2).size, q.id).toBe(texts2.length);
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          positions.add(q.options.findIndex((o) => o.id === q.correctId));
        }
      }
    }
    expect(positions.size).toBeGreaterThanOrEqual(3);
  });

  it('covers literal, sequence, inference and vocabulary questions, true and false statements', () => {
    const skills = new Set(texts.map((t) => t.skillId));
    for (const id of ['rom.text.literal.1', 'rom.text.sequence.2', 'rom.text.inference.2', 'rom.vocab.context.3', 'rom.text.mainidea.4']) {
      expect(skills.has(id), id).toBe(true);
    }
    const tf = texts.flatMap((t) => t.questions).filter((q) => q.type === 'true-false');
    expect(tf.some((q) => q.type === 'true-false' && q.correct)).toBe(true);
    expect(tf.some((q) => q.type === 'true-false' && !q.correct)).toBe(true);
  });

  it('is beta, ai-draft, OWN', () => {
    for (const t of texts) {
      expect(t.reviewStatus).toBe('beta');
      expect(t.provenance.source).toBe('ai-draft');
      expect(t.provenance.licence).toBe('OWN');
      expect(t.explanationId).toBe(romSkills.find((s) => s.id === t.skillId)?.explanations[0]);
    }
  });

  it('texts are unique', () => {
    const ps = texts.map((t) => t.passage.ro);
    expect(new Set(ps).size).toBe(ps.length);
  });
});

/* ------------------------------------------------------------------ */
/*  Romanian typography                                                */
/* ------------------------------------------------------------------ */

describe('Romanian typography in rom content', () => {
  it('uses comma-below ș/ț (never cedilla ş/ţ) and NFC', () => {
    const files = [...romFiles, join(ROOT, 'src', 'engine', 'items', 'generators', 'romData.ts')];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, relative(ROOT, f)).not.toMatch(/[ŞşŢţ]/);
      expect(text.normalize('NFC'), relative(ROOT, f)).toBe(text);
    }
  });

  it('has no leftover placeholders', () => {
    for (const f of romFiles) expect(readFileSync(f, 'utf8'), relative(ROOT, f)).not.toMatch(/TODO|lorem|XXX/i);
  });
});

describe('owner-reported fixes', () => {
  it('azi, ochi and ieri are single syllables (final short i)', () => {
    for (const w of ['azi', 'ochi', 'ieri']) {
      const entry = ROM_WORDS.find((x) => x.w === w)!;
      expect(entry.s, w).toBe(w);
      expect(entry.syl.length, w).toBe(1);
    }
  });
});
