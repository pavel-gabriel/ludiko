/**
 * THE seam between sessions and item production.
 *
 * Everything in src/ui/session gets its items from `getSessionItems` and nowhere else.
 * Today it serves the static bank (content/items) from the registry; the integrator
 * switches the body to the generators module (src/engine/items) without touching any UI.
 */
import { getItemsForSkill } from '@/engine/content/registry'
import type { Item, Skill } from '@/engine/types'

/** Fisher–Yates on a copy */
function shuffled<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Up to `count` items for a skill, in play order.
 * Static fallback: the bank is shuffled; if it has fewer than `count` items the bank is
 * repeated (copies get unique ids "<id>~2", "<id>~3", … so results and keys never collide).
 * Returns [] when the skill has no items at all.
 */
export function getSessionItems(skill: Skill, count: number, rnd: () => number = Math.random): Item[] {
  const bank = getItemsForSkill(skill.id)
  if (bank.length === 0 || count <= 0) return []
  const out: Item[] = []
  let round = 1
  while (out.length < count) {
    for (const item of shuffled(bank, rnd)) {
      if (out.length >= count) break
      out.push(round === 1 ? item : { ...item, id: `${item.id}~${round}` })
    }
    round += 1
  }
  return out
}
