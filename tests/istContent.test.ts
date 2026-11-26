import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateItems, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import { IST_EVENTS, IST_FACTS, IST_LEGENDS, IST_RULERS } from '../src/engine/items/generators/istData';
import {
  centuryNumber, centuryRange, centuryRoman, centuryWithEra, formatYear, toRoman, centuryLabelRo, centuryLabelEn,
} from '../src/engine/items/generators/istTime';
import { LEARN_SUBJECTS, subjectEmoji } from '../src/ui/learn/subjects';
import type { Difficulty, Item, ItemResponse, Skill } from '../src/engine/types';

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

const istSkills = getSkillsBySubject('ist');
const istFiles = [
  ...jsonFiles(join(CONTENT, 'skills', 'ist')),
  ...jsonFiles(join(CONTENT, 'items', 'ist')),
  ...jsonFiles(join(CONTENT, 'explanations', 'ist')),
  ...jsonFiles(join(CONTENT, 'data', 'ist')),
];
const bankItems = istSkills.flatMap((s) => getItemsForSkill(s.id));

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

const generatorOf = (s: Skill) => s.itemSources.flatMap((src) => ('generator' in src ? [src.generator] : []));
/** Run one generator directly (generateItems mixes several generators per skill) */
function runGen(name: string, params: Record<string, unknown>, skillId: string, d: Difficulty, n: number, seed: number): Item[] {
  const skill = istSkills.find((x) => x.id === skillId)!;
  const gen = getGenerator(name)!;
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
const sourceParams = (skill: Skill, name: string): Record<string, unknown> =>
  ((skill.itemSources.find((src) => 'generator' in src && src.generator === name) as { params?: Record<string, unknown> } | undefined)?.params ?? {});

const generatorSkills = istSkills.filter((s) => generatorOf(s).length > 0);

/* ------------------------------------------------------------------ */
/*  Skill graph                                                        */
/* ------------------------------------------------------------------ */

describe('ist skill graph', () => {
  it('has 12-16 valid grade IV skills over both semesters', () => {
    expect(istSkills.length).toBeGreaterThanOrEqual(12);
    expect(istSkills.length).toBeLessThanOrEqual(16);
    expect(new Set(istSkills.map((s) => s.grade))).toEqual(new Set([4]));
    expect(new Set(istSkills.map((s) => s.semester))).toEqual(new Set([1, 2]));
    const errors = jsonFiles(join(CONTENT, 'skills', 'ist')).flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
  });

  it('the whole graph is a valid DAG and prerequisites stay within history', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of istSkills) for (const p of s.prerequisites) expect(p.startsWith('ist.'), `${s.id} -> ${p}`).toBe(true);
  });

  it('is rooted and connected: some skills have no prerequisite, every other one reaches a root', () => {
    const byId = new Map(istSkills.map((s) => [s.id, s]));
    const roots = istSkills.filter((s) => s.prerequisites.length === 0);
    expect(roots.length).toBeGreaterThanOrEqual(1);
    const reachesRoot = (id: string, seen = new Set<string>()): boolean => {
      const s = byId.get(id)!;
      if (s.prerequisites.length === 0) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return s.prerequisites.some((p) => reachesRoot(p, seen));
    };
    for (const s of istSkills) expect(reachesRoot(s.id), s.id).toBe(true);
  });

  it('covers the required topics', () => {
    const ids = istSkills.map((s) => s.id).join(' ');
    for (const k of ['source', 'time.units', 'time.century', 'time.timeline', 'family', 'dacians', 'romans', 'formation',
      'medieval', 'mihai', 'union1859', 'independence', 'union1918', 'symbols', 'legend']) {
      expect(ids, k).toContain(k);
    }
  });

  it('follows the content policy: own, OWN, Ludiko, IST-IV-2014, ro+en titles', () => {
    for (const s of istSkills) {
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.competences.every((c) => c.programa === 'IST-IV-2014')).toBe(true);
      expect(s.title.en).toBeTruthy();
      expect(s.masteryCheck.minCorrect).toBeLessThanOrEqual(s.masteryCheck.items);
    }
  });

  it('every generator source exists and every bank file exists', () => {
    const known = listGenerators();
    for (const s of istSkills) {
      for (const src of s.itemSources) {
        if ('generator' in src) expect(known, `${s.id}: ${src.generator}`).toContain(src.generator);
        else expect(existsSync(join(CONTENT, 'items', src.bank)), `${s.id}: ${src.bank}`).toBe(true);
      }
    }
  });

  it('is offered in the learner area with an emoji and strings', () => {
    expect(LEARN_SUBJECTS).toContain('ist');
    expect(subjectEmoji('ist')).toBe('🏰');
    for (const lang of ['ro', 'en']) {
      const j = readJson(join(ROOT, 'src', 'i18n', `${lang}.json`));
      expect(j.learn.subject.ist).toBe(lang === 'ro' ? 'Istorie' : 'History');
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Explanations                                                       */
/* ------------------------------------------------------------------ */

describe('ist explanations', () => {
  it('has one valid, beta, ai-draft/OWN explanation per skill with 3 frames', () => {
    for (const s of istSkills) {
      expect(s.explanations.length, s.id).toBe(1);
      const e = getExplanation(s.explanations[0]);
      expect(e, s.id).toBeDefined();
      expect(validateExplanation(e), s.id).toEqual([]);
      expect(e!.skillId).toBe(s.id);
      expect(e!.frames.length).toBe(3);
      expect(e!.reviewStatus).toBe('beta');
      expect(e!.provenance.source).toBe('ai-draft');
      expect(e!.provenance.licence).toBe('OWN');
      for (const f of e!.frames) expect(f.text.en, s.id).toBeTruthy();
    }
  });

  it('timeline / century explanations use number lines', () => {
    for (const id of ['ist.time.units.4', 'ist.time.century.4', 'ist.time.timeline.4']) {
      const e = getExplanation(`exp.${id}`)!;
      expect(e.frames.every((f) => f.visual?.kind === 'number-line'), id).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Century conversion                                                 */
/* ------------------------------------------------------------------ */

describe('century conversion (Romanian school convention)', () => {
  const table: [number, string][] = [
    [1, 'I'], [100, 'I'], [101, 'II'], [1330, 'XIV'], [1386, 'XIV'], [1457, 'XV'], [1500, 'XV'], [1501, 'XVI'], [1600, 'XVI'],
    [1601, 'XVII'], [1859, 'XIX'], [1877, 'XIX'], [1900, 'XIX'], [1901, 'XX'], [1918, 'XX'], [2000, 'XX'], [2001, 'XXI'], [2007, 'XXI'],
    [106, 'II'], [113, 'II'], [-44, 'I'], [-82, 'I'], [-100, 'I'], [-101, 'II'],
  ];
  for (const [year, roman] of table) {
    it(`${year} -> ${roman}`, () => expect(centuryRoman(year)).toBe(roman));
  }

  it('matches the examples of the task, with era', () => {
    expect(centuryWithEra(1)).toBe('I');
    expect(centuryWithEra(1859)).toBe('XIX');
    expect(centuryWithEra(1600)).toBe('XVI');
    expect(centuryWithEra(2000)).toBe('XX');
    expect(centuryWithEra(2001)).toBe('XXI');
    expect(centuryWithEra(-44)).toBe('I î.Hr.');
    expect(centuryWithEra(-101)).toBe('II î.Hr.');
  });

  it('converts Roman numerals', () => {
    const pairs: [number, string][] = [[1, 'I'], [4, 'IV'], [9, 'IX'], [14, 'XIV'], [15, 'XV'], [16, 'XVI'], [18, 'XVIII'], [19, 'XIX'], [20, 'XX'], [21, 'XXI']];
    for (const [n, r] of pairs) expect(toRoman(n)).toBe(r);
  });

  it('formats Romanian and English labels', () => {
    expect(centuryLabelRo(1, false)).toBe('secolul I');
    expect(centuryLabelRo(15, false)).toBe('secolul al XV-lea');
    expect(centuryLabelRo(1, true)).toBe('secolul I î.Hr.');
    expect(centuryLabelRo(1, false, true)).toBe('secolul I d.Hr.');
    expect(centuryLabelEn(21, false)).toBe('the 21st century');
    expect(centuryLabelEn(12, false)).toBe('the 12th century');
    expect(centuryLabelEn(2, true)).toBe('the 2nd century BC');
    expect(formatYear(-82, 'ro')).toBe('82 î.Hr.');
    expect(formatYear(1859, 'en')).toBe('1859');
  });

  it('century ranges are consistent with centuryNumber for every year 1..2100 and -700..-1', () => {
    for (let y = 1; y <= 2100; y++) {
      const n = centuryNumber(y);
      const r = centuryRange(n, false);
      expect(y >= r.from && y <= r.to, String(y)).toBe(true);
    }
    for (let y = -700; y <= -1; y++) {
      const n = centuryNumber(y);
      const r = centuryRange(n, true);
      expect(y >= r.from && y <= r.to, String(y)).toBe(true);
    }
  });

  it('rejects year 0', () => {
    expect(() => centuryNumber(0)).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  Event table                                                        */
/* ------------------------------------------------------------------ */

describe('event table', () => {
  it('is chronological with unique ids and unique years', () => {
    const years = IST_EVENTS.map((e) => e.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(new Set(years).size).toBe(years.length);
    expect(new Set(IST_EVENTS.map((e) => e.id)).size).toBe(IST_EVENTS.length);
    expect(new Set(IST_EVENTS.map((e) => e.ro)).size).toBe(IST_EVENTS.length);
    expect(years.every((y) => Number.isInteger(y) && y !== 0)).toBe(true);
  });

  it('every event has Romanian and English text and a sentence stem', () => {
    for (const e of IST_EVENTS) {
      expect(e.ro && e.en && e.stemRo && e.stemEn, e.id).toBeTruthy();
      expect(e.stemRo.endsWith(' anul') || e.stemRo.endsWith(' anului'), e.id).toBe(true);
    }
  });

  it('holds the key dates (double-checked)', () => {
    const y = (id: string) => IST_EVENTS.find((e) => e.id === id)?.year;
    expect(y('burebista-start')).toBe(-82);
    expect(y('burebista-end')).toBe(-44);
    expect(y('province')).toBe(106);
    expect(y('posada')).toBe(1330);
    expect(y('mircea-start')).toBe(1386);
    expect(y('mircea-end')).toBe(1418);
    expect(y('stefan-start')).toBe(1457);
    expect(y('stefan-end')).toBe(1504);
    expect(y('mihai-union')).toBe(1600);
    expect(y('union1859')).toBe(1859);
    expect(y('independence')).toBe(1877);
    expect(y('union1918')).toBe(1918);
    expect(IST_EVENTS.filter((e) => e.approx).map((e) => e.id).sort()).toEqual(['bogdan', 'burebista-end', 'burebista-start']);
  });

  it('rulers: reigns are consistent with the event table and the statements', () => {
    for (const r of IST_RULERS) {
      expect(r.ro && r.en && r.achRo && r.achEn, r.id).toBeTruthy();
      if (r.reign) expect(r.reign[0] < r.reign[1], r.id).toBe(true);
    }
    const reign = (id: string) => IST_RULERS.find((r) => r.id === id)?.reign;
    expect(reign('stefan')).toEqual([1457, 1504]);
    expect(reign('mircea')).toEqual([1386, 1418]);
    expect(reign('cuza')).toEqual([1859, 1866]);
    expect(reign('mihai')).toEqual([1593, 1601]);
    expect(new Set(IST_RULERS.map((r) => r.id)).size).toBe(IST_RULERS.length);
    expect(new Set(IST_RULERS.map((r) => r.achRo)).size).toBe(IST_RULERS.length);
  });

  it('facts and legends are unique and balanced', () => {
    const f = IST_FACTS.map((x) => x.ro);
    expect(new Set(f).size).toBe(f.length);
    expect(IST_FACTS.filter((x) => x.ok).length).toBeGreaterThan(40);
    expect(IST_FACTS.filter((x) => !x.ok).length).toBeGreaterThan(20);
    expect(IST_LEGENDS.filter((x) => x.kind === 'L').length).toBeGreaterThanOrEqual(8);
    expect(IST_LEGENDS.filter((x) => x.kind === 'F').length).toBeGreaterThanOrEqual(8);
    for (const x of [...IST_FACTS, ...IST_LEGENDS]) expect(x.en, x.ro).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Generators                                                         */
/* ------------------------------------------------------------------ */

describe('ist generators', () => {
  it('registers the five generators', () => {
    for (const g of ['ist-century', 'ist-timeline', 'ist-ruler', 'ist-fact', 'ist-legend']) expect(getGenerator(g), g).toBeDefined();
  });

  for (const skill of generatorSkills) {
    it(`${skill.id}: 200 valid items with correct, checkable answers`, () => {
      const items = generateItems(skill, 200, { seed: 20261125 });
      expect(items).toHaveLength(200);
      for (const item of items) {
        expect(validateItem(item), item.id).toEqual([]);
        expect(item.skillId).toBe(skill.id);
        expect(checkResponse(item, correctResponse(item)), item.id).toBe(true);
        if (item.type === 'choice') {
          const wrong = item.options.find((o) => o.id !== item.correctId)!;
          expect(checkResponse(item, { type: 'choice', selectedId: wrong.id }), item.id).toBe(false);
          const texts = item.options.map((o) => o.text?.ro);
          expect(new Set(texts).size, item.id).toBe(texts.length);
        }
        if (item.type === 'true-false') expect(checkResponse(item, { type: 'true-false', value: !item.correct })).toBe(false);
      }
    });

    it(`${skill.id}: valid at every difficulty and deterministic for a seed`, () => {
      for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
        const items = generateItems(skill, 60, { seed: 7 + d, difficulty: d });
        for (const item of items) {
          expect(validateItem(item), `${item.id} d${d}`).toEqual([]);
          expect(checkResponse(item, correctResponse(item)), item.id).toBe(true);
        }
      }
      const a = JSON.stringify(generateItems(skill, 20, { seed: 99 }));
      expect(JSON.stringify(generateItems(skill, 20, { seed: 99 }))).toBe(a);
    });
  }

  it('ist-century: the marked answer is the real century', () => {
    const skill = istSkills.find((s) => s.id === 'ist.time.century.4')!;
    let forward = 0;
    let reverse = 0;
    let bc = 0;
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      for (const item of runGen('ist-century', { mode: 'century' }, skill.id, d, 150, 31 + d)) {
        if (item.type !== 'choice') continue;
        const correct = item.options.find((o) => o.id === item.correctId)!.text!.ro;
        const p = item.prompt.ro;
        let m = p.match(/^În ce secol a fost anul (\d+)\?$/);
        if (m) {
          forward++;
          const y = Number(m[1]);
          expect(correct).toBe(centuryLabelRo(centuryNumber(y), false));
          continue;
        }
        m = p.match(/^Anul (\d+) î\.Hr\. face parte din\.\.\.$/);
        if (m) {
          bc++;
          expect(correct).toBe(centuryLabelRo(centuryNumber(-Number(m[1])), true));
          continue;
        }
        m = p.match(/^Care dintre ani face parte din (.+)\?$/);
        expect(m, p).not.toBeNull();
        reverse++;
        const inside = item.options.filter((o) => centuryLabelRo(centuryNumber(Number(o.text!.ro)), false) === m![1]);
        expect(inside.length, p).toBe(1);
        expect(inside[0].id).toBe(item.correctId);
      }
    }
    expect(forward).toBeGreaterThan(100);
    expect(reverse).toBeGreaterThan(20);
    expect(bc).toBeGreaterThan(20);
  });

  it('ist-century (units): numeric answers are right', () => {
    const skill = istSkills.find((s) => s.id === 'ist.time.units.4')!;
    const source = skill.itemSources.find((s) => 'generator' in s && s.generator === 'ist-century') as { generator: string; params: Record<string, unknown> };
    const gen = getGenerator('ist-century')!;
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const item = gen(source.params, { skill, difficulty: ((i % 5) + 1) as Difficulty, rng: (() => { let a = i * 7919 + 1; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })(), index: i });
      seen.add(item.prompt.ro);
      const p = item.prompt.ro;
      if (item.type === 'number-input') {
        let m = p.match(/^Câți ani au (\d+) (decenii|secole)\?$/);
        if (m) expect(item.correct).toBe(Number(m[1]) * (m[2] === 'decenii' ? 10 : 100));
        m = p.match(/^Câte (decenii|secole) are un (secol|mileniu)\?$/);
        if (m) expect(item.correct).toBe(m[2] === 'secol' ? 10 : 10);
        m = p.match(/^Câte decenii au (\d+) secole\?$/);
        if (m) expect(item.correct).toBe(Number(m[1]) * 10);
      } else if (item.type === 'choice') {
        const m = p.match(/^Câți ani are un (deceniu|secol|mileniu)\?$/);
        expect(m).not.toBeNull();
        const years = { deceniu: 10, secol: 100, mileniu: 1000 }[m![1] as 'deceniu'];
        expect(item.options.find((o) => o.id === item.correctId)!.text!.ro).toBe(String(years));
      }
    }
    expect(seen.size).toBeGreaterThan(10);
  });

  it('ist-timeline: order items are chronological, intervals are exact', () => {
    let orders = 0;
    let intervals = 0;
    let firsts = 0;
    const byId = new Map(IST_EVENTS.map((e) => [`e_${e.id}`, e]));
    for (const skill of generatorSkills.filter((s) => generatorOf(s).includes('ist-timeline'))) {
      for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
        for (const item of runGen('ist-timeline', sourceParams(skill, 'ist-timeline'), skill.id, d, 80, 5 * d)) {
          if (item.type === 'order') {
            orders++;
            const years = item.correctOrder.map((id) => byId.get(id)!.year);
            expect(years, item.id).toEqual([...years].sort((a, b) => a - b));
            expect(new Set(years).size).toBe(years.length);
            expect(item.cards.map((c) => c.id).sort()).toEqual([...item.correctOrder].sort());
            expect(item.correctOrder.length).toBeGreaterThanOrEqual(3);
            if (d <= 1) expect(item.cards.every((c) => /\(\d+( î\.Hr\.)?\)$/.test(c.text!.ro))).toBe(true);
            else expect(item.cards.every((c) => !/\(\d+/.test(c.text!.ro))).toBe(true);
          } else if (item.type === 'choice') {
            firsts++;
            const ids = item.options.map((o) => byId.get(o.id)!);
            const earliest = ids.reduce((a, b) => (a.year < b.year ? a : b));
            expect(`e_${earliest.id}`).toBe(item.correctId);
          } else if (item.type === 'number-input') {
            intervals++;
            const nums = item.prompt.ro.match(/\d{3,4}/g)!.map(Number);
            expect(item.correct, item.prompt.ro).toBe(Math.max(...nums) - Math.min(...nums));
            expect(item.correct).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(orders).toBeGreaterThan(100);
    expect(intervals).toBeGreaterThan(5);
    expect(firsts).toBeGreaterThan(5);
  });

  it('ist-ruler: every match pair and every "who was" answer agrees with the table', () => {
    const skill = istSkills.find((s) => s.id === 'ist.medieval.heroes.4')!;
    const byAch = new Map(IST_RULERS.map((r) => [r.achRo, r]));
    let matches = 0;
    let whos = 0;
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      for (const item of runGen('ist-ruler', sourceParams(skill, 'ist-ruler'), skill.id, d, 100, 11 * d)) {
        if (item.type === 'match') {
          matches++;
          for (const p of item.pairs) {
            const r = byAch.get(p.right.text!.ro)!;
            expect(r.ro).toBe(p.left.text!.ro);
          }
          expect(item.pairs.length).toBeGreaterThanOrEqual(3);
        } else if (item.type === 'choice') {
          whos++;
          const m = item.prompt.ro.match(/^Cine a fost (.+)\?$/)!;
          const r = byAch.get(m[1])!;
          expect(item.options.find((o) => o.id === item.correctId)!.text!.ro).toBe(r.ro);
        }
      }
    }
    expect(matches).toBeGreaterThan(20);
    expect(whos).toBeGreaterThan(10);
  });

  it('ist-fact: true/false statements and year questions agree with the tables', () => {
    const facts = new Map(IST_FACTS.map((f) => [f.ro, f.ok]));
    const events = IST_EVENTS;
    let tfDates = 0;
    let choices = 0;
    for (const skill of generatorSkills.filter((s) => generatorOf(s).includes('ist-fact'))) {
      for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
        for (const item of runGen('ist-fact', sourceParams(skill, 'ist-fact'), skill.id, d, 60, 3 * d)) {
          if (item.type === 'true-false') {
            if (facts.has(item.prompt.ro)) {
              expect(item.correct).toBe(facts.get(item.prompt.ro));
              continue;
            }
            tfDates++;
            const e = events.find((x) => item.prompt.ro.startsWith(`${x.stemRo} `));
            expect(e, item.prompt.ro).toBeDefined();
            const stated = item.prompt.ro.slice(e!.stemRo.length + 1, -1);
            expect(item.correct).toBe(stated === formatYear(e!.year, 'ro'));
          } else if (item.type === 'choice') {
            choices++;
            const m = item.prompt.ro.match(/„(.+)”/)!;
            const e = events.find((x) => x.ro === m[1])!;
            expect(item.options.find((o) => o.id === item.correctId)!.text!.ro).toBe(formatYear(e.year, 'ro'));
            expect(item.options.length).toBe(4);
          }
        }
      }
    }
    expect(tfDates).toBeGreaterThan(20);
    expect(choices).toBeGreaterThan(20);
  });

  it('ist-legend: classification agrees with the table (choice and sort)', () => {
    const skill = istSkills.find((s) => s.id === 'ist.legend.fact.4')!;
    const kinds = new Map(IST_LEGENDS.map((l) => [l.ro, l.kind]));
    const strip = (s: string) => s.replace(/\.$/, '');
    const kindOf = (text: string) => IST_LEGENDS.find((l) => strip(l.ro) === text)!.kind;
    let choices = 0;
    let sorts = 0;
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      for (const item of runGen('ist-legend', {}, skill.id, d, 80, 13 * d)) {
        if (item.type === 'choice') {
          choices++;
          const text = item.prompt.ro.match(/„(.+)”$/)![1];
          expect(item.correctId).toBe(kindOf(text) === 'L' ? 'legend' : 'fact');
        } else if (item.type === 'sort') {
          sorts++;
          expect(item.cards).toHaveLength(4);
          const cats = new Set(item.cards.map((c) => c.categoryId));
          expect(cats.size).toBe(2);
          for (const c of item.cards) expect(c.categoryId).toBe(kinds.get(c.text!.ro) === 'L' ? 'legend' : 'fact');
        }
      }
    }
    expect(choices).toBeGreaterThan(20);
    expect(sorts).toBeGreaterThan(20);
  });
});

/* ------------------------------------------------------------------ */
/*  Static banks                                                       */
/* ------------------------------------------------------------------ */

describe('ist static item banks', () => {
  const files = jsonFiles(join(CONTENT, 'items', 'ist'));

  it('has at least 60 valid items, about 8+ short read-and-answer texts', () => {
    expect(bankItems.length).toBeGreaterThanOrEqual(60);
    expect(bankItems.filter((i) => i.type === 'read-and-answer').length).toBeGreaterThanOrEqual(8);
    expect(files.flatMap((f) => validateItems(readJson(f), relative(ROOT, f)))).toEqual([]);
  });

  it('every skill has static items and a spread of item types', () => {
    for (const s of istSkills) expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    const types = new Set(bankItems.map((i) => i.type));
    for (const t of ['choice', 'true-false', 'order', 'sort', 'match', 'fill-gap', 'number-input', 'read-and-answer']) expect(types.has(t as never), t).toBe(true);
  });

  it('every item is answerable with its correct answer and not by a wrong one', () => {
    for (const item of bankItems) {
      expect(checkResponse(item, correctResponse(item)), item.id).toBe(true);
      if (item.type === 'choice') {
        const wrong = item.options.find((o) => o.id !== item.correctId)!;
        expect(checkResponse(item, { type: 'choice', selectedId: wrong.id })).toBe(false);
      }
    }
  });

  it('is beta, ai-draft, OWN and points to its skill explanation', () => {
    for (const item of bankItems) {
      const skill = istSkills.find((s) => s.id === item.skillId)!;
      expect(item.reviewStatus).toBe('beta');
      expect(item.provenance.source).toBe('ai-draft');
      expect(item.provenance.licence).toBe('OWN');
      expect(item.explanationId).toBe(skill.explanations[0]);
    }
  });

  it('order items in the banks are chronological per the event table', () => {
    for (const item of bankItems) {
      if (item.type !== 'order') continue;
      const labels = item.correctOrder.map((id) => item.cards.find((c) => c.id === id)!.text!.ro.replace(/ \(\d+( î\.Hr\.)?\)$/, ''));
      const years = labels.map((l) => IST_EVENTS.find((e) => e.ro === l)?.year);
      if (years.every((y) => y !== undefined)) expect(years, item.id).toEqual([...(years as number[])].sort((a, b) => a - b));
    }
  });

  it('numeric history answers are right (intervals, reigns)', () => {
    const num = bankItems.filter((i) => i.type === 'number-input');
    for (const item of num) {
      if (item.type !== 'number-input') continue;
      const years = item.prompt.ro.match(/\b(1\d{3})\b/g)?.map(Number);
      if (years && years.length >= 2 && /Câți ani/.test(item.prompt.ro) && /(trecut|domnit|sunt între)/.test(item.prompt.ro)) {
        expect(item.correct, item.id).toBe(Math.max(...years) - Math.min(...years));
      }
    }
  });

  it('reading texts are unique and short (under 90 words)', () => {
    const texts = bankItems.flatMap((i) => (i.type === 'read-and-answer' ? [i.passage.ro] : []));
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t.split(/\s+/).length).toBeLessThan(90);
  });

  it('statements about dates in the banks never contradict the event table', () => {
    // every "<event stem> YEAR" sentence found in a passage or prompt carries the table year
    const blobs = bankItems.flatMap((i) => (i.type === 'read-and-answer' ? [i.passage.ro, ...i.questions.map((q) => q.prompt.ro)] : [i.prompt.ro]));
    for (const e of IST_EVENTS) {
      for (const b of blobs) {
        const at = b.indexOf(e.stemRo);
        if (at >= 0) {
          const rest = b.slice(at + e.stemRo.length + 1);
          expect(rest.startsWith(formatYear(e.year, 'ro')), `${e.id}: ${b}`).toBe(true);
        }
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Language and policy                                                */
/* ------------------------------------------------------------------ */

describe('ist content language and policy', () => {
  it('uses comma-below ș/ț (never cedilla ş/ţ) and NFC', () => {
    const files = [...istFiles, ...['istData.ts', 'istGenerators.ts', 'istTime.ts'].map((f) => join(ROOT, 'src', 'engine', 'items', 'generators', f))];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text, relative(ROOT, f)).not.toMatch(/[ŞşŢţ]/);
      expect(text.normalize('NFC'), relative(ROOT, f)).toBe(text);
    }
  });

  it('has no leftover placeholders', () => {
    for (const f of istFiles) expect(readFileSync(f, 'utf8'), relative(ROOT, f)).not.toMatch(/TODO|lorem|XXX/i);
  });

  it('all content carries provenance with allowed own/ai-draft/OWN values', () => {
    const data = readJson(join(CONTENT, 'data', 'ist', 'history.json'));
    expect(data.provenance.licence).toBe('OWN');
    expect(data.provenance.source).toBe('own');
  });

  it('keeps a neutral tone: no gory wording in the learner-facing text', () => {
    const blob = istFiles.map((f) => readFileSync(f, 'utf8')).join(' ').toLowerCase();
    for (const w of ['sânge', 'sange', 'masacr', 'tortur', 'decapit', 'măcel', 'impal', 'țeapă', 'blood', 'massacre', 'torture', 'beheaded']) {
      expect(blob.includes(w), w).toBe(false);
    }
  });
});
