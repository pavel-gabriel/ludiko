/**
 * Milestones that unlock the extra mascot looks and the extra album stickers. They are earned only by
 * learning (a first mastered island, play days, finished level checks), never bought, and nothing is taken
 * away: milestones are derived from progress that only grows. Pure; no storage here.
 */
import { getAllSkills } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import type { ChildProfile, ProfileProgress } from '@/profiles/types';
import { availableSubjects } from './availability';

export type MilestoneId = `island:${SubjectId}` | 'days7' | 'checksAll';

export const DAYS_MILESTONE = 7;

/** Subjects that have content at all, in a stable order */
function contentSubjects(): SubjectId[] {
  return [...new Set(getAllSkills().map((s) => s.subject))].sort();
}

/** Milestones the child has reached so far */
export function earnedMilestones(
  progress: Pick<ProfileProgress, 'skills' | 'playDays' | 'placements'>,
  profile: Pick<ChildProfile, 'grade'> | undefined,
): MilestoneId[] {
  const out: MilestoneId[] = [];
  const subjectOf = new Map(getAllSkills().map((s) => [s.id, s.subject] as const));
  const islandSubjects = new Set<SubjectId>();
  for (const [id, rec] of Object.entries(progress.skills)) {
    const subject = subjectOf.get(id);
    if (subject && rec.state === 'mastered') islandSubjects.add(subject);
  }
  for (const subject of contentSubjects()) if (islandSubjects.has(subject)) out.push(`island:${subject}`);
  if (new Set(progress.playDays).size >= DAYS_MILESTONE) out.push('days7');
  // without a known grade nobody can tell which checks are expected, so this one waits
  const subjects = profile ? availableSubjects(contentSubjects(), profile.grade) : [];
  if (subjects.length > 0 && subjects.every((s) => progress.placements?.[s]?.completedAt !== undefined)) out.push('checksAll');
  return out;
}

/* ---------------- mascot looks ---------------- */

export type LookId = 'classic' | 'mint' | 'sky' | 'sunny' | 'scarf' | 'cap' | 'glasses' | 'crown';

export interface LookDef {
  id: LookId;
  /** Milestone that unlocks it; none = always available */
  unlock?: MilestoneId;
}

export const MASCOT_LOOKS: readonly LookDef[] = [
  { id: 'classic' },
  { id: 'mint', unlock: 'island:mat' },
  { id: 'sky', unlock: 'island:rom' },
  { id: 'sunny', unlock: 'island:eng' },
  { id: 'scarf', unlock: 'island:stiinte' },
  { id: 'cap', unlock: 'island:logic' },
  { id: 'glasses', unlock: 'days7' },
  { id: 'crown', unlock: 'checksAll' },
];

export const DEFAULT_LOOK: LookId = 'classic';

export function isLookId(v: unknown): v is LookId {
  return typeof v === 'string' && MASCOT_LOOKS.some((l) => l.id === v);
}

export function lookUnlocked(look: LookDef, earned: readonly MilestoneId[]): boolean {
  return !look.unlock || earned.includes(look.unlock);
}

/** Looks the child may pick now, in display order */
export function unlockedLooks(earned: readonly MilestoneId[]): LookId[] {
  return MASCOT_LOOKS.filter((l) => lookUnlocked(l, earned)).map((l) => l.id);
}

/* ---------------- extra album stickers ---------------- */

/** Every milestone has a special album sticker; its id is `extra:<milestone>` */
export const extraStickerId = (m: MilestoneId) => `extra:${m}`;

/** Parse "extra:island:mat" / "extra:days7" back to a milestone; undefined if not a valid one */
export function parseExtraSticker(id: string): MilestoneId | undefined {
  if (!id.startsWith('extra:')) return undefined;
  const m = id.slice('extra:'.length);
  if (m === 'days7' || m === 'checksAll') return m;
  if (m.startsWith('island:') && contentSubjects().includes(m.slice('island:'.length) as SubjectId)) return m as MilestoneId;
  return undefined;
}

export function extraStickersFor(earned: readonly MilestoneId[]): string[] {
  return earned.map(extraStickerId);
}
