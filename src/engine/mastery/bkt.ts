/**
 * Bayesian Knowledge Tracing (Corbett & Anderson 1994) + skill-state machine + spaced review.
 * Pure functions: no clock, no randomness — callers pass `now`.
 */
import type { ItemType } from '../types';
import { DAY_MS, DEFAULT_MASTERY_CONFIG, type MasteryConfig, type MasteryRecord } from './types';

/**
 * P(correct | skill NOT known) for an item type — the chance of a lucky guess.
 * `optionCount` (choices shown) refines option-based types: guess = 1 / optionCount.
 */
export function guessFor(itemType: ItemType, optionCount?: number): number {
  const byOptions = (fallback: number) =>
    optionCount && optionCount > 1 ? Math.min(0.5, 1 / optionCount) : fallback;
  switch (itemType) {
    case 'true-false':
      return 0.5;
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer':
    case 'hotspot':
      return byOptions(0.25);
    case 'fill-gap':
      // typed gap ≈ number input; with offered options it behaves like a choice
      return optionCount && optionCount > 1 ? byOptions(0.25) : 0.05;
    case 'number-input':
      return 0.05;
    case 'order':
    case 'sort':
    case 'match':
      return 0.1;
    case 'read-and-answer':
      return 0.2;
  }
}

/** A fresh record for a skill the child has never touched. */
export function initialRecord(cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG): MasteryRecord {
  return { state: 'unknown', pMastery: cfg.pInit, attempts: 0, correct: 0, lastSeen: 0 };
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * One BKT step: posterior given the observation, then the learning transition.
 *   correct:  p·(1−s) / (p·(1−s) + (1−p)·g)
 *   wrong:    p·s     / (p·s     + (1−p)·(1−g))
 *   next = post + (1 − post)·T
 * Monotonic in `p` and, because 1−s > g, a correct answer always ends ≥ a wrong one.
 */
export function bktUpdate(
  p: number,
  correct: boolean,
  guess: number,
  cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): number {
  const s = cfg.pSlip;
  const g = clamp(guess, 0.001, 0.999);
  const prior = clamp(p, 0, 1);
  const post = correct
    ? (prior * (1 - s)) / (prior * (1 - s) + (1 - prior) * g)
    : (prior * s) / (prior * s + (1 - prior) * (1 - g));
  const next = post + (1 - post) * cfg.pTransit;
  return clamp(next, cfg.pFloor, cfg.pCeil);
}

/** Current index on the review ladder (stored, or derived from the last scheduled interval). */
export function reviewStepOf(rec: MasteryRecord, cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG): number {
  if (typeof rec.reviewStep === 'number') return clamp(Math.round(rec.reviewStep), 0, cfg.reviewLadderDays.length - 1);
  if (rec.nextReview === undefined || !rec.lastSeen) return -1;
  const days = (rec.nextReview - rec.lastSeen) / DAY_MS;
  let step = 0;
  cfg.reviewLadderDays.forEach((d, i) => {
    if (d <= days + 1e-6) step = i;
  });
  return step;
}

/** True when the spaced review of this skill is due at `now`. */
export function isDue(rec: MasteryRecord | undefined, now: number, cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG): boolean {
  return !!rec && rec.nextReview !== undefined && now >= rec.nextReview - cfg.dueToleranceMs;
}

/**
 * Spaced-review schedule after one answer.
 * - correct while due (or first schedule): one step up the ladder (1 → 3 → 7 → 14 → 30 → 60 days)
 * - correct while not due (extra practice): schedule unchanged (no cramming bonus)
 * - wrong: `failureStepsBack` steps down (min 1 day)
 */
export function scheduleReview(
  prev: MasteryRecord,
  correct: boolean,
  now: number,
  cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): { nextReview: number; reviewStep: number } {
  const ladder = cfg.reviewLadderDays;
  const step = reviewStepOf(prev, cfg);
  let nextStep: number;
  if (correct) {
    if (step < 0) nextStep = 0;
    else if (isDue(prev, now, cfg)) nextStep = Math.min(step + 1, ladder.length - 1);
    else return { nextReview: prev.nextReview as number, reviewStep: step };
  } else {
    nextStep = Math.max(0, step - cfg.failureStepsBack);
  }
  return { nextReview: now + ladder[nextStep] * DAY_MS, reviewStep: nextStep };
}

export interface Observation {
  correct: boolean;
  itemType: ItemType;
  /** epoch ms */
  now: number;
  /** Number of options shown (choice-like items) — refines the guess rate */
  optionCount?: number;
}

/**
 * Update a skill record after one answered item.
 *
 * State machine (mastered is only *entered* via `applyMasteryCheck`, or the auto-master rule):
 *   unknown  → learning (correct) | gap (wrong)
 *   gap      → learning on a correct answer
 *   learning → practised when p ≥ practisedThreshold and attempts ≥ minAttemptsPractised
 *   practised→ learning when p < practisedDropThreshold
 *   practised→ mastered when p ≥ autoMasterThreshold and attempts ≥ autoMasterMinAttempts
 *   mastered → learning when p < slipBackThreshold (slipped)
 */
export function updateMastery(
  prev: MasteryRecord | undefined,
  obs: Observation,
  cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): MasteryRecord {
  const base = prev ?? initialRecord(cfg);
  const prior = base.state === 'unknown' && base.attempts === 0 && !(base.pMastery > 0) ? cfg.pInit : base.pMastery;
  const p = bktUpdate(prior, obs.correct, guessFor(obs.itemType, obs.optionCount), cfg);
  const attempts = base.attempts + 1;
  const state = nextState(base.state, p, attempts, obs.correct, cfg);
  const sched = scheduleReview(base, obs.correct, obs.now, cfg);
  return {
    ...base,
    state,
    pMastery: p,
    attempts,
    correct: base.correct + (obs.correct ? 1 : 0),
    lastSeen: obs.now,
    nextReview: sched.nextReview,
    reviewStep: sched.reviewStep,
  };
}

function nextState(
  state: MasteryRecord['state'],
  p: number,
  attempts: number,
  correct: boolean,
  cfg: MasteryConfig,
): MasteryRecord['state'] {
  switch (state) {
    case 'unknown':
      return correct ? 'learning' : 'gap';
    case 'gap':
      return correct ? promoteLearning(p, attempts, cfg) : 'gap';
    case 'learning':
      return promoteLearning(p, attempts, cfg);
    case 'practised':
      if (p < cfg.practisedDropThreshold) return 'learning';
      if (p >= cfg.autoMasterThreshold && attempts >= cfg.autoMasterMinAttempts) return 'mastered';
      return 'practised';
    case 'mastered':
      return p < cfg.slipBackThreshold ? 'learning' : 'mastered';
  }
}

function promoteLearning(p: number, attempts: number, cfg: MasteryConfig): MasteryRecord['state'] {
  return p >= cfg.practisedThreshold && attempts >= cfg.minAttemptsPractised ? 'practised' : 'learning';
}

/** A practised skill whose evidence is strong enough for a mastery check. */
export function isReadyForCheck(rec: MasteryRecord | undefined, cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG): boolean {
  return (
    !!rec && rec.state === 'practised' && rec.pMastery >= cfg.checkReadyThreshold && rec.attempts >= cfg.minAttemptsForCheck
  );
}

/**
 * Apply a mastery check (the skill's `masteryCheck: { items, minCorrect }`): every item updates
 * BKT as usual; passing (≥ minCorrect) moves the skill to `mastered`, lifts p to at least
 * `pAfterCheckPass` and advances the review ladder one step. Failing leaves the state to the
 * normal rules (usually practised or learning).
 */
export function applyMasteryCheck(
  prev: MasteryRecord | undefined,
  results: boolean[],
  check: { items: number; minCorrect: number },
  opts: { itemType: Observation['itemType']; now: number; optionCount?: number },
  cfg: MasteryConfig = DEFAULT_MASTERY_CONFIG,
): { record: MasteryRecord; passed: boolean } {
  const start = prev ?? initialRecord(cfg);
  let rec = start;
  for (const correct of results) {
    rec = updateMastery(rec, { correct, itemType: opts.itemType, now: opts.now, optionCount: opts.optionCount }, cfg);
  }
  const nCorrect = results.filter(Boolean).length;
  const passed = results.length > 0 && nCorrect >= Math.min(check.minCorrect, results.length);
  if (!passed) return { record: rec, passed };
  const ladder = cfg.reviewLadderDays;
  const step = Math.min(Math.max(reviewStepOf(start, cfg), 0) + 1, ladder.length - 1);
  return {
    passed,
    record: {
      ...rec,
      state: 'mastered',
      pMastery: Math.max(rec.pMastery, cfg.pAfterCheckPass),
      reviewStep: step,
      nextReview: opts.now + ladder[step] * DAY_MS,
    },
  };
}
