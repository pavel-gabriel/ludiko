/**
 * Which subjects the "Hai să vedem ce știi" call to action tracks for a child (landing page and /learn):
 * subjects whose content continues at the child's grade (primary-only ones such as Științe leave for grade V+)
 * and that have something to check at the child's level right now. Same rule the daily plan uses, so the
 * card and the plan never disagree. Pure; reads only the content registry.
 */
import type { SubjectId } from '@/engine/types';
import type { ChildProfile, ProfileProgress } from '@/profiles/types';
import { isSubjectCurrent } from './availability';
import { placementLevelFor } from './placementOps';

export type CheckState = 'none' | 'inProgress' | 'done';

export function checkSubjects(profile: ChildProfile, subjects: readonly SubjectId[], now = Date.now()): SubjectId[] {
  return subjects.filter((s) => isSubjectCurrent(s, profile.grade) && placementLevelFor(profile, s, now) !== null);
}

export function checkStateOf(progress: Pick<ProfileProgress, 'placements'>, subject: SubjectId): CheckState {
  const rec = progress.placements?.[subject];
  return rec?.completedAt !== undefined ? 'done' : rec ? 'inProgress' : 'none';
}
