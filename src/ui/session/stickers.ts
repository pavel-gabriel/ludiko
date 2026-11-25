/** Small own sticker set: plain emoji, nothing licensed. Unlocked by finishing sessions with 2+ stars. */
export const STICKERS = ['🦊', '🐼', '🦄', '🐙', '🦋', '🐢', '🦁', '🐧', '🐞', '🐳', '🦉', '🐝'] as const

/** Sessions with at least this many stars unlock a sticker */
export const STICKER_MIN_STARS = 2

/**
 * Next sticker the child does not own yet, starting from a rotating offset so different
 * children (and sessions) see different ones first. Returns undefined when the set is complete.
 */
export function pickSticker(owned: readonly string[], seed = Date.now()): string | undefined {
  const start = Math.abs(Math.floor(seed)) % STICKERS.length
  for (let i = 0; i < STICKERS.length; i++) {
    const s = STICKERS[(start + i) % STICKERS.length]
    if (!owned.includes(s)) return s
  }
  return undefined
}
