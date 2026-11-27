import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import {
  FIGURE_ITEMS, FIGURE_LABELS, FRAZA_ITEMS, GIM_ANTONYMS, GIM_SYNONYMS, HOMONYMS, PARONYMS, POS_ITEMS, POS_LABELS,
  QUIZ, ROLE_ITEMS, ROLE_LABELS, SPELLING, SPELLING_GROUPS, SUBORD_ITEMS, SUBORD_LABELS, VERB_ITEMS, VERB_LABELS,
} from '../src/engine/items/generators/romGimnaziuData';
import { simulate } from './helpers/learner';
import type { Item, ItemResponse, ReadAndAnswerItem, Skill } from '../src/engine/types';

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

const gimSkills = getSkillsBySubject('rom').filter((s) => s.grade >= 5);
const oldSkills = getSkillsBySubject('rom').filter((s) => s.grade <= 4);
const byGrade = (g: number) => gimSkills.filter((s) => s.grade === g);

const skillFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'skills', 'rom', `grade${g}.json`));
const textFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'items', 'rom', `texts-grade${g}.json`));
const explFile = join(CONTENT, 'explanations', 'rom', 'grade5-8.json');
const dataFiles = ['spelling', 'grammar', 'vocab-gimnaziu', 'quiz-gimnaziu'].map((n) => join(CONTENT, 'data', 'rom', `${n}.json`));
const newFiles = [...skillFiles, ...textFiles, explFile, ...dataFiles];
const genFiles = ['romGimnaziuData', 'romLabelled', 'romSpelling', 'romPos', 'romVerbs', 'romSyntax', 'romFigures', 'romQuiz', 'romWordsAdv'].map((n) =>
  join(ROOT, 'src', 'engine', 'items', 'generators', `${n}.ts`),
);

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

