import { getSkillsBySubject } from '../../src/engine/content/registry';
import { createPlacement, nextProbe, recordProbe, type PlacementState } from '../../src/engine/diagnostic';
import type { Grade, Semester, Skill, SubjectId } from '../../src/engine/types';

export const mathSkills = (): Skill[] => getSkillsBySubject('mat');

/** Deterministic PRNG (mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A child "knows" a skill iff it is not missing and all its prerequisites are known. */
export function knowsFn(skills: Skill[], missing: Set<string>): (id: string) => boolean {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const memo = new Map<string, boolean>();
  const knows = (id: string): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const s = byId.get(id);
    const v = !!s && !missing.has(id) && s.prerequisites.every(knows);
    memo.set(id, v);
    return v;
  };
  return knows;
}

export function runPlacement(
  skills: Skill[],
  answer: (skillId: string, i: number) => boolean,
  opts: { grade: Grade; semester: Semester; subject?: SubjectId },
  maxProbes?: number,
): PlacementState {
  let st = createPlacement(skills, { ...opts, subject: opts.subject ?? 'mat' }, maxProbes ? { maxProbes } : {});
  for (let p = nextProbe(st), guard = 0; !p.done && guard < 100; p = nextProbe(st), guard++) {
    const results = Array.from({ length: p.itemsWanted }, (_, i) => answer(p.skillId, i));
    st = recordProbe(st, p.skillId, results);
  }
  return st;
}
