import type { TFunction } from 'i18next'
import type { Level } from '@/learner/contract'

/** "clasa pregătitoare" / "clasa 3" */
export function gradeLabel(t: TFunction, grade: number): string {
  return grade === 0 ? t('family.extras.level.prep') : t('family.extras.level.grade', { grade })
}

/** "clasa 3, semestrul 1" */
export function levelLabel(t: TFunction, level: Level): string {
  return t('family.extras.level.full', { grade: gradeLabel(t, level.grade), semester: level.semester })
}

/** A YYYY-MM-DD day (local) or a timestamp as a short date in the UI language, e.g. "27 nov." */
export function shortDate(lang: string, when: string | number): string {
  let date: Date
  if (typeof when === 'string') {
    const [y, m, d] = when.split('-').map(Number)
    date = new Date(y, m - 1, d)
  } else {
    date = new Date(when)
  }
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(date)
}

export function longDate(lang: string, ts: number): string {
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts))
}
