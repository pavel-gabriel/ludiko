import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLACEMENT_CONFIG,
  createPlacement,
  gradeName,
  levelStatement,
  nextProbe,
  pickAnchors,
  buildGraph,
  placementResult,
  progressFromPlacement,
  recordProbe,
  type PlacementResult,
} from '../src/engine/diagnostic';
import type { Skill } from '../src/engine/types';
import { knowsFn, mathSkills, rng, runPlacement } from './helpers/engineSim';

const skills = mathSkills();
const byId = new Map(skills.map((s) => [s.id, s]));
const dependantsClosure = (id: string): Set<string> => {
  const out = new Set<string>();
  const visit = (x: string) => {
    for (const s of skills) if (s.prerequisites.includes(x) && !out.has(s.id)) (out.add(s.id), visit(s.id));
  };
  visit(id);
  return out;
};

describe('graph sanity', () => {
  it('uses the real 18-skill math graph (grades 0–II)', () => {
    expect(skills.length).toBe(18);
    expect(byId.has('mat.add.carry.20')).toBe(true);
  });
});

describe('createPlacement / anchors', () => {
  it('picks 6–10 anchors, highest level first, covering the whole scope', () => {
    const st = createPlacement(skills, { grade: 2, semester: 2, subject: 'mat' });
    expect(st.anchors.length).toBeGreaterThanOrEqual(6);
    expect(st.anchors.length).toBeLessThanOrEqual(10);
    expect(st.anchors[0]).toBe('mat.wordproblem.100'); // end of chain covers the most
    expect(Object.keys(st.graph)).toHaveLength(18);
    expect(st.target).toEqual({ grade: 2, semester: 2 });
  });

  it('scopes to the declared semester', () => {
    const st = createPlacement(skills, { grade: 1, semester: 1, subject: 'mat' });
    expect(Object.values(st.graph).every((n) => n.grade < 1 || (n.grade === 1 && n.semester === 1))).toBe(true);
    expect(st.anchors.length).toBeGreaterThanOrEqual(6);
  });

  it('clamps the target to available content (grade III declared, content ends at II/2)', () => {
    const st = createPlacement(skills, { grade: 3, semester: 1, subject: 'mat' });
    expect(st.target).toEqual({ grade: 2, semester: 2 });
    expect(st.declared).toEqual({ grade: 3, semester: 1 });
  });

  it('small graph fallback: anchors = every skill', () => {
    const tiny = skills.filter((s) => s.grade === 0 && s.semester === 1);
    expect(pickAnchors(buildGraph(tiny)).sort()).toEqual(tiny.map((s) => s.id).sort());
  });

  it('empty scope (other subject) finishes immediately', () => {
    const st = createPlacement(skills, { grade: 2, semester: 1, subject: 'rom' });
    expect(nextProbe(st)).toEqual({ done: true, reason: 'empty' });
    expect(placementResult(st).level).toBeNull();
  });

  it('rejects unknown skills in recordProbe', () => {
    const st = createPlacement(skills, { grade: 2, semester: 2, subject: 'mat' });
    expect(() => recordProbe(st, 'nope', [true])).toThrow();
  });
});

