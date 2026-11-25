import {
  ALL_STICKER_IDS,
  STICKER_SETS,
  STREAK_MILESTONES,
  findSticker,
  parseSpecial,
  setStickerId,
  skillStickerId,
  streakStickerId,
  type StickerSet,
} from './stickerSets'

/**
 * How stickers are earned. All pure functions, so the rules are easy to read and to test.
 * Everything is earned by learning, never bought, and nothing is ever taken away:
 *
 *  1. A finished session with at least 2 stars gives a new sticker from the sets.
 *  2. Finishing today's mission gives a bonus sticker, from the set the child is closest to completing.
 *  3. Each mastered skill ("island conquered") gives a special island sticker.
 *  4. Completing a whole set gives a special set sticker.
 *  5. Play days add up (they never have to be in a row): 3, 7, 14 and 30 days give a special sticker.
 */

/** Sessions with at least this many stars unlock a sticker */
export const STICKER_MIN_STARS = 2

/** Stored ids with duplicates removed, order (= the order they were earned) kept. Old emoji ids stay valid as they are. */
export function migrateStickers(stored: readonly string[]): string[] {
  return [...new Set(stored.filter((id) => typeof id === 'string' && id.length > 0))]
}

/** Owned ids that belong to a known set (or are special stickers): what the album can show */
export function knownStickers(owned: readonly string[]): string[] {
  return migrateStickers(owned).filter((id) => findSticker(id) || parseSpecial(id))
}

/** Next regular sticker the child does not own yet, starting from a rotating offset; undefined when every set is complete */
export function pickSticker(owned: readonly string[], seed = Date.now()): string | undefined {
  const start = Math.abs(Math.floor(seed)) % ALL_STICKER_IDS.length
  for (let i = 0; i < ALL_STICKER_IDS.length; i++) {
    const id = ALL_STICKER_IDS[(start + i) % ALL_STICKER_IDS.length]
    if (!owned.includes(id)) return id
  }
  return undefined
}

/** Rule 1 */
export function sessionSticker(
  owned: readonly string[],
  session: { completed: boolean; stars: number },
  seed?: number,
): string | undefined {
  if (!session.completed || session.stars < STICKER_MIN_STARS) return undefined
  return pickSticker(owned, seed)
}

export interface SetProgress {
  set: StickerSet
  owned: number
  total: number
  complete: boolean
}

export function setProgress(owned: readonly string[]): SetProgress[] {
  return STICKER_SETS.map((set) => {
    const have = set.stickers.filter((x) => owned.includes(x.id)).length
    return { set, owned: have, total: set.stickers.length, complete: have === set.stickers.length }
  })
}

/** Rule 2: the bonus helps the set that is closest to done (ties: the first one); undefined when all are complete */
export function missionBonusSticker(owned: readonly string[], seed = 0): string | undefined {
  const open = setProgress(owned).filter((p) => !p.complete)
  if (open.length === 0) return undefined
  // keep helping a set that is already started; with an empty album, start with the first one
  const started = open.filter((p) => p.owned > 0)
  const best = (started.length > 0 ? started : open.slice(0, 1)).reduce((a, b) => (b.total - b.owned < a.total - a.owned ? b : a))
  const missing = best.set.stickers.filter((x) => !owned.includes(x.id))
  return missing[Math.abs(Math.floor(seed)) % missing.length].id
}

export interface SpecialInput {
  /** Skills currently mastered (progress state "mastered") */
  masteredSkillIds: readonly string[]
  /** Distinct play days so far */
  playDays: number
}

/**
 * Rules 3-5: special stickers that are due but not owned yet. Safe to call at any time (idempotent):
 * it only returns what is missing, in a stable order.
 */
export function dueSpecialStickers(owned: readonly string[], input: SpecialInput, extra: readonly string[] = []): string[] {
  const have = new Set([...owned, ...extra])
  const due: string[] = []
  for (const skillId of input.masteredSkillIds) {
    const id = skillStickerId(skillId)
    if (!have.has(id)) due.push(id)
  }
  for (const days of STREAK_MILESTONES) {
    const id = streakStickerId(days)
    if (input.playDays >= days && !have.has(id)) due.push(id)
  }
  for (const set of STICKER_SETS) {
    const id = setStickerId(set.id)
    if (!have.has(id) && set.stickers.every((x) => have.has(x.id))) due.push(id)
  }
  return due
}

/**
 * Ids in the order they were earned, newest last, flagged "new": everything after the count the child had
 * already seen. With no memory of a previous visit (null) only the latest few count as new.
 */
export function newStickerIds(owned: readonly string[], seenCount: number | null, fallbackRecent = 3): string[] {
  const start = seenCount === null ? Math.max(0, owned.length - fallbackRecent) : Math.min(seenCount, owned.length)
  return owned.slice(start)
}
