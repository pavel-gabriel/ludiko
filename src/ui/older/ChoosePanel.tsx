import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getSkillsBySubject } from '@/engine/content/registry'
import { localize, type Skill, type SubjectId } from '@/engine/types'
import { getProgress } from '@/profiles/profileService'
import type { SkillProgress } from '@/profiles/types'
import FilterChips from '@/ui/common/FilterChips'
import { matchesState, stateOptions, type StateFilter } from '@/ui/common/skillBuckets'
import { skillHasItems } from '@/ui/session/itemSource'
import { subjectEmoji } from '@/ui/learn/subjects'

/** Items in a self-chosen test */
export const SELF_TEST_ITEMS = 10

/** Skills of a subject at or below the child's grade that can produce items, in curriculum order */
export function chaptersFor(subject: SubjectId, grade: number): Skill[] {
  return [...getSkillsBySubject(subject)]
    .filter((s) => s.grade <= grade && skillHasItems(s))
    .sort((a, b) => a.grade - b.grade || a.semester - b.semester || (a.id < b.id ? -1 : 1))
}

/**
 * "Alege-ți singur": subject -> chapter (skills grouped by grade and semester) -> "Exersează" (practice session)
 * or "Testează-te" (check mode, 10 items, ends with the estimated mark). Both reuse /practice/:skillId.
 */
export default function ChoosePanel({ subjects, grade, profileId }: { subjects: SubjectId[]; grade: number; profileId?: string }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState<SubjectId | null>(null)
  const [skillId, setSkillId] = useState('')
  const [state, setState] = useState<StateFilter>('all')
  const [progress, setProgress] = useState<Record<string, SkillProgress> | null>(null)

  // the child's own progress lets the chapter list be filtered: to do / in progress / done
  useEffect(() => {
    if (!open || !profileId) return
    let live = true
    getProgress(profileId).then(
      (p) => live && setProgress(p.skills),
      () => live && setProgress(null),
    )
    return () => {
      live = false
    }
  }, [open, profileId])

  const allChapters = useMemo(() => (subject ? chaptersFor(subject, grade) : []), [subject, grade])
  const stateOf = (id: string) => progress?.[id]?.state
  const chapters = allChapters.filter((s) => matchesState(state, stateOf(s.id)))
  const groups = useMemo(() => {
    const out: { key: string; grade: number; semester: number; skills: Skill[] }[] = []
    for (const s of chapters) {
      const key = `${s.grade}-${s.semester}`
      const g = out.find((x) => x.key === key)
      if (g) g.skills.push(s)
      else out.push({ key, grade: s.grade, semester: s.semester, skills: [s] })
    }
    return out
  }, [chapters])

  return (
    <section aria-labelledby="choose-title" className="rounded-2xl bg-white shadow-sm" data-testid="choose-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="choose-body"
        data-testid="toggle-choose"
        className="flex min-h-[56px] w-full items-center gap-3 px-4 text-left active:scale-95"
      >
        <span aria-hidden="true">🧭</span>
        <span className="min-w-0 flex-1">
          <span id="choose-title" className="block text-lg font-extrabold text-ludiko-text">
            {t('older.pick.title')}
          </span>
          <span className="block text-sm font-semibold text-ludiko-text/70">{t('older.pick.subtitle')}</span>
        </span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div id="choose-body" className="flex flex-col gap-3 px-4 pb-4">
          <FilterChips
            label={t('older.pick.subject')}
            options={subjects.map((s) => ({ value: s, label: t(`learn.subject.${s}`), icon: subjectEmoji(s) }))}
            value={(subject ?? '') as SubjectId}
            onChange={(s) => {
              setSubject(s)
              setSkillId('')
            }}
            testId="pick-subject"
          />

          {subject && progress && allChapters.length > 0 && (
            <FilterChips
              label={t('filters.state')}
              options={stateOptions(t, allChapters.map((s) => stateOf(s.id)))}
              value={state}
              onChange={(v) => {
                setState(v)
                setSkillId('')
              }}
              testId="pick-state"
            />
          )}

          {subject && allChapters.length > 0 && chapters.length === 0 && (
            <p className="text-sm font-semibold text-ludiko-text/80" data-testid="pick-filter-empty">
              {t('filters.none')}
            </p>
          )}

          {subject && allChapters.length === 0 && (
            <p className="text-sm font-semibold text-ludiko-text/80" data-testid="pick-none">
              {t('older.pick.none')}
            </p>
          )}

          {subject && chapters.length > 0 && (
            <label className="flex flex-col gap-1 text-sm font-extrabold text-ludiko-text">
              {t('older.pick.chapter')}
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                data-testid="pick-chapter"
                className="min-h-[48px] w-full rounded-xl border-2 border-ludiko-text/20 bg-white px-3 text-base font-bold text-ludiko-text"
              >
                <option value="">{t('older.pick.chooseChapter')}</option>
                {groups.map((g) => (
                  <optgroup
                    key={g.key}
                    label={t('older.pick.gradeSem', {
                      grade: t(`profiles.gradeLabels.${g.grade}`),
                      sem: t('learn.map.semester', { n: g.semester }),
                    })}
                  >
                    {g.skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {localize(s.title, i18n.language)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}

          {skillId && (
            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/practice/${skillId}?mode=practice`}
                data-testid="pick-practice"
                className="flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-ludiko-green px-2 text-center text-ludiko-text active:scale-95"
              >
                <span className="text-base font-extrabold">{t('older.pick.practice')}</span>
                <span className="text-xs font-semibold">{t('older.pick.practiceDesc')}</span>
              </Link>
              <Link
                to={`/practice/${skillId}?mode=check&n=${SELF_TEST_ITEMS}`}
                data-testid="pick-test"
                className="flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-ludiko-yellow px-2 text-center text-ludiko-text active:scale-95"
              >
                <span className="text-base font-extrabold">{t('older.pick.test')}</span>
                <span className="text-xs font-semibold">{t('older.pick.testDesc')}</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
