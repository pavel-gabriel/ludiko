import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Grade } from '@/engine/types'
import type { SkillMapNode } from '@/learner'
import { islandState, ISLAND_LOOK, ISLAND_STATES } from './islandStyle'

export interface MapIsland extends SkillMapNode {
  /** Kid-readable skill title */
  title: string
}

const tileBase = 'flex min-h-[132px] flex-col justify-between gap-2 rounded-3xl p-3 text-left'

/** Adventure map: islands grouped by grade; unlocked islands are links to practice, hidden ones are not */
export default function SkillMapView({ islands }: { islands: MapIsland[] }) {
  const { t } = useTranslation()

  const grades = [...new Set(islands.map((i) => i.grade))].sort((a, b) => a - b) as Grade[]

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={t('learn.map.legend')} className="rounded-3xl bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-extrabold text-ludiko-text/70">{t('learn.map.legend')}</h2>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {ISLAND_STATES.map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm font-bold text-ludiko-text">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${ISLAND_LOOK[s].tile}`} aria-hidden="true">
                {ISLAND_LOOK[s].icon}
              </span>
              {t(`learn.map.state.${s}`)}
            </li>
          ))}
        </ul>
      </section>

      {islands.length === 0 && (
        <p className="rounded-3xl bg-white p-6 text-center text-lg font-bold text-ludiko-text shadow-md">
          <span className="block text-5xl" aria-hidden="true">🌊</span>
          {t('learn.map.empty')}
        </p>
      )}

      {grades.map((grade) => {
        const inGrade = islands.filter((i) => i.grade === grade)
        const semesters = [...new Set(inGrade.map((i) => i.semester))].sort()
        return (
          <section key={grade} aria-labelledby={`map-grade-${grade}`} className="rounded-3xl bg-sky-50 p-3">
            <h2 id={`map-grade-${grade}`} className="mb-3 text-xl font-extrabold text-ludiko-purple">
              <span aria-hidden="true">🌊 </span>
              {t(`profiles.gradeLabels.${grade}`)}
            </h2>
            {semesters.map((sem) => (
              <Fragment key={sem}>
                {semesters.length > 1 && (
                  <h3 className="mb-2 mt-3 text-sm font-extrabold text-ludiko-text/70">{t('learn.map.semester', { n: sem })}</h3>
                )}
                <ul className="grid grid-cols-2 gap-3">
                  {inGrade
                    .filter((i) => i.semester === sem)
                    .map((island) => {
                      const state = islandState(island)
                      const look = ISLAND_LOOK[state]
                      const label = t(`learn.map.state.${state}`)
                      const body = (
                        <>
                          <span className="flex items-start justify-between gap-1">
                            <span className="text-3xl" aria-hidden="true">{look.icon}</span>
                          </span>
                          <span className="line-clamp-4 text-sm font-bold leading-snug">{island.title}</span>
                          <span className={`self-start rounded-full px-2.5 py-1 text-xs font-extrabold ${look.chip}`}>{label}</span>
                        </>
                      )
                      return (
                        <li key={island.skillId}>
                          {state === 'locked' ? (
                            <div
                              className={`${tileBase} h-full ${look.tile}`}
                              data-state={state}
                              data-testid={`island-${island.skillId}`}
                              role="group"
                              aria-disabled="true"
                              aria-label={t('learn.map.lockedAria', { title: island.title })}
                            >
                              {body}
                            </div>
                          ) : (
                            <Link
                              to={`/practice/${island.skillId}`}
                              className={`${tileBase} h-full active:scale-95 transition-transform ${look.tile}`}
                              data-state={state}
                              data-testid={`island-${island.skillId}`}
                              aria-label={t('learn.map.open', { title: island.title, state: label })}
                            >
                              {body}
                            </Link>
                          )}
                        </li>
                      )
                    })}
                </ul>
              </Fragment>
            ))}
          </section>
        )
      })}
    </div>
  )
}
