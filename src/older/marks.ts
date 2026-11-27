/**
 * Marks for gimnaziu (grades V–VIII). LUDIKO'S OWN PRACTICE ESTIMATE, never an official grade.
 *
 * Formula (documented choice): nota = 1 + 9 · p, p = correct / total, rounded to 2 decimals.
 * The Romanian scale runs 1–10 and nobody scores below 1, so 0 correct = 1,00 and all correct = 10,00.
 * Two decimals (e.g. "8,50") match how Evaluarea Națională results are written and avoid cliff edges
 * between whole marks on tests of only 5–10 items.
 *
 * Grades 0–IV use calificative (FB/B/S/I) with the same thresholds as the exam practice.
 */
import { descriptorFor } from '../exam/scoring'
import type { Descriptor } from '../exam/types'

export const MARK_MIN = 1
export const MARK_MAX = 10

/** Estimated mark 1–10 (2 decimals); null when nothing was asked (total ≤ 0). `correct` is clamped to 0..total. */
export function markFromScore(correct: number, total: number): number | null {
  if (!(total > 0) || !Number.isFinite(total)) return null
  const c = Math.min(Math.max(Number.isFinite(correct) ? correct : 0, 0), total)
  const raw = MARK_MIN + (MARK_MAX - MARK_MIN) * (c / total)
  return Math.round(raw * 100) / 100
}

/** "8,50" in Romanian, "8.50" in English: always two decimals */
export function formatMark(mark: number, lang = 'ro'): string {
  const s = mark.toFixed(2)
  return lang.toLowerCase().startsWith('en') ? s : s.replace('.', ',')
}

export type GradeLabel =
  | { kind: 'calificativ'; descriptor: Descriptor }
  | { kind: 'nota'; mark: number; text: string }

/** Calificativ for grades 0–IV, estimated notă for V–VIII. `ratio` is correct / total (0..1). */
export function gradeLabel(grade: number, ratio: number, lang = 'ro'): GradeLabel {
  const p = Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0, 0), 1)
  if (grade >= 5) {
    const mark = markFromScore(p, 1) as number
    return { kind: 'nota', mark, text: formatMark(mark, lang) }
  }
  return { kind: 'calificativ', descriptor: descriptorFor(p) }
}

/** Grade of an exam id ('en2' -> 2, 'en8' -> 8); 0 when unknown */
export function examGradeOf(exam: string): number {
  const m = /^en(\d)$/.exec(exam)
  return m ? Number(m[1]) : 0
}
