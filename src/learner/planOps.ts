/**
 * Daily plan composition across subjects (docs/NOTIFICATIONS.md §1). Pure given (progress, profile,
 * stored plan, now), apart from storing missions through `ensureMission` like getTodayMission does.
 *
 *   Bit 1  Matematică
 *   Bit 2  Limba română
 *   Bit 3  a subject from the child's other available ones (eng, stiinte, logic, ist, geo, civ, bio, fiz, chim), rotating by day
 *
 * A subject's bit is a slice of its stored mission (deriveBits), or, when its placement is not finished,
 * a short chunk of the placement, so the plan both checks and practises.
 */
import { getSkillsBySubject } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import { toDayString } from '@/profiles/profileService';
import type { ChildProfile, ProfileProgress } from '@/profiles/types';
import { isSubjectAvailable, isSubjectCurrent } from './availability';
import { deriveBits } from './bitOps';
import { PLAN_CHECK_ITEMS, type PlanBit, type TodayPlan } from './contract';
import { ensureMission } from './missionOps';
import { placementLevelFor, placementProbeCount } from './placementOps';
import type { StoredPlan, StoredPlanBit } from './planStore';
import { DAY_MS } from './time';

/** The subjects that always take bit 1 and bit 2, in order */
export const PLAN_CORE_SUBJECTS: readonly SubjectId[] = ['mat', 'rom'];
/** Candidates for the rotating bit 3 */
export const PLAN_ROTATING_SUBJECTS: readonly SubjectId[] = ['eng', 'stiinte', 'logic', 'ist', 'geo', 'civ', 'bio', 'fiz', 'chim'];
/** A placement chunk is this many probes (~3 items each, about 3 minutes) */
export const PLAN_CHECK_PROBES = 2;

/** Whole days since 1970-01-01 of a YYYY-MM-DD local day: a stable number to rotate by */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

const placementDone = (progress: ProfileProgress, subject: SubjectId) =>
  progress.placements?.[subject]?.completedAt !== undefined;

/** One stored choice for `subject`, or undefined when the subject offers nothing today */
function chooseBit(
  progress: ProfileProgress,
  profile: ChildProfile,
  subject: SubjectId,
  day: string,
  now: number,
): StoredPlanBit | undefined {
  if (!isSubjectAvailable(subject, profile.grade)) return undefined;
  if (!placementDone(progress, subject)) {
    if (!placementLevelFor(profile, subject, now)) return undefined; // nothing to check at this level
    return { subject, source: 'placement', baseProbes: placementProbeCount(progress.placements?.[subject]) };
  }
  const bits = deriveBits(ensureMission(progress, profile, subject, now));
  if (bits.length === 0) return undefined;
  // rotate through the bits still to do, so new material, reviews and checks all get their turn
  const pool = bits.filter((b) => !b.done);
  const from = pool.length ? pool : bits;
  return { subject, source: 'mission', bitIndex: from[dayNumber(day) % from.length].index };
}

/** A subject "has work" when its placement is still to do, or it has gaps or reviews due */
function hasWork(progress: ProfileProgress, subject: SubjectId, now: number): boolean {
  if (!placementDone(progress, subject)) return true;
  return getSkillsBySubject(subject).some((s) => {
    const rec = progress.skills[s.id];
    return !!rec && (rec.state === 'gap' || (rec.nextReview !== undefined && rec.nextReview <= now));
  });
}

/** The rotating subjects in the order they should be tried today */
export function rotatingOrder(progress: ProfileProgress, profile: ChildProfile, day: string, now: number): SubjectId[] {
  const available = PLAN_ROTATING_SUBJECTS.filter((s) => isSubjectCurrent(s, profile.grade));
  const busy = available.filter((s) => hasWork(progress, s, now));
  const pool = busy.length ? busy : available;
  if (pool.length === 0) return [];
  const start = dayNumber(day) % pool.length;
  return [...pool.slice(start), ...pool.slice(0, start)];
}

export function composePlan(progress: ProfileProgress, profile: ChildProfile, now: number): StoredPlan {
  const day = toDayString(now);
  const bits: StoredPlanBit[] = [];
  for (const subject of PLAN_CORE_SUBJECTS) {
    const bit = chooseBit(progress, profile, subject, day, now);
    if (bit) bits.push(bit);
  }
  for (const subject of rotatingOrder(progress, profile, day, now)) {
    const bit = chooseBit(progress, profile, subject, day, now);
    if (bit) {
      bits.push(bit);
      break;
    }
  }
  return { day, bits };
}

/** Turn stored choices into bits with their live `done` state; choices that no longer apply are dropped. */
function expand(progress: ProfileProgress, profile: ChildProfile, stored: StoredPlan, now: number): PlanBit[] {
  const out: PlanBit[] = [];
  for (const choice of stored.bits) {
    if (!isSubjectAvailable(choice.subject, profile.grade)) continue;
    const index = out.length;
    if (choice.source === 'mission') {
      const bits = deriveBits(ensureMission(progress, profile, choice.subject, now));
      const bit = bits.find((b) => b.index === choice.bitIndex);
      if (bit) out.push({ ...bit, index, subject: choice.subject, source: 'mission', bitIndex: bit.index });
    } else {
      const rec = progress.placements?.[choice.subject];
      const done =
        placementDone(progress, choice.subject) || placementProbeCount(rec) >= (choice.baseProbes ?? 0) + PLAN_CHECK_PROBES;
      out.push({
        index,
        kind: 'island',
        day: stored.day,
        steps: [],
        itemCount: PLAN_CHECK_ITEMS,
        done,
        subject: choice.subject,
        source: 'placement',
      });
    }
  }
  return out;
}

/**
 * Today's plan: the stored one when it is for today, else a new one. `composed` is set when the caller must
 * store it (a new composition).
 */
export function resolvePlan(
  progress: ProfileProgress,
  profile: ChildProfile,
  stored: StoredPlan | undefined,
  now: number,
): { plan: TodayPlan; composed?: StoredPlan } {
  const day = toDayString(now);
  const base = stored && stored.day === day ? stored : undefined;
  const choice = base ?? composePlan(progress, profile, now);
  return { plan: { day, bits: expand(progress, profile, choice, now) }, composed: base ? undefined : choice };
}
