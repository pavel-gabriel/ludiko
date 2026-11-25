import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  DEFAULT_MASTERY_CONFIG as C,
  applyMasteryCheck,
  bktUpdate,
  guessFor,
  initialRecord,
  isDue,
  isReadyForCheck,
  scheduleReview,
  updateMastery,
  type MasteryRecord,
} from '../src/engine/mastery';
import type { ItemType } from '../src/engine/types';

const NOW = Date.UTC(2026, 10, 25, 9);
const ALL_TYPES: ItemType[] = [
  'choice', 'picture-choice', 'true-false', 'number-input', 'fill-gap', 'order', 'sort', 'match',
  'hotspot', 'read-and-answer', 'listen-and-answer',
];

describe('guessFor', () => {
  it('depends on the item type', () => {
    expect(guessFor('true-false')).toBe(0.5);
    expect(guessFor('choice')).toBe(0.25);
    expect(guessFor('choice', 3)).toBeCloseTo(1 / 3);
    expect(guessFor('number-input')).toBe(0.05);
    expect(guessFor('fill-gap')).toBe(0.05);
    expect(guessFor('fill-gap', 4)).toBe(0.25);
    for (const t of ALL_TYPES) {
      expect(guessFor(t)).toBeGreaterThan(0);
      expect(guessFor(t)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('BKT update', () => {
  const grid = Array.from({ length: 21 }, (_, i) => i / 20);

  it('is bounded in [pFloor, pCeil]', () => {
    for (const p of grid)
      for (const t of ALL_TYPES)
        for (const c of [true, false]) {
          const n = bktUpdate(p, c, guessFor(t));
          expect(n).toBeGreaterThanOrEqual(C.pFloor);
          expect(n).toBeLessThanOrEqual(C.pCeil);
        }
  });

  it('correct ≥ prior, correct > wrong, and monotonic in the prior', () => {
    for (const t of ALL_TYPES) {
      const g = guessFor(t);
      let prevC = -1;
      let prevW = -1;
      for (const p of grid) {
        const c = bktUpdate(p, true, g);
        const w = bktUpdate(p, false, g);
        expect(c).toBeGreaterThanOrEqual(Math.min(p, C.pCeil) - 1e-12);
        if (p > 0 && p < 1) expect(c).toBeGreaterThan(w);
        else expect(c).toBeGreaterThanOrEqual(w);
        expect(c).toBeGreaterThanOrEqual(prevC);
        expect(w).toBeGreaterThanOrEqual(prevW);
        prevC = c;
        prevW = w;
      }
    }
  });

  it('a wrong answer lowers a confident estimate', () => {
    expect(bktUpdate(0.9, false, 0.05)).toBeLessThan(0.9);
  });

  it('a correct guess-prone answer teaches less than a typed one', () => {
    expect(bktUpdate(0.3, true, guessFor('true-false'))).toBeLessThan(bktUpdate(0.3, true, guessFor('number-input')));
  });
});

const answer = (rec: MasteryRecord | undefined, correct: boolean, now = NOW, itemType: ItemType = 'number-input') =>
  updateMastery(rec, { correct, itemType, now });

describe('state transitions', () => {
  it('unknown → learning on correct, unknown → gap on wrong', () => {
    expect(answer(undefined, true).state).toBe('learning');
    expect(answer(undefined, false).state).toBe('gap');
    // profileService default record (pMastery 0) uses pInit as the prior
    const blank: MasteryRecord = { state: 'unknown', pMastery: 0, attempts: 0, correct: 0, lastSeen: NOW };
    expect(answer(blank, true).pMastery).toBeCloseTo(answer(undefined, true).pMastery);
  });

  it('gap stays gap on wrong and moves to learning on correct', () => {
    const g = answer(undefined, false);
    expect(answer(g, false).state).toBe('gap');
    expect(answer(g, true).state).toBe('learning');
  });

  it('learning → practised needs p ≥ 0.7 and enough attempts; never straight to mastered', () => {
    let r = answer(undefined, true);
    expect(r.state).toBe('learning');
    r = answer(r, true);
    expect(r.pMastery).toBeGreaterThan(C.practisedThreshold);
    expect(r.state).toBe('learning'); // only 2 attempts
    r = answer(r, true);
    expect(r.state).toBe('practised');
    for (let i = 0; i < 5; i++) r = answer(r, true);
    expect(r.state).toBe('practised'); // mastered requires a check (or the slow auto rule)
    expect(isReadyForCheck(r)).toBe(true);
  });

  it('practised → mastered by passing a mastery check; failing does not master', () => {
    let r: MasteryRecord | undefined;
    for (let i = 0; i < 6; i++) r = answer(r, true);
    const pass = applyMasteryCheck(r, [true, true, true, false, true], { items: 5, minCorrect: 4 }, { itemType: 'number-input', now: NOW });
    expect(pass.passed).toBe(true);
    expect(pass.record.state).toBe('mastered');
    expect(pass.record.pMastery).toBeGreaterThanOrEqual(C.pAfterCheckPass);
    const fail = applyMasteryCheck(r, [true, false, true, false, false], { items: 5, minCorrect: 4 }, { itemType: 'number-input', now: NOW });
    expect(fail.passed).toBe(false);
    expect(fail.record.state).not.toBe('mastered');
  });

  it('auto-master after many attempts at p ≥ 0.95', () => {
    let r: MasteryRecord | undefined;
    for (let i = 0; i < C.autoMasterMinAttempts - 1; i++) r = answer(r, true);
    expect(r!.state).toBe('practised');
    r = answer(r, true);
    expect(r.state).toBe('mastered');
  });

  it('mastered slips back to learning after repeated errors', () => {
    let r: MasteryRecord = { ...initialRecord(), state: 'mastered', pMastery: 0.95, attempts: 10, correct: 10, lastSeen: NOW };
    r = answer(r, false);
    expect(r.state).toBe('mastered'); // one slip is tolerated
    r = answer(r, false);
    expect(r.state).toBe('learning');
  });

  it('practised falls back to learning when p < 0.5', () => {
    let r: MasteryRecord = { ...initialRecord(), state: 'practised', pMastery: 0.75, attempts: 4, correct: 3, lastSeen: NOW };
    r = answer(r, false);
    expect(r.state).toBe('learning');
  });

  it('counts attempts/correct and sets lastSeen', () => {
    const r = answer(answer(undefined, true), false, NOW + 1000);
    expect(r).toMatchObject({ attempts: 2, correct: 1, lastSeen: NOW + 1000 });
  });
});

describe('spaced review', () => {
  it('interval grows 1 → 3 → 7 → 14 → 30 days on due successes', () => {
    let r: MasteryRecord = { ...initialRecord(), state: 'mastered', pMastery: 0.95, attempts: 5, correct: 5, lastSeen: NOW };
    let now = NOW;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      r = answer(r, true, now);
      intervals.push(Math.round((r.nextReview! - now) / DAY_MS));
      now = r.nextReview!;
    }
    expect(intervals).toEqual([1, 3, 7, 14, 30, 60]);
  });

  it('extra correct answers before the review is due do not grow the interval', () => {
    let r = answer(undefined, true, NOW);
    r = answer(r, true, NOW + DAY_MS);
    const due = r.nextReview!;
    const again = answer(r, true, NOW + DAY_MS + 60_000);
    expect(again.nextReview).toBe(due);
  });

  it('shrinks on failure', () => {
    const r: MasteryRecord = { ...initialRecord(), state: 'mastered', pMastery: 0.95, attempts: 9, correct: 9, lastSeen: NOW, reviewStep: 4, nextReview: NOW + 30 * DAY_MS };
    const s = scheduleReview(r, false, NOW + 30 * DAY_MS);
    expect(s.reviewStep).toBe(2);
    expect(s.nextReview - (NOW + 30 * DAY_MS)).toBe(7 * DAY_MS);
  });

  it('derives the ladder step from nextReview − lastSeen when reviewStep is missing', () => {
    const r: MasteryRecord = { state: 'mastered', pMastery: 0.9, attempts: 3, correct: 3, lastSeen: NOW, nextReview: NOW + 7 * DAY_MS };
    const s = scheduleReview(r, true, NOW + 7 * DAY_MS);
    expect(s.nextReview - (NOW + 7 * DAY_MS)).toBe(14 * DAY_MS);
  });

  it('isDue respects the tolerance', () => {
    const r: MasteryRecord = { ...initialRecord(), nextReview: NOW };
    expect(isDue(r, NOW - 2 * 60 * 60 * 1000)).toBe(true);
    expect(isDue(r, NOW - 2 * DAY_MS)).toBe(false);
    expect(isDue(undefined, NOW)).toBe(false);
  });
});
