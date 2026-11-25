/**
 * Cheap triggers for the learner screens (docs/CLASSROOM.md §4). Importing this file never loads Firebase:
 * the lazy `classroomService` is imported only when the active profile has a class link.
 * Every call is fire-and-forget and swallows errors, so a school's bad wifi never reaches the child.
 */
import { getProfile } from '@/profiles/profileService'
import { readCachedAssignments, readLastSync } from './assignmentCache'
import { SYNC_MIN_INTERVAL_MS } from './types'

let trailing: ReturnType<typeof setTimeout> | undefined

/**
 * After a finished bit or placement: sync the progress summary (the service throttles to once per
 * 10 minutes). When the throttle would skip this call, one trailing sync is scheduled so the last bit of
 * the session still reaches the teacher while the app stays open.
 */
export function triggerClassSync(profileId: string, now: number = Date.now()): void {
  void (async () => {
    const profile = await getProfile(profileId)
    if (!profile?.classLink) return
    const wait = readLastSync(profileId) + SYNC_MIN_INTERVAL_MS - now
    if (wait > 0) {
      if (trailing) clearTimeout(trailing)
      trailing = setTimeout(() => triggerClassSync(profileId), wait + 1000)
      return
    }
    await (await import('./classroomService')).syncProgress(profileId)
  })().catch(() => {})
}

/** On the learner home: refresh the cached assignments (then `onAssignments`), and sync the summary if one is due */
export function refreshClassData(profileId: string, onAssignments?: () => void): void {
  void (async () => {
    const profile = await getProfile(profileId)
    if (!profile?.classLink) return
    const svc = await import('./classroomService')
    const before = JSON.stringify(readCachedAssignments(profile.classLink.classId))
    const fresh = await svc.refreshAssignments(profile.classLink)
    if (fresh && JSON.stringify(readCachedAssignments(profile.classLink.classId)) !== before) onAssignments?.()
    await svc.syncProgress(profileId)
  })().catch(() => {})
}
