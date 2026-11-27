import { useCallback, useState } from 'react'
import { isGuideSeen, markGuideSeen, type GuideScreen } from './guideStore'

/**
 * Coach marks for a screen: open by itself the first time a profile sees the screen on this device,
 * re-openable with the "?" button. Closing (done or skipped) marks it as seen.
 */
export function useFirstRunGuide(screen: GuideScreen, profileId: string | undefined) {
  const [open, setOpen] = useState(() => !isGuideSeen(screen, profileId))
  const show = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    markGuideSeen(screen, profileId)
    setOpen(false)
  }, [screen, profileId])
  return { open, show, close }
}
