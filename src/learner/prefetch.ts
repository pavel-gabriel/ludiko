/**
 * Background download of the active profile's content packs (docs/ENGINE.md "Content packs", PLAN §10).
 *
 * After the learner home has rendered, the packs of every subject the child can play, up to their grade,
 * are fetched one at a time when the browser is idle. The service worker runtime-caches them
 * (CacheFirst), so missions, checks and practice then work offline. A grade I child gets the primary
 * packs only; nothing above the child's grade is downloaded. Skipped when the user asked to save data.
 */
import { gradeBand } from '@/engine/content/packIds';
import { packsFor, prefetchPacks } from '@/engine/content/packs';
import type { SubjectId } from '@/engine/types';
import { availableSubjects } from './availability';

/**
 * Packs to keep ready for a child: their playable subjects, grades 0..grade. Order = download order:
 * subjects in the given order (math and Romanian first), the child's own grade band before the earlier one.
 */
export function profilePacks(grade: number, subjects: readonly SubjectId[]): string[] {
  const own = `-${gradeBand(grade)}`;
  return availableSubjects(subjects, grade).flatMap((subject) =>
    packsFor({ subjects: [subject], maxGrade: grade }).sort((a, b) => Number(b.endsWith(own)) - Number(a.endsWith(own))),
  );
}

const started = new Set<string>();

export function prefetchProfileContent(grade: number, subjects: readonly SubjectId[]): void {
  const ids = profilePacks(grade, subjects).filter((id) => !started.has(id));
  if (ids.length === 0) return;
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { connection?: { saveData?: boolean } }) : undefined;
  if (nav?.connection?.saveData) return;
  for (const id of ids) started.add(id);
  const run = () => void prefetchPacks(ids);
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 5000 });
  else setTimeout(run, 1500);
}
