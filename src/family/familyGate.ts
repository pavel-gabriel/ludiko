/**
 * Cheap triggers for the cloud sync (docs/PARENT_SYNC.md §4). Importing this file never loads Firebase:
 * the lazy `familyService` is reached through `getFamilyApi()` only when a parent is signed in on this
 * device. Every call is fire-and-forget and swallows errors, so bad wifi never reaches the child.
 *
 * Throttle: at most one sync per minute. The first change schedules one sync a couple of seconds later
 * (so a finished bit is a single burst); changes during the minute after that share one trailing sync.
 */
import { getFamilyApi } from './api'
import { addTombstone, readFamilyState } from './familyState'
import { FAMILY_SYNC_MIN_INTERVAL_MS, type CloudProfile } from './types'

/** Wait this long after a change before syncing, so the burst of writes of one bit goes out together */
const SETTLE_MS = 2000

let timer: ReturnType<typeof setTimeout> | undefined
let lastAttempt = 0
let started = false

function run(): void {
  timer = undefined
  lastAttempt = Date.now()
  void getFamilyApi()
    .then((api) => api.syncNow())
    .catch(() => {})
}

/** Something worth syncing changed (progress saved, profile edited/created/deleted, back online) */
export function triggerFamilySync(now: number = Date.now()): void {
  const session = readFamilyState()
  if (!session || timer !== undefined) return
  const due = Math.max(session.lastSync, lastAttempt) + FAMILY_SYNC_MIN_INTERVAL_MS
  timer = setTimeout(run, Math.max(SETTLE_MS, due - now))
}

/** A profile was deleted on this device: remember it (if signed in) so the deletion reaches the other devices */
export function noteProfileDeleted(profile: CloudProfile, now: number = Date.now()): void {
  if (addTombstone(profile, now)) triggerFamilySync(now)
}

/** App start: sync once if a parent is signed in, and again whenever the device comes back online */
export function initFamilyGate(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', () => triggerFamilySync())
  triggerFamilySync()
}

/** Test helper */
export function _resetFamilyGateForTests(): void {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  lastAttempt = 0
  started = false
}
