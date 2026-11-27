/**
 * The look (colour variant / accessory) a child picked for Ludi. Stored on this device only, in localStorage,
 * per profile: ProfileProgress and the synced child document are validated field by field by firestore.rules
 * (which must not change for this), and a look is a convenience, not learning evidence. Memory fallback when
 * localStorage is unavailable. Which looks may be picked is decided by src/learner/extrasUnlocks, not here.
 */
import { useSyncExternalStore } from 'react'
import { DEFAULT_LOOK, isLookId, type LookId } from '@/learner/extrasUnlocks'

const ACTIVE_PROFILE_KEY = 'ludiko-active-profile' // same key as profileService (not imported: this file stays tiny)
const memory = new Map<string, string>()
const EVENT = 'ludiko-mascot-look'
const keyOf = (profileId: string) => `ludiko-mascot-look-${profileId}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

export function getLook(profileId: string | null | undefined): LookId {
  if (!profileId) return DEFAULT_LOOK
  const v = read(keyOf(profileId))
  return isLookId(v) ? v : DEFAULT_LOOK
}

export function setLook(profileId: string, look: LookId): void {
  const key = keyOf(profileId)
  memory.set(key, look)
  try {
    localStorage.setItem(key, look)
  } catch {
    /* the memory copy keeps it for this visit */
  }
  window.dispatchEvent(new Event(EVENT))
}

function activeLook(): LookId {
  return getLook(read(ACTIVE_PROFILE_KEY))
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** The active child's look; re-renders when it changes */
export function useActiveLook(): LookId {
  return useSyncExternalStore(subscribe, activeLook, () => DEFAULT_LOOK)
}
