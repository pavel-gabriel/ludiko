import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { classCounts, groupSuggestions, topGaps, type HeatSkill, type ProgressBySeat } from '@/classroom/heatmap'
import type { SeatDoc } from '@/classroom/types'
import { getSkill } from '@/engine/content/registry'
import { localize, type SubjectId } from '@/engine/types'

export interface ClassSummaryProps {
  seats: SeatDoc[]
  progress: ProgressBySeat
  subject: SubjectId
  /** Assign these skills (opens the assignment composer) */
  onAssign: (skillIds: string[]) => void
  skills?: HeatSkill[]
}

/** "Rezumat" first: counts, the skills most pupils miss, and groups of pupils who share the same deepest gap */
export default function ClassSummary({ seats, progress, subject, onAssign, skills }: ClassSummaryProps) {
  const { t, i18n } = useTranslation()
  const counts = useMemo(() => classCounts(seats, progress, subject), [seats, progress, subject])
  const gaps = useMemo(() => topGaps(seats, progress, subject, skills, 5), [seats, progress, subject, skills])
  const groups = useMemo(() => groupSuggestions(seats, progress, subject, skills), [seats, progress, subject, skills])
  const labelOf = (id: string) => seats.find((s) => s.id === id)?.label ?? id
  const titleOf = (id: string) => localize(getSkill(id)?.title, i18n.language) || id

  return (
    <div className="flex flex-col gap-4" data-testid="class-summary">
      <section aria-labelledby="sum-counts" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 id="sum-counts" className="sr-only">{t('classroom.summary.countsTitle')}</h2>
        <ul className="grid grid-cols-3 gap-2 text-center">
          <li className="rounded-xl bg-purple-50 p-2">
            <span className="block text-2xl font-extrabold">{counts.seats}</span>
            <span className="text-xs font-bold">{t('classroom.summary.seats')}</span>
          </li>
          <li className="rounded-xl bg-sky-50 p-2">
            <span className="block text-2xl font-extrabold">{counts.linked}</span>
            <span className="text-xs font-bold">{t('classroom.summary.linked')}</span>
          </li>
          <li className="rounded-xl bg-red-50 p-2">
            <span className="block text-2xl font-extrabold" data-testid="count-with-gaps">{counts.withGaps}</span>
            <span className="text-xs font-bold">{t('classroom.summary.withGaps')}</span>
          </li>
        </ul>
        {counts.seats > 0 && counts.withSummary < counts.seats && (
          <p className="mt-2 text-xs font-semibold text-gray-600">
            {t('classroom.summary.waiting', { count: counts.seats - counts.withSummary })}
          </p>
        )}
      </section>

      <section aria-labelledby="sum-gaps" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 id="sum-gaps" className="mb-2 text-lg font-extrabold">{t('classroom.summary.topGaps')}</h2>
        {gaps.length === 0 ? (
          <p className="font-semibold text-gray-600">{t('classroom.summary.noGaps')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {gaps.map((g) => (
              <li key={g.skillId} className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 p-3" data-testid={`gap-${g.skillId}`}>
                <p className="min-w-0 flex-1 basis-48 font-semibold">
                  <span className="mr-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-200 px-1.5 text-xs font-extrabold" aria-hidden="true">!</span>
                  {t('classroom.summary.gapAt', { count: g.count })} <strong>{titleOf(g.skillId)}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => onAssign([g.skillId])}
                  className="min-h-[44px] rounded-xl bg-ludiko-yellow px-4 text-sm font-bold shadow-sm active:scale-95"
                >
                  {t('classroom.summary.assign')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sum-groups" className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 id="sum-groups" className="text-lg font-extrabold">{t('classroom.summary.groups')}</h2>
        <p className="mb-2 text-sm text-gray-600">{t('classroom.summary.groupsHint')}</p>
        {groups.length === 0 ? (
          <p className="font-semibold text-gray-600">{t('classroom.summary.noGroups')}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {groups.map((g, i) => (
              <li key={g.skillId} className="rounded-xl bg-purple-50 p-3" data-testid={`group-${g.skillId}`}>
                <p className="font-extrabold">
                  {t('classroom.summary.group', { n: i + 1 })} · {t('classroom.pupils', { count: g.seatIds.length })}
                </p>
                <p className="text-sm font-semibold">{g.seatIds.map(labelOf).join(', ')}</p>
                <p className="mt-1 text-sm">
                  {t('classroom.summary.sharedGap')} <strong>{titleOf(g.skillId)}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => onAssign([g.skillId])}
                  className="mt-2 min-h-[44px] rounded-xl bg-white px-4 text-sm font-bold shadow-sm active:scale-95"
                >
                  {t('classroom.summary.assign')}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
