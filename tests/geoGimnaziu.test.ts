import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateItems, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getItemsForSkill, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, listGenerators } from '../src/engine/items/generators';
import { fmtDecimal, realDistance, scaleText } from '../src/engine/items/generators/geoGimnaziu';
import {
  CITY_RIVERS, CONTINENTS_BY_AREA, CONTINENT_NAMES, COUNTIES, COUNTRIES, EUROPE, MASSIFS, OCEANS_BY_AREA, PEAKS, PLANETS_BY_SIZE,
  PLANETS_FROM_SUN, QUIZ_TOPICS, RELIEF_UNITS, RO_CAPITAL, RO_RIVERS, WORLD_MOUNTAINS, WORLD_PEAKS, WORLD_RIVERS,
} from '../src/engine/items/generators/geoGimnaziuData';
import { simulate } from './helpers/learner';
import type { ChoiceItem, Item, ItemResponse, Skill } from '../src/engine/types';

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

const geoAll = getSkillsBySubject('geo');
const oldSkills = geoAll.filter((s) => s.grade <= 4);
const gimSkills = geoAll.filter((s) => s.grade >= 5);
const byGrade = (g: number) => gimSkills.filter((s) => s.grade === g);

const skillFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'skills', 'geo', `grade${g}.json`));
const bankFiles = [5, 6, 7, 8].map((g) => join(CONTENT, 'items', 'geo', `grade${g}.json`));
const explFile = join(CONTENT, 'explanations', 'geo', 'grade5-8.json');
const dataFiles = ['countries', 'romania', 'world', 'quiz-gimnaziu'].map((n) => join(CONTENT, 'data', 'geo', `${n}.json`));
const newFiles = [...skillFiles, ...bankFiles, explFile, ...dataFiles];

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

describe('geo gimnaziu skill graph (V-VIII)', () => {
  it('has 10-12 skills in each of grades V-VIII, all structurally valid', () => {
    for (const g of [5, 6, 7, 8]) {
      expect(byGrade(g).length, `grade ${g}`).toBeGreaterThanOrEqual(10);
      expect(byGrade(g).length, `grade ${g}`).toBeLessThanOrEqual(12);
    }
    const errors = skillFiles.flatMap((f) => validateSkills(readJson(f), relative(ROOT, f)));
    expect(errors).toEqual([]);
    expect(oldSkills.length).toBeGreaterThanOrEqual(12);
  });

  it('the whole graph is a valid DAG; geo prerequisites stay inside geo except the two maths links for map scale', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    const cross = gimSkills.flatMap((s) => s.prerequisites.filter((p) => !p.startsWith('geo.')).map((p) => `${s.id} -> ${p}`));
    expect(cross.sort()).toEqual(['geo.map.scale.5 -> mat.dec.convert', 'geo.map.scale.6 -> mat.ratio.basic']);
    for (const p of ['mat.dec.convert', 'mat.ratio.basic']) expect(getAllSkills().some((s) => s.id === p), p).toBe(true);
  });

  it('links into the grade IV skills and across the new grades, with no new root', () => {
    const old = new Set(oldSkills.map((s) => s.id));
    const byId = new Map(geoAll.map((s) => [s.id, s]));
    const intoOld = gimSkills.filter((s) => s.prerequisites.some((p) => old.has(p)));
    expect(intoOld.length).toBeGreaterThanOrEqual(8);
    for (const g of [6, 7, 8]) {
      const crossing = byGrade(g).filter((s) => s.prerequisites.some((p) => (byId.get(p)?.grade ?? g) < g));
      expect(crossing.length, `grade ${g}`).toBeGreaterThanOrEqual(3);
    }
    expect(gimSkills.filter((s) => s.prerequisites.length === 0)).toEqual([]);
    expect(geoAll.filter((s) => s.prerequisites.length === 0).map((s) => s.id)).toEqual(['geo.orient.cardinal.4']);
  });

  it('uses GEO-V-VIII-2017 with own provenance, an English title and the "verify" note', () => {
    for (const s of gimSkills) {
      expect(s.competences.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.competences.every((c) => c.programa === 'GEO-V-VIII-2017' && /^\d+\.\d+$/.test(c.code)), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
      expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
    }
  });

  it('follows the programa distribution: V general geography, VI Europe, VII continents, VIII Romania', () => {
    const ids = (g: number) => byGrade(g).map((s) => s.id).join(' ');
    for (const part of ['earth.universe', 'earth.motions', 'map.coords', 'map.scale', 'relief.forms', 'climate.general', 'waters.world', 'life.zones', 'population']) expect(ids(5), part).toContain(part);
    for (const part of ['europe.position', 'europe.relief', 'europe.climate', 'europe.waters', 'europe.capitals', 'europe.eu', 'europe.population', 'europe.economy', 'map.scale']) expect(ids(6), part).toContain(part);
    for (const part of ['asia.', 'africa', 'americas.north', 'americas.south', 'oceania', 'antarctica', 'world.capitals', 'world.issues']) expect(ids(7), part).toContain(part);
    for (const part of ['ro.position', 'ro.carpathians', 'ro.relief', 'ro.climate', 'ro.rivers', 'ro.danube', 'ro.resources', 'ro.population', 'ro.counties', 'ro.economy']) expect(ids(8), part).toContain(part);
    /* every skill of grade VIII is about Romania, of grade VI about Europe or scale */
    for (const s of byGrade(8)) expect(s.id.startsWith('geo.ro.'), s.id).toBe(true);
    for (const s of byGrade(6)) expect(/^geo\.(europe|map\.scale)/.test(s.id), s.id).toBe(true);
  });

  it('every skill has an existing 3-frame explanation (ai-draft, beta, OWN, with English)', () => {
    for (const s of gimSkills) {
      expect(s.explanations).toEqual([`exp.${s.id}`]);
      const exp = getExplanation(s.explanations[0]);
      expect(exp, s.id).toBeDefined();
      expect(exp?.skillId).toBe(s.id);
      expect(exp?.frames.length).toBe(3);
      expect(exp?.reviewStatus).toBe('beta');
      expect(exp?.provenance.source).toBe('ai-draft');
      expect(exp?.provenance.licence).toBe('OWN');
      expect(exp?.title.en).toBeTruthy();
      for (const f of exp?.frames ?? []) expect(f.text.en, s.id).toBeTruthy();
      expect(validateExplanation(exp)).toEqual([]);
    }
    const all = readJson(explFile) as { skillId: string }[];
    expect(new Set(all.map((e) => e.skillId)).size).toBe(gimSkills.length);
  });

  it('every skill has registered generators and a bank with at least 3 items', () => {
    for (const s of gimSkills) {
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
        else expect(existsSync(join(CONTENT, 'items', src.bank)), src.bank).toBe(true);
      }
      expect(s.itemSources.some((x) => 'generator' in x), s.id).toBe(true);
      expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThanOrEqual(3);
    }
    expect(listGenerators()).toEqual(
      expect.arrayContaining(['geo-quiz', 'geo-capital', 'geo-sort', 'geo-eu', 'geo-county', 'geo-river', 'geo-peak', 'geo-order', 'geo-world', 'geo-relief-unit', 'geo-scale']),
    );
  });

  it('placement + missions work over the geo graph for a child who knows grade IV', () => {
    const known = new Set(oldSkills.map((s) => s.id));
    for (const seed of [1, 2]) {
      for (const grade of [6, 8] as const) {
        const r = simulate(geoAll, { seed, known, subject: 'geo', declared: { grade, semester: 1 } }, 40);
        expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThanOrEqual(r.gapHistory[0]);
        for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
      }
    }
  });

  it('the maths prerequisites of map scale do not break placement or missions when maths is in the graph', () => {
    const mat = getAllSkills().filter((s) => s.subject === 'mat');
    const skills = [...geoAll, ...mat];
    const known = new Set([...oldSkills, ...mat.filter((s) => s.grade <= 6)].map((s) => s.id));
    const r = simulate(skills, { seed: 3, known, subject: 'geo', declared: { grade: 6, semester: 2 } }, 30);
    expect(r.gapHistory[r.gapHistory.length - 1]).toBeLessThanOrEqual(r.gapHistory[0]);
    for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
  });
});

