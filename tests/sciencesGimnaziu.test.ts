import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateExplanation, validateItem, validateSkillGraph, validateSkills } from '../src/engine/content/validate';
import { validateProvenance } from '../src/engine/content/provenance';
import { getAllSkills, getExplanation, getSkillsBySubject } from '../src/engine/content/registry';
import { checkResponse } from '../src/engine/items/check';
import { generateItems, getGenerator, mulberry32 } from '../src/engine/items/generators';
import { NAT_TOPICS } from '../src/engine/items/generators/natData';
import { learnerService } from '../src/learner';
import { isSubjectAvailable, subjectMinGrade } from '../src/learner/availability';
import { PLAN_ROTATING_SUBJECTS } from '../src/learner/planOps';
import { LEARN_SUBJECTS } from '../src/ui/learn/subjects';
import { _resetMemoryForTests } from '../src/profiles/db';
import { createProfile } from '../src/profiles/profileService';
import type { Grade, Item, ItemResponse, Skill, SubjectId } from '../src/engine/types';

const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'content');
const readJson = (f: string): any => JSON.parse(readFileSync(f, 'utf8'));

const SUBJECTS = { bio: { programa: 'BIO-V-VIII-2017', grades: [5, 6, 7, 8] }, fiz: { programa: 'FIZ-VI-VIII-2017', grades: [6, 7, 8] }, chim: { programa: 'CHIM-VII-VIII-2017', grades: [7, 8] } } as const;
const SUBJECT_IDS = ['bio', 'fiz', 'chim'] as const;
const sciSkills = SUBJECT_IDS.flatMap((s) => getSkillsBySubject(s));

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
/*  Content files and graph                                            */
/* ------------------------------------------------------------------ */

