/**
 * Content registry (docs/ENGINE.md "Content packs").
 *
 * - **Skill index** (always loaded): every skill of every subject and grade, from content/skills/**
 *   (Vite `import.meta.glob`, eager). Placement, planner, map and availability only need this, and
 *   cross-subject prerequisites (geo → mat, fiz → mat) resolve because the index has every skill.
 * - **Packs** (loaded on demand): static items and explanations per subject × grade band, registered by
 *   `registerPack` once `ensurePacks` (./packs.ts) has loaded them. Item/explanation lookups are
 *   synchronous over what is loaded; callers await `ensureContentForSkills` (or a `ContentGate`) first.
 *
 * Validation happens in CI (tests/contentValidation.test.ts), not at runtime.
 */
import type { Explanation, Grade, Item, Skill, SubjectId } from '../types';
import { packIdOf } from './packIds';

const skillFiles = import.meta.glob('../../../content/skills/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export interface PackData {
  items: Item[];
  explanations: Explanation[];
}

interface SkillIndex {
  skills: Skill[];
  skillsById: Map<string, Skill>;
}

let index: SkillIndex | null = null;
const itemsBySkill = new Map<string, Item[]>();
const explanationsById = new Map<string, Explanation>();
const loadedPacks = new Set<string>();

function skillIndex(): SkillIndex {
  if (!index) {
    const skills: Skill[] = [];
    for (const data of Object.values(skillFiles)) if (Array.isArray(data)) skills.push(...(data as Skill[]));
    index = { skills, skillsById: new Map(skills.map((s) => [s.id, s])) };
  }
  return index;
}

export function getAllSkills(): Skill[] {
  return skillIndex().skills;
}

export function getSkill(id: string): Skill | undefined {
  return skillIndex().skillsById.get(id);
}

export function getSkillsBySubject(subject: SubjectId, grade?: Grade): Skill[] {
  return skillIndex().skills.filter((s) => s.subject === subject && (grade === undefined || s.grade === grade));
}

/** The content pack holding a skill's items and explanations */
export function packOfSkill(skill: Pick<Skill, 'subject' | 'grade'>): string {
  return packIdOf(skill.subject, skill.grade);
}

/** Add a loaded pack's items and explanations (idempotent) */
export function registerPack(packId: string, data: PackData): void {
  if (loadedPacks.has(packId)) return;
  loadedPacks.add(packId);
  for (const it of data.items) {
    const list = itemsBySkill.get(it.skillId);
    if (list) list.push(it);
    else itemsBySkill.set(it.skillId, [it]);
  }
  for (const e of data.explanations) explanationsById.set(e.id, e);
}

export function isPackLoaded(packId: string): boolean {
  return loadedPacks.has(packId);
}

/** The skill's items and explanations are in memory (its pack is loaded) */
export function isSkillContentLoaded(skill: Pick<Skill, 'subject' | 'grade'>): boolean {
  return loadedPacks.has(packOfSkill(skill));
}

/**
 * Static (authored) items for a skill. Generated items come from the generators, not here.
 * Empty until the skill's pack is loaded (`ensureContentForSkills`).
 */
export function getItemsForSkill(skillId: string): Item[] {
  return itemsBySkill.get(skillId) ?? [];
}

/** Undefined until the pack of a skill using it is loaded */
export function getExplanation(id: string): Explanation | undefined {
  return explanationsById.get(id);
}
