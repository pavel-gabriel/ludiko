/**
 * Content registry: loads every JSON file under content/{skills,items,explanations}/ at build time
 * (Vite `import.meta.glob`, eager) and exposes lookup helpers. Validation happens in CI
 * (tests/contentValidation.test.ts), not at runtime.
 */
import type { Explanation, Grade, Item, Skill, SubjectId } from '../types';

const modules = import.meta.glob('../../../content/{skills,items,explanations}/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

interface Registry {
  skills: Skill[];
  skillsById: Map<string, Skill>;
  itemsBySkill: Map<string, Item[]>;
  explanationsById: Map<string, Explanation>;
}

let cached: Registry | null = null;

function buildRegistry(files: Record<string, unknown>): Registry {
  const skills: Skill[] = [];
  const items: Item[] = [];
  const explanations: Explanation[] = [];
  for (const [path, data] of Object.entries(files)) {
    if (!Array.isArray(data)) continue;
    if (path.includes('/content/skills/')) skills.push(...(data as Skill[]));
    else if (path.includes('/content/items/')) items.push(...(data as Item[]));
    else if (path.includes('/content/explanations/')) explanations.push(...(data as Explanation[]));
  }
  const itemsBySkill = new Map<string, Item[]>();
  for (const it of items) {
    const list = itemsBySkill.get(it.skillId) ?? [];
    list.push(it);
    itemsBySkill.set(it.skillId, list);
  }
  return {
    skills,
    skillsById: new Map(skills.map((s) => [s.id, s])),
    itemsBySkill,
    explanationsById: new Map(explanations.map((e) => [e.id, e])),
  };
}

function registry(): Registry {
  return (cached ??= buildRegistry(modules));
}

export function getAllSkills(): Skill[] {
  return registry().skills;
}

export function getSkill(id: string): Skill | undefined {
  return registry().skillsById.get(id);
}

export function getSkillsBySubject(subject: SubjectId, grade?: Grade): Skill[] {
  return registry().skills.filter((s) => s.subject === subject && (grade === undefined || s.grade === grade));
}

/** Static (authored) items for a skill. Generated items come from the generators, not here. */
export function getItemsForSkill(skillId: string): Item[] {
  return registry().itemsBySkill.get(skillId) ?? [];
}

export function getExplanation(id: string): Explanation | undefined {
  return registry().explanationsById.get(id);
}
