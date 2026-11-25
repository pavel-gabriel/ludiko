/** Daily mission planning on top of the engine planner. Pure given (progress, profile, now). */
import { DEFAULT_MASTERY_CONFIG, type ProgressMap } from '@/engine/mastery';
import { levelKey } from '@/engine/diagnostic';
import { planMission } from '@/engine/planner';
import { getSkillsBySubject } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import { toDayString } from '@/profiles/profileService';
import { MISSIONS_KEPT, type ChildProfile, type ProfileProgress } from '@/profiles/types';
import type { Level, Mission } from './contract';
import { DAY_MS, currentLevel, nextLevel } from './time';

/** After a failed mastery check the skill is not offered for another check for this long */
export const CHECK_COOLDOWN_MS = 2 * DAY_MS;

/**
 * Progress as the planner should see it: a skill whose mastery check failed less than 2 days ago
 * is hidden from the check step by capping `attempts` below `minAttemptsForCheck` on a COPY
 * (the planner has no hook for this). It still counts as practised, so it is planned as practice.
 */
export function plannerProgress(progress: ProfileProgress, now: number): ProgressMap {
  const map: ProgressMap = {};
  const cap = DEFAULT_MASTERY_CONFIG.minAttemptsForCheck - 1;
  for (const [id, rec] of Object.entries(progress.skills)) {
    const cooling = rec.checkFailedAt !== undefined && now >= rec.checkFailedAt && now - rec.checkFailedAt < CHECK_COOLDOWN_MS;
    map[id] = cooling ? { ...rec, attempts: Math.min(rec.attempts, cap) } : rec;
  }
  return map;
}

/**
 * Ceiling for never-seen skills: one semester above the child's current class level (declared
 * grade + school-calendar semester, or the placement target if that is higher). Gaps are always
 * eligible regardless. The +1 lets a child who has caught up move ahead gently instead of
 * running out of new material; it never pulls in a whole year.
 */
export function missionCeiling(profile: ChildProfile, placementTarget: Level | undefined, now: number): Level {
  const current = currentLevel(profile.grade, now);
  const base = placementTarget && levelKey(placementTarget) > levelKey(current) ? placementTarget : current;
  return nextLevel(base);
}

/** Plan (without storing) the mission for `now`. */
export function planDay(
  progress: ProfileProgress,
  profile: ChildProfile,
  subject: SubjectId,
  now: number,
): Mission {
  const planned = planMission(getSkillsBySubject(subject), plannerProgress(progress, now), {
    now,
    subject,
    ceiling: missionCeiling(profile, progress.placements?.[subject]?.target, now),
  });
  return {
    day: toDayString(now),
    subject,
    steps: planned.steps.map((s) => ({ kind: s.kind, skillId: s.skillId, itemCount: s.itemCount, done: false })),
    estimatedSeconds: planned.estimatedSeconds,
  };
}

export function findMission(progress: ProfileProgress, subject: SubjectId, day: string): Mission | undefined {
  return progress.missions?.find((m) => m.subject === subject && m.day === day);
}

/** Append a mission, keeping only the last MISSIONS_KEPT. */
export function storeMission(progress: ProfileProgress, mission: Mission): void {
  progress.missions = [...(progress.missions ?? []), mission].slice(-MISSIONS_KEPT);
}
