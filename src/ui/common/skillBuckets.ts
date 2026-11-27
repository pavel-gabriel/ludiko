import type { TFunction } from 'i18next'
import type { SkillState } from '@/engine/types'
import type { FilterOption } from './FilterChips'

/** Progress filter used by skill lists outside the map (/practice, "Alege-ți singur"): same words as the map */
export type StateFilter = 'all' | 'todo' | 'doing' | 'done'

export function stateBucket(state: SkillState | undefined): Exclude<StateFilter, 'all'> {
  if (state === 'mastered') return 'done'
  if (state === 'learning' || state === 'practised') return 'doing'
  return 'todo' // never seen, or a gap: something to do, never "failed"
}

/** Chip options with counts for a list of skill states */
export function stateOptions(t: TFunction, states: (SkillState | undefined)[]): FilterOption<StateFilter>[] {
  const c = { todo: 0, doing: 0, done: 0 }
  for (const s of states) c[stateBucket(s)]++
  return [
    { value: 'all', label: t('filters.all'), count: states.length },
    { value: 'todo', label: t('filters.todo'), icon: '🏝️', count: c.todo },
    { value: 'doing', label: t('filters.doing'), icon: '🌱', count: c.doing },
    { value: 'done', label: t('filters.done'), icon: '🏆', count: c.done },
  ]
}

export const matchesState = (filter: StateFilter, state: SkillState | undefined) => filter === 'all' || stateBucket(state) === filter
