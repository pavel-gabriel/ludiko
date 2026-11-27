/**
 * Lazy content packs (docs/ENGINE.md "Content packs", docs/PLAN.md §10).
 *
 * Each pack (`./packs/<packId>.ts`, e.g. `mat-p`) is its own code-split chunk group: the subject × grade
 * band's static items and explanations plus the generators (and their datasets) its skills use. The async
 * boundary lives here; everything downstream (`generateItems`, `getItemsForSkill`, `getExplanation`) stays
 * synchronous over the packs already loaded.
 */
import type { Grade, Skill, SubjectId } from '../types';
import { getAllSkills, getSkill, isPackLoaded, packOfSkill, registerPack, type PackData } from './registry';

const loaders = import.meta.glob<{ default: PackData }>('./packs/*.ts');

const loaderById = new Map(
  Object.entries(loaders).map(([file, load]) => [file.replace(/^.*\/([^/]+)\.ts$/, '$1'), load]),
);

/** Every pack that exists (sorted) */
export const PACK_IDS: readonly string[] = [...loaderById.keys()].sort();

const inFlight = new Map<string, Promise<void>>();

function loadPack(id: string): Promise<void> {
  if (isPackLoaded(id)) return Promise.resolve();
  const load = loaderById.get(id);
  if (!load) return Promise.resolve(); // a subject × band without a pack has nothing to load
  let p = inFlight.get(id);
  if (!p) {
    p = load().then(
      (mod) => {
        registerPack(id, mod.default);
        inFlight.delete(id);
      },
      (err: unknown) => {
        inFlight.delete(id); // allow a retry (e.g. back online)
        throw err;
      },
    );
    inFlight.set(id, p);
  }
  return p;
}

/** All `ids` are loaded */
export function packsLoaded(ids: readonly string[]): boolean {
  return ids.every((id) => isPackLoaded(id) || !loaderById.has(id));
}

/** Load the packs (in parallel); resolves at once when they are already in memory */
export async function ensurePacks(ids: readonly string[]): Promise<void> {
  const todo = [...new Set(ids)].filter((id) => !isPackLoaded(id));
  if (todo.length) await Promise.all(todo.map(loadPack));
}

/** Packs for these skills (unknown ids are ignored) */
export function packsForSkills(skills: readonly (string | Skill | undefined)[]): string[] {
  const out = new Set<string>();
  for (const s of skills) {
    const skill = typeof s === 'string' ? getSkill(s) : s;
    if (skill) out.add(packOfSkill(skill));
  }
  return [...out];
}

/**
 * Packs for the skills of `subjects` (all when omitted) up to `maxGrade` (inclusive; all grades when
 * omitted). A grade I child gets only the primary packs; a grade VIII child primary + gimnaziu, since a
 * level check can walk down to earlier grades.
 */
export function packsFor(opts: { subjects?: readonly SubjectId[]; maxGrade?: number } = {}): string[] {
  const out = new Set<string>();
  for (const s of getAllSkills()) {
    if (opts.subjects && !opts.subjects.includes(s.subject)) continue;
    if (opts.maxGrade !== undefined && s.grade > opts.maxGrade) continue;
    out.add(packOfSkill(s));
  }
  return [...out].sort();
}

/** Load what these skills need to produce items and explanations */
export function ensureContentForSkills(skills: readonly (string | Skill | undefined)[]): Promise<void> {
  return ensurePacks(packsForSkills(skills));
}

/** Load a subject's packs up to a grade (see `packsFor`) */
export function ensureContent(subject: SubjectId, maxGrade?: Grade | number): Promise<void> {
  return ensurePacks(packsFor({ subjects: [subject], maxGrade }));
}

/**
 * Background download of packs (one at a time, so the child's current screen keeps the bandwidth).
 * The service worker runtime-caches them (CacheFirst), so they work offline afterwards. Never throws.
 */
export function prefetchPacks(ids: readonly string[]): Promise<void> {
  const todo = ids.filter((id) => !isPackLoaded(id));
  return todo.reduce<Promise<void>>((chain, id) => chain.then(() => loadPack(id).catch(() => undefined)), Promise.resolve());
}
