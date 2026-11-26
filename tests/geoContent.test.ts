import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItems, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator } from '../src/engine/items/generators';
import { DIRECTIONS, directionBetween } from '../src/engine/items/generators/geoDirections';
import { LEARN_SUBJECTS, SUBJECT_EMOJI } from '../src/ui/learn/subjects';
import ro from '../src/i18n/ro.json';
import en from '../src/i18n/en.json';
import type { HotspotItem, Item, ItemResponse, Skill } from '../src/engine/types';

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

const geoSkills = getSkillsBySubject('geo');
const geoItems: Item[] = geoSkills.flatMap((s) => getItemsForSkill(s.id));
const mapData = readJson(join(CONTENT, 'data/geo/romania-map.json')) as {
  image: { labelled: string; blank: string; viewBox: [number, number] };
  targets: { id: string; kind: string; ro: string; x: number; y: number; r: number }[];
};

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

describe('geo skill graph (grade IV)', () => {
  it('has 12-14 valid skills, all grade IV, own provenance, GEO-IV-2014 codes flagged to verify', () => {
    expect(geoSkills.length).toBeGreaterThanOrEqual(12);
    expect(geoSkills.length).toBeLessThanOrEqual(14);
    const errors = jsonFiles(join(CONTENT, 'skills', 'geo')).flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
    for (const s of geoSkills) {
      expect(s.grade).toBe(4);
      expect(s.competences.every((c) => c.programa === 'GEO-IV-2014')).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en).toBeTruthy();
    }
  });

  it('the whole graph is a valid DAG and geo prerequisites stay inside geo', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of geoSkills) for (const p of s.prerequisites) expect(p.startsWith('geo.'), `${s.id} -> ${p}`).toBe(true);
    const roots = geoSkills.filter((s) => s.prerequisites.length === 0);
    expect(roots.map((s) => s.id)).toEqual(['geo.orient.cardinal.4']);
  });

  it('covers the programa topics', () => {
    const ids = geoSkills.map((s) => s.id).join(' ');
    for (const part of ['cardinal', 'map', 'position', 'relief.units', 'carpathians', 'lowlands', 'rivers', 'danube', 'blacksea', 'climate', 'zones', 'settlements', 'counties', 'environment']) {
      expect(ids, part).toContain(part);
    }
  });

  it('every skill has a 3-frame explanation (ai-draft, beta, own) and enough items or a generator', () => {
    for (const s of geoSkills) {
      expect(s.explanations).toEqual([`exp.${s.id}`]);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      for (const f of exp?.frames ?? []) expect(f.text.en).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
      for (const src of s.itemSources) if ('generator' in src) expect(getGenerator(src.generator)).toBeTypeOf('function');
      expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(5);
    }
  });
});

describe('geo item banks', () => {
  it('every file under content/items/geo validates; ids unique; own ai-draft beta', () => {
    const files = jsonFiles(join(CONTENT, 'items', 'geo'));
    expect(files.length).toBeGreaterThanOrEqual(5);
    const all: unknown[] = [];
    for (const f of files) {
      const items = readJson(f);
      expect(validateItems(items, relative(ROOT, f))).toEqual([]);
      all.push(...items);
    }
    const ids = (all as Item[]).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of all as Item[]) {
      expect(it.reviewStatus).toBe('beta');
      expect(it.provenance.source).toBe('ai-draft');
      expect(it.provenance.licence).toBe('OWN');
    }
  });

  it('has at least 60 items covering the types, with 6 read-and-answer texts and hotspots', () => {
    expect(geoItems.length).toBeGreaterThanOrEqual(60);
    const count = (t: string) => geoItems.filter((i) => i.type === t).length;
    expect(count('read-and-answer')).toBeGreaterThanOrEqual(6);
    expect(count('hotspot')).toBeGreaterThanOrEqual(15);
    for (const t of ['choice', 'true-false', 'match', 'sort', 'order', 'number-input']) expect(count(t), t).toBeGreaterThan(0);
  });

  it('a perfect child passes every item and a wrong answer fails the closed ones', () => {
    for (const it of geoItems) expect(checkResponse(it, correctResponse(it)), it.id).toBe(true);
    for (const it of geoItems) {
      if (it.type === 'choice') {
        const wrong = it.options.find((o) => o.id !== it.correctId)!;
        expect(checkResponse(it, { type: 'choice', selectedId: wrong.id }), it.id).toBe(false);
      }
      if (it.type === 'true-false') expect(checkResponse(it, { type: 'true-false', value: !it.correct }), it.id).toBe(false);
    }
  });

  it('choice options are unique and short enough for a phone', () => {
    for (const it of geoItems) {
      if (it.type !== 'choice') continue;
      const texts = it.options.map((o) => o.text?.ro);
      expect(new Set(texts).size, it.id).toBe(texts.length);
      for (const t of texts) expect((t ?? '').length, it.id).toBeLessThanOrEqual(70);
    }
  });
});

