/**
 * Class assignments as an extra bit on /learn ("Tema de la clasă", docs/CLASSROOM.md §4).
 * Pure: a teacher's assignment + the child's own skill states -> what the home screen shows.
 * "Done" needs no storage: an assignment is done when every assigned skill is practised or mastered.
 */
import { getSkill } from '@/engine/content/registry';
import type { SkillState } from '@/engine/types';
import type { AssignmentBit } from './contract';
import { DAY_MS } from './time';

/** The assignment fields the child needs (the Firestore document without its createdAt bookkeeping) */
export interface AssignmentInput {
  id: string;
  subject: AssignmentBit['subject'];
  skillIds: string[];
  title: string;
  dueDay: string;
}

/** Past-due assignments stay visible this many days so a late child can still finish them */
export const ASSIGNMENT_GRACE_DAYS = 14;

/** Whole local days from `now`'s day to `dueDay` (YYYY-MM-DD): 0 = today, negative = overdue. NaN for a bad date. */
export function daysUntil(dueDay: string, now: number): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDay);
  if (!m) return Number.NaN;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((due - today) / DAY_MS);
}

/** An assigned skill is done once it is practised or mastered */
export const isAssignedSkillDone = (state: SkillState | undefined): boolean => state === 'practised' || state === 'mastered';

export function deriveAssignmentBits(
  assignments: AssignmentInput[],
  stateOf: (skillId: string) => SkillState | undefined,
  now: number,
): AssignmentBit[] {
  const bits: AssignmentBit[] = [];
  for (const a of assignments) {
    const daysLeft = daysUntil(a.dueDay, now);
    if (Number.isNaN(daysLeft) || daysLeft < -ASSIGNMENT_GRACE_DAYS) continue;
    const skills = a.skillIds
      .filter((id) => getSkill(id)?.subject === a.subject)
      .map((skillId) => {
        const state = stateOf(skillId) ?? 'unknown';
        return { skillId, state, done: isAssignedSkillDone(state) };
      });
    if (skills.length === 0) continue;
    const doneCount = skills.filter((s) => s.done).length;
    const done = doneCount === skills.length;
    bits.push({
      kind: 'assignment',
      assignmentId: a.id,
      title: a.title,
      subject: a.subject,
      dueDay: a.dueDay,
      daysLeft,
      skills,
      doneCount,
      total: skills.length,
      done,
      overdue: !done && daysLeft < 0,
    });
  }
  // open first (soonest due first), finished ones last
  return bits.sort((a, b) => Number(a.done) - Number(b.done) || a.daysLeft - b.daysLeft || (a.assignmentId < b.assignmentId ? -1 : 1));
}
