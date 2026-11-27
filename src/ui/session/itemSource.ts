/**
 * THE seam between sessions and item production.
 *
 * Everything in src/ui/session gets its items from `getSessionItems` and nowhere else.
 * Skills with generator sources get fresh procedural items (which also mix in static bank
 * items); skills with only a static bank are served from content/items.
 */
import { getItemsForSkill, isSkillContentLoaded } from '@/engine/content/registry'
import { generateItems } from '@/engine/items/generators'
import type { Item, Skill } from '@/engine/types'

/**
 * True when the skill can produce items (generator or static bank). Before its content pack is loaded the
 * skill's declared `bank` source is trusted (content validation checks every bank has items).
 */
export function skillHasItems(skill: Skill): boolean {
  if (skill.itemSources.some((s) => 'generator' in s)) return true
  if (!isSkillContentLoaded(skill)) return skill.itemSources.some((s) => 'bank' in s)
  return getItemsForSkill(skill.id).length > 0
}

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
 * The skill's content pack must be loaded (`ensureContentForSkills` / `ContentGate`).
 */
export function getSessionItems(skill: Skill, count: number, rnd: () => number = Math.random): Item[] {
  if (count > 0 && skill.itemSources.some((s) => 'generator' in s)) {
    return generateItems(skill, count, { seed: Math.floor(rnd() * 2 ** 31) })
  }
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
