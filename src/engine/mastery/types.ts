import type { SkillState } from '../types';

/**
 * Per-child, per-skill learning record used by the engine.
 *
 * Structurally compatible with `SkillProgress` in src/profiles/types.ts (the persisted shape):
 * every SkillProgress is a MasteryRecord and vice versa. `reviewStep` is an optional extra
 * (index into the review ladder); when absent it is derived from `nextReview - lastSeen`.
 */
export interface MasteryRecord {
  state: SkillState;
  /** P(skill is known), 0..1 (Bayesian Knowledge Tracing posterior) */
  pMastery: number;
  attempts: number;
  correct: number;
  /** epoch ms of the last answered item (0 = never) */
  lastSeen: number;
  /** epoch ms when this skill should next come back as a spaced review */
  nextReview?: number;
  /** Index into `MasteryConfig.reviewLadderDays` used to compute `nextReview` */
  reviewStep?: number;
}

/** Map of skillId → record (the `skills` field of ProfileProgress). */
export type ProgressMap = Record<string, MasteryRecord | undefined>;

export interface MasteryConfig {
  /** Prior P(known) for a skill never seen and not placed */
  pInit: number;
  /** P(learn) after each practice opportunity */
  pTransit: number;
  /** P(wrong | known) */
  pSlip: number;
  /** Posterior is clamped into [pFloor, pCeil] so it never gets stuck at 0 or 1 */
  pFloor: number;
  pCeil: number;
  /** learning → practised when p ≥ this (and attempts ≥ minAttemptsPractised) */
  practisedThreshold: number;
  minAttemptsPractised: number;
  /** practised → learning when p drops below this (hysteresis) */
  practisedDropThreshold: number;
  /** A practised skill is offered a mastery check when p ≥ this and attempts ≥ minAttemptsForCheck */
  checkReadyThreshold: number;
  minAttemptsForCheck: number;
  /** practised → mastered without a check only if p ≥ autoMasterThreshold and attempts ≥ autoMasterMinAttempts */
  autoMasterThreshold: number;
  autoMasterMinAttempts: number;
  /** mastered → learning when p drops below this ("slip back") */
  slipBackThreshold: number;
  /** p after passing a mastery check is at least this */
  pAfterCheckPass: number;
  /** Spaced-review ladder in days: success moves one step up, failure `failureStepsBack` down */
  reviewLadderDays: number[];
  failureStepsBack: number;
  /** A review counts as "due" (and grows the interval) if now ≥ nextReview − dueToleranceMs */
  dueToleranceMs: number;
}

export const DEFAULT_MASTERY_CONFIG: MasteryConfig = {
  pInit: 0.2,
  pTransit: 0.1,
  pSlip: 0.1,
  pFloor: 0.01,
  pCeil: 0.99,
  practisedThreshold: 0.7,
  minAttemptsPractised: 3,
  practisedDropThreshold: 0.5,
  checkReadyThreshold: 0.85,
  minAttemptsForCheck: 5,
  autoMasterThreshold: 0.95,
  autoMasterMinAttempts: 15,
  slipBackThreshold: 0.6,
  pAfterCheckPass: 0.95,
  reviewLadderDays: [1, 3, 7, 14, 30, 60],
  failureStepsBack: 2,
  dueToleranceMs: 12 * 60 * 60 * 1000,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
