import { DAY_MS, DEFAULT_MASTERY_CONFIG, type MasteryConfig, type MasteryRecord } from '../mastery/types';
import type { PlacementResult } from './placement';

/**
 * Turn a placement into initial mastery records (merge into ProfileProgress.skills, keeping any
 * existing record that has real attempts).
 * - mastered (likely): p = 0.6 + 0.35·confidence; a spaced review comes soon to confirm it
 *   (1 day if confidence < 0.7, 3 days if < 0.9, else 7 days)
 * - gap: p = 0.05 + 0.1·(1 − confidence), no review
 * - unknown: no record (the planner treats it as never seen)
 */
export function progressFromPlacement(
  result: PlacementResult,
  now: number,
  cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): Record<string, MasteryRecord> {
  const out: Record<string, MasteryRecord> = {};
  const ladder = cfg.reviewLadderDays;
  for (const [id, s] of Object.entries(result.skillStates)) {
    if (s.state === 'mastered') {
      const step = Math.min(s.confidence < 0.7 ? 0 : s.confidence < 0.9 ? 1 : 2, ladder.length - 1);
      out[id] = {
        state: 'mastered',
        pMastery: Math.min(cfg.pCeil, 0.6 + 0.35 * s.confidence),
        attempts: 0,
        correct: 0,
        lastSeen: now,
        reviewStep: step,
        nextReview: now + ladder[step] * DAY_MS,
      };
    } else if (s.state === 'gap') {
      out[id] = {
        state: 'gap',
        pMastery: 0.05 + 0.1 * (1 - s.confidence),
        attempts: 0,
        correct: 0,
        lastSeen: now,
      };
    }
  }
  return out;
}