/* ------------------------------------------------------------------ */
/*  Curated data                                                       */
/* ------------------------------------------------------------------ */

describe('curated data: files', () => {
  it('own work with valid provenance, NFC text with comma-below diacritics only', () => {
    for (const f of dataFiles) {
      const raw = readFileSync(f, 'utf8');
      expect(validateProvenance(JSON.parse(raw).provenance), relative(ROOT, f)).toEqual([]);
      expect(JSON.parse(raw).provenance.licence).toBe('OWN');
    }
    for (const f of newFiles) {
      const raw = readFileSync(f, 'utf8');
      expect(raw.normalize('NFC') === raw, `${relative(ROOT, f)} is NFC`).toBe(true);
      expect(/[şţŞŢ]/.test(raw), `${relative(ROOT, f)} has cedilla diacritics`).toBe(false);
    }
  });
});

describe('curated data: countries', () => {
  it('has unique ids, names and capitals; valid continents', () => {
    const ids = COUNTRIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(COUNTRIES.map((c) => c.ro)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.en)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.capital.ro)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.capital.en)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(Object.keys(CONTINENT_NAMES), c.id).toContain(c.continent);
      expect(c.ro && c.en && c.capital.ro && c.capital.en, c.id).toBeTruthy();
    }
    expect(EUROPE.length).toBeGreaterThanOrEqual(40);
    for (const cont of Object.keys(CONTINENT_NAMES)) expect(COUNTRIES.filter((c) => c.continent === cont).length, cont).toBeGreaterThanOrEqual(4);
  });

  it('the EU has exactly 27 members (2026) and the well-known members and non-members are right', () => {
    const members = EUROPE.filter((c) => c.eu).map((c) => c.ro).sort();
    expect(members.length).toBe(27);
    for (const m of ['România', 'Bulgaria', 'Croația', 'Franța', 'Germania', 'Italia', 'Spania', 'Polonia', 'Ungaria', 'Suedia', 'Finlanda', 'Irlanda', 'Cipru', 'Malta', 'Țările de Jos']) expect(members, m).toContain(m);
    for (const n of ['Regatul Unit', 'Norvegia', 'Elveția', 'Islanda', 'Serbia', 'Ucraina', 'Republica Moldova', 'Rusia', 'Belarus', 'Albania', 'Muntenegru', 'Macedonia de Nord', 'Bosnia și Herțegovina']) expect(members, n).not.toContain(n);
    for (const c of COUNTRIES.filter((x) => x.continent !== 'europa')) expect(c.eu).toBe(false);
  });

  it('spot checks capitals, neighbours and landlocked countries', () => {
    const cap = (id: string) => COUNTRIES.find((c) => c.id === id)?.capital.ro;
    const expected: Record<string, string> = {
      franta: 'Paris', germania: 'Berlin', italia: 'Roma', spania: 'Madrid', polonia: 'Varșovia', ungaria: 'Budapesta', bulgaria: 'Sofia',
      grecia: 'Atena', austria: 'Viena', serbia: 'Belgrad', moldova: 'Chișinău', ucraina: 'Kiev', olanda: 'Amsterdam', elvetia: 'Berna',
      china: 'Beijing', japonia: 'Tokyo', india: 'New Delhi', egipt: 'Cairo', maroc: 'Rabat', sua: 'Washington', canada: 'Ottawa', brazilia: 'Brasilia',
      australia: 'Canberra', 'noua-zeelanda': 'Wellington', argentina: 'Buenos Aires', kenya: 'Nairobi',
    };
    for (const [id, c] of Object.entries(expected)) expect(cap(id), id).toBe(c);
    expect(EUROPE.filter((c) => c.borderRomania).map((c) => c.id).sort()).toEqual(['bulgaria', 'moldova', 'serbia', 'ucraina', 'ungaria']);
    expect(EUROPE.filter((c) => c.landlocked).map((c) => c.id).sort()).toEqual(
      ['andorra', 'austria', 'belarus', 'cehia', 'elvetia', 'liechtenstein', 'luxemburg', 'macedonia', 'moldova', 'san-marino', 'serbia', 'slovacia', 'ungaria'],
    );
    /* disputed or transcontinental cases are left out on purpose */
    for (const id of ['turcia', 'kazahstan', 'israel', 'indonesia', 'africa-de-sud', 'kosovo', 'taiwan']) expect(COUNTRIES.some((c) => c.id === id), id).toBe(false);
  });
});

