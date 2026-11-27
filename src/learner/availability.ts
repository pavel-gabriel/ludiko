/**
 * Which subjects a child of a given grade can play. Derived from the content registry, never
 * hard-coded: a subject's minimum grade is the lowest grade of any of its skills (docs/PLAN.md §4).
 * A subject above the child's grade has nothing to check or practise yet, so the learner area shows it
 * as a "from grade N" teaser instead of a door that leads nowhere.
 */
import { getAllSkills } from '@/engine/content/registry';
import type { Grade, SubjectId } from '@/engine/types';

let minGrades: Map<SubjectId, Grade> | null = null;
let maxGrades: Map<SubjectId, Grade> | null = null;

function table(): Map<SubjectId, Grade> {
  if (!minGrades) {
    const map = new Map<SubjectId, Grade>();
    for (const s of getAllSkills()) {
      const seen = map.get(s.subject);
      if (seen === undefined || s.grade < seen) map.set(s.subject, s.grade);
    }
    minGrades = map;
  }
  return minGrades;
}

/** Lowest grade with content for `subject`; undefined when the subject has no skills at all */
export function subjectMinGrade(subject: SubjectId): Grade | undefined {
  return table().get(subject);
}

/** Content exists for `subject` at or below `grade` */
export function isSubjectAvailable(subject: SubjectId, grade: number): boolean {
  const min = subjectMinGrade(subject);
  return min !== undefined && min <= grade;
}

/** Highest grade with content for `subject`; undefined when the subject has no skills at all */
export function subjectMaxGrade(subject: SubjectId): Grade | undefined {
  if (!maxGrades) {
    const map = new Map<SubjectId, Grade>();
    for (const s of getAllSkills()) {
      const seen = map.get(s.subject);
      if (seen === undefined || s.grade > seen) map.set(s.subject, s.grade);
    }
    maxGrades = map;
  }
  return maxGrades.get(subject);
}

/**
 * The subject still has content at the child's grade. Primary-only subjects (e.g. Științe, which grades V–VIII
 * continue as Biologie/Fizică/Chimie) stay playable for older kids but leave the daily rotation.
 */
export function isSubjectCurrent(subject: SubjectId, grade: number): boolean {
  const max = subjectMaxGrade(subject);
  return isSubjectAvailable(subject, grade) && max !== undefined && max >= grade;
}

/** `subjects` that are playable at `grade`, in the given order */
export function availableSubjects(subjects: readonly SubjectId[], grade: number): SubjectId[] {
  return subjects.filter((s) => isSubjectAvailable(s, grade));
}

/** `subjects` that start above `grade` (teaser rows), with the grade they start at, lowest first */
export function lockedSubjects(subjects: readonly SubjectId[], grade: number): { subject: SubjectId; minGrade: Grade }[] {
  const out: { subject: SubjectId; minGrade: Grade }[] = [];
  for (const subject of subjects) {
    const minGrade = subjectMinGrade(subject);
    if (minGrade !== undefined && minGrade > grade) out.push({ subject, minGrade });
  }
  return out.sort((a, b) => a.minGrade - b.minGrade);
}