describe('placement with simulated children (declared grade II, semester 2)', () => {
  const declared = { grade: 2 as const, semester: 2 as const };

  it('perfect child → level at the declared grade, no gaps', () => {
    const st = runPlacement(skills, () => true, declared);
    const r = placementResult(st);
    expect(r.level).toEqual(declared);
    expect(r.gaps).toEqual([]);
    expect(r.unknown).toEqual([]);
    expect(r.complete).toBe(true);
    expect(r.probesUsed).toBeLessThanOrEqual(DEFAULT_PLACEMENT_CONFIG.maxProbes);
    expect(Object.values(r.skillStates).every((s) => s.state === 'mastered')).toBe(true);
  });

  it('child who knows only grade 0 → gaps start at the 0/I boundary, deepest first', () => {
    const k = knowsFn(skills, new Set(skills.filter((s) => s.grade >= 1).map((s) => s.id)));
    const r = placementResult(runPlacement(skills, k, declared));
    expect(r.level).toEqual({ grade: 0, semester: 2 });
    expect(new Set(r.gaps)).toEqual(new Set(skills.filter((s) => s.grade >= 1).map((s) => s.id)));
    expect(r.gaps[0]).toBe('mat.count.20');
    expect(r.frontier).toContain('mat.count.20');
    for (const s of skills.filter((x) => x.grade === 0)) expect(r.skillStates[s.id].state).toBe('mastered');
    // foundations first: every gap comes after its gap prerequisites
    r.gaps.forEach((g, i) =>
      byId.get(g)!.prerequisites.forEach((p) => {
        if (r.gaps.includes(p)) expect(r.gaps.indexOf(p)).toBeLessThan(i);
      }),
    );
  });

  it('child missing only mat.add.carry.20 → found within budget; dependants are gaps, not mastered', () => {
    const k = knowsFn(skills, new Set(['mat.add.carry.20']));
    const st = runPlacement(skills, k, declared);
    const r = placementResult(st);
    expect(r.probesUsed).toBeLessThanOrEqual(DEFAULT_PLACEMENT_CONFIG.maxProbes);
    expect(r.gaps[0]).toBe('mat.add.carry.20');
    expect(r.frontier).toEqual(['mat.add.carry.20']);
    for (const d of dependantsClosure('mat.add.carry.20')) expect(['gap', 'unknown']).toContain(r.skillStates[d].state);
    expect(new Set(r.gaps)).toEqual(new Set(['mat.add.carry.20', ...dependantsClosure('mat.add.carry.20')]));
    for (const s of skills) if (!r.gaps.includes(s.id)) expect(r.skillStates[s.id].state).toBe('mastered');
    expect(r.level).toEqual({ grade: 1, semester: 1 });
  });

  it('tolerates one slip per probe (2/3 still passes)', () => {
    const k = knowsFn(skills, new Set(['mat.sub.borrow.20']));
    const r = placementResult(runPlacement(skills, (id, i) => (i === 1 ? false : k(id)), declared));
    expect(r.frontier).toEqual(['mat.sub.borrow.20']);
  });

  it('noisy children: the true deepest gap is in the frontier most of the time', () => {
    let hits = 0;
    const runs = 40;
    for (let seed = 1; seed <= runs; seed++) {
      const r1 = rng(seed);
      const k = knowsFn(skills, new Set(['mat.add.carry.20']));
      const r = placementResult(
        runPlacement(skills, (id) => (k(id) ? r1() > 0.1 : r1() < 0.1), declared),
      );
      if (r.frontier.includes('mat.add.carry.20')) hits++;
    }
    expect(hits / runs).toBeGreaterThan(0.7);
  });

  it('stops on the probe budget and reports itself incomplete', () => {
    const k = knowsFn(skills, new Set(['mat.add.carry.20']));
    const st = runPlacement(skills, k, declared, 3);
    expect(st.history).toHaveLength(3);
    expect(nextProbe(st)).toEqual({ done: true, reason: 'budget' });
    const r = placementResult(st);
    expect(r.complete).toBe(false);
    expect(levelStatement(r, 'ro')).toContain('nu e încă completă');
  });

  it('is resumable: state survives a JSON round-trip mid-way', () => {
    const k = knowsFn(skills, new Set(['mat.add.carry.20']));
    let st = createPlacement(skills, { ...declared, subject: 'mat' });
    for (let i = 0; i < 3; i++) {
      const p = nextProbe(st);
      if (p.done) break;
      st = recordProbe(st, p.skillId, [k(p.skillId), k(p.skillId), k(p.skillId)]);
      st = JSON.parse(JSON.stringify(st));
    }
    for (let p = nextProbe(st); !p.done; p = nextProbe(st)) st = recordProbe(st, p.skillId, [k(p.skillId), k(p.skillId), k(p.skillId)]);
    expect(placementResult(st)).toEqual(placementResult(runPlacement(skills, k, declared)));
  });

  it('confidence decays with distance from the probed skill', () => {
    const r = placementResult(runPlacement(skills, () => true, declared));
    expect(r.skillStates['mat.wordproblem.100'].confidence).toBeGreaterThan(r.skillStates['mat.count.10'].confidence);
  });

  it('seeds mastery records: gaps low, mastered high with a review scheduled', () => {
    const k = knowsFn(skills, new Set(['mat.add.carry.20']));
    const now = Date.UTC(2026, 10, 25);
    const seeded = progressFromPlacement(placementResult(runPlacement(skills, k, declared)), now);
    expect(seeded['mat.add.carry.20']).toMatchObject({ state: 'gap' });
    expect(seeded['mat.add.carry.20'].pMastery).toBeLessThan(0.2);
    expect(seeded['mat.count.10'].state).toBe('mastered');
    expect(seeded['mat.count.10'].nextReview).toBeGreaterThan(now);
  });
});

describe('levelStatement', () => {
  const base = (over: Partial<PlacementResult>): PlacementResult => ({
    subject: 'mat',
    declared: { grade: 3, semester: 1 },
    target: { grade: 2, semester: 2 },
    skillStates: {},
    gaps: [],
    frontier: [],
    unknown: [],
    level: { grade: 2, semester: 2 },
    missingCount: 4,
    estimatedWeeks: 3,
    probesUsed: 8,
    complete: true,
    ...over,
  });

  it('matches the PLAN §4 example in ro and en', () => {
    expect(levelStatement(base({}), 'ro')).toBe(
      'Matematică: nivel clasa a II-a, semestrul 2. Clasa reală: a III-a. Lipsesc 4 competențe — estimat 3 săptămâni de misiuni.',
    );
    expect(levelStatement(base({}), 'en')).toBe(
      'Math: level grade II, semester 2. Actual grade: III. 4 competences missing — about 3 weeks of missions.',
    );
  });

  it('handles singular, "de" plurals, none missing and no level', () => {
    expect(levelStatement(base({ missingCount: 1, estimatedWeeks: 1 }), 'ro')).toContain('Lipsește 1 competență — estimat 1 săptămână');
    expect(levelStatement(base({ missingCount: 21, estimatedWeeks: 15 }), 'ro')).toContain('Lipsesc 21 de competențe — estimat 15 săptămâni');
    expect(levelStatement(base({ missingCount: 1, estimatedWeeks: 1 }), 'en')).toContain('1 competence missing — about 1 week');
    expect(levelStatement(base({ missingCount: 0, estimatedWeeks: 0 }), 'ro')).toContain('Nu lipsește nicio competență.');
    expect(levelStatement(base({ level: null }), 'ro')).toContain('nivel început de clasa pregătitoare');
    expect(levelStatement(base({ declared: { grade: 0, semester: 1 } }), 'ro')).toContain('Clasa reală: pregătitoare.');
  });

  it('names Romanian grades', () => {
    expect([0, 1, 2, 4, 8].map((g) => gradeName(g as Skill['grade'], 'ro'))).toEqual([
      'clasa pregătitoare',
      'clasa I',
      'clasa a II-a',
      'clasa a IV-a',
      'clasa a VIII-a',
    ]);
  });
});
