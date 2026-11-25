import type { SkillMapNode } from '@/learner'

/** What an island looks like on the child's map. Never "gap" or "failed": unexplored is just "new". */
export type IslandState = 'locked' | 'new' | 'learning' | 'practised' | 'mastered' | 'review'

export const ISLAND_STATES: readonly IslandState[] = ['locked', 'new', 'learning', 'practised', 'mastered', 'review']

export function islandState(node: Pick<SkillMapNode, 'state' | 'unlocked' | 'dueForReview'>): IslandState {
  if (!node.unlocked) return 'locked'
  if (node.dueForReview) return 'review'
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
}
