/**
 * Scoring of an exam simulation. LUDIKO'S OWN PRACTICE ESTIMATE, not official grading:
 * the thresholds below are ours, documented in docs/EXAM_PRACTICE.md §4.
 */
import type { Descriptor, ExamAnswers, ExamScore, AssembledTest, PracticeEntry, SectionScore } from './types'

/** Lowest share of correct answers (0..1) for each calificativ; anything lower is "Insuficient" */
export const DESCRIPTOR_THRESHOLDS = { fb: 0.9, b: 0.7, s: 0.5 } as const

/** Child-facing stars: everyone who answered anything gets at least one */
function starsFor(ratio: number, answered: number): 0 | 1 | 2 | 3 {
  if (answered <= 0) return 0
  if (ratio >= 0.9) return 3
  if (ratio >= 0.6) return 2
  return 1
}

export function descriptorFor(ratio: number): Descriptor {
  if (ratio >= DESCRIPTOR_THRESHOLDS.fb) return 'fb'
  if (ratio >= DESCRIPTOR_THRESHOLDS.b) return 'b'
  if (ratio >= DESCRIPTOR_THRESHOLDS.s) return 's'
  return 'i'
}

/**
 * Score a test. `answers` maps item id -> correct?; an item with no entry was not answered and counts
 * as not correct (it also lands on the practice list, so skipped topics are not forgotten).
 */
export function scoreExam(test: AssembledTest, answers: ExamAnswers): ExamScore {
  const sections: SectionScore[] = []
  const perSkill = new Map<string, { wrong: number; total: number }>()
  let correct = 0
  let total = 0
  let answered = 0

  for (const section of test.sections) {
    let sc = 0
    for (const item of section.items) {
      const verdict = answers[item.id]
      const rec = perSkill.get(item.skillId) ?? { wrong: 0, total: 0 }
      rec.total += 1
      if (verdict !== undefined) answered += 1
      if (verdict === true) sc += 1
      else rec.wrong += 1
      perSkill.set(item.skillId, rec)
    }
    const ratio = section.items.length ? sc / section.items.length : 0
    sections.push({ sectionId: section.id, correct: sc, total: section.items.length, ratio, descriptor: descriptorFor(ratio) })
    correct += sc
    total += section.items.length
  }

  const ratio = total ? correct / total : 0
  const practice: PracticeEntry[] = [...perSkill.entries()]
    .filter(([, v]) => v.wrong > 0)
    .map(([skillId, v]) => ({ skillId, ...v }))
    .sort((a, b) => b.wrong - a.wrong || b.wrong / b.total - a.wrong / a.total || a.skillId.localeCompare(b.skillId))

  return {
    correct,
    total,
    answered,
    ratio,
    descriptor: descriptorFor(ratio),
    stars: starsFor(ratio, answered),
    sections,
    practice,
  }
}
