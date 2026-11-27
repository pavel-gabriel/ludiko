/**
 * Scoring of the gimnaziu simulations. LUDIKO'S OWN PRACTICE ESTIMATE, not official grading
 * (docs/EXAM_PRACTICE.md §7): points per item come from the blueprint; a reading text earns partial
 * points per question answered correctly; the estimated mark is markFromScore(points, maxPoints).
 */
import { checkResponse } from '@/engine/items/check'
import type { Item, ItemResponse } from '@/engine/types'
import { markFromScore } from '../older/marks'
import { hasEstimatedMark } from './gimBlueprints'
import { descriptorFor, scoreExam } from './scoring'
import type { AssembledTest, ExamAnswers, ExamScore } from './types'

export interface CompetenceScore {
  competence: string
  points: number
  max: number
  ratio: number
}

export interface SectionPoints {
  sectionId: string
  points: number
  max: number
  ratio: number
}

export interface GimScore extends ExamScore {
  points: number
  maxPoints: number
  /** Integer percentage of the points */
  percent: number
  /** Estimated mark only for EN VIII; EN VI has no mark (percentage + competences instead) */
  markApplies: boolean
  competences: CompetenceScore[]
  sectionPoints: SectionPoints[]
}

/** Share of a read-and-answer item's questions that are right (0..1); other types: 1 or 0 */
export function partialFraction(item: Item, response: ItemResponse): number {
  if (item.type !== 'read-and-answer') return checkResponse(item, response) ? 1 : 0
  if (response.type !== 'read-and-answer' || item.questions.length === 0) return 0
  const right = item.questions.filter((q) => {
    const r = response.answers[q.id]
    return r !== undefined && checkResponse(q, r)
  }).length
  return right / item.questions.length
}

/**
 * `answers`: item id -> fully correct?; `fractions`: optional item id -> share 0..1 for items that earn
 * partial points (reading texts). An item with a `true` verdict always earns all its points.
 */
export function scoreGimExam(test: AssembledTest, answers: ExamAnswers, fractions: Record<string, number> = {}): GimScore {
  const base = scoreExam(test, answers)
  const meta = test.itemMeta ?? {}
  const byCompetence = new Map<string, { points: number; max: number }>()
  const sectionPoints: SectionPoints[] = []
  let points = 0
  let max = 0

  for (const section of test.sections) {
    let sp = 0
    let sm = 0
    for (const item of section.items) {
      const m = meta[item.id] ?? { points: 1, competence: 'misc' }
      const verdict = answers[item.id]
      const frac = verdict === true ? 1 : verdict === undefined ? 0 : Math.min(1, Math.max(0, fractions[item.id] ?? 0))
      const earned = Math.round(m.points * frac * 100) / 100
      const c = byCompetence.get(m.competence) ?? { points: 0, max: 0 }
      c.points += earned
      c.max += m.points
      byCompetence.set(m.competence, c)
      sp += earned
      sm += m.points
    }
    sectionPoints.push({ sectionId: section.id, points: sp, max: sm, ratio: sm ? sp / sm : 0 })
    points += sp
    max += sm
  }

  const ratio = max ? points / max : 0
  const applies = hasEstimatedMark(test.exam)
  return {
    ...base,
    ratio,
    descriptor: descriptorFor(ratio),
    mark: applies ? markFromScore(points, max) : null,
    stars: base.answered <= 0 ? 0 : ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1,
    points,
    maxPoints: max,
    percent: Math.round(ratio * 100),
    markApplies: applies,
    competences: [...byCompetence.entries()].map(([competence, v]) => ({ competence, ...v, ratio: v.max ? v.points / v.max : 0 })),
    sectionPoints,
  }
}
