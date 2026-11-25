/**
 * School-calendar helpers (local time). No Firebase, no I/O.
 *
 * Semester rule (Romanian school year): Sep–Jan = semester 1, Feb–Aug = semester 2.
 * Nominal semester starts used for the "early in the semester" rule: 1 Sep and 1 Feb.
 */
import { levelFromKey, levelKey } from '@/engine/diagnostic';
import type { Grade, Semester } from '@/engine/types';
import type { Level } from './contract';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A child in the first N weeks of a semester has not been taught much of it yet */
export const EARLY_SEMESTER_WEEKS = 6;

export function schoolSemester(now: number = Date.now()): Semester {
  const month = new Date(now).getMonth(); // 0 = Jan
  return month >= 8 || month === 0 ? 1 : 2;
}

/** Local midnight of the nominal first day of the semester `now` falls in (1 Sep / 1 Feb). */
export function semesterStart(now: number): number {
  const d = new Date(now);
  const month = d.getMonth();
  if (month >= 8) return new Date(d.getFullYear(), 8, 1).getTime();
  if (month === 0) return new Date(d.getFullYear() - 1, 8, 1).getTime();
  return new Date(d.getFullYear(), 1, 1).getTime();
}

/** The child's class level at `now`: declared grade + the current school-calendar semester. */
export function currentLevel(grade: Grade, now: number): Level {
  return { grade, semester: schoolSemester(now) };
}

/**
 * Level a placement checks the child against. Normally the declared grade and current semester;
 * during the first 6 weeks of a semester it is the previous semester instead (the new material
 * has barely been taught, so missing it is not a gap). Never below grade 0, semester 1.
 */
export function placementTarget(grade: Grade, now: number): Level {
  const current = currentLevel(grade, now);
  const early = now < semesterStart(now) + EARLY_SEMESTER_WEEKS * 7 * DAY_MS;
  if (!early) return current;
  return levelFromKey(Math.max(0, levelKey(current) - 1));
}

/** One semester above `level` (clamped to grade VIII, semester 2). */
export function nextLevel(level: Level): Level {
  return levelFromKey(Math.min(levelKey({ grade: 8, semester: 2 }), levelKey(level) + 1));
}

/** The last `n` local days ending today, as YYYY-MM-DD strings (newest first). */
export function lastDays(now: number, n: number, toDay: (ts: number) => string): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(toDay(d.getTime()));
  }
  return out;
}
