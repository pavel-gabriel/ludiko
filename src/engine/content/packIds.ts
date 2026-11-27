/**
 * Content pack ids (docs/ENGINE.md "Content packs"). Pure and dependency-free: also imported by the
 * build plugin (scripts/contentPacksPlugin.ts), which splits content/{items,explanations} into packs.
 *
 * A pack = one subject × one grade band: `p` (primary, grades 0–IV) or `g` (gimnaziu, grades V–VIII).
 * Examples: `mat-p`, `mat-g`, `rom-p`, `chim-g`.
 */
export type GradeBand = 'p' | 'g';

/** Highest grade of the primary band */
export const PRIMARY_MAX_GRADE = 4;

export function gradeBand(grade: number): GradeBand {
  return grade <= PRIMARY_MAX_GRADE ? 'p' : 'g';
}

export function packIdOf(subject: string, grade: number): string {
  return `${subject}-${gradeBand(grade)}`;
}
