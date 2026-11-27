import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfileStore } from '@/store/profileStore'
import ReadAloudButton from '@/ui/speech/ReadAloudButton'
import { ageBand, bandText, bumpItemGuide, itemGuideCount, ITEM_GUIDE_TIMES } from './guideStore'

/* Items already counted (StrictMode runs effects twice; an item counts once) */
const counted = new Set<string>()

/**
 * "What do I do here?" for an item type: true while the active profile has seen this type fewer than
 * ITEM_GUIDE_TIMES times on this device. Each item (by id) counts once.
 */
export function useItemGuide(type: string, itemId: string): boolean {
  const profileId = useProfileStore((s) => s.activeProfile?.id)
  const [show] = useState(() => counted.has(`${profileId}:${itemId}`) || itemGuideCount(type, profileId) < ITEM_GUIDE_TIMES)
  useEffect(() => {
    const key = `${profileId}:${itemId}`
    if (!show || counted.has(key)) return
    counted.add(key)
    bumpItemGuide(type, profileId)
  }, [show, type, itemId, profileId])
  return show
}

/** One friendly how-to line under the prompt, in the child's tone, with read-aloud for the younger bands */
export default function ItemTypeGuide({ type }: { type: string }) {
  const { t } = useTranslation()
  const grade = useProfileStore((s) => s.activeProfile?.grade)
  const band = ageBand(grade)
  const text = bandText(t, `guide.items.${type}`, band)
  if (!text || text.startsWith('guide.items.')) return null
  return (
    <div
      className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-ludiko-yellow/60 px-3 py-2"
      data-testid="item-guide"
      data-item-guide={type}
    >
      <p className="text-sm font-bold text-ludiko-text">
        <span aria-hidden="true">💡 </span>
        {text}
      </p>
      {band !== 'big' && <ReadAloudButton band={band} text={text} label={t('guide.readHint')} className="!min-h-[44px] !text-xs" />}
    </div>
  )
}