describe('curated data: Romania', () => {
  it('has all 41 counties plus Bucharest, unique ids and seats', () => {
    expect(COUNTIES.length).toBe(41);
    expect(RO_CAPITAL).toBe('București');
    expect(new Set(COUNTIES.map((c) => c.id)).size).toBe(41);
    expect(new Set(COUNTIES.map((c) => c.ro)).size).toBe(41);
    const seats = COUNTIES.filter((c) => c.seat !== null).map((c) => c.seat as string);
    expect(seats.length).toBe(40);
    expect(new Set(seats).size).toBe(40);
    expect(seats).not.toContain('București');
    expect(COUNTIES.filter((c) => c.seat === null).map((c) => c.ro)).toEqual(['Ilfov']);
    expect(COUNTIES.some((c) => c.ro === 'București')).toBe(false);
  });

  it('county seats are right (spot checks, including the counties whose seat has a different name)', () => {
    const seat = (n: string) => COUNTIES.find((c) => c.ro === n)?.seat;
    const expected: Record<string, string> = {
      Alba: 'Alba Iulia', Argeș: 'Pitești', Bihor: 'Oradea', 'Bistrița-Năsăud': 'Bistrița', 'Caraș-Severin': 'Reșița', Cluj: 'Cluj-Napoca',
      Covasna: 'Sfântu Gheorghe', Dâmbovița: 'Târgoviște', Dolj: 'Craiova', Gorj: 'Târgu Jiu', Harghita: 'Miercurea Ciuc', Hunedoara: 'Deva',
      Ialomița: 'Slobozia', Maramureș: 'Baia Mare', Mehedinți: 'Drobeta-Turnu Severin', Mureș: 'Târgu Mureș', Neamț: 'Piatra Neamț', Olt: 'Slatina',
      Prahova: 'Ploiești', Sălaj: 'Zalău', Teleorman: 'Alexandria', Timiș: 'Timișoara', Vâlcea: 'Râmnicu Vâlcea', Vrancea: 'Focșani', Constanța: 'Constanța', Tulcea: 'Tulcea',
    };
    for (const [county, s] of Object.entries(expected)) expect(seat(county), county).toBe(s);
    for (const c of COUNTIES) expect(['Muntenia', 'Oltenia', 'Moldova', 'Transilvania', 'Banat', 'Dobrogea', null], c.ro).toContain(c.region);
    expect(COUNTIES.filter((c) => c.region === 'Oltenia').map((c) => c.ro).sort()).toEqual(['Dolj', 'Gorj', 'Mehedinți', 'Olt', 'Vâlcea']);
  });

  it('rivers, peaks, massifs and relief units are consistent', () => {
    expect(new Set(RO_RIVERS.map((r) => r.id)).size).toBe(RO_RIVERS.length);
    for (const r of RO_RIVERS) {
      expect(r.lengthKm).toBeGreaterThan(200);
      expect(r.mouth).toBeTruthy();
    }
    expect(RO_RIVERS[0].ro).toBe('Dunărea');
    expect(RO_RIVERS.find((r) => r.ro === 'Mureșul')?.mouth).toBe('Tisa');
    expect(RO_RIVERS.find((r) => r.ro === 'Prutul')?.mouth).toBe('Dunărea');
    expect(RO_RIVERS.find((r) => r.ro === 'Bistrița')?.mouth).toBe('Siretul');
    expect(new Set(CITY_RIVERS.map((c) => c.city)).size).toBe(CITY_RIVERS.length);
    expect(CITY_RIVERS.find((c) => c.city === 'București')?.river).toBe('Dâmbovița');
    expect(new Set(PEAKS.map((p) => p.ro)).size).toBe(PEAKS.length);
    const top = [...PEAKS].sort((a, b) => b.heightM - a.heightM)[0];
    expect(top.ro).toBe('Moldoveanu');
    expect(top.heightM).toBe(2544);
    for (const p of PEAKS) {
      expect(p.heightM).toBeGreaterThan(1400);
      expect(p.heightM).toBeLessThan(2600);
      expect(['Carpații Orientali', 'Carpații Meridionali', 'Carpații Occidentali']).toContain(p.group);
    }
    expect(new Set(MASSIFS.map((m) => m.ro)).size).toBe(MASSIFS.length);
    expect(MASSIFS.find((m) => m.ro === 'Făgăraș')?.group).toBe('Carpații Meridionali');
    expect(MASSIFS.find((m) => m.ro === 'Rodna')?.group).toBe('Carpații Orientali');
    expect(MASSIFS.find((m) => m.ro === 'Apuseni')?.group).toBe('Carpații Occidentali');
    expect(new Set(RELIEF_UNITS.map((u) => u.ro)).size).toBe(RELIEF_UNITS.length);
    expect(new Set(RELIEF_UNITS.map((u) => u.note)).size).toBe(RELIEF_UNITS.length);
  });
});

