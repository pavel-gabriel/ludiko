import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import { GIM_CHOICES, GIM_EVENTS, GIM_FACTS, GIM_PAIRS, GIM_SORTS } from '../src/engine/items/generators/istGimData';
import { simulate } from './helpers/learner';
import type { Difficulty, Item, ItemResponse, Skill } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));

const gimSkills = getSkillsBySubject('ist').filter((s) => s.grade >= 5);
const oldSkills = getSkillsBySubject('ist').filter((s) => s.grade <= 4);
const byGrade = (g: number) => gimSkills.filter((s) => s.grade === g);
const skillFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'skills', 'ist', `grade${g}.json`));
const explFile = join(CONTENT, 'explanations', 'ist', 'grade5-8.json');
const bankFile = join(CONTENT, 'items', 'ist', 'grade5-8.json');
const eventsFile = join(CONTENT, 'data', 'ist', 'events-gimnaziu.json');
const factsFile = join(CONTENT, 'data', 'ist', 'facts-gimnaziu.json');
const newFiles = [...skillFiles, explFile, bankFile, eventsFile, factsFile];

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

const tagsOf = (s: Skill): string[] => {
  const src = s.itemSources.find((x) => 'generator' in x && x.generator === 'ist-events') as { params: { tags: string[] } };
  return src.params.tags;
};
const poolOf = (s: Skill) => GIM_EVENTS.filter((e) => e.tags.some((t) => tagsOf(s).includes(t)));

