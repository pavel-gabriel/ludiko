/**
 * Sticker helpers used by the session flow. The album (src/ui/album/) owns the sets and the earning rules;
 * this file keeps the original names so existing imports keep working. A sticker's id is its emoji.
 */
import { ALL_STICKER_IDS } from '@/ui/album/stickerSets'

export { STICKER_MIN_STARS, pickSticker } from '@/ui/album/earning'

/** Every regular sticker (the first twelve of the original version are part of the album sets) */
export const STICKERS: readonly string[] = ALL_STICKER_IDS
