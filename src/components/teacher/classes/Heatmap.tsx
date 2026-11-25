import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { groupByGrade, heatmapColumns, skillStateOf, type HeatSkill, type ProgressBySeat } from '@/classroom/heatmap'
import type { SeatDoc } from '@/classroom/types'
import type { SubjectId } from '@/engine/types'
import { getSkill } from '@/engine/content/registry'
import { localize } from '@/engine/types'
import { STATE_LOOK, STATE_ORDER } from './stateLook'

export interface HeatmapProps {
  seats: SeatDoc[]
  progress: ProgressBySeat
  subject: SubjectId
  /** Columns: the subject's skills up to this grade */
  maxGrade: number
  /** Header click: the teacher wants to assign this skill */
  onPickSkill?: (skillId: string) => void
  /** Test hook: skills to show instead of the registry's */
  skills?: HeatSkill[]
}

const HEAD_ROW = 28 // px: height of the grade row, where the skill row sticks below it

/** Seats × skills, grouped by grade. Scrolls inside its own box; the seat column and both header rows stay put. */
export default function Heatmap({ seats, progress, subject, maxGrade, onPickSkill, skills }: HeatmapProps) {
  const { t, i18n } = useTranslation()
  const [onlyGaps, setOnlyGaps] = useState(false)

  const all = useMemo(() => heatmapColumns(subject, maxGrade, skills), [subject, maxGrade, skills])
  const columns = useMemo(
    () => (onlyGaps ? all.filter((c) => seats.some((s) => skillStateOf(progress[s.id], subject, c.id) === 'gap')) : all),
    [all, onlyGaps, seats, progress, subject],
  )
  const groups = useMemo(() => groupByGrade(columns), [columns])
  const titleOf = (id: string) => localize(getSkill(id)?.title, i18n.language) || id

  return (
    <div className="flex flex-col gap-3" data-testid="heatmap">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="heatmap-title" className="text-lg font-extrabold">{t('classroom.map.title')}</h2>
        <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={onlyGaps}
            onChange={(e) => setOnlyGaps(e.target.checked)}
            data-testid="heatmap-only-gaps"
          />
          {t('classroom.map.onlyGaps')}
        </label>
      </div>

      <ul className="flex flex-wrap gap-2" aria-label={t('classroom.map.legend')}>
        {STATE_ORDER.map((s) => (
          <li key={s} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${STATE_LOOK[s].chip}`}>
            <span aria-hidden="true" className="w-3 text-center">{STATE_LOOK[s].glyph}</span>
            {t(`classroom.state.${s}`)}
          </li>
        ))}
      </ul>

      {seats.length === 0 || columns.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center font-semibold shadow-sm">
          {seats.length === 0 ? t('classroom.map.noSeats') : t('classroom.map.noColumns')}
        </p>
      ) : (
        <div
          className="relative max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-white"
          role="region"
          aria-label={t('classroom.map.title')}
          tabIndex={0}
        >
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 top-0 z-30 min-w-[84px] max-w-[110px] border-b border-r border-gray-200 bg-white px-2 text-left align-bottom font-extrabold"
                >
                  {t('classroom.map.seat')}
                </th>
                {groups.map((g) => (
                  <th
                    key={g.grade}
                    colSpan={g.skills.length}
                    scope="colgroup"
                    style={{ height: HEAD_ROW }}
                    className="sticky top-0 z-20 whitespace-nowrap border-b border-l border-gray-200 bg-purple-100 px-2 text-left font-extrabold"
                  >
                    <span className="sticky left-[96px] inline-block">{t(`profiles.gradeLabels.${g.grade}`)}</span>
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    style={{ top: HEAD_ROW }}
                    className="sticky z-20 w-9 min-w-[36px] border-b border-gray-200 bg-white p-0 align-bottom font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => onPickSkill?.(c.id)}
                      title={titleOf(c.id)}
                      aria-label={t('classroom.map.pickSkill', { skill: titleOf(c.id) })}
                      className="flex h-36 w-9 items-end justify-center overflow-hidden pb-1 text-left text-[11px] hover:bg-purple-50"
                    >
                      <span className="max-h-36 truncate leading-9 [writing-mode:vertical-rl] rotate-180">{titleOf(c.id)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seats.map((seat) => (
                <tr key={seat.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-[110px] truncate border-b border-r border-gray-200 bg-white px-2 py-1 text-left text-sm font-bold"
                    title={seat.label}
                  >
                    {seat.label}
                    {!progress[seat.id] && <span className="block text-[10px] font-semibold text-gray-500">{t('classroom.map.noSummary')}</span>}
                  </th>
                  {columns.map((c) => {
                    const state = skillStateOf(progress[seat.id], subject, c.id)
                    const label = t(`classroom.state.${state}`)
                    return (
                      <td
                        key={c.id}
                        data-state={state}
                        data-testid={`cell-${seat.id}-${c.id}`}
                        title={`${seat.label} · ${titleOf(c.id)} · ${label}`}
                        className={`h-9 w-9 min-w-[36px] border-b border-gray-100 text-center text-sm ${STATE_LOOK[state].cell}`}
                      >
                        <span aria-hidden="true">{STATE_LOOK[state].glyph}</span>
                        <span className="sr-only">{label}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
