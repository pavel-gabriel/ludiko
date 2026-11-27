/**
 * The sticker album: plain emoji grouped into themed sets, our own curation (nothing licensed).
 * A sticker's stored id IS its emoji, so everything a child already owns from the first twelve-sticker
 * version stays valid: those twelve are simply members of the sets below (see LEGACY_STICKERS).
 * Special stickers (island conquered, set finished, play-day milestones) use prefixed ids, see `specialSticker`.
 */

import type { SubjectId } from '@/engine/types'
import { parseExtraSticker } from '@/learner/extrasUnlocks'
import { subjectEmoji } from '@/ui/learn/subjects'

export type SetId = 'animals' | 'fruits' | 'space' | 'sea' | 'sport'

export interface Sticker {
  /** Stored id = the emoji itself */
  id: string
  /** i18n key under `album.names.*` */
  key: string
}

export interface StickerSet {
  id: SetId
  /** Set icon (also an emoji) */
  icon: string
  stickers: readonly Sticker[]
}

const s = (id: string, key: string): Sticker => ({ id, key })

export const STICKER_SETS: readonly StickerSet[] = [
  {
    id: 'animals',
    icon: '🦊',
    stickers: [
      s('🦊', 'fox'), s('🐼', 'panda'), s('🦁', 'lion'), s('🐧', 'penguin'), s('🐢', 'turtle'),
      s('🦉', 'owl'), s('🐝', 'bee'), s('🐞', 'ladybug'), s('🦋', 'butterfly'), s('🦄', 'unicorn'),
    ],
  },
  {
    id: 'fruits',
    icon: '🍎',
    stickers: [
      s('🍎', 'apple'), s('🍌', 'banana'), s('🍓', 'strawberry'), s('🍇', 'grapes'), s('🍊', 'orange'),
      s('🍉', 'watermelon'), s('🍒', 'cherries'), s('🍑', 'peach'), s('🍐', 'pear'), s('🍋', 'lemon'),
    ],
  },
  {
    id: 'space',
    icon: '🚀',
    stickers: [
      s('🚀', 'rocket'), s('🌍', 'earth'), s('🌙', 'moon'), s('🌟', 'star'), s('🪐', 'saturn'),
      s('☄️', 'comet'), s('🌞', 'sun'), s('👽', 'alien'), s('🛰️', 'satellite'), s('🔭', 'telescope'),
    ],
  },
  {
    id: 'sea',
    icon: '🌊',
    stickers: [
      s('🐙', 'octopus'), s('🐳', 'whale'), s('🐬', 'dolphin'), s('🐠', 'fish'), s('🦀', 'crab'),
      s('🐚', 'shell'), s('🦈', 'shark'), s('🐡', 'pufferfish'), s('⚓', 'anchor'), s('🦑', 'squid'),
    ],
  },
  {
    id: 'sport',
    icon: '⚽',
    stickers: [
      s('⚽', 'football'), s('🏀', 'basketball'), s('🎾', 'tennis'), s('🏐', 'volleyball'), s('🏓', 'pingpong'),
      s('🚴', 'cycling'), s('🏊', 'swimming'), s('🥇', 'medal'), s('🏆', 'trophy'),
    ],
  },
]

/** Every regular sticker id, set by set */
export const ALL_STICKERS: readonly Sticker[] = STICKER_SETS.flatMap((set) => set.stickers)
export const ALL_STICKER_IDS: readonly string[] = ALL_STICKERS.map((x) => x.id)

const byId = new Map<string, { sticker: Sticker; set: StickerSet }>(
  STICKER_SETS.flatMap((set) => set.stickers.map((sticker) => [sticker.id, { sticker, set }] as const)),
)

export function findSticker(id: string): { sticker: Sticker; set: StickerSet } | undefined {
  return byId.get(id)
}

/** The twelve stickers of the first version: ids that may already be saved on a child's profile */
export const LEGACY_STICKERS = ['🦊', '🐼', '🦄', '🐙', '🦋', '🐢', '🦁', '🐧', '🐞', '🐳', '🦉', '🐝'] as const

/* ---------------- special stickers ---------------- */

export type SpecialKind = 'skill' | 'set' | 'streak' | 'extra'

export interface SpecialSticker {
  id: string
  kind: SpecialKind
  emoji: string
  /** skill id, set id, play-day count or milestone id */
  ref: string
}

/** Cumulative play days (never consecutive, so a missed day costs nothing) that unlock a sticker */
export const STREAK_MILESTONES = [3, 7, 14, 30] as const
const STREAK_EMOJI: Record<number, string> = { 3: '🌈', 7: '🎈', 14: '🌻', 30: '🎉' }
const SET_EMOJI: Record<SetId, string> = { animals: '🏅', fruits: '🧺', space: '🌌', sea: '🏝️', sport: '🎖️' }
/** Emoji pool for "island conquered" stickers; picked deterministically from the skill id */
const ISLAND_EMOJI = ['🏝️', '🗺️', '🧭', '⛵', '🔑', '💎', '👑', '🪄', '🧩', '🎯', '🔮', '🏰'] as const

export const skillStickerId = (skillId: string) => `skill:${skillId}`
export const setStickerId = (setId: SetId) => `set:${setId}`
export const streakStickerId = (days: number) => `streak:${days}`

function hash(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

/** Parse a special sticker id; undefined for regular (emoji) ids and for malformed ones */
export function parseSpecial(id: string): SpecialSticker | undefined {
  const [prefix, ...rest] = id.split(':')
  const ref = rest.join(':')
  if (!ref) return undefined
  if (prefix === 'skill') return { id, kind: 'skill', ref, emoji: ISLAND_EMOJI[hash(ref) % ISLAND_EMOJI.length] }
  if (prefix === 'set' && STICKER_SETS.some((x) => x.id === ref)) {
    return { id, kind: 'set', ref, emoji: SET_EMOJI[ref as SetId] }
  }
  if (prefix === 'extra') return parseExtra(id)
  if (prefix === 'streak' && (STREAK_MILESTONES as readonly number[]).includes(Number(ref))) {
    return { id, kind: 'streak', ref, emoji: STREAK_EMOJI[Number(ref)] }
  }
  return undefined
}

const EXTRA_EMOJI = { days7: '🥳', checksAll: '🎓' } as const

/** Parse a special sticker id; see `parseSpecial` for the other kinds */
function parseExtra(id: string): SpecialSticker | undefined {
  const milestone = parseExtraSticker(id)
  if (!milestone) return undefined
  const emoji = milestone === 'days7' || milestone === 'checksAll' ? EXTRA_EMOJI[milestone] : subjectEmoji(milestone.slice('island:'.length) as SubjectId)
  return { id, kind: 'extra', ref: milestone, emoji }
}

/** What to draw for any sticker id (regular or special); undefined for unknown ids */
export function stickerEmoji(id: string): string | undefined {
  return findSticker(id)?.sticker.id ?? parseSpecial(id)?.emoji
}

/** Fixed special slots shown as "?" until earned (island stickers are open-ended, so they are not listed) */
export const FIXED_SPECIAL_IDS: readonly string[] = [
  ...STREAK_MILESTONES.map(streakStickerId),
  ...STICKER_SETS.map((x) => setStickerId(x.id)),
]