describe('curated data: world and quiz', () => {
  it('orders are strictly descending with clear gaps, with well-known first and last entries', () => {
    for (const set of [PLANETS_BY_SIZE, CONTINENTS_BY_AREA, OCEANS_BY_AREA, WORLD_PEAKS]) {
      for (let i = 1; i < set.length; i++) expect(set[i - 1].v / set[i].v, `${set[i].ro}`).toBeGreaterThanOrEqual(1.04);
    }
    expect(PLANETS_FROM_SUN.map((p) => p.ro)).toEqual(['Mercur', 'Venus', 'Pământ', 'Marte', 'Jupiter', 'Saturn', 'Uranus', 'Neptun']);
    expect(CONTINENTS_BY_AREA[0].ro).toBe('Asia');
    expect(CONTINENTS_BY_AREA[CONTINENTS_BY_AREA.length - 1].ro).toBe('Australia și Oceania');
    expect(OCEANS_BY_AREA[0].ro).toBe('Oceanul Pacific');
    expect(WORLD_PEAKS[0].ro).toBe('Everest');
    expect(WORLD_PEAKS.find((p) => p.ro === 'Kilimanjaro')?.continent).toBe('Africa');
    expect(WORLD_RIVERS.find((r) => r.ro === 'Dunărea')?.mouth.ro).toBe('Marea Neagră');
    expect(WORLD_RIVERS.find((r) => r.ro === 'Nilul')?.mouth.ro).toBe('Marea Mediterană');
    expect(WORLD_MOUNTAINS.find((m) => m.ro === 'Anzii')?.continent).toBe('america-sud');
    for (const r of WORLD_RIVERS) expect(Object.keys(CONTINENT_NAMES)).toContain(r.continent);
  });

  it('every quiz topic is used by a skill; questions are well formed', () => {
    const used = new Set(gimSkills.flatMap((s) => s.itemSources.flatMap((x) => ('generator' in x && x.generator === 'geo-quiz' ? [String(x.params?.topic)] : []))));
    for (const topic of Object.keys(QUIZ_TOPICS)) expect(used.has(topic), topic).toBe(true);
    for (const t of used) expect(QUIZ_TOPICS[t], t).toBeDefined();
    for (const [topic, pool] of Object.entries(QUIZ_TOPICS)) {
      expect(pool.mcq.length, topic).toBeGreaterThanOrEqual(2);
      expect(pool.tf.length, topic).toBeGreaterThanOrEqual(2);
      const prompts = pool.mcq.map((q) => q.prompt);
      expect(new Set(prompts).size, `${topic} duplicate prompts`).toBe(prompts.length);
      for (const q of pool.mcq) {
        expect(q.wrong.length, q.prompt).toBeGreaterThanOrEqual(3);
        expect(new Set([q.correct, ...q.wrong]).size, q.prompt).toBe(q.wrong.length + 1);
        expect(q.prompt.endsWith('?') || q.prompt.endsWith('...'), q.prompt).toBe(true);
      }
      for (const s of pool.tf) expect(s.statement.endsWith('.'), s.statement).toBe(true);
      const statements = pool.tf.map((s) => s.statement);
      expect(new Set(statements).size, `${topic} duplicate statements`).toBe(statements.length);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Independent verification of generated answers                      */
/* ------------------------------------------------------------------ */

const NBSP = /[\s  ]/g;
const num = (s: string): number => Number((s.match(/^[\d\s\u00a0\u202f]+(,\d+)?/)?.[0] ?? '').replace(NBSP, '').replace(',', '.'));
const optText = (i: ChoiceItem, id: string): string => (i.options.find((o) => o.id === id)?.text?.ro ?? '') as string;
const correctText = (i: ChoiceItem): string => optText(i, i.correctId);

const countryByRo = new Map(COUNTRIES.map((c) => [c.ro, c]));
const countryByCap = new Map(COUNTRIES.map((c) => [c.capital.ro, c]));
const countyByRo = new Map(COUNTIES.map((c) => [c.ro, c]));
const countyBySeat = new Map(COUNTIES.filter((c) => c.seat).map((c) => [c.seat as string, c]));
const riverByRo = new Map(RO_RIVERS.map((r) => [r.ro, r]));
const worldRiverByRo = new Map(WORLD_RIVERS.map((r) => [r.ro, r]));
const peakByRo = new Map(PEAKS.map((p) => [p.ro, p]));
const heightOf = (name: string): number => (peakByRo.get(name)?.heightM ?? WORLD_PEAKS.find((p) => p.ro === name)?.v) as number;
const worldPeakByRo = new Map(WORLD_PEAKS.map((p) => [p.ro, p]));
const quizMcq = new Map(Object.values(QUIZ_TOPICS).flatMap((t) => t.mcq.map((q) => [q.prompt, q] as const)));
const quizTf = new Map(Object.values(QUIZ_TOPICS).flatMap((t) => t.tf.map((s) => [s.statement, s.correct] as const)));
const contName = (id: string) => CONTINENT_NAMES[id as keyof typeof CONTINENT_NAMES].ro;

function cardsSorted(item: Item, values: Map<string, number>, desc: boolean): boolean {
  if (item.type !== 'order') return false;
  const names = item.correctOrder.map((id) => (item.cards.find((c) => c.id === id)?.text?.ro ?? '') as string);
  if (!names.every((n) => values.has(n))) return false;
  const v = names.map((n) => values.get(n) as number);
  return v.every((x, i) => i === 0 || (desc ? v[i - 1] > x : v[i - 1] < x));
}
const valueMap = (xs: readonly { ro: string; v: number }[]) => new Map(xs.map((x) => [x.ro, x.v]));

/** Returns a description when the item is wrong, 'unrecognised' when no check applies, or null when verified */
function verify(item: Item): string | null {
  const p = item.prompt.ro;
  let m: RegExpMatchArray | null;

  if (item.type === 'choice') {
    const ct = correctText(item);
    if (quizMcq.has(p)) return (quizMcq.get(p) as { correct: string }).correct === ct ? null : `quiz ${p}`;
    if ((m = p.match(/^Care este capitala țării „(.+)”\?$/))) return countryByRo.get(m[1])?.capital.ro === ct ? null : `capital ${p} ${ct}`;
    if ((m = p.match(/^Orașul (.+) este capitala unei țări\. Care este aceea\?$/))) return countryByCap.get(m[1])?.ro === ct ? null : `country ${p}`;
    if ((m = p.match(/^Care este reședința județului (.+)\?$/))) return countyByRo.get(m[1])?.seat === ct ? null : `seat ${p}`;
    if ((m = p.match(/^Orașul (.+) este reședința unui județ\. Care este acela\?$/))) return countyBySeat.get(m[1])?.ro === ct ? null : `county ${p}`;
    if ((m = p.match(/^În ce se varsă direct (.+)\?$/))) {
      const mouth = riverByRo.get(m[1])?.mouth ?? worldRiverByRo.get(m[1])?.mouth.ro;
      return mouth === ct ? null : `mouth ${p} ${ct}`;
    }
    if ((m = p.match(/^Pe ce râu se află orașul (.+)\?$/))) return CITY_RIVERS.find((c) => c.city === m![1])?.river === ct ? null : `city ${p}`;
    if ((m = p.match(/^În ce masiv se află vârful (.+)\?$/))) return peakByRo.get(m[1])?.massif === ct ? null : `massif ${p}`;
    if ((m = p.match(/^Din ce grup al Carpaților face parte masivul (.+)\?$/))) return MASSIFS.find((x) => x.ro === m![1])?.group === ct ? null : `group ${p}`;
    if (p === 'Care dintre aceste vârfuri este cel mai înalt?') {
      const best = Math.max(...item.options.map((o) => heightOf(o.text?.ro as string)));
      return heightOf(ct) === best && item.options.filter((o) => heightOf(o.text?.ro as string) === best).length === 1 ? null : `highest ${ct}`;
    }
    if ((m = p.match(/^Pe ce continent se află vârful (.+)\?$/))) return worldPeakByRo.get(m[1])?.continent === ct ? null : `peak continent ${p}`;
    if ((m = p.match(/^Pe ce continent se află (.+)\?$/))) {
      const mt = WORLD_MOUNTAINS.find((x) => x.ro === m![1]);
      return mt && contName(mt.continent) === ct ? null : `mountain ${p}`;
    }
    if ((m = p.match(/^Pe ce continent curge (.+)\?$/))) {
      const r = worldRiverByRo.get(m[1]);
      return r && contName(r.continent) === ct ? null : `river continent ${p}`;
    }
    if (p.startsWith('Care dintre aceste țări este stat membru')) return countryByRo.get(ct)?.eu === true ? null : `eu yes ${ct}`;
    if (p.startsWith('Care dintre aceste țări NU este stat membru')) return countryByRo.get(ct)?.eu === false ? null : `eu no ${ct}`;
    if ((m = p.match(/^Din ce formă de relief face parte unitatea „(.+)”\?$/))) return RELIEF_UNITS.find((u) => u.ro === m![1])?.form === ct ? null : `form ${p}`;
    if ((m = p.match(/^Care unitate de relief se află (.+)\?$/))) return RELIEF_UNITS.find((u) => u.note === m![1])?.ro === ct ? null : `unit ${p}`;
    return verifyScaleChoice(item, p, ct);
  }

  if (item.type === 'true-false') {
    if ((m = p.match(/^Capitala țării „(.+)” este (.+)\.$/))) return (countryByRo.get(m[1])?.capital.ro === m[2]) === item.correct ? null : `tf capital ${p}`;
    if ((m = p.match(/^Reședința județului (.+) este (.+)\.$/))) return (countyByRo.get(m[1])?.seat === m[2]) === item.correct ? null : `tf seat ${p}`;
    if ((m = p.match(/^Țara „(.+)” este stat membru al Uniunii Europene\.$/))) return countryByRo.get(m[1])?.eu === item.correct ? null : `tf eu ${p}`;
    if (quizTf.has(p)) return quizTf.get(p) === item.correct ? null : `tf quiz ${p}`;
    return 'unrecognised';
  }

  if (item.type === 'fill-gap') {
    if ((m = item.template.ro.match(/^Capitala țării „(.+)” este \{\{gap\}\}\.$/))) return countryByRo.get(m[1])?.capital.ro === item.correct ? null : `gap capital`;
    if ((m = item.template.ro.match(/^Reședința județului (.+) este \{\{gap\}\}\.$/))) return countyByRo.get(m[1])?.seat === item.correct ? null : `gap seat`;
    if (item.template.ro === 'Vârful {{gap}} este cel mai înalt din România.') return item.correct === 'Moldoveanu' && (item.options ?? []).every((o) => heightOf(o) <= heightOf('Moldoveanu')) ? null : 'gap highest';
    return 'unrecognised';
  }

  if (item.type === 'match') {
    const pairs = item.pairs.map((x) => [x.left.text?.ro as string, x.right.text?.ro as string]);
    if (p === 'Potrivește fiecare țară cu capitala ei.') return pairs.every(([l, r]) => countryByRo.get(l)?.capital.ro === r) ? null : 'match capitals';
    if (p === 'Potrivește fiecare județ cu reședința lui.') return pairs.every(([l, r]) => countyByRo.get(l.replace(/^Județul /, ''))?.seat === r) ? null : 'match seats';
    if (p === 'Potrivește fiecare unitate de relief cu locul ei.') return pairs.every(([l, r]) => RELIEF_UNITS.find((u) => u.ro === l)?.note === r) ? null : 'match units';
    return 'unrecognised';
  }

  if (item.type === 'order') {
    if (p.startsWith('Ordonează planetele începând')) {
      const idx = item.correctOrder.map((id) => PLANETS_FROM_SUN.findIndex((x) => x.ro === item.cards.find((c) => c.id === id)?.text?.ro));
      return idx.every((x, i) => x >= 0 && (i === 0 || idx[i - 1] < x)) ? null : 'order planets sun';
    }
    if (p.includes('de la cel mai mare diametru')) return cardsSorted(item, valueMap(PLANETS_BY_SIZE), true) ? null : 'planets big';
    if (p.includes('de la cel mai mic diametru')) return cardsSorted(item, valueMap(PLANETS_BY_SIZE), false) ? null : 'planets small';
    if (p.startsWith('Ordonează continentele')) return cardsSorted(item, valueMap(CONTINENTS_BY_AREA), p.includes('de la cel mai mare')) ? null : 'continents';
    if (p.startsWith('Ordonează oceanele')) return cardsSorted(item, valueMap(OCEANS_BY_AREA), p.includes('de la cel mai mare')) ? null : 'oceans';
    if (p.startsWith('Ordonează râurile de la cel mai lung')) return cardsSorted(item, new Map(RO_RIVERS.map((r) => [r.ro, r.lengthKm])), true) ? null : 'rivers desc';
    if (p.startsWith('Ordonează râurile de la cel mai scurt')) return cardsSorted(item, new Map(RO_RIVERS.map((r) => [r.ro, r.lengthKm])), false) ? null : 'rivers asc';
    if (p.startsWith('Ordonează vârfurile')) {
      const all = new Map<string, number>([...PEAKS.map((x) => [x.ro, x.heightM] as const), ...WORLD_PEAKS.map((x) => [x.ro, x.v] as const)]);
      return cardsSorted(item, all, true) ? null : 'peaks';
    }
    return 'unrecognised';
  }

  if (item.type === 'sort') {
    const lab = (id: string) => item.categories.find((c) => c.id === id)?.label.ro as string;
    if (p === 'Pe ce continent se află fiecare țară?') return item.cards.every((c) => contName(countryByRo.get(c.text?.ro as string)?.continent as string) === lab(c.categoryId)) ? null : 'sort continent';
    if (p === 'Pe ce continent se află fiecare lanț muntos?') return item.cards.every((c) => contName(WORLD_MOUNTAINS.find((x) => x.ro === c.text?.ro)?.continent as string) === lab(c.categoryId)) ? null : 'sort mountains';
    if (p === 'Din ce formă de relief face parte fiecare unitate?') {
      const feat = new Map(readJson(join(CONTENT, 'data/geo/romania.json')).features.map((f: any) => [f.ro, f.form]));
      return item.cards.every((c) => feat.get(c.text?.ro as string) === lab(c.categoryId)) ? null : 'sort relief';
    }
    if (p === 'În ce regiune istorică se află fiecare județ?') return item.cards.every((c) => countyByRo.get((c.text?.ro as string).replace(/^Județul /, ''))?.region === lab(c.categoryId)) ? null : 'sort regions';
    if (p === 'Din ce grup al Carpaților face parte fiecare masiv?') return item.cards.every((c) => MASSIFS.find((x) => x.ro === c.text?.ro)?.group === lab(c.categoryId)) ? null : 'sort massifs';
    const flag =
      p.startsWith('Așază fiecare țară europeană') ? (c: (typeof COUNTRIES)[number]) => c.eu
      : p.startsWith('Care țări nu au ieșire') ? (c: (typeof COUNTRIES)[number]) => c.landlocked === true
      : p.startsWith('Care țări se învecinează') ? (c: (typeof COUNTRIES)[number]) => c.borderRomania === true
      : null;
    if (flag) {
      const yesId = item.categories[0].id;
      return item.cards.every((c) => (c.categoryId === yesId) === flag(countryByRo.get(c.text?.ro as string) as (typeof COUNTRIES)[number])) ? null : 'sort flag';
    }
    return 'unrecognised';
  }
  return item.type === 'number-input' ? verifyScaleNumber(item, p) : 'unrecognised';
}

/* ---- map scale: recompute everything with integer arithmetic ---- */
const km = (s: string) => num(s);
const nOf = (s: string): number => Number(s.replace(NBSP, ''));

function expectedDistance(cm: string, n: number): { v: number; unit: string } {
  const tenths = Math.round(num(cm) * 10);
  const realCm = (tenths * n) / 10;
  return n < 100000 ? { v: realCm / 100, unit: 'm' } : { v: realCm / 100000, unit: 'km' };
}

function verifyScaleChoice(item: ChoiceItem, p: string, ct: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^Pe o hartă la scara 1:([\d\s ]+), distanța dintre două localități este de ([\d,]+)[\s ]cm\. Care este distanța reală, în (m|km)\?$/))) {
    const e = expectedDistance(m[2], nOf(m[1]));
    return e.unit === m[3] && Math.abs(num(ct) - e.v) < 1e-9 ? null : `scale dist ${p} -> ${ct}`;
  }
  if ((m = p.match(/^Două orașe se află la ([\d\s ]+)[\s ]km distanță în realitate\. Ce distanță vor avea pe o hartă la scara 1:([\d\s ]+), în cm\?$/))) {
    const cm = (km(m[1]) * 100000) / nOf(m[2]);
    return Math.abs(num(ct) - cm) < 1e-9 && ct.endsWith('cm') ? null : `scale map ${p} -> ${ct}`;
  }
  if ((m = p.match(/^Pe o hartă, (\d+)[\s ]cm reprezintă ([\d\s ]+)[\s ]km în realitate\. Care este scara hărții\?$/))) {
    const n = (km(m[2]) * 100000) / Number(m[1]);
    return ct === scaleText(n) ? null : `scale find ${p} -> ${ct}`;
  }
  if ((m = p.match(/^Pe o hartă, 1[\s ]cm reprezintă ([\d\s ]+)[\s ](m|km) în realitate\. Care este scara hărții\?$/))) {
    const n = km(m[1]) * (m[2] === 'm' ? 100 : 100000);
    return ct === scaleText(n) ? null : `scale equiv ${p} -> ${ct}`;
  }
  if (p.startsWith('Care dintre aceste scări este cea mai')) {
    const ns = item.options.map((o) => nOf((o.text?.ro as string).replace('1:', '')));
    const target = p.includes('cea mai mare') ? Math.min(...ns) : Math.max(...ns);
    return nOf(ct.replace('1:', '')) === target ? null : `scale detail ${p}`;
  }
  return 'unrecognised';
}

function verifyScaleNumber(item: Item, p: string): string | null {
  const m = p.match(/^Pe o hartă la scara 1:([\d\s ]+), distanța dintre două localități este de ([\d,]+)[\s ]cm\. Care este distanța reală, în (m|km)\?$/);
  if (!m || item.type !== 'number-input') return 'unrecognised';
  const e = expectedDistance(m[2], nOf(m[1]));
  return e.unit === m[3] && item.correct === e.v && Number.isInteger(e.v) ? null : `scale number ${p}`;
}

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

describe('geo gimnaziu generators over every generator-backed skill', () => {
  it('there are at least 40 generator-backed V-VIII skills', () => {
    expect(genSkills.length).toBeGreaterThanOrEqual(40);
  });

  for (const skill of genSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });
      const generated = items.filter((i) => i.id.startsWith('gen.'));

      it(`produces ${COUNT} valid items`, () => {
        expect(items.length).toBe(COUNT);
        expect(items.flatMap((i) => validateItem(i))).toEqual([]);
        expect(new Set(items.map((i) => i.id)).size).toBe(COUNT);
        for (const i of items) {
          expect(i.skillId).toBe(skill.id);
          expect(i.explanationId).toBe(skill.explanations[0]);
        }
        expect(generated.length).toBeGreaterThan(100);
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
          if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct }), i.id).toBe(false);
        }
      });

      it('has unique options, exactly one correct, at least 2 options', () => {
        for (const i of items) {
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
          if (i.type === 'choice' || i.type === 'fill-gap') expect(texts.length, i.id).toBeGreaterThanOrEqual(2);
          if (i.type === 'choice') expect(i.options.filter((o) => o.id === i.correctId).length).toBe(1);
          if (i.type === 'fill-gap') expect(texts.filter((o) => o === i.correct).length).toBe(1);
          if (i.type === 'sort') {
            expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
            for (const c of i.categories) expect(i.cards.some((k) => k.categoryId === c.id), `${i.id} empty category`).toBe(true);
          }
          if (i.type === 'match') {
            expect(new Set(i.pairs.map((x) => x.left.text?.ro)).size, i.id).toBe(i.pairs.length);
            expect(new Set(i.pairs.map((x) => x.right.text?.ro)).size, i.id).toBe(i.pairs.length);
          }
          if (i.type === 'order') expect(new Set(i.cards.map((c) => c.text?.ro)).size, i.id).toBe(i.cards.length);
        }
      });

      it('answers are independently verified against the curated data', () => {
        for (const i of generated) expect(verify(i), `${i.id}: ${i.prompt.ro}`).toBeNull();
      });

      it('is deterministic for a seed', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
        expect(generateItems(skill, 30, { seed: SEED + 1 })).not.toEqual(items.slice(0, 30));
      });

      it('varies: at least 12 distinct items out of 200', () => {
        const keys = new Set(generated.map((i) => JSON.stringify({ ...i, id: '', provenance: '' }).replace(/"id":"[^"]*",?/g, '')));
        expect(keys.size).toBeGreaterThanOrEqual(12);
      });

      it('works at every difficulty and stays verified', () => {
        for (const d of [1, 2, 3, 4, 5] as const) {
          const batch = generateItems(skill, 40, { seed: 7, difficulty: d });
          expect(batch.flatMap((i) => validateItem(i))).toEqual([]);
          for (const i of batch) {
            expect(checkResponse(i, correctResponse(i))).toBe(true);
            if (i.id.startsWith('gen.')) expect(verify(i), i.prompt.ro).toBeNull();
          }
        }
      });
    });
  }

  it('the generated items cover every item type the task asks for', () => {
    const types = new Set<string>();
    for (const s of genSkills) for (const d of [1, 3, 4] as const) for (const i of generateItems(s, 60, { seed: 11, difficulty: d })) types.add(i.type);
    for (const t of ['choice', 'true-false', 'match', 'sort', 'order', 'fill-gap', 'number-input']) expect(types.has(t), t).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Map scale                                                          */
/* ------------------------------------------------------------------ */

describe('map scale generator', () => {
  const scale5 = gimSkills.find((s) => s.id === 'geo.map.scale.5') as Skill;
  const scale6 = gimSkills.find((s) => s.id === 'geo.map.scale.6') as Skill;

  it('formats numbers with the decimal comma and groups thousands', () => {
    expect(fmtDecimal(1.75)).toBe('1,75');
    expect(fmtDecimal(4.5)).toBe('4,5');
    expect(fmtDecimal(12)).toBe('12');
    expect(scaleText(100000)).toBe('1:100 000');
    expect(realDistance(45, 100000)).toEqual({ value: 4.5, unit: 'km' });
    expect(realDistance(25, 25000)).toEqual({ value: 625, unit: 'm' });
    expect(realDistance(30, 50000)).toEqual({ value: 1500, unit: 'm' });
    expect(realDistance(30, 200000)).toEqual({ value: 6, unit: 'km' });
  });

  it('shows prompts and options with the decimal comma, never a decimal point', () => {
    for (const skill of [scale5, scale6]) {
      for (const i of generateItems(skill, 200, { seed: 5 })) {
        if (!i.id.startsWith('gen.')) continue;
        const texts = [i.prompt.ro, ...(i.type === 'choice' ? i.options.map((o) => o.text?.ro ?? '') : [])];
        for (const t of texts) expect(/\d\.\d/.test(t), t).toBe(false);
      }
    }
  });

  it('level 1 never needs more than whole centimetres at the easiest difficulty; every distractor differs from the answer', () => {
    for (const i of generateItems(scale5, 200, { seed: 8, difficulty: 1 })) {
      if (!i.id.startsWith('gen.')) continue;
      expect(verify(i), i.prompt.ro).toBeNull();
      if (i.type === 'choice') expect(new Set(i.options.map((o) => o.text?.ro)).size).toBe(i.options.length);
    }
  });

  it('mixes the modes: distance, reverse distance, scale from a statement, scale from a pair, larger/smaller scale', () => {
    const prompts = generateItems(scale6, 300, { seed: 13 }).filter((i) => i.id.startsWith('gen.')).map((i) => i.prompt.ro);
    expect(prompts.some((p) => p.startsWith('Pe o hartă la scara'))).toBe(true);
    expect(prompts.some((p) => p.startsWith('Două orașe se află'))).toBe(true);
    expect(prompts.some((p) => /reprezintă .*km în realitate\. Care este scara/.test(p) && !p.includes('1 cm'))).toBe(true);
    expect(prompts.some((p) => p.includes('1 cm reprezintă'))).toBe(true);
    expect(prompts.some((p) => p.startsWith('Care dintre aceste scări'))).toBe(true);
  });

  it('uses the existing ruler visual and no raster media', () => {
    const items = generateItems(scale5, 200, { seed: 17 }).filter((i) => i.id.startsWith('gen.'));
    expect(items.some((i) => i.visual?.kind === 'ruler')).toBe(true);
    for (const i of items) expect(i.visual === undefined || i.visual.kind === 'ruler').toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Banks                                                              */
/* ------------------------------------------------------------------ */

describe('geo gimnaziu item banks', () => {
  const banks = bankFiles.map((f) => ({ f, items: readJson(f) as Item[] }));

  it('every bank validates; ids are unique and match the skill; own ai-draft beta', () => {
    const all = banks.flatMap((b) => b.items);
    expect(validateItems(all)).toEqual([]);
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(120);
    for (const { f, items } of banks) {
      const g = Number(f.match(/grade(\d)\.json$/)?.[1]);
      for (const i of items) {
        expect(validateItem(i)).toEqual([]);
        expect(i.id.startsWith(`item.${i.skillId}.`), i.id).toBe(true);
        expect(i.reviewStatus).toBe('beta');
        expect(i.provenance.source).toBe('ai-draft');
        expect(i.provenance.licence).toBe('OWN');
        expect(i.explanationId).toBe(`exp.${i.skillId}`);
        expect(getAllSkills().find((s) => s.id === i.skillId)?.grade, i.id).toBe(g);
      }
    }
  });

  it('each grade bank mixes choice, true-false, fill-gap, match, sort and order items', () => {
    for (const { f, items } of banks) {
      const types = new Set(items.map((i) => i.type));
      for (const t of ['choice', 'true-false', 'fill-gap', 'match', 'sort', 'order']) expect(types.has(t as Item['type']), `${f}: ${t}`).toBe(true);
    }
  });

  it('match items have unique left and right texts', () => {
    for (const { items } of banks) {
      for (const i of items) {
        if (i.type !== 'match') continue;
        expect(new Set(i.pairs.map((x) => x.left.text?.ro)).size, i.id).toBe(i.pairs.length);
        expect(new Set(i.pairs.map((x) => x.right.text?.ro)).size, i.id).toBe(i.pairs.length);
      }
    }
  });

  it('every bank item is answerable: the perfect response passes, fill-gap options hold the answer', () => {
    for (const { items } of banks) {
      for (const i of items) {
        expect(checkResponse(i, correctResponse(i)), i.id).toBe(true);
        if (i.type === 'fill-gap') expect(i.options).toContain(i.correct);
      }
    }
  });

  it('bank facts agree with the curated data (match pairs, order, sort)', () => {
    for (const { items } of banks) {
      for (const i of items) {
        if (i.type === 'match' && i.prompt.ro === 'Potrivește fiecare țară cu capitala ei.') {
          for (const p of i.pairs) expect(countryByRo.get(p.left.text?.ro as string)?.capital.ro, i.id).toBe(p.right.text?.ro);
        }
        if (i.type === 'match' && i.prompt.ro === 'Potrivește fiecare județ cu reședința lui.') {
          for (const p of i.pairs) expect(countyByRo.get(p.left.text?.ro as string)?.seat, i.id).toBe(p.right.text?.ro);
        }
        if (i.type === 'order' && i.prompt.ro.startsWith('Ordonează vârfurile')) {
          const h = i.correctOrder.map((id) => heightOf(i.cards.find((c) => c.id === id)?.text?.ro as string));
          expect(h.every((x, k) => k === 0 || h[k - 1] > x), i.id).toBe(true);
        }
        if (i.type === 'order' && i.prompt.ro.startsWith('Ordonează râurile')) {
          const names = i.correctOrder.map((id) => i.cards.find((c) => c.id === id)?.text?.ro as string);
          const lens: Record<string, number> = { Volga: 3530, Dunărea: 2850, Rinul: 1230, Prutul: 950, Mureșul: 760, Oltul: 615, Argeșul: 350 };
          const v = names.map((n) => lens[n]);
          expect(v.every((x, k) => x !== undefined && (k === 0 || v[k - 1] > x)), i.id).toBe(true);
        }
        if (i.type === 'sort' && i.prompt.ro === 'Care țări se învecinează cu România?') {
          for (const c of i.cards) {
            const label = i.categories.find((k) => k.id === c.categoryId)?.label.ro;
            expect(label === 'Vecin al României', i.id).toBe(countryByRo.get(c.text?.ro as string)?.borderRomania === true);
          }
        }
      }
    }
  });
});
