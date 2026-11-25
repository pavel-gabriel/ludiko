import { describe, expect, it } from 'vitest';
import { mathSkills } from './helpers/engineSim';
import { simulate } from './helpers/learner';

/**
 * End-to-end: placement → seeded progress → daily planMission → simulated answers → updateMastery.
 * The simulated learner (grade II, knows only grade 0) learns a skill with probability pLearn per
 * item once its prerequisites are known, slips/guesses as configured.
 */
describe('learning loop simulation', () => {
  const skills = mathSkills();
  const grade0 = () => new Set(skills.filter((s) => s.grade === 0).map((s) => s.id));

  it('closes gaps for a typical learner (pLearn 0.2/item, slip 8%) within 40 sessions', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = simulate(skills, { seed, known: grade0() }, 40);
      expect(r.gapsAfterPlacement).toBeGreaterThanOrEqual(10);
      const final = r.gapHistory[r.gapHistory.length - 1];
      expect(final).toBeLessThan(r.gapHistory[0]);
      expect(final).toBe(0);
      expect(r.masteredHistory[r.masteredHistory.length - 1]).toBeGreaterThanOrEqual(16);
      for (const m of r.missions) expect(m.estimatedSeconds).toBeLessThanOrEqual(600);
    }
  });

  it('a slow learner (pLearn 0.04/item, slip 15%) still makes steady progress', () => {
    for (const seed of [1, 2, 3]) {
      const r = simulate(skills, { seed, known: grade0(), pLearn: 0.04, slip: 0.15 }, 60);
      const h = r.gapHistory;
      expect(h[30]).toBeLessThan(h[0]);
      expect(h[60]).toBeLessThanOrEqual(Math.floor(h[0] / 2));
    }
  });

  it('is fully deterministic for a given seed', () => {
    const a = simulate(skills, { seed: 42, known: grade0() }, 20);
    const b = simulate(skills, { seed: 42, known: grade0() }, 20);
    expect(a.gapHistory).toEqual(b.gapHistory);
    expect(a.missions).toEqual(b.missions);
  });
});
