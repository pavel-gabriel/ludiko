/**
 * National-exam practice (docs/EXAM_PRACTICE.md): a blueprint describes the FORMAT of a paper
 * (sections, counts per skill group, time, item types). It never contains items: those are
 * assembled at run time from existing skills (generators + static banks), so nothing is copied
 * from real exam papers (docs/LEGAL_CONTENT_POLICY.md §4).
 */
import type { Difficulty, Grade, Item, ItemType, LocalizedText, SubjectId } from '@/engine/types'

export type ExamId = 'en2' | 'en4' | 'en6' | 'en8'
/** The two papers of an exam, in the official order: 1 = limba română, 2 = matematică (+ explorarea mediului / științe) */
export type ExamTestNo = 1 | 2

/** Which skills a part draws from: fixed ids, or a pattern resolved against the registry at run time */
export type SkillSelector =
  | { ids: string[] }
  | {
      /** e.g. 'stiinte': skills another content wave may not have shipped yet */
      subject: SubjectId
      grades: Grade[]
      /** Optional id prefix filter, e.g. 'stiinte.plants.' */
      idPrefix?: string
    }

/** A group of items of one skill group inside a section ("competence group" of the blueprint) */
export interface ExamPart {
  id: string
  /** Programa competence code shown to parents (e.g. '2.1'); informative */
  competence: string
  skills: SkillSelector
  /** Number of items this part contributes */
  count: number
  /** Generators are asked for this difficulty; the section is sorted easy -> hard afterwards */
  difficulty: Difficulty
  /** Gimnaziu simulations: points per item of this part (weighted scoring). Absent = unweighted paper. */
  points?: number
}

export interface ExamSection {
  id: string
  title: LocalizedText
  intro: LocalizedText
  /** Skipped (not an error) when none of its parts resolves to a skill with items — e.g. science content not shipped yet */
  optional?: boolean
  parts: ExamPart[]
}

export interface ExamBlueprint {
  /** e.g. 'en2.t1' */
  id: string
  exam: ExamId
  test: ExamTestNo
  title: LocalizedText
  /** Official working time for the paper, in minutes (docs/EXAM_PRACTICE.md §1) */
  timeLimitMin: number
  /** Item types that fit a paper-style test: audio and map-tapping items are left out */
  allowedTypes: ItemType[]
  sections: ExamSection[]
  /** Gimnaziu simulations (src/exam/gimBlueprints.ts): which of the several tests of this paper (1..n) */
  variant?: number
  /** Gimnaziu simulations: fixed seed, so "Test 2" is always the same paper */
  seed?: number
}

/* ------------------------------------------------------------------ */
/*  Assembled test                                                     */
/* ------------------------------------------------------------------ */

export interface AssembledSection {
  id: string
  title: LocalizedText
  intro: LocalizedText
  /** Sorted easy -> hard (stable) */
  items: Item[]
}

export interface AssembledTest {
  blueprintId: string
  exam: ExamId
  test: ExamTestNo
  seed: number
  title: LocalizedText
  timeLimitMin: number
  sections: AssembledSection[]
  /** Optional sections left out because no skill with items was available */
  skippedSections: string[]
  /** Parts that could not deliver their full count (never happens for the shipped blueprints; tested) */
  shortfalls: { partId: string; wanted: number; got: number }[]
  /** Weighted (gimnaziu) papers only: points and competence tag per item id */
  itemMeta?: Record<string, { points: number; competence: string }>
  variant?: number
}

/** Per-item verdict collected by the runner; absent id = not answered */
export type ExamAnswers = Record<string, boolean>

/* ------------------------------------------------------------------ */
/*  Scoring                                                            */
/* ------------------------------------------------------------------ */

export type Descriptor = 'fb' | 'b' | 's' | 'i'

export interface SectionScore {
  sectionId: string
  correct: number
  total: number
  ratio: number
  descriptor: Descriptor
}

export interface PracticeEntry {
  skillId: string
  wrong: number
  total: number
}

export interface ExamScore {
  correct: number
  total: number
  answered: number
  ratio: number
  descriptor: Descriptor
  /** Estimated mark 1–10 (src/older/marks.ts); shown only when the exam is for grade V or above. Never an official mark. */
  mark: number | null
  /** 1..3 for the child's celebration; never 0 once the child tried */
  stars: 0 | 1 | 2 | 3
  sections: SectionScore[]
  /** Skills with wrong or unanswered items, most to practise first */
  practice: PracticeEntry[]
}
