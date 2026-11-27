import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '@/components/ui/LanguageToggle'
import { getAllSkills } from '@/engine/content/registry'
import { getProgress } from '@/profiles/profileService'
import type { SkillProgress } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import FilterChips, { type FilterOption } from '@/ui/common/FilterChips'
import { matchesState, stateOptions, type StateFilter } from '@/ui/common/skillBuckets'
import { LEARN_SUBJECTS, subjectEmoji } from '@/ui/learn/subjects'
import { skillHasItems } from './itemSource'
import { localize, type Grade, type Skill, type SubjectId } from '@/engine/types'

/**
 * /practice — every skill in the registry, grouped by grade, with filter chips (subject, grade and, with an
 * active profile, the child's progress). Opens on the child's grade. A dev-friendly door into sessions.
 */
export default function PracticeListPage() {
  const { t, i18n } = useTranslation()
  const profile = useProfileStore((s) => s.activeProfile)
  const profilesLoaded = useProfileStore((s) => s.loaded)
  const loadProfiles = useProfileStore((s) => s.load)
  const [skillsProgress, setSkillsProgress] = useState<Record<string, SkillProgress> | null>(null)
  const [subject, setSubject] = useState<'all' | SubjectId>('all')
  const [grade, setGrade] = useState<string>(() => (profile ? String(profile.grade) : 'all'))
  const [state, setState] = useState<StateFilter>('all')

  useEffect(() => {
    if (!profilesLoaded) void loadProfiles().catch(() => {})
  }, [profilesLoaded, loadProfiles])

  // a direct visit loads the profile after the first render: open on the child's grade once it is known
  const gradeTouched = useRef(false)
  useEffect(() => {
    if (profile && !gradeTouched.current) setGrade(String(profile.grade))
  }, [profile])

  useEffect(() => {
    if (!profile) return
    let live = true
    getProgress(profile.id).then(
      (p) => live && setSkillsProgress(p.skills),
      () => live && setSkillsProgress(null),
    )
    return () => {
      live = false
    }
  }, [profile])

  const all = useMemo(() => getAllSkills(), [])
  const subjects = useMemo(() => LEARN_SUBJECTS.filter((s) => all.some((k) => k.subject === s)), [all])
  const bySubject = useMemo(() => (subject === 'all' ? all : all.filter((s) => s.subject === subject)), [all, subject])
  const grades = useMemo(() => [...new Set(bySubject.map((s) => s.grade))].sort((a, b) => a - b), [bySubject])
  const shownGrade = grade === 'all' || grades.includes(Number(grade) as Grade) ? grade : 'all'
  const byGrade = useMemo(
    () => (shownGrade === 'all' ? bySubject : bySubject.filter((s) => s.grade === Number(shownGrade))),
    [bySubject, shownGrade],
  )
  const stateOf = (id: string) => skillsProgress?.[id]?.state
  const visible = byGrade.filter((s) => matchesState(state, stateOf(s.id)))

  const groups = useMemo(() => {
    const map = new Map<Grade, Skill[]>()
    for (const s of visible) map.set(s.grade, [...(map.get(s.grade) ?? []), s])
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([g, skills]) => ({
        grade: g,
        skills: [...skills].sort((a, b) => a.semester - b.semester || a.id.localeCompare(b.id)),
      }))
  }, [visible])

  const subjectOptions: FilterOption<'all' | SubjectId>[] = [
    { value: 'all', label: t('filters.allSubjects'), count: all.length },
    ...subjects.map((s) => ({
      value: s,
      label: t(`learn.subject.${s}`),
      icon: subjectEmoji(s),
      count: all.filter((k) => k.subject === s).length,
    })),
  ]
  const gradeOptions: FilterOption<string>[] = [
    { value: 'all', label: t('filters.allGrades'), count: bySubject.length },
    ...grades.map((g) => ({ value: String(g), label: t(`play.grades.${g}`), count: bySubject.filter((s) => s.grade === g).length })),
  ]

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link to="/" className="inline-flex min-h-[44px] items-center text-sm font-bold underline">
          ← Ludiko
        </Link>
        <LanguageToggle />
      </header>

      <h1 className="text-center text-3xl font-extrabold text-ludiko-text">
        <span aria-hidden="true">🎒 </span>
        {t('session.list.title')}
      </h1>
      <p className="mb-4 mt-1 text-center text-base font-semibold text-ludiko-text/70">{t('session.list.subtitle')}</p>

      <div className="mb-5 flex flex-col gap-3 rounded-3xl bg-white/70 p-3 shadow-sm" data-testid="practice-filters">
        <FilterChips label={t('filters.subject')} showLabel scroll options={subjectOptions} value={subject} onChange={setSubject} testId="practice-subject" />
        <FilterChips
          label={t('filters.grade')}
          showLabel
          options={gradeOptions}
          value={shownGrade}
          onChange={(g) => {
            gradeTouched.current = true
            setGrade(g)
          }}
          testId="practice-grade"
        />
        {skillsProgress && (
          <FilterChips
            label={t('filters.state')}
            showLabel
            options={stateOptions(t, byGrade.map((s) => stateOf(s.id)))}
            value={state}
            onChange={setState}
            testId="practice-state"
          />
        )}
      </div>

      {groups.length === 0 && (
        <p className="rounded-3xl bg-white p-5 text-center text-base font-bold text-ludiko-text shadow-sm" data-testid="practice-empty">
          {t('filters.none')}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(({ grade: g, skills }) => (
          <section key={g} aria-labelledby={`grade-${g}`}>
            <h2 id={`grade-${g}`} className="mb-2 text-lg font-extrabold text-ludiko-purple">
              {t(`profiles.gradeLabels.${g}`)}
            </h2>
            <ul className="flex flex-col gap-2">
              {skills.map((skill) => {
                const ready = skillHasItems(skill)
                return (
                  <li key={skill.id}>
                    <Link
                      to={`/practice/${skill.id}`}
                      className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-md active:scale-95"
                    >
                      <span className="min-w-0 text-base font-bold leading-snug text-ludiko-text">
                        {subject === 'all' && <span aria-hidden="true">{subjectEmoji(skill.subject)} </span>}
                        {localize(skill.title, i18n.language)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          ready ? 'bg-ludiko-green' : 'bg-gray-100 text-ludiko-text/70'
                        }`}
                      >
                        {ready ? t('session.list.ready') : t('session.list.soon')}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
