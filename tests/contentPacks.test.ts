/**
 * Content packs (docs/ENGINE.md "Content packs"): the always-loaded skill index + lazy packs per
 * subject × grade band. These tests check that splitting loses nothing and that each pack, loaded on its
 * own, brings every generator its skills need.
 */
import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { buildPacks } from '../scripts/contentPacksPlugin';
import { gradeBand, packIdOf } from '../src/engine/content/packIds';
import { PACK_IDS, packsFor, packsForSkills } from '../src/engine/content/packs';
import { getAllSkills, getExplanation, getItemsForSkill, isPackLoaded, packOfSkill } from '../src/engine/content/registry';
import { profilePacks } from '../src/learner/prefetch';
import type { Skill } from '../src/engine/types';

const CONTENT = join(__dirname, '..', 'content');
const LEARN_SUBJECTS = ['mat', 'rom', 'eng', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim'] as const;

const skills = getAllSkills();
const split = buildPacks(CONTENT);

describe('pack ids', () => {
  it('bands: 0–IV primary, V–VIII gimnaziu', () => {
    expect([0, 4, 5, 8].map(gradeBand)).toEqual(['p', 'p', 'g', 'g']);
    expect(packIdOf('mat', 1)).toBe('mat-p');
    expect(packIdOf('chim', 7)).toBe('chim-g');
  });

  it('every skill has a pack module, and every pack module has skills', () => {
    const needed = new Set(skills.map(packOfSkill));
    expect([...needed].sort()).toEqual([...PACK_IDS]);
    expect([...split.byPack.keys()].sort()).toEqual([...PACK_IDS]);
  });

  it('the test setup loaded every pack', () => {
    for (const id of PACK_IDS) expect(isPackLoaded(id)).toBe(true);
  });
});

describe('pack split loses nothing', () => {
  it('every item lands in exactly its skill’s pack', () => {
    const skillPack = new Map(skills.map((s) => [s.id, packOfSkill(s)]));
    let total = 0;
    for (const [packId, data] of split.byPack) {
      for (const it of data.items as { skillId: string }[]) {
        expect(skillPack.get(it.skillId), it.skillId).toBe(packId);
        total += 1;
      }
    }
    const registered = skills.reduce((n, s) => n + getItemsForSkill(s.id).length, 0);
    expect(total).toBe(registered);
    expect(total).toBeGreaterThan(0);
  });

  it('every explanation a skill (or one of its items) references is in that skill’s pack', () => {
    for (const s of skills) {
      const pack = split.byPack.get(packOfSkill(s))!;
      const ids = new Set((pack.explanations as { id: string }[]).map((e) => e.id));
      for (const e of s.explanations) expect(ids.has(e), `${s.id} -> ${e}`).toBe(true);
      for (const it of getItemsForSkill(s.id)) if (it.explanationId) expect(ids.has(it.explanationId), it.id).toBe(true);
      for (const e of s.explanations) expect(getExplanation(e)).toBeDefined();
    }
  });

  it('every pack stays well under the 1 MB per subject-grade budget (docs/PLAN.md §10)', () => {
    for (const [packId, data] of split.byPack) expect(JSON.stringify(data).length, packId).toBeLessThan(600 * 1024);
  });

  it('a skill with only bank sources has items (skillHasItems trusts the declaration before its pack loads)', () => {
    for (const s of skills) {
      if (s.itemSources.some((x) => 'generator' in x)) continue;
      expect(getItemsForSkill(s.id).length, s.id).toBeGreaterThan(0);
    }
  });
});

describe('each pack alone registers the generators its skills use', () => {
  for (const packId of PACK_IDS) {
    it(packId, async () => {
      vi.resetModules();
      await import(`../src/engine/content/packs/${packId}.ts`);
      const { listGenerators } = await import('../src/engine/items/generators/registry');
      const have = new Set(listGenerators());
      const need = skills
        .filter((s) => packOfSkill(s) === packId)
        .flatMap((s) => s.itemSources.flatMap((x) => ('generator' in x ? [x.generator] : [])));
      for (const g of new Set(need)) expect(have.has(g), `${packId} needs ${g}`).toBe(true);
    });
  }
});

describe('what a child downloads', () => {
  it('a grade I child gets primary packs only', () => {
    const ids = profilePacks(1, LEARN_SUBJECTS);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.endsWith('-p'))).toBe(true);
    expect(ids).toContain('mat-p');
    expect(ids).not.toContain('chim-g');
  });

  it('a grade VIII child gets primary and gimnaziu packs (a level check can walk down)', () => {
    const ids = profilePacks(8, LEARN_SUBJECTS);
    expect(ids).toEqual(expect.arrayContaining(['mat-p', 'mat-g', 'chim-g']));
    // download order: math first, the child's own band before the earlier one
    expect(ids.slice(0, 4)).toEqual(['mat-g', 'mat-p', 'rom-g', 'rom-p']);
  });

  it('packsFor / packsForSkills', () => {
    expect(packsFor({ subjects: ['mat'], maxGrade: 3 })).toEqual(['mat-p']);
    expect(packsFor({ subjects: ['mat'] })).toEqual(['mat-g', 'mat-p']);
    const geo = skills.find((s: Skill) => s.subject === 'geo' && s.grade >= 5)!;
    expect(packsForSkills([geo.id, 'nope', undefined])).toEqual(['geo-g']);
  });

  it('cross-subject prerequisites resolve from the index alone', () => {
    const byId = new Map(skills.map((s) => [s.id, s]));
    const cross = skills.filter((s) => s.prerequisites.some((p) => byId.get(p)?.subject !== s.subject));
    for (const s of cross) for (const p of s.prerequisites) expect(byId.has(p), `${s.id} -> ${p}`).toBe(true);
  });
});
