import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageToggle from '@/components/ui/LanguageToggle'
import { getAllSkills, getItemsForSkill } from '@/engine/content/registry'
import { localize, type Grade, type Skill } from '@/engine/types'

/** /practice — every skill in the registry, grouped by grade. A dev-friendly door into sessions. */
export default function PracticeListPage() {
  const { t, i18n } = useTranslation()

  const groups = useMemo(() => {
    const byGrade = new Map<Grade, Skill[]>()
    for (const s of getAllSkills()) byGrade.set(s.grade, [...(byGrade.get(s.grade) ?? []), s])
    return [...byGrade.entries()]
      .sort(([a], [b]) => a - b)
      .map(([grade, skills]) => ({
        grade,
        skills: [...skills].sort((a, b) => a.semester - b.semester || a.id.localeCompare(b.id)),
      }))
  }, [])

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
      <p className="mb-5 mt-1 text-center text-base font-semibold text-ludiko-text/70">{t('session.list.subtitle')}</p>

      <div className="flex flex-col gap-6">
        {groups.map(({ grade, skills }) => (
          <section key={grade} aria-labelledby={`grade-${grade}`}>
            <h2 id={`grade-${grade}`} className="mb-2 text-lg font-extrabold text-ludiko-purple">
              {t(`profiles.gradeLabels.${grade}`)}
            </h2>
            <ul className="flex flex-col gap-2">
              {skills.map((skill) => {
                const n = getItemsForSkill(skill.id).length
                return (
                  <li key={skill.id}>
                    <Link
                      to={`/practice/${skill.id}`}
                      className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-md active:scale-95"
                    >
                      <span className="min-w-0 text-base font-bold leading-snug text-ludiko-text">
                        {localize(skill.title, i18n.language)}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                          n > 0 ? 'bg-ludiko-green' : 'bg-gray-100 text-ludiko-text/70'
                        }`}
                      >
                        {n > 0 ? t('session.list.items', { n }) : t('session.list.soon')}
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
