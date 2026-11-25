/**
 * Implementation of the LearnerService contract (src/learner/contract.ts).
 *
 * Persistence is IndexedDB via src/profiles (offline, no Firebase); every write is a serialised
 * read-modify-write through `updateProgress`. Time comes from `Date.now()` unless the contract
 * method takes `now`.
 */
import { applyMasteryCheck as engineMasteryCheck } from '@/engine/mastery';
import { getSkill } from '@/engine/content/registry';
import type { SubjectId } from '@/engine/types';
import {
  applyAttemptCounters,
  getProfile,
  getProgress,
  markPlayDay,
  toDayString,
  updateProgress,
} from '@/profiles/profileService';
import type { ChildProfile } from '@/profiles/types';
import type { LearnerService, Mission } from './contract';
import { masteryAfterItem, stampStateChange, withPrior } from './masteryOps';
import { findMission, planDay, storeMission } from './missionOps';
import { advancePlacement, recordPlacementProbe } from './placementOps';
import { buildParentSummary, buildSkillMap } from './readModels';
import { schoolSemester } from './time';

async function requireProfile(profileId: string): Promise<ChildProfile> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error(`profile not found: ${profileId}`);
  return profile;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const learnerService: LearnerService = {
  schoolSemester,

  async recordItemResult(profileId, item, result, meta) {
    const now = Date.now();
    await updateProgress(profileId, (progress) => {
      markPlayDay(progress, now);
      // Mastery checks: applyMasteryCheck owns attempts/correct/mastery for the whole check,
      // so per-item calls in 'check' mode only keep the play-day streak (no double counting).
      if (meta.mode === 'check') return;
      if (meta.retry || meta.mode === 'placement') {
        // counts as an attempt, but must not move pMastery
        applyAttemptCounters(progress, item.skillId, result.correct, now);
        return;
      }
      progress.skills[item.skillId] = masteryAfterItem(progress.skills[item.skillId], item, result.correct, now);
    });
  },

  async applyMasteryCheck(profileId, skillId, results, itemType) {
    const skill = getSkill(skillId);
    if (!skill) throw new Error(`unknown skill: ${skillId}`);
    const now = Date.now();
    return updateProgress(profileId, (progress) => {
      markPlayDay(progress, now);
      const prev = progress.skills[skillId];
      const { record, passed } = engineMasteryCheck(withPrior(prev), results, skill.masteryCheck, { itemType, now });
      const next = stampStateChange(prev, record, now);
      if (passed) delete next.checkFailedAt;
      else next.checkFailedAt = now;
      progress.skills[skillId] = next;
      return { passed };
    });
  },

  /* --- placement --- */

  async getPlacement(profileId, subject) {
    const rec = (await getProgress(profileId)).placements?.[subject];
    return rec ? clone(rec) : undefined;
  },

  async placementNext(profileId, subject, now = Date.now()) {
    const profile = await requireProfile(profileId);
    return updateProgress(profileId, (progress) => advancePlacement(progress, profile, subject, now));
  },

  async placementRecord(profileId, subject, skillId, results) {
    const now = Date.now();
    await updateProgress(profileId, (progress) => recordPlacementProbe(progress, subject, skillId, results, now));
  },

  async resetPlacement(profileId, subject) {
    await updateProgress(profileId, (progress) => {
      if (progress.placements) delete progress.placements[subject]; // level history stays
    });
  },

  /* --- missions --- */

  async getTodayMission(profileId, subject, now = Date.now()) {
    const profile = await requireProfile(profileId);
    return updateProgress(profileId, (progress): Mission | undefined => {
      if (progress.placements?.[subject]?.completedAt === undefined) return undefined;
      const day = toDayString(now);
      const stored = findMission(progress, subject, day);
      if (stored) return clone(stored);
      const mission = planDay(progress, profile, subject, now);
      storeMission(progress, mission);
      return clone(mission);
    });
  },

  async completeMissionStep(profileId, subject: SubjectId, day, stepIndex, accuracy) {
    return updateProgress(profileId, (progress) => {
      const mission = findMission(progress, subject, day);
      if (!mission) throw new Error(`no ${subject} mission for ${day}`);
      const step = mission.steps[stepIndex];
      if (!step) throw new Error(`mission step ${stepIndex} does not exist`);
      step.done = true;
      step.accuracy = Math.min(1, Math.max(0, Number.isFinite(accuracy) ? accuracy : 0));
      if (mission.completedAt === undefined && mission.steps.every((s) => s.done)) mission.completedAt = Date.now();
      return clone(mission);
    });
  },

  /* --- read models --- */

  async getSkillMap(profileId, subject, now = Date.now()) {
    return buildSkillMap(await getProgress(profileId), subject, now);
  },

  async getLevelHistory(profileId, subject) {
    return clone((await getProgress(profileId)).levelHistory?.[subject] ?? []);
  },

  async getParentSummary(profileId, now = Date.now()) {
    const profile = await requireProfile(profileId);
    return buildParentSummary(await getProgress(profileId), profile, now);
  },
};
