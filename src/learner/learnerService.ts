/**
 * Implementation of the LearnerService contract (src/learner/contract.ts).
 * PLACEHOLDER — being implemented in Phase 1A wave 3. Do not call from tests without mocking '@/learner'.
 */
import type { LearnerService } from './contract';

const notYet = (name: string) => () => {
  throw new Error(`learnerService.${name} is not implemented yet`);
};

export const learnerService: LearnerService = {
  schoolSemester: notYet('schoolSemester'),
  recordItemResult: notYet('recordItemResult'),
  applyMasteryCheck: notYet('applyMasteryCheck'),
  getPlacement: notYet('getPlacement'),
  placementNext: notYet('placementNext'),
  placementRecord: notYet('placementRecord'),
  resetPlacement: notYet('resetPlacement'),
  getTodayMission: notYet('getTodayMission'),
  completeMissionStep: notYet('completeMissionStep'),
  getSkillMap: notYet('getSkillMap'),
  getLevelHistory: notYet('getLevelHistory'),
  getParentSummary: notYet('getParentSummary'),
} as LearnerService;