describe('sciences gimnaziu: skill graph (bio V-VIII, fiz VI-VIII, chim VII-VIII)', () => {
  it('skill files are structurally valid and counts are in range', () => {
    for (const [subject, cfg] of Object.entries(SUBJECTS)) {
      for (const g of cfg.grades) {
        const f = join(CONTENT, 'skills', subject, `grade${g}.json`);
        expect(validateSkills(readJson(f), relative(ROOT, f))).toEqual([]);
        const n = getSkillsBySubject(subject as SubjectId, g as Grade).length;
        expect(n, `${subject} ${g}`).toBeGreaterThanOrEqual(8);
        expect(n, `${subject} ${g}`).toBeLessThanOrEqual(14);
      }
    }
  });

  it('the whole graph is a valid DAG with ids ending in the grade', () => {
    expect(validateSkillGraph(getAllSkills())).toEqual([]);
    for (const s of sciSkills) expect(s.id.endsWith(`.${s.grade}`), s.id).toBe(true);
  });

  it('grades never start before the subject minimum', () => {
    expect(subjectMinGrade('bio')).toBe(5);
    expect(subjectMinGrade('fiz')).toBe(6);
    expect(subjectMinGrade('chim')).toBe(7);
  });

  it('every skill has a prerequisite (no orphan roots) and links into grade III-IV stiinte or math', () => {
    expect(sciSkills.filter((s) => s.prerequisites.length === 0)).toEqual([]);
    const byId = new Map(getAllSkills().map((s) => [s.id, s]));
    for (const subject of SUBJECT_IDS) {
      const links = getSkillsBySubject(subject).flatMap((s) => s.prerequisites.map((p) => byId.get(p) as Skill));
      expect(links.some((p) => p.subject === 'stiinte' || p.subject === 'mat'), subject).toBe(true);
    }
    const fizMath = getSkillsBySubject('fiz').filter((s) => s.prerequisites.some((p) => p.startsWith('mat.')));
    expect(fizMath.length).toBeGreaterThanOrEqual(3);
    // each grade crosses into earlier material
    for (const subject of SUBJECT_IDS) {
      for (const g of SUBJECTS[subject].grades.slice(1)) {
        const crossing = getSkillsBySubject(subject, g as Grade).filter((s) => s.prerequisites.some((p) => (byId.get(p) as Skill).grade < g));
        expect(crossing.length, `${subject} ${g}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('uses the programa ids with codes, own provenance and the "verify" note', () => {
    for (const s of sciSkills) {
      expect(s.competences.length, s.id).toBeGreaterThan(0);
      expect(s.competences.every((c) => c.programa === SUBJECTS[s.subject as 'bio'].programa && /^\d+\.\d+$/.test(c.code)), s.id).toBe(true);
      expect(s.provenance.source).toBe('own');
      expect(s.provenance.licence).toBe('OWN');
      expect(s.provenance.author).toBe('Ludiko');
      expect(s.provenance.notes).toMatch(/verify/);
      expect(s.title.en, s.id).toBeTruthy();
    }
  });

  it('covers the main strands', () => {
    const ids = sciSkills.map((s) => s.id).join(' ');
    for (const part of [
      'bio.cell', 'bio.kingdoms', 'bio.ecosystem', 'bio.plant.leaf', 'bio.animal.vert', 'bio.skeleton', 'bio.circulatory', 'bio.nervous', 'bio.heredity', 'bio.punnett', 'bio.evolution',
      'fiz.length', 'fiz.speed', 'fiz.density', 'fiz.weight', 'fiz.pressure', 'fiz.work', 'fiz.energy', 'fiz.heat', 'fiz.ohm', 'fiz.light',
      'chim.matter', 'chim.atom', 'chim.periodic', 'chim.symbols', 'chim.valence', 'chim.balance', 'chim.acids', 'chim.water', 'chim.metals',
    ]) expect(ids, part).toContain(part);
  });

  it('every skill has one existing 3-frame explanation (ai-draft, beta, OWN) with NFC Romanian', () => {
    for (const s of sciSkills) {
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
  });

  it('text files use comma-below diacritics and NFC only', () => {
    const files: string[] = [];
    for (const subject of SUBJECT_IDS) {
      for (const dir of ['skills', 'explanations']) {
        const d = join(CONTENT, dir, subject);
        for (const f of readdirSync(d)) files.push(join(d, f));
      }
      files.push(join(CONTENT, 'data', 'nat', `${subject}.json`));
    }
    for (const f of files) {
      const t = readFileSync(f, 'utf8');
      expect(/[şţŞŢ]/.test(t), `${f} has cedilla letters`).toBe(false);
      expect(t.normalize('NFC') === t, `${f} is not NFC`).toBe(true);
    }
  });

  it('data files carry valid provenance and every quiz entry is well formed', () => {
    for (const subject of SUBJECT_IDS) {
      const f = readJson(join(CONTENT, 'data', 'nat', `${subject}.json`));
      expect(validateProvenance(f.provenance)).toEqual([]);
    }
    for (const [topic, t] of Object.entries(NAT_TOPICS)) {
      expect(getAllSkills().some((s) => s.id === topic), topic).toBe(true);
      for (const q of t.q ?? []) {
        expect(q.length, `${topic}: ${q[0]}`).toBeGreaterThanOrEqual(3);
        expect(new Set(q.slice(1)).size, `${topic}: duplicate answers in ${q[0]}`).toBe(q.length - 1);
        expect(q.every((x) => x.trim().length > 0)).toBe(true);
      }
      for (const group of t.m ?? []) {
        expect(group.length, topic).toBeGreaterThanOrEqual(4);
        expect(new Set(group.map((p) => p[0])).size, topic).toBe(group.length);
        expect(new Set(group.map((p) => p[1])).size, topic).toBe(group.length);
      }
      for (const [, la, lb, a, b] of t.s ?? []) {
        expect(la).not.toBe(lb);
        expect(a.length, topic).toBeGreaterThanOrEqual(3);
        expect(b.length, topic).toBeGreaterThanOrEqual(3);
        expect(a.filter((x) => b.includes(x)), topic).toEqual([]);
      }
      for (const o of t.o ?? []) {
        expect(o.length, topic).toBeGreaterThanOrEqual(4);
        expect(new Set(o.slice(1)).size, topic).toBe(o.length - 1);
      }
    }
  });

  it('every skill resolves its generators and has enough conceptual or numeric material', () => {
    for (const s of sciSkills) {
      expect(s.itemSources.length, s.id).toBeGreaterThan(0);
      for (const src of s.itemSources) {
        if ('generator' in src) expect(getGenerator(src.generator), `${s.id}: ${src.generator}`).toBeTypeOf('function');
      }
      const topic = NAT_TOPICS[s.id];
      const entries = topic ? (topic.q?.length ?? 0) + (topic.tf?.length ?? 0) + (topic.m?.length ?? 0) + (topic.s?.length ?? 0) + (topic.o?.length ?? 0) : 0;
      const numeric = s.itemSources.some((x) => 'generator' in x && x.generator !== 'nat-quiz');
      expect(entries >= 6 || (numeric && entries >= 3) || (numeric && entries === 0), `${s.id} entries ${entries}`).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Availability and rotation                                          */
/* ------------------------------------------------------------------ */

describe('sciences gimnaziu: availability, rotation and "all subjects"', () => {
  it('bio from V, fiz from VI, chim from VII', () => {
    for (const g of [0, 4]) for (const s of SUBJECT_IDS) expect(isSubjectAvailable(s, g), `${s} ${g}`).toBe(false);
    expect(isSubjectAvailable('bio', 5)).toBe(true);
    expect(isSubjectAvailable('fiz', 5)).toBe(false);
    expect(isSubjectAvailable('chim', 5)).toBe(false);
    expect(isSubjectAvailable('fiz', 6)).toBe(true);
    expect(isSubjectAvailable('chim', 6)).toBe(false);
    expect(isSubjectAvailable('chim', 7)).toBe(true);
    expect(isSubjectAvailable('chim', 8) && isSubjectAvailable('fiz', 8) && isSubjectAvailable('bio', 8)).toBe(true);
  });

  it('the subjects join the rotating third bit and the learner subject list', () => {
    for (const s of SUBJECT_IDS) {
      expect(PLAN_ROTATING_SUBJECTS).toContain(s);
      expect(LEARN_SUBJECTS).toContain(s);
    }
  });
});

describe('sciences gimnaziu: placement works for each subject', () => {
  const NOW = new Date(2027, 2, 20, 10).getTime();
  beforeEach(() => {
    _resetMemoryForTests();
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const grades: Record<string, Grade> = { bio: 5, fiz: 6, chim: 7 };
  for (const subject of SUBJECT_IDS) {
    for (const knows of [true, false]) {
      it(`${subject}: a child who knows ${knows ? 'everything' : 'nothing'} finishes the placement`, async () => {
        const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: grades[subject], language: 'ro' });
        let done = false;
        for (let i = 0; i < 60 && !done; i++) {
          const r = await learnerService.placementNext(p.id, subject, NOW);
          if ('unavailable' in r) throw new Error('unavailable');
          if (r.done) done = true;
          else await learnerService.placementRecord(p.id, subject, r.skillId, Array(r.itemCount).fill(knows));
        }
        expect(done).toBe(true);
      });
    }
  }

  it('a grade V profile gets no fiz or chim placement', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🦊', grade: 5, language: 'ro' });
    for (const s of ['fiz', 'chim'] as const) {
      const r = await learnerService.placementNext(p.id, s, NOW);
      expect('unavailable' in r, s).toBe(true);
    }
    const bio = await learnerService.placementNext(p.id, 'bio', NOW);
    expect('unavailable' in bio).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Generators: validity, determinism                                  */
/* ------------------------------------------------------------------ */

const SEED = 20261127;
const COUNT = 200;
const optionTexts = (item: Item): string[] => {
  if (item.type === 'choice' || item.type === 'picture-choice') return item.options.map((o) => o.text?.ro ?? JSON.stringify(o.visual));
  if (item.type === 'fill-gap') return item.options ?? [];
  return [];
};

describe('sciences gimnaziu: every skill gives 200 valid, deterministic items', () => {
  for (const skill of sciSkills) {
    describe(skill.id, () => {
      const items = generateItems(skill, COUNT, { seed: SEED });

      it(`produces ${COUNT} valid items with working answer keys`, () => {
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
          if (i.type === 'true-false') expect(checkResponse(i, { type: 'true-false', value: !i.correct })).toBe(false);
          const texts = optionTexts(i);
          expect(new Set(texts).size, `${i.id} ${JSON.stringify(texts)}`).toBe(texts.length);
        }
      });

      it('is deterministic for a seed and works at every difficulty', () => {
        expect(generateItems(skill, 30, { seed: SEED })).toEqual(items.slice(0, 30));
        for (const d of [1, 2, 3, 4, 5] as const) {
          const batch = generateItems(skill, 30, { seed: 7, difficulty: d });
          expect(batch.flatMap((i) => validateItem(i))).toEqual([]);
          for (const i of batch) expect(checkResponse(i, correctResponse(i))).toBe(true);
        }
      });
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Independent verification of the numeric generators                 */
/* ------------------------------------------------------------------ */

function direct(skillId: string, gen: string, n: number, difficulty: 1 | 2 | 3 | 4 | 5, only?: Record<string, unknown>): Item[] {
  const skill = getAllSkills().find((s) => s.id === skillId) as Skill;
  const src = skill.itemSources.find((s) => 'generator' in s && s.generator === gen) as { params?: Record<string, unknown> } | undefined;
  expect(src, `${skillId} uses ${gen}`).toBeDefined();
  const params = { ...(src?.params ?? {}), ...(only ?? {}) };
  return Array.from({ length: n }, (_, index) => getGenerator(gen)!(params, { skill, difficulty, rng: mulberry32(SEED + index * 7919), index }));
}

const num = (s: string): number => Number(s.replace(/[\s  ]/g, '').replace(',', '.'));
/** The number a perfect child would give */
function answerOf(item: Item): number {
  if (item.type === 'number-input') return item.correct;
  if (item.type === 'choice') return num(item.options.find((o) => o.id === item.correctId)?.text?.ro ?? 'NaN');
  throw new Error(`unexpected ${item.type}`);
}
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

describe('fiz-convert: matches an independent conversion table', () => {
  const EXP: Record<string, number> = {
    km: -3, m: 0, dm: 1, cm: 2, mm: 3, t: -3, kg: 0, g: 3, mg: 6, 'm²': 0, 'dm²': 2, 'cm²': 4, 'mm²': 6, 'm³': 0, 'dm³': 3, l: 3, 'cm³': 6, ml: 6,
    kPa: -3, hPa: -2, Pa: 0, kN: -3, N: 0, kJ: -3, J: 0, MW: -6, kW: -3, W: 0, A: 0, mA: 3, kV: -3, V: 0, mV: 3, 'kΩ': -3, 'Ω': 0,
  };
  const SECONDS: Record<string, number> = { h: 3600, min: 60, s: 1 };
  const cases: [string, string][] = [
    ['fiz.length.6', 'length'], ['fiz.massvol.6', 'mass'], ['fiz.massvol.6', 'volume'], ['fiz.area.6', 'area'], ['fiz.pressure.7', 'pressure'],
    ['fiz.power.7', 'power'], ['fiz.current.8', 'current'], ['fiz.ohm.8', 'voltage'], ['fiz.ohm.8', 'resistance'], ['fiz.time.6', 'time'], ['fiz.speed.7', 'speed'],
  ];
  for (const [skillId, family] of cases) {
    it(`${family}`, () => {
      for (const d of [1, 2, 3, 4] as const) {
        for (const item of direct(skillId, 'fiz-convert', 120, d, { family })) {
          const p = item.prompt.ro;
          let expected: number;
          let m: RegExpMatchArray | null;
          if ((m = p.match(/^(\d+) h (\d+) min = \? min$/))) expected = Number(m[1]) * 60 + Number(m[2]);
          else if ((m = p.match(/^([\d\s ,]+) (\S+) = \? (\S+)$/))) {
            const [value, from, to] = [num(m[1]), m[2], m[3]];
            if (family === 'speed') expected = from === 'km/h' ? value / 3.6 : value * 3.6;
            else if (family === 'time') expected = (value * SECONDS[from]) / SECONDS[to];
            else expected = value * 10 ** (EXP[to] - EXP[from]);
          } else throw new Error(`unparsed: ${p}`);
          expect(close(answerOf(item), expected), `${p} -> ${answerOf(item)} (expected ${expected})`).toBe(true);
        }
      }
    });
  }
});

describe('fiz-calc: one-formula problems are solved by an independent evaluator', () => {
  type M = Record<string, number>;
  const F: Record<string, (v: M) => number> = {
    'v = d / t': (v) => v.d / v.t,
    'ρ = m / V': (v) => v.m / v.V,
    'p = F / S': (v) => v.F / v.S,
    'P = L / t': (v) => v.L / v.t,
    'I = Q / t': (v) => v.Q / v.t,
    'G = m · g': (v) => v.m * v.g,
    'F = k · Δl': (v) => v.k * v['Δl'],
    'L = F · d': (v) => v.F * v.d,
    'U = I · R': (v) => v.I * v.R,
    'P = U · I': (v) => v.U * v.I,
    'p = ρ · g · h': (v) => v['ρ'] * v.g * v.h,
    'FA = ρ · g · V': (v) => v['ρ'] * v.g * v.V,
    'Ep = m · g · h': (v) => v.m * v.g * v.h,
    'Q = m · c · Δt': (v) => v.m * v.c * v['Δt'],
  };
  const KINDS: [string, string][] = [
    ['fiz.speed.6', 'speed'], ['fiz.density.6', 'density'], ['fiz.pressure.7', 'pressure'], ['fiz.power.7', 'power'], ['fiz.current.8', 'current'],
    ['fiz.weight.7', 'weight'], ['fiz.elastic.7', 'hooke'], ['fiz.work.7', 'work'], ['fiz.ohm.8', 'ohm'], ['fiz.elpower.8', 'elpower'],
    ['fiz.liquid.7', 'hydro'], ['fiz.liquid.7', 'archimedes'], ['fiz.energy.7', 'potential'], ['fiz.heat.8', 'heat'],
  ];
  for (const [skillId, kind] of KINDS) {
    it(`${kind}`, () => {
      const seenAsk = new Set<string>();
      for (const d of [1, 2] as const) {
        for (const item of direct(skillId, 'fiz-calc', 150, d, { kind })) {
          const m = item.prompt.ro.match(/^Calculează .+? (\S+) \(în (.+?)\), știind că (.+)\. Formula: (.+)\.$/);
          expect(m, item.prompt.ro).not.toBeNull();
          const [, ask, , given, formula] = m as RegExpMatchArray;
          const f = F[formula];
          expect(f, formula).toBeTypeOf('function');
          const vars: M = {};
          for (const g of given.matchAll(/([^\s,]+) = (\d[\d  ]*(?:,\d+)?)/g)) vars[g[1]] = num(g[2]);
          const result = formula.split(' = ')[0];
          let expected: number;
          if (ask === result) expected = f(vars);
          else {
            const target = vars[result];
            const g = (x: number) => f({ ...vars, [ask]: x }) - target;
            const increasing = g(2) > g(1);
            let lo = 0;
            let hi = 1e9;
            for (let i = 0; i < 200; i++) {
              const mid = (lo + hi) / 2;
              if (g(mid) < 0 === increasing) lo = mid;
              else hi = mid;
            }
            expected = (lo + hi) / 2;
          }
          seenAsk.add(ask === result ? 'result' : 'unknown');
          expect(Math.abs(answerOf(item) - expected) <= 1e-4 * Math.max(1, Math.abs(expected)), `${item.prompt.ro} -> ${answerOf(item)} vs ${expected}`).toBe(true);
        }
      }
      expect(seenAsk.has('result')).toBe(true);
    });
  }

  it('kinetic energy and average speed', () => {
    for (const item of direct('fiz.energy.7', 'fiz-calc', 80, 2, { kind: 'kinetic' })) {
      const m = item.prompt.ro.match(/m = (\d+) kg și v = (\d+) m\/s/) as RegExpMatchArray;
      expect(answerOf(item)).toBe((Number(m[1]) * Number(m[2]) ** 2) / 2);
    }
    for (const item of direct('fiz.speed.7', 'fiz-calc', 80, 2, { kind: 'avgspeed' })) {
      const m = item.prompt.ro.match(/d1 = (\d+) km, t1 = (\d+) h, d2 = (\d+) km și t2 = (\d+) h/) as RegExpMatchArray;
      const [d1, t1, d2, t2] = m.slice(1).map(Number);
      expect(d1 > 0 && d2 > 0).toBe(true);
      expect(answerOf(item)).toBe((d1 + d2) / (t1 + t2));
    }
  });
});

describe('fiz lever, resistors, instrument reading', () => {
  it('lever balance F1·d1 = F2·d2', () => {
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('fiz.lever.7', 'fiz-lever', 100, d)) {
        const p = item.prompt.ro;
        const F1 = Number(p.match(/F1 = (\d+) N/)![1]);
        const d1 = Number(p.match(/d1 = (\d+) m/)![1]);
        if (p.includes('Calculează forța F2')) {
          const d2 = Number(p.match(/d2 = (\d+) m/)![1]);
          expect(answerOf(item)).toBe((F1 * d1) / d2);
        } else {
          const F2 = Number(p.match(/F2 = (\d+) N/)![1]);
          expect(answerOf(item)).toBe((F1 * d1) / F2);
        }
      }
    }
  });

  it('series and parallel resistors', () => {
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('fiz.resistors.8', 'fiz-resistors', 120, d)) {
        const p = item.prompt.ro;
        const rs = [...p.matchAll(/R\d = (\d+) Ω/g)].map((m) => Number(m[1]));
        if (p.includes('în serie')) expect(answerOf(item)).toBe(rs.reduce((a, b) => a + b, 0));
        else {
          expect(rs.length).toBe(2);
          expect(close(answerOf(item), (rs[0] * rs[1]) / (rs[0] + rs[1]))).toBe(true);
        }
      }
    }
  });

  it('ruler, thermometer, rectangle and cuboid', () => {
    for (const d of [1, 3] as const) {
      for (const item of direct('fiz.measure.6', 'fiz-read', 80, d, { kind: 'ruler' })) {
        expect(item.visual?.kind).toBe('ruler');
        const v = item.visual as { from?: number; objectEnd: number };
        expect(answerOf(item)).toBe(v.objectEnd - (v.from ?? 0));
      }
    }
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('fiz.temp.6', 'fiz-read', 120, d, { kind: 'thermo' })) {
        const p = item.prompt.ro;
        let m: RegExpMatchArray | null;
        if ((m = p.match(/de la (-?\d+) °C la (-?\d+) °C/))) expect(answerOf(item)).toBe(Number(m[2]) - Number(m[1]));
        else if ((m = p.match(/: (-?\d+) °C = \? K/))) expect(answerOf(item)).toBe(Number(m[1]) + 273);
        else expect(answerOf(item)).toBe((item.visual as { marks: number[] }).marks[0]);
      }
      for (const item of direct('fiz.area.6', 'fiz-read', 120, d, { kind: 'area' })) {
        const p = item.prompt.ro;
        let m: RegExpMatchArray | null;
        if ((m = p.match(/cuboid are lungimea (\d+) cm, lățimea (\d+) cm și înălțimea (\d+) cm/))) expect(answerOf(item)).toBe(Number(m[1]) * Number(m[2]) * Number(m[3]));
        else {
          m = p.match(/lungimea (\d+) cm și lățimea (\d+) cm\. Calculează (aria|perimetrul)/) as RegExpMatchArray;
          const [a, b] = [Number(m[1]), Number(m[2])];
          expect(answerOf(item)).toBe(m[3] === 'aria' ? a * b : 2 * (a + b));
        }
      }
    }
  });
});

describe('chemistry generators match independent chemistry', () => {
  const AR: Record<string, number> = { H: 1, C: 12, N: 14, O: 16, Na: 23, Mg: 24, Al: 27, P: 31, S: 32, Cl: 35.5, K: 39, Ca: 40, Fe: 56, Cu: 64, Zn: 65, Ag: 108 };
  /** atoms of a formula: element letters + digits, with one bracket group */
  function atoms(formula: string): Record<string, number> {
    const out: Record<string, number> = {};
    const add = (el: string, n: number) => (out[el] = (out[el] ?? 0) + n);
    let rest = formula;
    rest = rest.replace(/\(([A-Za-z0-9]+)\)(\d*)/g, (_, inner: string, k: string) => {
      for (const [, el, n] of inner.matchAll(/([A-Z][a-z]?)(\d*)/g)) add(el, (n ? Number(n) : 1) * (k ? Number(k) : 1));
      return '';
    });
    for (const [, el, n] of rest.matchAll(/([A-Z][a-z]?)(\d*)/g)) add(el, n ? Number(n) : 1);
    return out;
  }
  const shellsOf = (z: number): number[] => {
    const out: number[] = [];
    let left = z;
    for (const c of [2, 8, 8, 18]) {
      if (left <= 0) break;
      out.push(Math.min(c, left));
      left -= c;
    }
    return out;
  };
  const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  const lcm = (a: number, b: number) => {
    let x = a;
    while (x % b !== 0) x += a;
    return x;
  };

  it('atoms: protons, neutrons, electrons, mass number', () => {
    for (const item of direct('chim.atom.7', 'chim-atom', 200, 2)) {
      const p = item.prompt.ro;
      let m: RegExpMatchArray | null;
      if ((m = p.match(/Z = (\d+) și A = (\d+)\. Câți neutroni/))) expect(answerOf(item)).toBe(Number(m[2]) - Number(m[1]));
      else if ((m = p.match(/Z = (\d+)\. Câți electroni/))) expect(answerOf(item)).toBe(Number(m[1]));
      else if ((m = p.match(/are (\d+) protoni și (\d+) neutroni\. Care este numărul lui de masă/))) expect(answerOf(item)).toBe(Number(m[1]) + Number(m[2]));
      else if ((m = p.match(/A = (\d+) și (\d+) neutroni\. Care este numărul lui atomic/))) expect(answerOf(item)).toBe(Number(m[1]) - Number(m[2]));
      else throw new Error(p);
    }
  });

  it('electron shells, outer electrons, period', () => {
    const seen = new Set<string>();
    for (const d of [1, 3] as const) {
      for (const item of direct('chim.config.7', 'chim-config', 150, d)) {
        const p = item.prompt.ro;
        const z = Number(p.match(/Z = (\d+)/)![1]);
        const sh = shellsOf(z);
        if (p.includes('ultimul strat')) { expect(answerOf(item)).toBe(sh[sh.length - 1]); seen.add('outer'); }
        else if (p.includes('perioadă')) { expect(answerOf(item)).toBe(sh.length); seen.add('period'); }
        else {
          expect(item.type).toBe('choice');
          const c = item as Extract<Item, { type: 'choice' }>;
          expect(c.options.find((o) => o.id === c.correctId)?.text?.ro).toBe(sh.join(', '));
          seen.add('config');
        }
      }
    }
    expect(seen.size).toBe(3);
  });

  it('formula atom counts and molar masses', () => {
    for (const item of direct('chim.formula.7', 'chim-formula', 200, 3)) {
      const p = item.prompt.ro;
      const f = p.match(/formula chimică (\S+)\?$/)![1];
      const a = atoms(f);
      const m = p.match(/atomi de (\S+) sunt/);
      expect(answerOf(item)).toBe(m ? a[m[1]] : Object.values(a).reduce((x, y) => x + y, 0));
    }
    for (const d of [1, 3] as const) {
      for (const item of direct('chim.molmass.7', 'chim-molmass', 200, d)) {
        const m = item.prompt.ro.match(/substanței (\S+) \(în g\/mol\)\. Mase atomice: (.+)\.$/) as RegExpMatchArray;
        const table: Record<string, number> = {};
        for (const [, el, v] of m[2].matchAll(/([A-Z][a-z]?) = (\d+(?:,\d+)?)/g)) {
          table[el] = num(v);
          expect(table[el], el).toBe(AR[el]);
        }
        const a = atoms(m[1]);
        expect(Object.keys(a).sort()).toEqual(Object.keys(table).sort());
        expect(close(answerOf(item), Object.entries(a).reduce((s, [el, n]) => s + AR[el] * n, 0))).toBe(true);
      }
    }
  });

  it('valence: criss-cross formulas and valences from formulas', () => {
    const kinds = new Set<string>();
    for (const d of [1, 3] as const) {
      for (const item of direct('chim.valence.7', 'chim-valence', 200, d)) {
        const p = item.prompt.ro;
        let m: RegExpMatchArray | null;
        if ((m = p.match(/dintre (\S+) \(valența (\w+)\) și (\S+) \(valența (\w+)\)\?/))) {
          const [a, va, b, vb] = [m[1], ROMAN[m[2]], m[3], ROMAN[m[4]]];
          const l = lcm(va, vb);
          const expected = `${a}${l / va > 1 ? l / va : ''}${b}${l / vb > 1 ? l / vb : ''}`;
          const c = item as Extract<Item, { type: 'choice' }>;
          expect(c.options.find((o) => o.id === c.correctId)?.text?.ro).toBe(expected);
          // charge balance of the correct formula
          const at = atoms(expected);
          expect(at[a] * va).toBe(at[b] * vb);
          kinds.add('formula');
        } else if ((m = p.match(/În compusul (\S+), (\S+) are valența (\w+)\. Care este valența lui (\S+)\?/))) {
          const at = atoms(m[1]);
          expect(answerOf(item)).toBe((at[m[2]] * ROMAN[m[3]]) / at[m[4]]);
          kinds.add('valence');
        } else throw new Error(p);
      }
    }
    expect(kinds.size).toBe(2);
  });

  it('balancing: the keyed coefficient really balances the equation', () => {
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('chim.balance.8', 'chim-balance', 200, d)) {
        expect(item.type).toBe('fill-gap');
        const it = item as Extract<Item, { type: 'fill-gap' }>;
        const [lhs, rhs] = it.template.ro.split(' → ');
        const terms = (side: string) => side.split(' + ').map((t) => {
          const m = t.match(/^(?:(\d+|\{\{gap\}\}) )?(\S+)$/) as RegExpMatchArray;
          return { coef: m[1] === undefined ? 1 : m[1] === '{{gap}}' ? null : Number(m[1]), formula: m[2] };
        });
        const all = [...terms(lhs).map((t) => ({ ...t, sign: 1 })), ...terms(rhs).map((t) => ({ ...t, sign: -1 }))];
        const balance = (x: number) => {
          const net: Record<string, number> = {};
          for (const t of all) for (const [el, n] of Object.entries(atoms(t.formula))) net[el] = (net[el] ?? 0) + t.sign * (t.coef ?? x) * n;
          return net;
        };
        const final = balance(Number(it.correct));
        expect(Object.values(final).every((v) => v === 0), `${it.template.ro} gap=${it.correct}`).toBe(true);
        for (const wrong of (it.options ?? []).filter((o) => o !== it.correct)) expect(Object.values(balance(Number(wrong))).every((v) => v === 0)).toBe(false);
      }
    }
  });

  it('solutions: concentration formula', () => {
    const modes = new Set<string>();
    for (const d of [1, 3] as const) {
      for (const item of direct('chim.solutions.8', 'chim-solution', 200, d)) {
        const p = item.prompt.ro;
        const ms = Number(p.match(/ms = (\d+) g/)?.[1]);
        const md = Number(p.match(/md = (\d+) g/)?.[1]);
        const c = Number(p.match(/c = (\d+) %/)?.[1]);
        if (p.includes('Calculează concentrația')) { expect(answerOf(item)).toBe((md / ms) * 100); modes.add('c'); }
        else if (p.includes('Calculează masa de substanță dizolvată')) { expect(answerOf(item)).toBe((c * ms) / 100); modes.add('md'); }
        else if (p.includes('Calculează masa soluției')) { expect(answerOf(item)).toBe((md * 100) / c); modes.add('ms'); }
        else if (p.includes('masa de apă')) { expect(answerOf(item)).toBe(ms - md); modes.add('water'); }
        else throw new Error(p);
      }
    }
    expect(modes.size).toBe(4);
  });

  it('mass law: stoichiometric ratios from atomic masses, and conservation', () => {
    for (const d of [1, 3] as const) {
      for (const item of direct('chim.masslaw.8', 'chim-masslaw', 200, d)) {
        const p = item.prompt.ro;
        const eq = p.match(/reacția (.+?) \(reactanții/)![1];
        const [lhs] = eq.split(' → ');
        const [ta, tb] = lhs.split(' + ').map((t) => {
          const m = t.match(/^(?:(\d+) )?(\S+)$/) as RegExpMatchArray;
          const a = atoms(m[2]);
          return (m[1] ? Number(m[1]) : 1) * Object.entries(a).reduce((s, [el, n]) => s + AR[el] * n, 0);
        });
        const grams = [...p.matchAll(/(\d+) g/g)].map((m) => Number(m[1]));
        if (p.includes('se obțin') && p.includes('au reacționat')) {
          const [ma, mp] = grams;
          expect(answerOf(item)).toBe(mp - ma);
          expect(close(ma / answerOf(item), ta / tb)).toBe(true);
        } else {
          const [ma, mb] = grams;
          expect(close(ma / mb, ta / tb), p).toBe(true);
          expect(answerOf(item)).toBe(ma + mb);
        }
      }
    }
  });

  it('pH: acid below 7, neutral at 7, basic above', () => {
    const cls = (ph: number) => (ph < 7 ? 'acid' : ph === 7 ? 'neutral' : 'base');
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('chim.ph.8', 'chim-ph', 150, d)) {
        if (item.type === 'choice') expect(item.correctId).toBe(cls(Number(item.prompt.ro.match(/pH = (\d+)/)![1])));
        else if (item.type === 'sort') for (const c of item.cards) expect(c.categoryId).toBe(cls(Number(c.text!.ro.match(/pH = (\d+)/)![1])));
        else throw new Error(item.type);
      }
    }
  });
});

describe('biology generators match independent genetics', () => {
  it('Punnett crosses by enumeration', () => {
    const kinds = new Set<string>();
    for (const d of [1, 2, 3] as const) {
      for (const item of direct('bio.punnett.8', 'bio-punnett', 200, d)) {
        const p = item.prompt.ro;
        if (p.includes('gameți')) {
          const g = p.match(/genotipul (\S+)\?/)![1];
          const c = item as Extract<Item, { type: 'choice' }>;
          const text = c.options.find((o) => o.id === c.correctId)?.text?.ro as string;
          if (g[0] === g[1]) expect(text.startsWith('doar')).toBe(true);
          else expect(text).toContain(' și ');
          kinds.add('gametes');
          continue;
        }
        const [, a, b] = p.match(/genotipurile (\S+) × (\S+)\./) as RegExpMatchArray;
        const offspring = [a[0], a[1]].flatMap((x) => [b[0], b[1]].map((y) => [x, y].sort((u, v) => (u === u.toUpperCase() ? -1 : 1) - (v === v.toUpperCase() ? -1 : 1)).join('')));
        const upper = a[0].toUpperCase() === a[0] ? a[0] : a[0].toUpperCase();
        const lower = upper.toLowerCase();
        let m: RegExpMatchArray | null;
        if ((m = p.match(/fenotipul (dominant|recesiv)\?$/))) {
          const n = offspring.filter((g) => (m![1] === 'dominant' ? g.includes(upper) : g === lower + lower)).length;
          expect(answerOf(item)).toBe((n / 4) * 100);
          kinds.add('phenotype');
        } else if ((m = p.match(/genotipul (\S+)\?$/))) {
          expect(answerOf(item)).toBe((offspring.filter((g) => g === m![1]).length / 4) * 100);
          kinds.add('genotype');
        } else throw new Error(p);
        if (d <= 2) expect(item.visual?.kind).toBe('grid');
      }
    }
    expect(kinds.size).toBe(3);
  });

  it('microscope magnification', () => {
    for (const d of [1, 3] as const) {
      for (const item of direct('bio.microscope.5', 'bio-magnify', 100, d)) {
        const p = item.prompt.ro;
        let m: RegExpMatchArray | null;
        if ((m = p.match(/ocularul (\d+)× și obiectivul (\d+)×/))) expect(answerOf(item)).toBe(Number(m[1]) * Number(m[2]));
        else if ((m = p.match(/de (\d+) de ori în total, iar ocularul este (\d+)×/))) expect(answerOf(item)).toBe(Number(m[1]) / Number(m[2]));
        else throw new Error(p);
      }
    }
  });
});

describe('nat-quiz items keep their keys', () => {
  it('every curated entry survives generation: choice key text, tf, match, sort, order', () => {
    for (const skill of sciSkills.filter((s) => NAT_TOPICS[s.id])) {
      const t = NAT_TOPICS[skill.id];
      const items = direct(skill.id, 'nat-quiz', 150, 2);
      for (const i of items) {
        if (i.type === 'choice') {
          const correct = i.options.find((o) => o.id === i.correctId)?.text?.ro;
          expect((t.q ?? []).some((q) => q[0] === i.prompt.ro && q[1] === correct), `${skill.id}: ${i.prompt.ro}`).toBe(true);
        } else if (i.type === 'true-false') {
          expect((t.tf ?? []).some((x) => `Adevărat sau fals? ${x[0]}` === i.prompt.ro && x[1] === i.correct), `${skill.id}: ${i.prompt.ro}`).toBe(true);
        } else if (i.type === 'match') {
          const group = (t.m ?? []).find((g) => i.pairs.every((p) => g.some((x) => x[0] === p.left.text?.ro && x[1] === p.right.text?.ro)));
          expect(group, skill.id).toBeDefined();
        } else if (i.type === 'sort') {
          const ok = (t.s ?? []).some((e) => e[0] === i.prompt.ro && i.cards.every((c) => (c.categoryId === 'a' ? e[3] : e[4]).includes(c.text!.ro)));
          expect(ok, skill.id).toBe(true);
        } else if (i.type === 'order') {
          const byId = new Map(i.cards.map((c) => [c.id, c.text!.ro]));
          const got = i.correctOrder.map((id) => byId.get(id));
          expect((t.o ?? []).some((o) => o[0] === i.prompt.ro && JSON.stringify(o.slice(1)) === JSON.stringify(got)), skill.id).toBe(true);
        }
      }
    }
  });
});

describe('no new third-party assets', () => {
  it('the content uses only built-in visual kinds', () => {
    for (const subject of SUBJECT_IDS) {
      const dir = join(CONTENT, 'explanations', subject);
      expect(existsSync(dir)).toBe(true);
      for (const f of readdirSync(dir)) {
        for (const e of readJson(join(dir, f)) as { frames: { visual?: { kind: string } }[] }[]) {
          for (const fr of e.frames) if (fr.visual) expect(fr.visual.kind).not.toBe('image');
        }
      }
    }
  });
});
