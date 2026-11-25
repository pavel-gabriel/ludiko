import { describe, it, expect } from 'vitest';
import { getAllSkills, getExplanation } from '../src/engine/content/registry';
import type { Explanation, VisualSpec } from '../src/engine/types';

import grade0File from '../content/skills/mat/grade0.json';
import grade1File from '../content/skills/mat/grade1.json';
import grade2File from '../content/skills/mat/grade2.json';
/* Scope: the 18-skill grade 0-II seed graph (measures/III-IV explanations are tested by their own suites) */
const SEED_IDS = new Set([...grade0File, ...grade1File, ...grade2File].map((s: { id: string }) => s.id));
const mathSkills = getAllSkills().filter((s) => s.subject === 'mat' && SEED_IDS.has(s.id));

/** Numbers a visual "shows" (plus the small numbers that are implicit in it). */
function visualNumbers(v: VisualSpec | undefined): { nums: Set<number>; tens: Set<number>; ones: Set<number>; blocks: boolean } {
  const nums = new Set<number>();
  const tens = new Set<number>();
  const ones = new Set<number>();
  let blocks = false;
  if (!v) return { nums, tens, ones, blocks };
  if (v.kind === 'objects') {
    for (let i = 0; i <= v.count; i++) nums.add(i);
  } else if (v.kind === 'base10-blocks') {
    blocks = true;
    const h = v.hundreds ?? 0;
    const t = v.tens ?? 0;
    const o = v.ones ?? 0;
    [h, t, o, h * 100 + t * 10 + o, t * 10, h * 100].forEach((n) => nums.add(n));
    for (let i = 0; i <= 10; i++) nums.add(i);
    for (let i = 1; i <= t; i++) nums.add(i * 10);
    for (let i = 0; i <= o; i++) nums.add(t * 10 + i);
    tens.add(t);
    ones.add(o);
  } else if (v.kind === 'number-line') {
    for (const m of v.marks ?? []) nums.add(m);
    const ms = [...(v.marks ?? [])];
    for (const a of ms) for (const b of ms) nums.add(Math.abs(a - b));
    for (const j of v.jumps ?? []) {
      nums.add(j.from);
      nums.add(j.to);
      nums.add(Math.abs(j.to - j.from));
    }
  }
  return { nums, tens, ones, blocks };
}

/** Every number written in a frame must be visible in one of the explanation's visuals (heuristic). */
function mismatches(exp: Explanation): string[] {
  const problems: string[] = [];
  const seen = new Set<number>();
  /* tens digits of any blocks picture in the explanation (a two-digit number is "shown" as its tens + ones) */
  const seenTens = new Set<number>();
  exp.frames.forEach((f) => {
    const vn = visualNumbers(f.visual);
    vn.tens.forEach((n) => seenTens.add(n));
    vn.nums.forEach((n) => seen.add(n));
  });
  exp.frames.forEach((f, i) => {
    if (!f.visual || !['objects', 'base10-blocks', 'number-line'].includes(f.visual.kind)) return;
    const used = (f.text.ro.match(/\d+/g) ?? []).map(Number);
    for (const n of used) {
      const ok = seen.has(n) || (n >= 10 && n < 100 && seenTens.has(Math.floor(n / 10)));
      if (!ok) problems.push(`${exp.id} frame ${i + 1}: number ${n} in text is not in the visual`);
    }
  });
  return problems;
}

describe('math explanations, grades 0-II', () => {
  it('covers every math skill of grades 0-2', () => {
    expect(mathSkills.length).toBeGreaterThanOrEqual(18);
    const missing = mathSkills.filter((s) => s.explanations.length === 0).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it('references only existing explanations that point back at their skill', () => {
    for (const s of mathSkills) {
      for (const id of s.explanations) {
        const e = getExplanation(id);
        expect(e, `${s.id} -> ${id}`).toBeDefined();
        expect(e?.skillId).toBe(s.id);
      }
    }
  });

  it('has 3-4 frames, short Romanian text, ro+en, and a visual on every frame', () => {
    for (const s of mathSkills) {
      for (const id of s.explanations) {
        const e = getExplanation(id)!;
        expect(e.frames.length).toBeGreaterThanOrEqual(3);
        expect(e.frames.length).toBeLessThanOrEqual(4);
        for (const f of e.frames) {
          expect(f.visual, `${id} needs a visual`).toBeDefined();
          expect(f.text.ro.length).toBeGreaterThan(0);
          expect(f.text.en?.length ?? 0).toBeGreaterThan(0);
          expect(f.text.ro.split(/\s+/).length, `${id}: ${f.text.ro}`).toBeLessThanOrEqual(17);
        }
      }
    }
  });

  it('shows the numbers mentioned in the text in the frame visuals', () => {
    const problems = mathSkills.flatMap((s) => s.explanations.map((id) => getExplanation(id)!)).flatMap(mismatches);
    expect(problems).toEqual([]);
  });
});