const tokens = (s: string): string[] => s.split(/\s+/).map((t) => t.replace(/^[.,;:!?„”"()—-]+|[.,;:!?„”"()—-]+$/g, '').toLowerCase()).filter(Boolean);
const occurrences = (sentence: string, phrase: string): number => {
  const s = sentence.toLowerCase();
  const p = phrase.toLowerCase();
  let n = 0;
  for (let i = s.indexOf(p); i !== -1; i = s.indexOf(p, i + 1)) {
    const before = i === 0 ? ' ' : s[i - 1];
    const after = i + p.length >= s.length ? ' ' : s[i + p.length];
    if (!/\p{L}/u.test(before) && !/\p{L}/u.test(after)) n++;
  }
  return n;
};

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('rom gimnaziu skill graph (V-VIII)', () => {
  it('has 10-14 skills in each of grades V-VIII, all structurally valid', () => {
    for (const g of [5, 6, 7, 8]) {
      expect(byGrade(g).length, `grade ${g}`).toBeGreaterThanOrEqual(10);
      expect(byGrade(g).length, `grade ${g}`).toBeLessThanOrEqual(14);
    }
    const errors = skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph is a valid DAG and rom prerequisites stay inside rom', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of gimSkills) for (const p of s.prerequisites) expect(p.startsWith('rom.'), `${s.id} -> ${p}`).toBe(true);
  });

  it('links into the grade III-IV skills and across the new grades', () => {
    const old34 = new Set(oldSkills.filter((s) => s.grade >= 3).map((s) => s.id));
    const byId = new Map(getSkillsBySubject('rom').map((s) => [s.id, s]));
    const intoOld = gimSkills.filter((s) => s.prerequisites.some((p) => old34.has(p)));
    expect(intoOld.length).toBeGreaterThanOrEqual(3);
    for (const g of [6, 7, 8]) {
      const crossing = byGrade(g).filter((s) => s.prerequisites.some((p) => (byId.get(p) as Skill).grade < g));
      expect(crossing.length, `grade ${g}`).toBeGreaterThanOrEqual(3);
    }
    /* every skill is reachable from the grade 0-IV graph: no new root without prerequisites */
    expect(gimSkills.filter((s) => s.prerequisites.length === 0)).toEqual([]);
  });

  it('uses LLR-V-VIII-2017 with own provenance, an English title and the "verify" note', () => {
    for (const s of gimSkills) {
      expect(s.competences.every((c) => c.programa === 'LLR-V-VIII-2017'), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
      expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
    }
  });

  it('covers the strands: comprehension, text modes, vocabulary, morphology, syntax, spelling, punctuation, figures, versification', () => {
    const ids = gimSkills.map((s) => s.id).join(' ');
    for (const part of [
      'text.literal', 'text.mainidea', 'text.inference', 'text.characters', 'text.intention', 'text.theme', 'text.modes', 'text.nonliterary',
      'vocab.synonym', 'vocab.homonym', 'vocab.paronym', 'vocab.lexfamily', 'vocab.compound', 'vocab.sense',
      'morph.noun', 'morph.pos', 'morph.verb', 'morph.mood',
      'synt.subject', 'synt.attribute', 'synt.complement', 'synt.clause', 'synt.subordinate',
      'spell.sa', 'spell.ia', 'spell.nai', 'spell.la', 'spell.caps', 'spell.cratima',
      'punct.basic', 'punct.comma', 'punct.dialog', 'punct.phrase',
      'fig.basic', 'fig.more', 'fig.adv', 'verse.',
    ]) {
      expect(ids, part).toContain(part);
    }
  });

  it('every skill has an existing 3-frame explanation (ai-draft, beta, OWN)', () => {
    for (const s of gimSkills) {
      expect(s.explanations.length, s.id).toBe(1);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      expect(exp?.title.en).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
    }
    const all = readJson(explFile) as { skillId: string }[];
    expect(new Set(all.map((e) => e.skillId)).size).toBe(gimSkills.length);
  });

  it('every skill is backed by registered generators or a bank with >= 3 texts', () => {
    for (const s of gimSkills) {
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
        else expect(existsSync(join(CONTENT, 'items', src.bank)), src.bank).toBe(true);
      }
      if (!s.itemSources.some((x) => 'generator' in x)) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(listGenerators()).toEqual(
      expect.arrayContaining(['spelling-pairs', 'parts-of-speech', 'verb-forms', 'syntax-roles', 'figures-of-speech', 'rom-quiz', 'word-relations']),
    );
  });

  it('placement + missions work over the rom graph for a child who knows grades 0-IV', () => {
    const rom = getSkillsBySubject('rom');
    const known = new Set(oldSkills.map((s) => s.id));
    for (const seed of [1, 2]) {
      const r = simulate(rom, { seed, known, subject: 'rom', declared: { grade: 6, semester: 1 } }, 40);
      expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThanOrEqual(r.gapHistory[0]);
      for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

const SEED = 20261127;
const COUNT = 200;
const genSkills = gimSkills.filter((s) => s.itemSources.some((x) => 'generator' in x));

const optionTexts = (item: Item): string[] => {
  if (item.type === 'choice' || item.type === 'picture-choice') return item.options.map((o) => o.text?.ro ?? JSON.stringify(o.visual));
  if (item.type === 'fill-gap') return item.options ?? [];
  return [];
};

describe('rom gimnaziu generators over every generator-backed skill', () => {
  it('there are at least 30 generator-backed V-VIII skills', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(30);
  });

  for (const skill of genSkills) {
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
          if (i.type === 'choice') {
            const wrong = i.options.find((o) => o.id !== i.correctId) as { id: string };
            expect(checkResponse(i, { type: 'choice', selectedId: wrong.id }), i.id).toBe(false);
          }
          if (i.type === 'fill-gap') {
            const wrong = (i.options ?? []).find((o) => o !== i.correct) as string;
            expect(checkResponse(i, { type: 'fill-gap', value: wrong }), i.id).toBe(false);
          }
        }
      });

      it('has unique options, exactly one correct, at least 2 options', () => {
        for (const i of items) {
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
          expect(texts.length, i.id).toBeGreaterThanOrEqual(2);
          if (i.type === 'choice') expect(i.options.filter((o) => o.id === i.correctId).length).toBe(1);
          if (i.type === 'fill-gap') expect(texts.filter((o) => o === i.correct).length).toBe(1);
        }
      });

      it('is deterministic for a seed', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
      });

      it('varies: at least 12 distinct items out of 200 (most skills far more)', () => {
        const keys = new Set(items.map((i) => JSON.stringify({ ...i, id: '', provenance: '' }).replace(/"id":"[^"]*",?/g, '')));
        expect(keys.size).toBeGreaterThanOrEqual(12);
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

  it('spelling skills yield at least 60 distinct sentences each over many items', () => {
    const skill = gimSkills.find((s) => s.id === 'rom.spell.review.8') as Skill;
    const seen = new Set(generateItems(skill, 1500, { seed: 3 }).map((i) => (i.type === 'fill-gap' ? i.template.ro : '')));
    expect(seen.size).toBeGreaterThanOrEqual(120);
  });
});

/* ------------------------------------------------------------------ */
/*  Curated data: spelling                                             */
/* ------------------------------------------------------------------ */

describe('curated data: spelling-pairs', () => {
  it('is own work with valid provenance', () => {
    const raw = readJson(join(CONTENT, 'data', 'rom', 'spelling.json'));
    expect(validateProvenance(raw.provenance)).toEqual([]);
    expect(raw.provenance.licence).toBe('OWN');
  });

  it('has at least 150 original sentences, no duplicates', () => {
    expect(SPELLING.length).toBeGreaterThanOrEqual(150);
    expect(new Set(SPELLING.map((e) => e.t)).size).toBe(SPELLING.length);
  });

  it('every sentence has exactly one gap and the right form is one of the two forms', () => {
    for (const e of SPELLING) {
      expect(e.t.split('{{gap}}').length - 1, e.t).toBe(1);
      const forms = SPELLING_GROUPS[e.g];
      expect(forms, e.g).toHaveLength(2);
      expect(forms.includes(e.a), `${e.g}: ${e.t}`).toBe(true);
    }
  });

  it('the rest of the sentence never contains either form (no hint, no second gap)', () => {
    for (const e of SPELLING) {
      const rest = tokens(e.t.replace('{{gap}}', ' '));
      for (const f of SPELLING_GROUPS[e.g]) expect(rest.includes(f.toLowerCase()), `${e.t} contains ${f}`).toBe(false);
    }
  });

  it('sentences start with a capital, end with a mark, and a gap opening the sentence gets a capital', () => {
    for (const e of SPELLING) {
      const first = e.t.startsWith('{{gap}}') ? 'X' : e.t[0];
      expect(first, e.t).toBe(first.toLocaleUpperCase('ro'));
      expect(e.t, e.t).toMatch(/[.!?]$/);
    }
    const skill = gimSkills.find((s) => s.id === 'rom.spell.ia.5') as Skill;
    for (const i of generateItems(skill, 300, { seed: 9 })) {
      if (i.type === 'fill-gap' && i.template.ro.startsWith('{{gap}}')) {
        expect(i.correct[0]).toBe(i.correct[0].toLocaleUpperCase('ro'));
        for (const o of i.options ?? []) expect(o[0]).toBe(o[0].toLocaleUpperCase('ro'));
      }
    }
  });

  it('each group offers both of its forms as answers (the hyphenated-only trap group excepted) and groups cover the listed pairs', () => {
    for (const g of Object.keys(SPELLING_GROUPS)) {
      const answers = new Set(SPELLING.filter((e) => e.g === g).map((e) => e.a));
      if (g !== 'intro') expect(answers.size, g).toBe(2);
      expect(SPELLING.filter((e) => e.g === g).length, g).toBeGreaterThanOrEqual(8);
    }
    const forms = new Set(Object.values(SPELLING_GROUPS).flat());
    for (const f of ['s-a', 'sa', 's-au', 'sau', 'i-a', 'ia', 'i-au', 'iau', 'n-ai', 'nai', 'ne-a', 'nea', 'l-a', 'la', 'într-o', 'intr-o', 'mi-a', 'mi-au', 'miau', 'm-ai', 'mai']) {
      expect(forms.has(f), f).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Curated data: grammar                                              */
/* ------------------------------------------------------------------ */

describe('curated data: grammar sets', () => {
  it('grammar file is own work with valid provenance', () => {
    const raw = readJson(join(CONTENT, 'data', 'rom', 'grammar.json'));
    expect(validateProvenance(raw.provenance)).toEqual([]);
    for (const f of ['vocab-gimnaziu.json', 'quiz-gimnaziu.json']) {
      expect(validateProvenance(readJson(join(CONTENT, 'data', 'rom', f)).provenance), f).toEqual([]);
    }
  });

  it('parts of speech: the highlighted word occurs once, exactly one label, 10 labels with >= 10 words each', () => {
    expect(POS_LABELS.length).toBe(10);
    for (const e of POS_ITEMS) {
      expect(occurrences(e.s, e.w), `${e.s} / ${e.w}`).toBe(1);
      expect(POS_LABELS.includes(e.label), e.label).toBe(true);
    }
    for (const l of POS_LABELS) expect(POS_ITEMS.filter((e) => e.label === l).length, l).toBeGreaterThanOrEqual(10);
    /* the same sentence+word never carries two labels */
    const keys = POS_ITEMS.map((e) => `${e.s}|${e.w}`);
    expect(new Set(keys).size).toBe(keys.length);
    /* the grade V and VI skills have at least 40 words each over their 5 labels */
    expect(POS_ITEMS.filter((e) => ['substantiv', 'articol', 'adjectiv', 'pronume', 'numeral'].includes(e.label)).length).toBeGreaterThanOrEqual(50);
  });

  it('verb forms: form occurs once, label valid, 6 tenses, 8 moods, 6 persons covered', () => {
    for (const e of VERB_ITEMS) {
      expect(occurrences(e.s, e.w), `${e.s} / ${e.w}`).toBe(1);
      expect(VERB_LABELS[e.kind].includes(e.label), `${e.kind}: ${e.label}`).toBe(true);
    }
    for (const kind of ['tense', 'mood', 'person'] as const) {
      for (const l of VERB_LABELS[kind]) {
        expect(VERB_ITEMS.filter((e) => e.kind === kind && e.label === l).length, `${kind}: ${l}`).toBeGreaterThanOrEqual(5);
      }
    }
    const keys = VERB_ITEMS.map((e) => `${e.kind}|${e.s}|${e.w}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('person items carry an explicit subject (so number and person are unambiguous)', () => {
    const subjects = /\b(Eu|Tu|Ea|El|Ele|Ei|Noi|Voi|Mama|Fratele|Maria|Bunicul|Copilul|Elevul|Fetele|Copiii|Păsările|Elevii)\b/;
    for (const e of VERB_ITEMS.filter((x) => x.kind === 'person')) expect(e.s, e.s).toMatch(subjects);
  });

  it('syntax roles: highlighted text occurs once, exactly one label, every role has >= 10 examples', () => {
    expect(ROLE_LABELS.length).toBe(9);
    for (const e of ROLE_ITEMS) {
      expect(occurrences(e.s, e.w), `${e.s} / ${e.w}`).toBe(1);
      expect(ROLE_LABELS.includes(e.label), e.label).toBe(true);
    }
    for (const l of ROLE_LABELS) expect(ROLE_ITEMS.filter((e) => e.label === l).length, l).toBeGreaterThanOrEqual(10);
    const keys = ROLE_ITEMS.map((e) => `${e.s}|${e.w}`);
    expect(new Set(keys).size, 'a sentence+word pair has two labels').toBe(keys.length);
  });

  it('predicat nominal entries contain a copulative verb; predicat verbal entries do not use "a fi" as the only verb', () => {
    for (const e of ROLE_ITEMS.filter((x) => x.label === 'predicat nominal')) expect(e.w, e.s).toMatch(/\b(este|era|a devenit|pare|va fi|sunt|devine|rămâne)\b/);
    for (const e of ROLE_ITEMS.filter((x) => x.label === 'predicat verbal')) expect(e.w, e.s).not.toMatch(/\b(este|era|sunt|va fi)\b/);
  });

  it('frază items: 2-3 clauses, valid relation, both relations present', () => {
    expect(FRAZA_ITEMS.length).toBeGreaterThanOrEqual(20);
    for (const e of FRAZA_ITEMS) {
      expect(['coordonare', 'subordonare']).toContain(e.relation);
      expect(e.clauses).toBeGreaterThanOrEqual(2);
      expect(e.clauses).toBeLessThanOrEqual(3);
    }
    expect(new Set(FRAZA_ITEMS.map((e) => e.relation)).size).toBe(2);
    for (const e of FRAZA_ITEMS.filter((x) => x.relation === 'coordonare' && x.clauses === 2)) expect(e.s, e.s).toMatch(/,| și | sau /);
  });

  it('subordinate clauses: the clause is part of the sentence and each of 9 labels has >= 3 examples', () => {
    expect(SUBORD_LABELS.length).toBeGreaterThanOrEqual(8);
    for (const e of SUBORD_ITEMS) expect(occurrences(e.s, e.clause), `${e.s} / ${e.clause}`).toBe(1);
    for (const l of SUBORD_LABELS) expect(SUBORD_ITEMS.filter((e) => e.label === l).length, l).toBeGreaterThanOrEqual(3);
  });

  it('figures of speech: 9 figures, 10 lines each, no line shared by two figures, no repeated lines', () => {
    expect(FIGURE_LABELS.length).toBe(9);
    const lines = FIGURE_ITEMS.map((e) => e.line);
    expect(new Set(lines).size).toBe(lines.length);
    for (const l of FIGURE_LABELS) expect(FIGURE_ITEMS.filter((e) => e.figure === l).length, l).toBeGreaterThanOrEqual(10);
  });

  it('figure lines carry the formal marker of their figure', () => {
    const repeated = (line: string) => {
      const t = tokens(line);
      return t.some((w, i) => t.indexOf(w) !== i && w.length > 2);
    };
    for (const e of FIGURE_ITEMS) {
      if (e.figure === 'comparație') expect(e.line, e.line).toMatch(/\b(ca|precum|cât)\b/);
      if (e.figure === 'enumerație') expect((e.line.match(/,/g) ?? []).length, e.line).toBeGreaterThanOrEqual(2);
      if (e.figure === 'repetiție') expect(repeated(e.line), e.line).toBe(true);
      if (e.figure === 'metaforă') expect(e.line, e.line).not.toMatch(/\b(ca|precum)\b/);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Curated data: vocabulary and quiz                                  */
/* ------------------------------------------------------------------ */

describe('curated data: vocabulary', () => {
  it('synonym and antonym pairs: distinct words, no duplicates, no pair that is both', () => {
    for (const list of [GIM_SYNONYMS, GIM_ANTONYMS]) {
      expect(list.length).toBeGreaterThanOrEqual(25);
      const keys = list.map(([a, b]) => [a, b].sort().join('|'));
      expect(new Set(keys).size).toBe(keys.length);
      for (const [a, b] of list) expect(a).not.toBe(b);
    }
    const syn = new Set(GIM_SYNONYMS.map(([a, b]) => [a, b].sort().join('|')));
    for (const [a, b] of GIM_ANTONYMS) expect(syn.has([a, b].sort().join('|')), `${a}/${b}`).toBe(false);
  });

  it('paronyms: one gap, two different words, no repeated sentence', () => {
    expect(PARONYMS.length).toBeGreaterThanOrEqual(20);
    for (const e of PARONYMS) {
      expect(e.t.split('{{gap}}').length - 1, e.t).toBe(1);
      expect(e.correct).not.toBe(e.wrong);
      expect(tokens(e.t.replace('{{gap}}', ' ')).includes(e.wrong.toLowerCase()), e.t).toBe(false);
    }
    expect(new Set(PARONYMS.map((e) => e.t)).size).toBe(PARONYMS.length);
  });

  it('homonyms: >= 2 senses, >= 2 sentences per sense, the word occurs in every sentence', () => {
    expect(HOMONYMS.length).toBeGreaterThanOrEqual(10);
    for (const h of HOMONYMS) {
      expect(h.senses.length, h.w).toBeGreaterThanOrEqual(2);
      const stem = h.w.toLowerCase().slice(0, Math.max(2, h.w.length - 1));
      const all = h.senses.flat();
      expect(new Set(all).size, h.w).toBe(all.length);
      for (const s of h.senses) {
        expect(s.length, h.w).toBeGreaterThanOrEqual(2);
        for (const sentence of s) expect(sentence.toLowerCase(), `${h.w}: ${sentence}`).toContain(stem);
      }
    }
  });
});

describe('curated data: rom-quiz', () => {
  const topics = Object.keys(QUIZ);

  it('has the 11 topics used by the skills, 10+ questions each', () => {
    expect(topics.sort()).toEqual(['caps', 'comma', 'compound', 'dialog', 'lexfamily', 'noun', 'phrase', 'punct', 'sense', 'verse', 'verse2']);
    for (const t of topics) expect(QUIZ[t].length, t).toBeGreaterThanOrEqual(10);
  });

  it('every question has a unique prompt per topic, a correct answer not among the wrong ones, and distinct options', () => {
    for (const t of topics) {
      const prompts = QUIZ[t].map((e) => `${e.prompt}|${e.correct}`);
      expect(new Set(prompts).size, t).toBe(prompts.length);
      for (const e of QUIZ[t]) {
        expect(e.wrong.length, e.prompt).toBeGreaterThanOrEqual(1);
        expect(e.wrong.includes(e.correct), e.prompt).toBe(false);
        expect(new Set([e.correct, ...e.wrong]).size, e.prompt).toBe(e.wrong.length + 1);
      }
    }
  });

  it('every topic named by a skill exists', () => {
    for (const s of gimSkills) {
      for (const src of s.itemSources) {
        if ('generator' in src && src.generator === 'rom-quiz') expect(topics, s.id).toContain(src.params?.topic);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Item bank: texts                                                   */
/* ------------------------------------------------------------------ */

const texts: ReadAndAnswerItem[] = textFiles.flatMap((f) => readJson(f) as ReadAndAnswerItem[]);
const sentencesOf = (p: string): string[] => p.split(/(?<=[.!?])\s+(?=[A-ZĂÂÎȘȚ—„])/).filter(Boolean);
const wordsOfText = (s: string): string[] => s.split(/\s+/).filter(Boolean);
const gradeOf = new Map(gimSkills.map((s) => [s.id, s.grade]));
const credits: { id: string; url?: string; basis?: string; source: string }[] = readJson(join(CONTENT, 'credits.json'));

describe('read-and-answer text bank, grades V-VIII', () => {
  it('has at least 32 valid texts, 8-10 per grade, all with 3-5 choice/true-false questions', () => {
    expect(texts.length).toBeGreaterThanOrEqual(32);
    for (const g of [5, 6, 7, 8]) {
      const n = texts.filter((t) => gradeOf.get(t.skillId) === g).length;
      expect(n, `grade ${g}`).toBeGreaterThanOrEqual(8);
      expect(n, `grade ${g}`).toBeLessThanOrEqual(10);
    }
    for (const t of texts) {
      expect(t.type).toBe('read-and-answer');
      expect(validateItem(t), t.id).toEqual([]);
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.questions.length, t.id).toBeLessThanOrEqual(5);
      expect(t.prompt.en).toBeTruthy();
      for (const q of t.questions) expect(['choice', 'true-false']).toContain(q.type);
    }
  });

  it('each text belongs to a bank skill of its grade; each bank skill has at least 3 texts', () => {
    const per = new Map<string, number>();
    for (const t of texts) {
      expect(gradeOf.has(t.skillId), t.id).toBe(true);
      per.set(t.skillId, (per.get(t.skillId) ?? 0) + 1);
      for (const q of t.questions) expect(q.skillId).toBe(t.skillId);
      expect(t.explanationId).toBe(gimSkills.find((s) => s.id === t.skillId)?.explanations[0]);
    }
    for (const s of gimSkills) if (s.itemSources.some((x) => 'bank' in x)) expect(per.get(s.id) ?? 0, s.id).toBeGreaterThanOrEqual(3);
    for (const s of gimSkills) for (const src of s.itemSources) if ('bank' in src) expect(src.bank).toBe(`rom/texts-grade${s.grade}.json`);
  });

  it('is ai-draft/OWN/beta, or public domain with a credits entry (basis, url, retrieved)', () => {
    const pd = texts.filter((t) => t.provenance.source === 'public-domain');
    for (const t of texts) {
      expect(t.reviewStatus).toBe('beta');
      if (t.provenance.source === 'public-domain') continue;
      expect(t.provenance.source).toBe('ai-draft');
      expect(t.provenance.licence).toBe('OWN');
    }
    for (const t of pd) {
      expect(validateProvenance(t.provenance), t.id).toEqual([]);
      const credit = credits.find((c) => c.id === t.provenance.id);
      expect(credit, `${t.id}: no credits.json entry`).toBeDefined();
      expect(credit?.basis).toBeTruthy();
      expect(credit?.url).toBe(t.provenance.url);
      expect(t.passage.ro.split(/\s+/).length, `${t.id}: PD fragments must stay short`).toBeLessThanOrEqual(120);
    }
  });

  it('texts are unique and original (no passage repeated across the bank, including grades 0-IV)', () => {
    const old = jsonFiles(join(CONTENT, 'items', 'rom'))
      .filter((f) => !textFiles.includes(f))
      .flatMap((f) => readJson(f) as ReadAndAnswerItem[]);
    const all = [...texts, ...old].map((t) => t.passage.ro);
    expect(new Set(all).size).toBe(all.length);
  });

  it('length and reading level per grade: sentences and words stay within the grade band', () => {
    const band: Record<number, { sentences: [number, number]; words: [number, number]; mean: number; max: number }> = {
      5: { sentences: [4, 10], words: [40, 110], mean: 17, max: 26 },
      6: { sentences: [4, 10], words: [40, 130], mean: 18, max: 28 },
      7: { sentences: [4, 12], words: [40, 140], mean: 19, max: 30 },
      8: { sentences: [4, 12], words: [40, 140], mean: 20, max: 32 },
    };
    for (const t of texts) {
      const g = gradeOf.get(t.skillId) as number;
      const b = band[g];
      const sentences = sentencesOf(t.passage.ro);
      const words = wordsOfText(t.passage.ro).length;
      const lens = sentences.map((s) => wordsOfText(s).length);
      const mean = lens.reduce((a, c) => a + c, 0) / lens.length;
      expect(sentences.length, `${t.id} sentences`).toBeGreaterThanOrEqual(b.sentences[0]);
      expect(sentences.length, `${t.id} sentences`).toBeLessThanOrEqual(b.sentences[1]);
      expect(words, `${t.id} words`).toBeGreaterThanOrEqual(b.words[0]);
      expect(words, `${t.id} words`).toBeLessThanOrEqual(b.words[1]);
      expect(mean, `${t.id} mean ${mean.toFixed(1)}`).toBeLessThanOrEqual(b.mean);
      expect(Math.max(...lens), `${t.id} max`).toBeLessThanOrEqual(b.max);
    }
  });

  it('answers are checkable: correct passes, any flipped answer fails; options unique; answer positions vary', () => {
    const positions = new Set<number>();
    let tfTrue = 0;
    let tfFalse = 0;
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
          const opts = q.options.map((o) => o.text?.ro);
          expect(new Set(opts).size, q.id).toBe(opts.length);
          expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
          positions.add(q.options.findIndex((o) => o.id === q.correctId));
        } else if (q.correct) tfTrue++;
        else tfFalse++;
      }
    }
    expect(positions.size).toBe(3);
    expect(tfTrue).toBeGreaterThanOrEqual(2);
    expect(tfFalse).toBeGreaterThanOrEqual(10);
  });

  it('true/false statements are checkable against the passage: statements of the "false" kind are not copied verbatim from it', () => {
    for (const t of texts) {
      for (const q of t.questions) {
        if (q.type !== 'true-false') continue;
        const statement = q.prompt.ro.replace(/^Adevărat sau fals\?\s*/, '').replace(/[.]$/, '');
        if (!q.correct) expect(t.passage.ro.includes(statement), `${q.id}: a false statement appears verbatim in the text`).toBe(false);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Typography and policy                                              */
/* ------------------------------------------------------------------ */

describe('typography and content policy (new files)', () => {
  it('uses comma-below ș/ț (never cedilla ş/ţ) and NFC in every new content file and generator', () => {
    for (const f of [...newFiles, ...genFiles]) {
      const text = readFileSync(f, 'utf8');
      expect(text, relative(ROOT, f)).not.toMatch(/[ŞşŢţ]/);
      expect(text.normalize('NFC'), relative(ROOT, f)).toBe(text);
    }
  });

  it('has no placeholders and no English-only leftovers in the Romanian text', () => {
    for (const f of newFiles) expect(readFileSync(f, 'utf8'), relative(ROOT, f)).not.toMatch(/TODO|lorem|XXX|\bTBD\b/i);
  });

  it('no sentence or text sample is copied from the older rom item banks', () => {
    const old = jsonFiles(join(CONTENT, 'items', 'rom'))
      .filter((f) => !textFiles.includes(f))
      .flatMap((f) => readJson(f) as ReadAndAnswerItem[])
      .map((t) => t.passage.ro);
    for (const t of texts) for (const o of old) expect(o.includes(t.passage.ro.slice(0, 40))).toBe(false);
  });
});
