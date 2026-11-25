/** Pure helpers that bridge persisted SkillProgress and the engine's mastery functions. */
import { DEFAULT_MASTERY_CONFIG, updateMastery, type MasteryRecord } from '@/engine/mastery';
import type { Item } from '@/engine/types';
import type { SkillProgress } from '@/profiles/types';

/** How many options the child chose between (refines the guess rate); undefined = engine default. */
export function itemOptionCount(item: Item): number | undefined {
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer':
      return item.options.length;
    case 'hotspot':
      return item.regions.length;
    case 'fill-gap':
      return item.options?.length;
    default:
      return undefined;
  }
}

/**
 * Records written by counters-only paths (retries, placement attempts, legacy recordAttempt)
 * have state 'unknown' and pMastery 0; BKT needs the prior, not 0, for those.
 */
export function withPrior(rec: SkillProgress | undefined): SkillProgress | undefined {
  if (rec && rec.state === 'unknown' && !(rec.pMastery > 0)) return { ...rec, pMastery: DEFAULT_MASTERY_CONFIG.pInit };
  return rec;
}

/** Stamp `stateChangedAt` when the engine moved the skill to a different state. */
export function stampStateChange(prev: SkillProgress | undefined, next: MasteryRecord, now: number): SkillProgress {
  const before = prev?.state ?? 'unknown';
  const out: SkillProgress = { ...prev, ...next };
  if (next.state !== before) out.stateChangedAt = now;
  return out;
}

/** One answered item → the new persisted record (BKT + state machine + spaced review). */
export function masteryAfterItem(
  prev: SkillProgress | undefined,
  item: Item,
  correct: boolean,
  now: number,
): SkillProgress {
  const next = updateMastery(withPrior(prev), {
    correct,
    itemType: item.type,
    now,
    optionCount: itemOptionCount(item),
  });
  return stampStateChange(prev, next, now);
}
