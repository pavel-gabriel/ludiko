import { describe, expect, it } from 'vitest';
import { planMission, type Mission } from '../src/engine/planner';
import { DAY_MS, type MasteryRecord } from '../src/engine/mastery';
import type { SkillState } from '../src/engine/types';
import { mathSkills, rng } from './helpers/engineSim';

const skills = mathSkills();
const byId = new Map(skills.map((s) => [s.id, s]));
const NOW = Date.UTC(2026, 10, 25, 15);
const STATES: SkillState[] = ['unknown', 'gap', 'learning', 'practised', 'mastered'];

const rec = (state: SkillState, over: Partial<MasteryRecord> = {}): MasteryRecord => ({
  state,
  pMastery: { unknown: 0.2, gap: 0.1, learning: 0.5, practised: 0.8, mastered: 0.95 }[state],
  attempts: state === 'unknown' ? 0 : 6,
  correct: state === 'unknown' ? 0 : 4,
  lastSeen: NOW - 2 * DAY_MS,
  nextReview: NOW + 3 * DAY_MS,
  ...over,
});

function randomProgress(seed: number): Record<string, MasteryRecord> {
  const r = rng(seed);
  const out: Record<string, MasteryRecord> = {};
  for (const s of skills) {
    const state = STATES[Math.floor(r() * STATES.length)];
    if (state === 'unknown' && r() < 0.5) continue;
    out[s.id] = rec(state, {
      pMastery: state === 'practised' ? 0.7 + r() * 0.29 : undefined,
      nextReview: NOW + Math.round((r() * 10 - 5) * DAY_MS),
      lastSeen: NOW - Math.round(r() * 10 * DAY_MS),
    });
    if (out[s.id].pMastery === undefined) out[s.id].pMastery = rec(state).pMastery;
  }
  return out;
}

const stateOf = (p: Record<string, MasteryRecord>, id: string): SkillState => p[id]?.state ?? 'unknown';

function checkInvariants(m: Mission, p: Record<string, MasteryRecord>, minutes = 10) {
  expect(m.estimatedSeconds).toBeLessThanOrEqual(minutes * 60);
  expect(m.steps.filter((s) => s.kind === 'new').length).toBeLessThanOrEqual(1);
  expect(new Set(m.steps.map((s) => s.skillId)).size).toBe(m.steps.length);
  m.steps.forEach((s, i) => {
    if (i > 0) expect(s.skillId).not.toBe(m.steps[i - 1].skillId);
    expect(s.itemCount).toBeGreaterThan(0);
    const prereqs = byId.get(s.skillId)!.prerequisites;
    for (const q of prereqs) expect(stateOf(p, q)).not.toBe('gap');
    if (s.kind === 'new') for (const q of prereqs) expect(['practised', 'mastered']).toContain(stateOf(p, q));
    if (s.kind === 'check') {
      expect(stateOf(p, s.skillId)).toBe('practised');
      expect(s.itemCount).toBe(byId.get(s.skillId)!.masteryCheck.items);
    }
    if (s.kind === 'review') expect(stateOf(p, s.skillId)).toBe('mastered');
  });
}

