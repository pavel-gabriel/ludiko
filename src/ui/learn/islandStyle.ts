import type { SkillMapNode } from '@/learner'

/**
 * What an island looks like on the child's map. Never "gap" or "failed": unexplored is just "new".
 * `known`: the level check found the child already knows it — skipped on the route, not an achievement.
 */
export type IslandState = 'locked' | 'new' | 'learning' | 'practised' | 'mastered' | 'review' | 'known'

export const ISLAND_STATES: readonly IslandState[] = ['new', 'learning', 'practised', 'review', 'mastered', 'known', 'locked']

export function islandState(node: Pick<SkillMapNode, 'state' | 'unlocked' | 'dueForReview' | 'known'>): IslandState {
  if (!node.unlocked) return 'locked'
  if (node.dueForReview) return 'review'
  if (node.known) return 'known'
  switch (node.state) {
    case 'mastered':
      return 'mastered'
    case 'practised':
      return 'practised'
    case 'learning':
      return 'learning'
    default:
      return 'new'
  }
}

/** Each state is told apart by an icon and a text label as well as colour */
export const ISLAND_LOOK: Record<IslandState, { icon: string; tile: string; chip: string }> = {
  locked: {
    icon: '🔒',
    tile: 'border-2 border-dashed border-gray-300 bg-gray-100 text-ludiko-text/60',
    chip: 'bg-gray-200 text-ludiko-text/70',
  },
  new: {
    icon: '🏝️',
    tile: 'bg-ludiko-yellow ring-2 ring-ludiko-orange text-ludiko-text shadow-md',
    chip: 'bg-white text-ludiko-text',
  },
  learning: {
    icon: '🌱',
    tile: 'bg-ludiko-green text-ludiko-text shadow-md',
    chip: 'bg-white text-ludiko-text',
  },
  practised: {
    icon: '⭐',
    tile: 'bg-ludiko-blue text-ludiko-text shadow-md',
    chip: 'bg-white text-ludiko-text',
  },
  mastered: {
    icon: '🏆',
    tile: 'bg-ludiko-purple text-ludiko-text shadow-md',
    chip: 'bg-white text-ludiko-text',
  },
  review: {
    icon: '🔄',
    tile: 'bg-ludiko-orange text-ludiko-text shadow-md',
    chip: 'bg-white text-ludiko-text',
  },
  known: {
    icon: '✔️',
    tile: 'border-2 border-ludiko-green bg-white/70 text-ludiko-text/80',
    chip: 'bg-ludiko-green/60 text-ludiko-text',
  },
}

/** Map filter buckets (FilterChips on the map): what is left to do, what is under way, what is done */
export type IslandBucket = 'todo' | 'doing' | 'done' | 'locked'
export type IslandFilter = 'all' | IslandBucket

export function islandBucket(state: IslandState): IslandBucket {
  switch (state) {
    case 'locked':
      return 'locked'
    case 'new':
      return 'todo'
    case 'mastered':
    case 'known':
      return 'done'
    default:
      return 'doing' // learning, practised, a review that is due
  }
}