describe('geo map hotspots', () => {
  const hotspots = geoItems.filter((i): i is HotspotItem => i.type === 'hotspot');
  const targets = new Map(mapData.targets.map((t) => [t.id, t]));
  const [vw, vh] = mapData.image.viewBox;

  it('regions are within 0-100 and equal the shared data file (single source of truth)', () => {
    for (const h of hotspots) {
      for (const r of h.regions) {
        expect(r.x, `${h.id} ${r.id}`).toBeGreaterThanOrEqual(0);
        expect(r.x).toBeLessThanOrEqual(100);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeLessThanOrEqual(100);
        expect(r.r).toBeGreaterThan(0);
        const t = targets.get(r.id);
        expect(t, `${h.id}: unknown target ${r.id}`).toBeDefined();
        expect({ x: r.x, y: r.y, r: r.r }).toEqual({ x: t!.x, y: t!.y, r: t!.r });
      }
    }
  });

  it('the regions offered in one item never overlap (also at the 48 px minimum on a 360 px screen)', () => {
    const MIN_R = (24 / 328) * 100; // 48 px button on a ~328 px wide map, as % of the width
    for (const h of hotspots) {
      expect(h.regions.length).toBeGreaterThanOrEqual(3);
      expect(h.regions.length).toBeLessThanOrEqual(4);
      for (let i = 0; i < h.regions.length; i++) {
        for (let j = i + 1; j < h.regions.length; j++) {
          const a = h.regions[i], b = h.regions[j];
          const d = Math.hypot(a.x - b.x, (a.y - b.y) * (vh / vw)); // y % is of the height: convert to width %
          expect(d, `${h.id}: ${a.id}/${b.id}`).toBeGreaterThanOrEqual(Math.max(a.r, MIN_R) + Math.max(b.r, MIN_R));
        }
      }
    }
  });

  it('every tap region lies fully inside the image (nothing is clipped)', () => {
    const aspect = vw / vh;
    for (const h of hotspots) {
      for (const r of h.regions) {
        expect(r.x - r.r, `${h.id} ${r.id} left`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.r, `${h.id} ${r.id} right`).toBeLessThanOrEqual(100);
        expect(r.y - r.r * aspect, `${h.id} ${r.id} top`).toBeGreaterThanOrEqual(0);
        expect(r.y + r.r * aspect, `${h.id} ${r.id} bottom`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('exactly one correct region that is among the options; tap targets are not labelled with the answer', () => {
    for (const h of hotspots) {
      expect(h.regions.filter((r) => r.id === h.correctId).length).toBe(1);
      for (const r of h.regions) expect(r.label).toBeUndefined();
    }
  });

  it('uses the blank map with a credited (Natural Earth) image that exists and stays light', () => {
    for (const h of hotspots) {
      expect(h.image.src).toBe(mapData.image.blank);
      expect(h.image.provenanceId).toBe('data-natural-earth');
    }
    for (const rel of [mapData.image.blank, mapData.image.labelled]) {
      const f = join(ROOT, 'public', rel);
      expect(existsSync(f), rel).toBe(true);
      const svg = readFileSync(f, 'utf8');
      expect(svg.length, rel).toBeLessThan(60 * 1024);
      expect(svg).toContain(`viewBox="0 0 ${vw} ${vh}"`);
      expect(svg).toContain('role="img"');
    }
    const labelled = readFileSync(join(ROOT, 'public', mapData.image.labelled), 'utf8');
    for (const name of ['Carpații', 'Orientali', 'Meridionali', 'Occidentali', 'Subcarpați', 'Transilvaniei', 'Moldovei', 'Dobrogei', 'Câmpia', 'Delta', 'Marea', 'UCRAINA', 'MOLDOVA', 'BULGARIA', 'SERBIA', 'UNGARIA', 'Dunărea', 'Mureș', 'Olt', 'Siret', 'Prut', 'Jiu', 'Argeș', 'Someș', 'București', 'Cluj-Napoca', 'Iași', 'Timișoara', 'Constanța', 'Brașov']) {
      expect(labelled, name).toContain(name);
    }
    const blank = readFileSync(join(ROOT, 'public', mapData.image.blank), 'utf8');
    expect(blank).not.toContain('<text');
  });

  it('covers the required targets: Delta, three Carpathian ranges, Iași, the Danube', () => {
    const correct = new Set(hotspots.map((h) => h.correctId));
    for (const id of ['delta-dunarii', 'carpati-meridionali', 'carpati-orientali', 'carpati-occidentali', 'iasi', 'dunarea', 'marea-neagra', 'bucuresti']) {
      expect(correct.has(id), id).toBe(true);
    }
  });
});

describe('credits: Natural Earth', () => {
  const credits = readJson(join(CONTENT, 'credits.json')) as Record<string, unknown>[];
  it('is a valid public-domain entry with basis, url and retrieval date', () => {
    const c = credits.find((x) => x.id === 'data-natural-earth');
    expect(c).toBeDefined();
    expect(validateProvenance(c)).toEqual([]);
    expect(c?.source).toBe('public-domain');
    expect(c?.basis).toMatch(/public domain/i);
    expect(c?.url).toMatch(/^https:\/\/www\.naturalearthdata\.com/);
    expect(c?.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('no map asset uses OSM / Google data', () => {
    const text = JSON.stringify(credits.find((x) => x.id === 'data-natural-earth')).toLowerCase() + readFileSync(join(ROOT, 'public/content/media/geo/romania.svg'), 'utf8').toLowerCase();
    expect(text).not.toMatch(/openstreetmap|google/);
  });
});

/* ---------- facts table: every figure/claim that a geography teacher should double-check ---------- */

type Fact = { skill: string; prompt: string; answer: string | number | boolean };
const FACTS: Fact[] = [
  { skill: 'geo.relief.carpathians.4', prompt: 'vârful Moldoveanu, cel mai înalt', answer: 'Carpații Meridionali' },
  { skill: 'geo.relief.carpathians.4', prompt: 'Care este înălțimea vârfului Moldoveanu', answer: '2544 m' },
  { skill: 'geo.relief.carpathians.4', prompt: 'Munții Apuseni fac parte din...', answer: 'Carpații Occidentali' },
  { skill: 'geo.counties.capital.4', prompt: 'Câte județe are România', answer: 41 },
  { skill: 'geo.counties.capital.4', prompt: 'Care este capitala României', answer: 'București' },
  { skill: 'geo.counties.capital.4', prompt: 'București se află pe malul Dunării', answer: false },
  { skill: 'geo.danube.delta.4', prompt: 'În ce se varsă Dunărea', answer: 'Marea Neagră' },
  { skill: 'geo.danube.delta.4', prompt: 'Prin câte țări curge Dunărea', answer: 10 },
  { skill: 'geo.danube.delta.4', prompt: 'cele trei brațe ale Dunării', answer: 'Chilia, Sulina și Sfântu Gheorghe' },
  { skill: 'geo.danube.delta.4', prompt: 'cel mai scurt și este folosit de nave', answer: 'Sulina' },
  { skill: 'geo.danube.delta.4', prompt: 'cea mai mare parte a Deltei', answer: 'Tulcea' },
  { skill: 'geo.romania.position.4', prompt: 'Câți vecini la uscat', answer: 5 },
  { skill: 'geo.romania.position.4', prompt: 'Cu ce țară se învecinează România la nord', answer: 'Ucraina' },
  { skill: 'geo.romania.position.4', prompt: 'Cu ce țară se învecinează România la sud', answer: 'Bulgaria' },
  { skill: 'geo.romania.position.4', prompt: 'Cu ce țară se învecinează România la vest', answer: 'Ungaria' },
  { skill: 'geo.romania.position.4', prompt: 'NU se învecinează cu România', answer: 'Polonia' },
  { skill: 'geo.romania.position.4', prompt: 'Marea Neagră se află la vestul României', answer: false },
  { skill: 'geo.rivers.4', prompt: 'curge numai pe teritoriul României', answer: 'Oltul' },
  { skill: 'geo.rivers.4', prompt: 'granița dintre România și Republica Moldova', answer: 'Prut' },
  { skill: 'geo.rivers.4', prompt: 'orașul Arad', answer: 'Mureș' },
  { skill: 'geo.blacksea.4', prompt: 'cel mai mare port', answer: 'Constanța' },
  { skill: 'geo.climate.4', prompt: 'Câte anotimpuri', answer: 4 },
  { skill: 'geo.climate.4', prompt: 'Ce fel de climă', answer: 'Temperat-continentală' },
  { skill: 'geo.environment.protected.4', prompt: 'primul parc național', answer: 'Retezat' },
];

function answerOf(item: Item): string | number | boolean | null {
  if (item.type === 'choice') return item.options.find((o) => o.id === item.correctId)?.text?.ro ?? null;
  if (item.type === 'true-false') return item.correct;
  if (item.type === 'number-input') return item.correct;
  return null;
}

describe('geo facts table (for human review)', () => {
  for (const f of FACTS) {
    it(`${f.skill}: "${f.prompt}" = ${String(f.answer)}`, () => {
      const matches = getItemsForSkill(f.skill).filter((i) => i.prompt.ro.includes(f.prompt));
      expect(matches.length, 'item not found').toBeGreaterThanOrEqual(1);
      expect(matches.map(answerOf)).toContain(f.answer);
    });
  }

  it('county / seat and region matches are the right pairs', () => {
    const matchItems = getItemsForSkill('geo.counties.capital.4').filter((i) => i.type === 'match');
    const pairs = matchItems.flatMap((i) => (i.type === 'match' ? i.pairs.map((p) => `${p.left.text?.ro}=${p.right.text?.ro}`) : []));
    for (const want of ['Dolj=Craiova', 'Bihor=Oradea', 'Suceava=Suceava', 'Prahova=Ploiești', 'Argeș=Pitești', 'Mureș=Târgu Mureș', 'Neamț=Piatra Neamț', 'Maramureș=Baia Mare', 'Constanța=Dobrogea', 'Cluj-Napoca=Transilvania', 'Iași=Moldova', 'Craiova=Oltenia']) {
      expect(pairs).toContain(want);
    }
  });

  it('relief units are typed correctly (munți / podiș / câmpie / dealuri)', () => {
    const items = getItemsForSkill('geo.relief.units.4');
    const cards = items.flatMap((i) => (i.type === 'sort' ? i.cards.map((c) => [c.text?.ro, i.categories.find((k) => k.id === c.categoryId)?.label.ro] as const) : []));
    for (const [unit, type] of cards) {
      if (unit?.startsWith('Carpații')) expect(type).toBe('Munți');
      if (unit?.startsWith('Podișul')) expect(type).toBe('Podișuri');
      if (unit?.startsWith('Câmpia')) expect(type).toBe('Câmpii');
    }
    expect(cards.length).toBeGreaterThanOrEqual(12);
  });
});

describe('geo-directions generator', () => {
  const skill = getSkillsBySubject('geo').find((s) => s.id === 'geo.orient.cardinal.4') as Skill;

  it('is registered, deterministic per seed and valid for every difficulty', () => {
    expect(getGenerator('geo-directions')).toBeTypeOf('function');
    for (let d = 1; d <= 5; d++) {
      const a = generateItems(skill, 30, { difficulty: d as 1 | 2 | 3 | 4 | 5, seed: 7 });
      const b = generateItems(skill, 30, { difficulty: d as 1 | 2 | 3 | 4 | 5, seed: 7 });
      expect(b).toEqual(a);
      expect(validateItems(a)).toEqual([]);
      for (const it of a) expect(checkResponse(it, correctResponse(it))).toBe(true);
    }
  });

  it('city directions are computed from coordinates (spot checks, no ambiguous pairs)', () => {
    const cities = readJson(join(CONTENT, 'data/geo/cities.json')).cities as { id: string; lon: number; lat: number; ro: string; en: string }[];
    const c = (id: string) => cities.find((x) => x.id === id)!;
    // eight directions: index 0 = N, 1 = NE, 2 = E, 3 = SE, 4 = S, 5 = SV, 6 = V, 7 = NV
    expect(directionBetween(c('bucuresti'), c('constanta'), true)).toBe(2);
    expect(directionBetween(c('cluj-napoca'), c('bucuresti'), true)).toBe(3);
    expect(directionBetween(c('timisoara'), c('iasi'), false)).toBe(2);
    expect(directionBetween(c('craiova'), c('iasi'), true)).toBe(1);
    expect(directionBetween(c('satu-mare'), c('bucuresti'), true)).toBe(3);
    expect(directionBetween(c('oradea'), c('timisoara'), false)).toBe(4);
    expect(directionBetween(c('cluj-napoca'), c('brasov'), true)).toBe(3);
    // Iasi is almost on the NNE border of Bucharest -> ambiguous with 8 directions, so it is never asked
    expect(directionBetween(c('bucuresti'), c('iasi'), true)).toBeNull();
  });

  it('every generated city question matches the computed direction', () => {
    const cities = readJson(join(CONTENT, 'data/geo/cities.json')).cities as { id: string; lon: number; lat: number; ro: string; en: string }[];
    const items = generateItems(skill, 200, { difficulty: 4, seed: 99 }).filter((i) => i.type === 'choice' && /În ce direcție se află/.test(i.prompt.ro));
    expect(items.length).toBeGreaterThan(10);
    for (const it of items) {
      if (it.type !== 'choice') continue;
      const m = /se află (.+) față de (.+)\?/.exec(it.prompt.ro)!;
      const to = cities.find((x) => x.ro === m[1])!;
      const from = cities.find((x) => x.ro === m[2])!;
      const d = directionBetween(from, to, true);
      expect(d, it.prompt.ro).not.toBeNull();
      const answer = it.options.find((o) => o.id === it.correctId)?.text?.ro.toLowerCase();
      expect(answer).toBe(DIRECTIONS[d as number].ro);
    }
  });
});

describe('geo in the learner area', () => {
  it('is offered, with emoji and ro/en names', () => {
    expect(LEARN_SUBJECTS).toContain('geo');
    expect(SUBJECT_EMOJI.geo).toBe('🗺️');
    expect((ro as any).learn.subject.geo).toBe('Geografie');
    expect((en as any).learn.subject.geo).toBe('Geography');
  });
});
