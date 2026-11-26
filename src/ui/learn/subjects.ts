import type { SubjectId } from '@/engine/types'

/** Subjects offered in the learner area. Add an id here (plus `learn.subject.<id>` strings) to open another subject. */
export const LEARN_SUBJECTS: readonly SubjectId[] = ['mat', 'rom', 'stiinte', 'civ']

export const SUBJECT_EMOJI: Partial<Record<SubjectId, string>> = {
  mat: '🔢',
  rom: '📖',
  stiinte: '🔬',
  civ: '🤝',
}

export function subjectEmoji(subject: SubjectId): string {
  return SUBJECT_EMOJI[subject] ?? '📚'
}

/** Route param -> subject, or null when it is not a learner subject */
export function parseSubject(raw: string | undefined): SubjectId | null {
  return LEARN_SUBJECTS.find((s) => s === raw) ?? null
}