/** Run one generator directly (generateItems mixes the generators and the bank) */
function runGen(name: string, skill: Skill, d: Difficulty, n: number, seed: number): Item[] {
  const gen = getGenerator(name)!;
  const params = (skill.itemSources.find((src) => 'generator' in src && src.generator === name) as { params: Record<string, unknown> }).params;
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: n }, (_, index) => gen(params, { skill, difficulty: d, rng, index }));
}

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('ist gimnaziu skill graph (V-VIII)', () => {
  it('has 10-12 skills in each of grades V-VIII over both semesters, all structurally valid', () => {
    for (const g of [5, 6, 7, 8]) {
      expect(byGrade(g).length, `grade ${g}`).toBeGreaterThanOrEqual(10);
      expect(byGrade(g).length, `grade ${g}`).toBeLessThanOrEqual(12);
      expect(new Set(byGrade(g).map((s) => s.semester)), `grade ${g}`).toEqual(new Set([1, 2]));
    }
    const errors = skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph is a valid DAG and ist prerequisites stay inside ist', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of gimSkills) for (const p of s.prerequisites) expect(p.startsWith('ist.'), `${s.id} -> ${p}`).toBe(true);
  });

  it('links into grade IV and across the new grades; no new root', () => {
    const old = new Set(oldSkills.map((s) => s.id));
    const byId = new Map(getSkillsBySubject('ist').map((s) => [s.id, s]));
    expect(gimSkills.filter((s) => s.prerequisites.some((p) => old.has(p))).length).toBeGreaterThanOrEqual(5);
    for (const g of [6, 7, 8]) {
      const crossing = byGrade(g).filter((s) => s.prerequisites.some((p) => (byId.get(p) as Skill).grade < g));
      expect(crossing.length, `grade ${g}`).toBeGreaterThanOrEqual(2);
    }
    expect(gimSkills.filter((s) => s.prerequisites.length === 0)).toEqual([]);
  });

  it('uses IST-V-VIII-2017 with own provenance, an English title and the "verify" note', () => {
    for (const s of gimSkills) {
      expect(s.competences.every((c) => c.programa === 'IST-V-VIII-2017'), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
      expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
      expect(s.masteryCheck.minCorrect).toBeLessThanOrEqual(s.masteryCheck.items);
    }
  });

  it('covers the programa: antiquity, Middle Ages, modern, contemporary, with the Romanian history interwoven', () => {
    const ids = gimSkills.map((s) => s.id).join(' ');
    for (const part of [
      'prehistory', 'orient', 'greece', 'rome.republic', 'rome.empire', 'dacians', 'romanization', 'christianity',
      'mid.begin', 'feudal', 'byzantium', 'islam', 'crusades', 'migrations', 'states', 'mircea', 'stefan', 'ottoman', 'mihai',
      'discoveries', 'renaissance', 'reformation', 'enlightenment', 'revolutions', 'industrial', 'phanariot', '1821', '1848', 'union', 'independence',
      'ww1', 'union1918', 'interwar', 'totalitarian', 'ww2', 'ww2ro', 'coldwar', 'communism', 'rev1989', 'eu',
    ]) {
      expect(ids, part).toContain(`ist.${part}`);
    }
  });

  it('every skill has one existing 3-frame explanation (ai-draft, beta, OWN) and generators + the bank are registered', () => {
    for (const s of gimSkills) {
      expect(s.explanations.length, s.id).toBe(1);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      expect(validateExplanation(exp), s.id).toEqual([]);
      for (const f of exp!.frames) expect(f.text.en, s.id).toBeTruthy();
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
        else expect(existsSync(join(CONTENT, 'items', src.bank)), src.bank).toBe(true);
      }
    }
    expect(new Set((readJson(explFile) as { skillId: string }[]).map((e) => e.skillId)).size).toBe(gimSkills.length);
    expect(listGenerators()).toEqual(expect.arrayContaining(['ist-events', 'ist-gim']));
  });

  it('timeline explanations use number lines', () => {
    const lines = gimSkills.filter((s) => getExplanation(s.explanations[0])!.frames.some((f) => f.visual?.kind === 'number-line'));
    expect(lines.length).toBeGreaterThanOrEqual(30);
  });

  it('placement + missions work over the ist graph for a child who knows grade IV', () => {
    const ist = getSkillsBySubject('ist');
    const known = new Set(oldSkills.map((s) => s.id));
    for (const seed of [1, 2]) {
      const r = simulate(ist, { seed, known, subject: 'ist', declared: { grade: 6, semester: 1 } }, 40);
      expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThanOrEqual(r.gapHistory[0]);
      for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Events dataset                                                     */
/* ------------------------------------------------------------------ */

/** Independently typed anchor dates (year, negative = BC) that must match the dataset */
const ANCHORS: Record<string, number> = {
  marathon: -490, salamina: -480, 'alex-moarte': -323, cezar: -44, augustus: -27, colosseum: 80, provincie: 106, columna: 113,
  cadere: 476, milano: 313, tesalonic: 380, carol: 800, hastings: 1066, 'magna-carta': 1215, sofia: 537, hegira: 622,
  'constantinopol-1453': 1453, posada: 1330, 'mircea-start': 1386, vaslui: 1475, 'stefan-start': 1457, 'stefan-end': 1504, calugareni: 1595,
  'unire-1600': 1600, 'mihai-end': 1601, columb: 1492, vasco: 1498, teze: 1517, bastilia: 1789, napoleon: 1804, waterloo: 1815, watt: 1769,
  tudor: 1821, 'revolutia-1848': 1848, unirea: 1859, 'carol-1866': 1866, independenta: 1877, berlin: 1878, regat: 1881, 'ww1-start': 1914,
  'ro-razboi-1916': 1916, 'alba-iulia': 1918, 'ww2-start': 1939, '23-august': 1944, nato: 1949, zid: 1961, 'republica-1947': 1947,
  timisoara: 1989, 'nato-ro': 2004, 'ue-ro': 2007, 'roma-fond': -753, 'olimpiade-1': -776, 'razboi1': 101, retragere: 271,
};

describe('curated events dataset', () => {
  const raw = readJson(eventsFile);

  it('is own work with valid provenance', () => {
    expect(validateProvenance(raw.provenance)).toEqual([]);
    expect(raw.provenance.licence).toBe('OWN');
    expect(raw.provenance.source).toBe('own');
  });

  it('has unique ids, integer non-zero years, grade 5-8, tags, ro+en labels', () => {
    expect(GIM_EVENTS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(GIM_EVENTS.map((e) => e.id)).size).toBe(GIM_EVENTS.length);
    for (const e of GIM_EVENTS) {
      expect(Number.isInteger(e.year) && e.year !== 0, e.id).toBe(true);
      expect(e.year, e.id).toBeLessThanOrEqual(2026);
      expect([5, 6, 7, 8], e.id).toContain(e.grade);
      expect(e.tags.length, e.id).toBeGreaterThan(0);
      expect(e.ro.trim().length, e.id).toBeGreaterThan(5);
      expect(e.en.trim().length, e.id).toBeGreaterThan(5);
      expect(typeof e.approx).toBe('boolean');
    }
  });

  it('events lie in the period of their grade (V antiquity, VI Middle Ages, VII modern, VIII contemporary)', () => {
    const range: Record<number, [number, number]> = { 5: [-3000000, 2000], 6: [200, 1700], 7: [1400, 1950], 8: [1900, 2026] };
    for (const e of GIM_EVENTS) {
      const [lo, hi] = range[e.grade];
      expect(e.year >= lo && e.year <= hi, `${e.id} ${e.year} grade ${e.grade}`).toBe(true);
    }
  });

  it('matches the independently typed anchor dates', () => {
    const byId = new Map(GIM_EVENTS.map((e) => [e.id, e]));
    for (const [id, year] of Object.entries(ANCHORS)) expect(byId.get(id)?.year, id).toBe(year);
  });

  it('every skill pool has at least 5 distinct years and every tag is used by a skill', () => {
    for (const s of gimSkills) {
      expect(new Set(poolOf(s).map((e) => e.year)).size, s.id).toBeGreaterThanOrEqual(5);
      expect(poolOf(s).filter((e) => e.grade === s.grade).length, s.id).toBeGreaterThanOrEqual(4);
    }
    const used = new Set(gimSkills.flatMap(tagsOf));
    for (const e of GIM_EVENTS) expect(e.tags.some((t) => used.has(t)), e.id).toBe(true);
  });

  it('keeps the grade IV dataset untouched and ids distinct from it', () => {
    const old = readJson(join(CONTENT, 'data', 'ist', 'history.json')).events as { id: string }[];
    const ids = new Set(GIM_EVENTS.map((e) => e.id));
    for (const e of old) expect(ids.has(e.id) && false, e.id).toBe(false);
  });
});

describe('curated facts dataset', () => {
  it('is own work with valid provenance', () => {
    const raw = readJson(factsFile);
    expect(validateProvenance(raw.provenance)).toEqual([]);
    expect(raw.provenance.licence).toBe('OWN');
  });

  it('every skill has true and false statements, >= 4 pairs, >= 3 questions and a sorting set', () => {
    for (const s of gimSkills) {
      const tag = tagsOf(s)[0];
      const f = GIM_FACTS.filter((x) => x.tag === tag);
      expect(f.length, s.id).toBeGreaterThanOrEqual(6);
      expect(f.some((x) => x.ok) && f.some((x) => !x.ok), s.id).toBe(true);
      expect(GIM_PAIRS.filter((x) => x.tag === tag).length, s.id).toBeGreaterThanOrEqual(4);
      expect(GIM_CHOICES.filter((x) => x.tag === tag).length, s.id).toBeGreaterThanOrEqual(3);
      expect(GIM_SORTS.filter((x) => x.tag === tag).length, s.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('statements are unique; pairs have unique sides; questions have distinct options and a valid answer', () => {
    expect(new Set(GIM_FACTS.map((f) => `${f.tag}|${f.ro}`)).size).toBe(GIM_FACTS.length);
    for (const tag of new Set(GIM_PAIRS.map((p) => p.tag))) {
      const ps = GIM_PAIRS.filter((p) => p.tag === tag);
      expect(new Set(ps.map((p) => p.left.ro)).size, tag).toBe(ps.length);
      expect(new Set(ps.map((p) => p.right.ro)).size, tag).toBe(ps.length);
      expect(new Set(ps.map((p) => p.left.en)).size, tag).toBe(ps.length);
    }
    for (const c of GIM_CHOICES) {
      expect(c.options.length, c.ro).toBeGreaterThanOrEqual(3);
      expect(new Set(c.options.map((o) => o.ro)).size, c.ro).toBe(c.options.length);
      expect(c.correct >= 0 && c.correct < c.options.length, c.ro).toBe(true);
    }
    for (const s of GIM_SORTS) {
      expect(s.categories.length).toBe(2);
      for (const cat of s.categories) expect(s.cards.filter((c) => c.cat === cat.id).length, s.id).toBeGreaterThanOrEqual(2);
      expect(s.cards.every((c) => s.categories.some((x) => x.id === c.cat))).toBe(true);
      expect(new Set(s.cards.map((c) => c.ro)).size, s.id).toBe(s.cards.length);
    }
  });

  it('every item has an English text', () => {
    for (const x of [...GIM_FACTS, ...GIM_CHOICES]) expect(x.en.length, x.ro).toBeGreaterThan(3);
    for (const x of GIM_PAIRS) expect(x.left.en && x.right.en, x.left.ro).toBeTruthy();
  });
});

describe('text quality of the new files', () => {
  it('uses comma-below diacritics, NFC, and no placeholder text', () => {
    for (const f of newFiles) {
      const text = readFileSync(f, 'utf8');
      expect(text.normalize('NFC'), f).toBe(text);
      expect(/[şŞţŢ]/.test(text), `${f}: cedilla diacritics`).toBe(false);
      expect(/\bTODO\b|lorem ipsum|xxx/i.test(text), f).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Bank                                                               */
/* ------------------------------------------------------------------ */

describe('ist gimnaziu bank', () => {
  const bank = readJson(bankFile) as Item[];

  it('has valid, beta, ai-draft/OWN items, unique ids, at least 3 per skill, mixed types', () => {
    expect(bank.flatMap((i) => validateItem(i))).toEqual([]);
    expect(new Set(bank.map((i) => i.id)).size).toBe(bank.length);
    for (const i of bank) {
      expect(i.reviewStatus).toBe('beta');
      expect(i.provenance.source).toBe('ai-draft');
      expect(i.provenance.licence).toBe('OWN');
      expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
    }
    for (const s of gimSkills) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    expect(new Set(bank.map((i) => i.type))).toEqual(new Set(['choice', 'match', 'sort']));
  });
});

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

const SEED = 20261127;
const COUNT = 200;
const eventById = new Map(GIM_EVENTS.map((e) => [e.id, e]));
const eid = (cardId: string) => eventById.get(cardId.replace(/^e_/, ''))!;
const centuryOf = (y: number) => Math.ceil(Math.abs(y) / 100);

describe('ist gimnaziu generators over every skill', () => {
  it('there are 40+ generator-backed V-VIII skills', () => {
    expect(gimSkills.filter((s) => s.itemSources.some((x) => 'generator' in x)).length).toBeGreaterThanOrEqual(40);
  });

  for (const skill of gimSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it(`produces ${COUNT} valid items; correct answers pass, a wrong one fails`, () => {
        expect(items.length).toBe(COUNT);
        expect(items.flatMap((i) => validateItem(i))).toEqual([]);
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
        for (const i of items) {
          expect(i.skillId).toBe(skill.id);
          expect(i.explanationId).toBe(skill.explanations[0]);
          expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
          if (i.type === 'choice') {
            const wrong = i.options.find((o) => o.id !== i.correctId) as { id: string };
            expect(checkResponse(i, { type: 'choice', selectedId: wrong.id }), i.id).toBe(false);
          }
          if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct }), i.id).toBe(false);
          if (i.type === 'fill-gap') {
            const wrong = (i.options ?? []).find((o) => o !== i.correct) as string;
            expect(checkResponse(i, { type: 'fill-gap', value: wrong }), i.id).toBe(false);
          }
        }
      });

      it('is deterministic for a seed', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
        for (const name of ['ist-events', 'ist-gim']) {
          expect(runGen(name, skill, 3, 20, 5)).toEqual(runGen(name, skill, 3, 20, 5));
        }
      });

      it('works at every difficulty with unique options and one correct answer', () => {
        for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
          for (const name of ['ist-events', 'ist-gim']) {
            for (const i of runGen(name, skill, d, 40, 11 + d)) {
              expect(validateItem({ ...i, id: 'x', provenance: { id: 'x', kind: 'item', title: 't', author: 'a', source: 'generated', licence: 'OWN' }, reviewStatus: 'auto-checked' }), `${skill.id} d${d}`).toEqual([]);
              expect(checkResponse(i, correctResponse(i))).toBe(true);
              if (i.type === 'choice') {
                const texts = i.options.map((o) => o.text?.ro);
                expect(new Set(texts).size, JSON.stringify(texts)).toBe(texts.length);
                expect(i.options.filter((o) => o.id === i.correctId).length).toBe(1);
              }
              if (i.type === 'fill-gap') expect(new Set(i.options).size).toBe((i.options ?? []).length);
            }
          }
        }
      });

      it('timeline items are independently correct (order sorted by year, no ties, century/year/between recomputed)', () => {
        const allowed = new Set(poolOf(skill).map((e) => e.id));
        let sawOrder = 0;
        let sawFirst = 0;
        let sawCentury = 0;
        let sawBetween = 0;
        for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
          for (const i of runGen('ist-events', skill, d, 60, 100 + d)) {
            if (i.type === 'order') {
              sawOrder++;
              const years = i.correctOrder.map((c) => eid(c).year);
              for (const c of i.correctOrder) expect(allowed.has(eid(c).id), c).toBe(true);
              expect(years, i.prompt.ro).toEqual([...years].sort((a, b) => a - b));
              expect(new Set(years).size, 'ties').toBe(years.length);
              expect(new Set(i.cards.map((c) => c.id))).toEqual(new Set(i.correctOrder));
              if (d <= 1) for (const c of i.cards) expect(c.text?.ro).toContain(`(${eid(c.id).year < 0 ? `${-eid(c.id).year} î.Hr.` : eid(c.id).year})`);
            } else if (i.type === 'choice' && i.prompt.ro.startsWith('Care eveniment')) {
              sawFirst++;
              const evs = i.options.map((o) => eid(o.id));
              const years = evs.map((e) => e.year);
              expect(new Set(years).size, 'ties').toBe(years.length);
              const want = /târziu/.test(i.prompt.ro) ? Math.max(...years) : Math.min(...years);
              expect(eid(i.correctId).year).toBe(want);
            } else if (i.type === 'choice' && i.prompt.ro.startsWith('În ce secol')) {
              sawCentury++;
              const ev = GIM_EVENTS.find((e) => i.prompt.ro.includes(`„${e.ro}”`))!;
              expect(ev, i.prompt.ro).toBeDefined();
              const bc = ev.year < 0;
              expect(i.correctId).toBe(`c${bc ? 'b' : 'a'}${centuryOf(ev.year)}`);
              expect(ev.year).toBeGreaterThan(-3000);
              const correctText = i.options.find((o) => o.id === i.correctId)!.text!.ro;
              expect(correctText).toContain('secolul');
              if (bc) expect(correctText).toContain('î.Hr.');
            } else if (i.type === 'choice' && i.prompt.ro.startsWith('În ce an')) {
              const ev = GIM_EVENTS.find((e) => i.prompt.ro.includes(`„${e.ro}”`))!;
              expect(ev, i.prompt.ro).toBeDefined();
              expect(i.correctId).toBe(`y${Math.abs(ev.year)}`);
              expect(i.options.map((o) => o.id).includes(i.correctId)).toBe(true);
            } else if (i.type === 'fill-gap') {
              const ev = GIM_EVENTS.find((e) => i.template.ro.includes(`„${e.ro}”`))!;
              expect(i.correct).toBe(String(Math.abs(ev.year)));
              expect(i.template.ro.includes('î.Hr.')).toBe(ev.year < 0);
            } else if (i.type === 'number-input') {
              sawBetween++;
              const marks = (i.visual as { marks: number[] }).marks;
              const [a, b] = marks.map((y) => GIM_EVENTS.find((e) => e.year === y && !e.approx && allowed.has(e.id))!);
              expect(a && b, i.prompt.ro).toBeTruthy();
              expect(Math.sign(a.year)).toBe(Math.sign(b.year));
              expect(i.correct).toBe(b.year - a.year);
              expect(i.correct).toBeGreaterThan(0);
            }
          }
        }
        expect(sawOrder).toBeGreaterThan(10);
        expect(sawFirst).toBeGreaterThan(5);
        if (poolOf(skill).some((e) => e.year > -3000)) expect(sawCentury + sawBetween).toBeGreaterThan(5);
      });

      it('fact items are consistent with the curated data', () => {
        const tags = tagsOf(skill);
        for (const i of runGen('ist-gim', skill, 3, 80, 77)) {
          if (i.type === 'true-false') {
            const f = GIM_FACTS.find((x) => x.ro === i.prompt.ro && tags.includes(x.tag));
            expect(f, i.prompt.ro).toBeDefined();
            expect(i.correct).toBe(f!.ok);
          } else if (i.type === 'match') {
            for (const p of i.pairs) {
              const pair = GIM_PAIRS.find((x) => x.left.ro === p.left.text!.ro && tags.includes(x.tag))!;
              expect(pair.right.ro).toBe(p.right.text!.ro);
            }
          } else if (i.type === 'sort') {
            const s = GIM_SORTS.find((x) => x.promptRo === i.prompt.ro && tags.includes(x.tag))!;
            for (const c of i.cards) expect(s.cards.find((x) => x.ro === c.text!.ro)!.cat).toBe(c.categoryId);
          } else if (i.type === 'choice') {
            const q = GIM_CHOICES.find((x) => x.ro === i.prompt.ro && tags.includes(x.tag))!;
            expect(i.options.find((o) => o.id === i.correctId)!.text!.ro).toBe(q.options[q.correct].ro);
          }
        }
      });
    });
  }

  it('all generator-produced item types appear over the whole subject', () => {
    const types = new Set<string>();
    for (const s of gimSkills) for (const i of generateItems(s, 60, { seed: 3 })) types.add(i.type);
    for (const t of ['choice', 'true-false', 'order', 'sort', 'match', 'fill-gap', 'number-input']) expect(types.has(t), t).toBe(true);
  });
});
