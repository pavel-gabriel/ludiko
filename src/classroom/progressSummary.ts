/**
 * The skill-state summary a linked device shares with its class (docs/CLASSROOM.md §2).
 * Pure: builds the document from local progress. ONLY these fields leave the device:
 * per subject the placement level, the missing-skill count and the state of each skill that has one;
 * plus the number of play days this week and `updatedAt`. No nickname, avatar, recovery code,
 * item-level answers or finer timestamps.
 */
import { getSkill } from '@/engine/content/registry'
import type { SubjectId } from '@/engine/types'
import { lastDays } from '@/learner/time'
import { toDayString } from '@/profiles/profileService'
import type { ProfileProgress } from '@/profiles/types'
import { CLASS_SUBJECTS, type SeatProgressDoc, type SubjectProgress } from './types'

export function buildClassProgress(progress: ProfileProgress, now: number): SeatProgressDoc {
  const subjects: Partial<Record<SubjectId, SubjectProgress>> = {}
  const entry = (subject: SubjectId): SubjectProgress => (subjects[subject] ??= { skills: {} })

  for (const [skillId, rec] of Object.entries(progress.skills)) {
    const skill = getSkill(skillId)
    if (!skill || !CLASS_SUBJECTS.includes(skill.subject)) continue
    if (rec.state === 'unknown') continue // absent = unknown
    entry(skill.subject).skills[skillId] = rec.state
  }

  for (const [subject, placement] of Object.entries(progress.placements ?? {}) as [SubjectId, NonNullable<ProfileProgress['placements']>[SubjectId]][]) {
    if (!placement || placement.completedAt === undefined || !placement.summary) continue
    if (!CLASS_SUBJECTS.includes(subject)) continue
    const e = entry(subject)
    e.level = { grade: placement.summary.level.grade, semester: placement.summary.level.semester }
    e.missingCount = placement.summary.missingCount
  }

  const week = new Set(lastDays(now, 7, toDayString))
  return {
    subjects,
    playDaysThisWeek: progress.playDays.filter((d) => week.has(d)).length,
    updatedAt: now,
  }
}
