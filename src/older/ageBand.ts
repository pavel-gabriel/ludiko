/**
 * Age bands: the same app, three tones (docs/PLAN.md §6).
 *  small  grade 0–II   playful, mascot front and centre
 *  middle grade III–IV playful but a little less baby talk
 *  big    grade V–VIII calm, mature copy, optional mascot, denser layouts (targets still ≥ 44px)
 */
export type AgeBand = 'small' | 'middle' | 'big'

export function ageBand(grade: number | undefined | null): AgeBand {
  if (grade === undefined || grade === null || Number.isNaN(grade)) return 'small'
  if (grade >= 5) return 'big'
  if (grade >= 3) return 'middle'
  return 'small'
}

export const isBig = (grade: number | undefined | null): boolean => ageBand(grade) === 'big'
