import { getExplanation, getSkill } from '@/engine/content/registry'
import type { Explanation } from '@/engine/types'

/** SessionRunner asks by `item.explanationId`, or by skill id when the item has none: fall back to the skill's first explanation */
export function explanationFor(id: string): Explanation | undefined {
  const direct = getExplanation(id)
  if (direct) return direct
  const first = getSkill(id)?.explanations[0]
  return first ? getExplanation(first) : undefined
}
