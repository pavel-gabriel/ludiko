import type { TFunction } from 'i18next'
import { ageBand, type AgeBand } from '@/older/ageBand'
import { readPref, writePref } from '@/ui/common/devicePref'

/**
 * First-run guidance state, per profile, on this device (docs/PRIVACY_DATA_MAP.md D17):
 *  - which screens' coach marks were seen ("learn", "map")
 *  - how many times an item type's one-line how-to was shown (shown the first ITEM_GUIDE_TIMES times)
 */
export type GuideScreen = 'learn' | 'map'

/** An item type's how-to line is shown this many times per profile, then it gets out of the way */
export const ITEM_GUIDE_TIMES = 3

const who = (profileId: string | undefined) => profileId || 'anon'

export function isGuideSeen(screen: GuideScreen, profileId: string | undefined): boolean {
  return readPref(`guide.${screen}.${who(profileId)}`) === '1'
}

export function markGuideSeen(screen: GuideScreen, profileId: string | undefined): void {
  writePref(`guide.${screen}.${who(profileId)}`, '1')
}

export function itemGuideCount(type: string, profileId: string | undefined): number {
  const n = Number(readPref(`guide.item.${type}.${who(profileId)}`) ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function bumpItemGuide(type: string, profileId: string | undefined): void {
  writePref(`guide.item.${type}.${who(profileId)}`, String(itemGuideCount(type, profileId) + 1))
}

/**
 * Text in the child's tone: `${base}.${band}`, falling back to `${base}.small` (middle shares the small text
 * unless it has its own). Older kids (big) get shorter, plainer lines.
 */
export function bandText(t: TFunction, base: string, band: AgeBand, vars?: Record<string, unknown>): string {
  return t([`${base}.${band}`, `${base}.small`], vars ?? {}) as string
}

export { ageBand }
export type { AgeBand }
