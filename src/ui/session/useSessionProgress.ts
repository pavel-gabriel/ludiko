import { useCallback, useEffect, useRef, useState } from 'react'
import type { Item, ItemResult } from '@/engine/types'
import { addStars, addSticker, getProgress, recordAttempt } from '@/profiles/profileService'
import { useProfileStore } from '@/store/profileStore'
import { pickSticker, STICKER_MIN_STARS } from './stickers'
import type { AttemptMeta, SessionReward, SessionSummary } from './types'

/**
 * Connects a session to the active child profile (IndexedDB, offline, no Firebase):
 *  - onAttempt  -> recordAttempt(profileId, item.skillId, correct)
 *  - onFinish   -> addStars / addSticker, then exposes `reward` for the results screen
 * With no active profile the child can still play as a guest: nothing is saved,
 * but the results screen still shows what they earned (`reward.saved === false`).
 * Storage errors never break the session.
 */
export function useSessionProgress() {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const loaded = useProfileStore((s) => s.loaded)
  const load = useProfileStore((s) => s.load)
  const [reward, setReward] = useState<SessionReward | null>(null)
  const profileRef = useRef(activeProfile)
  profileRef.current = activeProfile
  const pending = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])

  const onAttempt = useCallback((result: ItemResult, item: Item, _meta?: AttemptMeta) => {
    const profile = profileRef.current
    if (!profile) return
    // serialise writes: each recordAttempt is a read-modify-write on the same record
    pending.current = pending.current
      .then(() => recordAttempt(profile.id, item.skillId, result.correct))
      .catch(() => {})
  }, [])

  const onFinish = useCallback((summary: SessionSummary) => {
    const profile = profileRef.current
    const stars = summary.completed ? summary.stars : 0
    const wantsSticker = summary.completed && summary.stars >= STICKER_MIN_STARS
    pending.current = pending.current
      .then(async () => {
        let owned: string[] = []
        if (profile) {
          try {
            owned = (await getProgress(profile.id)).stickers
          } catch {
            /* keep going without the owned list */
          }
        }
        const sticker = wantsSticker ? pickSticker(owned) : undefined
        let saved = false
        if (profile && summary.completed) {
          try {
            if (stars > 0) await addStars(profile.id, stars)
            if (sticker) await addSticker(profile.id, sticker)
            saved = true
          } catch {
            /* offline-first storage failed: still show the reward */
          }
        }
        setReward({ stars, sticker, newSticker: sticker !== undefined, saved })
      })
      .catch(() => {})
  }, [])

  const reset = useCallback(() => setReward(null), [])

  return {
    /** Active child profile, or null when playing as a guest */
    profile: activeProfile,
    /** Profiles are loaded and none is active */
    isGuest: loaded && !activeProfile,
    profilesLoaded: loaded,
    onAttempt,
    onFinish,
    reward,
    reset,
  }
}
