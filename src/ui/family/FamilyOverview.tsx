import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { FamilyRow } from '@/learner/historyModels'
import { gradeLabel, shortDate } from './format'

/** One line per child: grade, play days this week, islands mastered, level checks; a link to the detail */
export default function FamilyOverview({ rows }: { rows: FamilyRow[] }) {
  const { t, i18n } = useTranslation()
  if (rows.length === 0) {
    return <p className="rounded-2xl bg-white p-4 text-base font-bold text-ludiko-text">{t('family.extras.overview.empty')}</p>
  }
  return (
    <ul className="flex flex-col gap-3" data-testid="family-overview">
      {rows.map((r) => (
        <li key={r.profileId} className="rounded-3xl bg-white p-4 shadow-sm" data-testid={`family-row-${r.profileId}`}>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ludiko-purple text-2xl" aria-hidden="true">
              {r.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-extrabold text-ludiko-text">{r.nickname}</h2>
              <p className="text-sm font-semibold text-ludiko-text/80" data-testid="family-line">
                {t('family.extras.overview.line', {
                  grade: gradeLabel(t, r.grade),
                  days: t('family.extras.overview.days', { count: r.playDaysThisWeek }),
                  mastered: t('family.extras.overview.mastered', { count: r.masteredTotal }),
                  checks: t('family.extras.overview.checks', { count: r.checksDone }),
                })}
              </p>
              <p className="text-xs font-semibold text-ludiko-text/60">
                {r.lastPlayDay
                  ? t('family.extras.overview.lastPlay', { date: shortDate(i18n.language, r.lastPlayDay) })
                  : t('family.extras.overview.neverPlayed')}
              </p>
            </div>
          </div>
          <Link
            to={`/learn/parent/history?profile=${encodeURIComponent(r.profileId)}`}
            className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl bg-ludiko-yellow px-3 text-center text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
          >
            {t('family.extras.overview.open', { name: r.nickname })}
          </Link>
        </li>
      ))}
    </ul>
  )
}