describe('planMission', () => {
  it('fresh child: starts with the root skill as the one new step', () => {
    const m = planMission(skills, {}, { now: NOW });
    expect(m.steps).toHaveLength(1);
    expect(m.steps[0]).toMatchObject({ kind: 'new', skillId: 'mat.count.10' });
  });

  it('picks the deepest unmet prerequisite as the new skill', () => {
    const p: Record<string, MasteryRecord> = {};
    for (const s of skills) p[s.id] = rec(s.grade === 0 ? 'mastered' : 'gap');
    const m = planMission(skills, p, { now: NOW });
    expect(m.steps.find((s) => s.kind === 'new')?.skillId).toBe('mat.count.20');
  });

  it('never schedules a skill whose prerequisite is a gap', () => {
    const p: Record<string, MasteryRecord> = {
      'mat.count.10': rec('mastered'),
      'mat.numrec.10': rec('gap'),
      'mat.add.10': rec('learning'), // inconsistent on purpose: its prerequisite is a gap
      'mat.compare.10': rec('practised', { pMastery: 0.9 }),
    };
    const m = planMission(skills, p, { now: NOW });
    const ids = m.steps.map((s) => s.skillId);
    expect(ids).toContain('mat.numrec.10');
    expect(ids).not.toContain('mat.add.10');
    expect(ids).not.toContain('mat.compare.10');
    checkInvariants(m, p);
  });

  it('includes due spaced reviews, most overdue first', () => {
    const p: Record<string, MasteryRecord> = {};
    for (const s of skills) p[s.id] = rec('mastered', { nextReview: NOW + 5 * DAY_MS });
    p['mat.add.10'].nextReview = NOW - DAY_MS;
    p['mat.count.20'].nextReview = NOW - 3 * DAY_MS;
    p['mat.sub.10'].nextReview = NOW - 2 * DAY_MS;
    const m = planMission(skills, p, { now: NOW });
    const reviews = m.steps.filter((s) => s.kind === 'review').map((s) => s.skillId);
    expect(reviews).toEqual(['mat.count.20', 'mat.sub.10']);
  });

  it('schedules a mastery check for a ready skill', () => {
    const p: Record<string, MasteryRecord> = {
      'mat.count.10': rec('practised', { pMastery: 0.92, attempts: 8 }),
    };
    const m = planMission(skills, p, { now: NOW });
    expect(m.steps.find((s) => s.kind === 'check')?.skillId).toBe('mat.count.10');
  });

  it('includes 1–2 learning/practised skills', () => {
    const p: Record<string, MasteryRecord> = {
      'mat.count.10': rec('mastered'),
      'mat.numrec.10': rec('mastered'),
      'mat.add.10': rec('learning'),
      'mat.compare.10': rec('learning'),
      'mat.count.20': rec('practised', { pMastery: 0.75 }),
    };
    const m = planMission(skills, p, { now: NOW });
    const practice = m.steps.filter((s) => s.kind === 'practice').map((s) => s.skillId);
    expect(practice.sort()).toEqual(['mat.add.10', 'mat.compare.10']);
  });

  it('respects the time budget and invariants on random progress maps', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = randomProgress(seed);
      for (const minutes of [5, 10, 15]) checkInvariants(planMission(skills, p, { now: NOW, minutes }), p, minutes);
    }
  });

  it('fills about 10 minutes when there is enough to do', () => {
    const p: Record<string, MasteryRecord> = {};
    for (const s of skills) p[s.id] = rec(s.grade === 0 ? 'mastered' : 'gap', { nextReview: NOW - DAY_MS });
    p['mat.count.20'] = rec('learning');
    p['mat.count.100'] = rec('learning');
    const m = planMission(skills, p, { now: NOW });
    expect(m.estimatedSeconds).toBeGreaterThan(8 * 60);
    expect(m.estimatedSeconds).toBeLessThanOrEqual(10 * 60);
  });

  it('is deterministic with a fixed now and does not mutate progress', () => {
    const p = randomProgress(7);
    const snapshot = JSON.stringify(p);
    const a = planMission(skills, p, { now: NOW });
    const b = planMission(skills, JSON.parse(snapshot), { now: NOW });
    expect(a).toEqual(b);
    expect(JSON.stringify(p)).toBe(snapshot);
  });

  it('respects the ceiling for never-seen skills', () => {
    const p: Record<string, MasteryRecord> = {};
    for (const s of skills) if (s.grade <= 1) p[s.id] = rec('mastered');
    expect(planMission(skills, p, { now: NOW, ceiling: { grade: 1, semester: 2 } }).steps.some((s) => s.kind === 'new')).toBe(false);
    expect(planMission(skills, p, { now: NOW }).steps.find((s) => s.kind === 'new')?.skillId).toMatch(/\.100$/);
  });
});
