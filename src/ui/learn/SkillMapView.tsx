import { useMemo, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { Grade } from '@/engine/types'
import type { SkillMapNode } from '@/learner'
import FilterChips, { type FilterOption } from '@/ui/common/FilterChips'
import { useBoolPref } from '@/ui/common/devicePref'
import { islandBucket, islandState, ISLAND_LOOK, ISLAND_STATES, type IslandFilter, type IslandState } from './islandStyle'

export interface MapIsland extends SkillMapNode {
  /** Kid-readable skill title */
  title: string
}

/** Device preference: show locked ("ascunse") islands under "Toate" (off by default: the route stays short) */
export const SHOW_LOCKED_PREF = 'filters.map.showLocked'

export function stateLabel(t: TFunction, s: IslandState): string {
  return s === 'known' ? t('guide.map.stateKnown') : t(`learn.map.state.${s}`)
}

/** The island the route points at: the read model's `next`, else (fixtures, old data) the first open new island */
export function nextOf(islands: MapIsland[]): MapIsland | undefined {
  const flagged = islands.find((i) => i.next)
  if (flagged) return flagged
  if (islands.some((i) => i.next !== undefined)) return undefined
  return islands.find((i) => islandState(i) === 'new')
}

/** Counts per filter chip; "Toate" counts what "Toate" shows (locked ones only when they are shown) */
export function filterCounts(islands: MapIsland[], showLocked: boolean): Record<IslandFilter, number> {
  const c: Record<IslandFilter, number> = { all: 0, todo: 0, doing: 0, done: 0, locked: 0 }
  for (const i of islands) c[islandBucket(islandState(i))]++
  c.all = islands.length - (showLocked ? 0 : c.locked)
  return c
}

export function filterIslands(islands: MapIsland[], filter: IslandFilter, showLocked: boolean): MapIsland[] {
  return islands.filter((i) => {
    const b = islandBucket(islandState(i))
    if (filter === 'all') return showLocked || b !== 'locked'
    return b === filter
  })
}

const ord = (i: MapIsland, fallback: number) => (i.route ?? fallback) + 1

function Stop({ island, n, isNext, last }: { island: MapIsland; n: number; isNext: boolean; last: boolean }) {
  const { t } = useTranslation()
  const state = islandState(island)
  const look = ISLAND_LOOK[state]
  const label = stateLabel(t, state)
  const known = state === 'known'
  const tile = `flex w-full items-center gap-3 rounded-2xl px-3 text-left ${known ? 'min-h-[56px] py-2' : 'min-h-[72px] py-3'} ${look.tile} ${
    isNext ? 'ring-4 ring-ludiko-pink' : ''
  }`
  const body = (
    <>
      <span className={known ? 'text-xl' : 'text-3xl'} aria-hidden="true">{look.icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`line-clamp-3 font-bold leading-snug ${known ? 'text-sm' : 'text-base'}`}>{island.title}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${look.chip}`}>{label}</span>
          {isNext && (
            <span className="rounded-full bg-ludiko-pink px-2.5 py-0.5 text-xs font-extrabold text-ludiko-text" data-testid="next-badge">
              <span aria-hidden="true">⭐ </span>
              {t('guide.map.nextBadge')}
            </span>
          )}
        </span>
      </span>
    </>
  )
  return (
    <li className="relative flex gap-3" data-route={n}>
      <div className="flex w-9 shrink-0 flex-col items-center" aria-hidden="true">
        <span
          className={`z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold shadow-sm ${
            isNext ? 'bg-ludiko-pink text-ludiko-text' : known ? 'bg-ludiko-green/60 text-ludiko-text/70' : 'bg-white text-ludiko-text'
          }`}
        >
          {n}
        </span>
        {!last && <span className="-mb-3 w-0 flex-1 border-l-4 border-dotted border-sky-300" />}
      </div>
      <div className="min-w-0 flex-1 pb-3">
        {state === 'locked' ? (
          <div
            className={tile}
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
            className={`${tile} transition-transform active:scale-95`}
            data-state={state}
            data-next={isNext || undefined}
            data-testid={`island-${island.skillId}`}
            aria-label={`${t('guide.map.stop', { n })}: ${t('learn.map.open', { title: island.title, state: label })}`}
          >
            {body}
          </Link>
        )}
      </div>
    </li>
  )
}

/**
 * Adventure map as an ordered ROUTE of islands (prerequisites first, then grade/semester): numbered stops on a
 * dotted path, the next island highlighted, islands the check found already known shown as skipped ("Știi
 * deja"). Filter chips with counts (Toate / De făcut / În lucru / Gata / Ascunse) and a remembered toggle for
 * locked islands keep long maps short. Unlocked islands are links to practice; locked ones are not.
 */
export default function SkillMapView({ islands, upToGrade }: { islands: MapIsland[]; /** Progress counts islands up to this grade */ upToGrade?: number }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<IslandFilter>('all')
  const [showLocked, setShowLocked] = useBoolPref(SHOW_LOCKED_PREF, false)
  const [legendOpen, setLegendOpen] = useState(false)

  const next = useMemo(() => nextOf(islands), [islands])
  const counts = useMemo(() => filterCounts(islands, showLocked), [islands, showLocked])
  const shown = useMemo(() => filterIslands(islands, filter, showLocked), [islands, filter, showLocked])
  // "Insule gata: X din Y" counts the child's own grades, not the whole subject up to grade VIII
  const mine = upToGrade === undefined ? islands : islands.filter((i) => i.grade <= upToGrade)
  const knownCount = mine.filter((i) => islandState(i) === 'known').length
  const doneCount = mine.filter((i) => islandBucket(islandState(i)) === 'done').length
  const position = new Map(islands.map((i, k) => [i.skillId, ord(i, k)]))

  const options: FilterOption<IslandFilter>[] = [
    { value: 'all', label: t('filters.all'), count: counts.all },
    { value: 'todo', label: t('filters.todo'), icon: '🏝️', count: counts.todo },
    { value: 'doing', label: t('filters.doing'), icon: '🌱', count: counts.doing },
    { value: 'done', label: t('filters.done'), icon: '🏆', count: counts.done },
    { value: 'locked', label: t('filters.locked'), icon: '🔒', count: counts.locked },
  ]

  const grades = [...new Set(shown.map((i) => i.grade))] as Grade[]

  if (islands.length === 0) {
    return (
      <p className="rounded-3xl bg-white p-6 text-center text-lg font-bold text-ludiko-text shadow-md">
        <span className="block text-5xl" aria-hidden="true">🌊</span>
        {t('learn.map.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {next ? (
        <Link
          to={`/practice/${next.skillId}`}
          data-testid="next-island"
          data-guide="next-island"
          className="flex items-center gap-3 rounded-3xl bg-ludiko-yellow p-4 shadow-md ring-4 ring-ludiko-orange transition-transform active:scale-[0.98]"
        >
          <span className="text-5xl" aria-hidden="true">🏝️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold uppercase tracking-wide text-ludiko-text/70">
              {t('guide.map.nextTitle')} · {t('guide.map.stop', { n: position.get(next.skillId) })}
            </span>
            <span className="block text-lg font-extrabold leading-snug text-ludiko-text">{next.title}</span>
            <span className="mt-1 inline-flex min-h-[40px] items-center rounded-full bg-ludiko-green px-4 text-base font-extrabold text-ludiko-text shadow-sm">
              {t('guide.map.go')} <span aria-hidden="true">&nbsp;→</span>
            </span>
          </span>
        </Link>
      ) : (
        <p className="rounded-3xl bg-white p-4 text-center text-base font-bold text-ludiko-text shadow-sm" data-testid="no-next">
          <span aria-hidden="true">🎉 </span>
          {t('guide.map.noNext')}
        </p>
      )}

      <div className="rounded-3xl bg-white p-3 shadow-sm" data-guide="map-filters">
        <p className="mb-2 px-1 text-sm font-bold text-ludiko-text/80" data-testid="map-progress">
          {t('guide.map.progress', { done: doneCount, total: mine.length })}
          {knownCount > 0 && <span className="block text-xs font-semibold">{t('guide.map.knownNote', { n: knownCount })}</span>}
        </p>
        <FilterChips label={t('filters.islands')} options={options} value={filter} onChange={setFilter} testId="map-filter" />
        {counts.locked > 0 && (
          <label className="mt-2 flex min-h-[44px] items-center gap-3 px-1 text-sm font-bold text-ludiko-text">
            <input
              type="checkbox"
              checked={showLocked}
              onChange={(e) => setShowLocked(e.target.checked)}
              data-testid="toggle-locked"
              className="h-6 w-6 shrink-0"
            />
            {t('filters.showLocked')}
          </label>
        )}
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          aria-expanded={legendOpen}
          aria-controls="map-legend"
          className="mt-1 flex min-h-[44px] w-full items-center gap-2 px-1 text-left text-sm font-extrabold text-ludiko-text/70"
        >
          <span className="flex-1">{t('learn.map.legend')}</span>
          <span aria-hidden="true">{legendOpen ? '▴' : '▾'}</span>
        </button>
        {legendOpen && (
          <ul id="map-legend" className="grid grid-cols-2 gap-x-2 gap-y-1.5 px-1 pb-1" aria-label={t('learn.map.legend')}>
            {ISLAND_STATES.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm font-bold text-ludiko-text">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${ISLAND_LOOK[s].tile}`} aria-hidden="true">
                  {ISLAND_LOOK[s].icon}
                </span>
                {stateLabel(t, s)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-5" data-guide="map-route" aria-label={t('guide.map.route')} role="region">
        {shown.length === 0 && (
          <p className="rounded-3xl bg-white p-5 text-center text-base font-bold text-ludiko-text shadow-sm" data-testid="filter-empty">
            {t('filters.none')}
          </p>
        )}
        {grades.map((grade) => {
          const inGrade = shown.filter((i) => i.grade === grade)
          const semesters = [...new Set(inGrade.map((i) => i.semester))]
          return (
            <section key={grade} aria-labelledby={`map-grade-${grade}`} className="rounded-3xl bg-sky-50 p-3">
              <h2 id={`map-grade-${grade}`} className="mb-3 text-xl font-extrabold text-ludiko-purple">
                <span aria-hidden="true">🌊 </span>
                {t(`profiles.gradeLabels.${grade}`)}
              </h2>
              {semesters.map((sem) => {
                const stops = inGrade.filter((i) => i.semester === sem)
                return (
                  <div key={sem}>
                    {semesters.length > 1 && (
                      <h3 className="mb-2 mt-1 text-sm font-extrabold text-ludiko-text/70">{t('learn.map.semester', { n: sem })}</h3>
                    )}
                    <ol className="flex flex-col">
                      {stops.map((island, k) => (
                        <Stop
                          key={island.skillId}
                          island={island}
                          n={position.get(island.skillId) ?? k + 1}
                          isNext={island.skillId === next?.skillId}
                          last={k === stops.length - 1}
                        />
                      ))}
                    </ol>
                  </div>
                )
              })}
            </section>
          )
        })}
        {filter === 'all' && !showLocked && counts.locked > 0 && (
          <p className="flex flex-wrap items-center justify-center gap-2 rounded-3xl bg-white/70 p-3 text-center text-sm font-bold text-ludiko-text/80">
            <span>
              <span aria-hidden="true">🔒 </span>
              {t('filters.lockedHidden', { n: counts.locked })}
            </span>
            <button
              type="button"
              onClick={() => setShowLocked(true)}
              data-testid="show-locked"
              className="min-h-[44px] rounded-full bg-white px-4 font-extrabold shadow-sm active:scale-95"
            >
              {t('filters.showThem')}
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
