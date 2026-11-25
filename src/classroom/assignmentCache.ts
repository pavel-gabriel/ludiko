/**
 * Small localStorage caches for the class link: the last fetched assignments (so /learn works offline)
 * and the time of the last progress sync (for the 10-minute throttle). No Firebase here.
 * Every access is wrapped: storage may be missing or full, and nothing here may break a child's screen.
 */
import type { AssignmentDoc } from './types'

const ASSIGN_KEY = 'ludiko.classAssignments.v1:'
const SYNC_KEY = 'ludiko.classSync.v1:'

/** What the child device needs from an assignment */
export type CachedAssignment = Pick<AssignmentDoc, 'id' | 'subject' | 'skillIds' | 'title' | 'dueDay'>

export function readCachedAssignments(classId: string): CachedAssignment[] {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY + classId)
    if (!raw) return []
    const list = (JSON.parse(raw) as { assignments?: unknown }).assignments
    if (!Array.isArray(list)) return []
    return list.filter(
      (a): a is CachedAssignment =>
        !!a && typeof a.id === 'string' && typeof a.subject === 'string' && Array.isArray(a.skillIds) &&
        typeof a.title === 'string' && typeof a.dueDay === 'string',
    )
  } catch {
    return []
  }
}

export function writeCachedAssignments(classId: string, assignments: CachedAssignment[]): void {
  try {
    const slim = assignments.map(({ id, subject, skillIds, title, dueDay }) => ({ id, subject, skillIds, title, dueDay }))
    localStorage.setItem(ASSIGN_KEY + classId, JSON.stringify({ assignments: slim }))
  } catch {
    /* storage unavailable */
  }
}

export function clearClassCaches(classId: string, profileId: string): void {
  try {
    localStorage.removeItem(ASSIGN_KEY + classId)
    localStorage.removeItem(SYNC_KEY + profileId)
  } catch {
    /* storage unavailable */
  }
}

/** epoch ms of the last successful progress sync of this profile, 0 if never */
export function readLastSync(profileId: string): number {
  try {
    const n = Number(localStorage.getItem(SYNC_KEY + profileId))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function writeLastSync(profileId: string, at: number): void {
  try {
    localStorage.setItem(SYNC_KEY + profileId, String(at))
  } catch {
    /* storage unavailable */
  }
}
