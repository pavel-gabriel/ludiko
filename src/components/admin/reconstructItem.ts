import { getItemsForSkill, getSkill } from '@/engine/content/registry'
import { generateItems } from '@/engine/items/generators'
import type { Item } from '@/engine/types'
import { buildReportSnapshot, type ReportSnapshot } from '@/services/reportSnapshot'

const GENERATED_ID = /^gen\.(.+)\.(\d+)\.(\d+)$/

/** The skill whose content pack `reconstructSnapshot` needs loaded (docs/ENGINE.md "Content packs") */
export function snapshotSkillId(itemId: string, skillId?: string): string | undefined {
  return GENERATED_ID.exec(itemId)?.[1] ?? skillId
}

/**
 * Old reports have no snapshot. Rebuild what the child saw from the item id:
 * - generated ids (gen.<skillId>.<seed>.<index>) are deterministic given the seed, so regenerate them;
 *   (approximate if the original session fixed a difficulty)
 * - otherwise look the id up in the static bank of the skill.
 * Returns undefined when nothing can be rebuilt.
 */
export function reconstructSnapshot(itemId: string, skillId?: string): ReportSnapshot | undefined {
  try {
    const gen = GENERATED_ID.exec(itemId)
    if (gen) {
      const skill = getSkill(gen[1])
      if (!skill) return undefined
      const index = Number(gen[3])
      const items = generateItems(skill, index + 1, { seed: Number(gen[2]) })
      const item = items.find((i) => i.id === itemId)
      return item ? buildReportSnapshot(item, 'practice', '/') : undefined
    }
    if (!skillId) return undefined
    const item = getItemsForSkill(skillId).find((i) => i.id === itemId)
    return item ? buildReportSnapshot(item, 'practice', '/') : undefined
  } catch {
    return undefined
  }
}

/**
 * The exact item behind a report, so the admin can open THAT question (not a new one):
 * generated ids are regenerated from their seed, bank ids are looked up. undefined when it cannot be rebuilt.
 */
export function reconstructItem(itemId: string, skillId?: string): Item | undefined {
  try {
    const gen = GENERATED_ID.exec(itemId)
    if (gen) {
      const skill = getSkill(gen[1])
      if (!skill) return undefined
      const index = Number(gen[3])
      return generateItems(skill, index + 1, { seed: Number(gen[2]) }).find((i) => i.id === itemId)
    }
    if (!skillId) return undefined
    return getItemsForSkill(skillId).find((i) => i.id === itemId)
  } catch {
    return undefined
  }
}
