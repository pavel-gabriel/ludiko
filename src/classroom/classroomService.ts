/**
 * Classroom service (docs/CLASSROOM.md §4). Firestore + anonymous auth: import it ONLY dynamically
 * (see `api.ts` and `syncGate.ts`), never from a module of the initial bundle.
 *
 * Data (see firestore.rules, section "Classroom"):
 *   classes/{classId}                      { teacherUid, name, grade, createdAt }
 *   classes/{classId}/seats/{code}         { label, joinCode, linked, linkedAt? }      seat id == join code
 *   classes/{classId}/progress/{code}      { subjects, playDaysThisWeek, updatedAt }   written by the linked device
 *   classes/{classId}/assignments/{id}     { subject, skillIds, title, dueDay, createdAt }
 *   joinCodes/{code}                       { classId, className }                      get-only index for joining
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { ensureAnonymousAuth } from '@/services/authService'
import { db, firebaseEnabled } from '@/services/firebase'
import { getProfile, getProgress, setClassLink } from '@/profiles/profileService'
import { clearClassCaches, readLastSync, writeCachedAssignments, writeLastSync } from './assignmentCache'
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from './joinCode'
import { buildClassProgress } from './progressSummary'
import {
  ASSIGNMENT_SKILLS_MAX,
  ASSIGNMENT_TITLE_MAX,
  CLASS_NAME_MAX,
  CLASS_SUBJECTS,
  ClassroomError,
  MAX_SEATS_PER_CLASS,
  SEAT_LABEL_MAX,
  SYNC_MIN_INTERVAL_MS,
  type AssignmentDoc,
  type ClassDoc,
  type ClassLink,
  type ClassroomApi,
  type JoinCodeDoc,
  type NewAssignment,
  type SeatDoc,
  type SeatProgressDoc,
} from './types'

/** A Firestore write that cannot reach the server never settles by itself: give up after this long */
const WRITE_TIMEOUT_MS = 8000
const BATCH_LIMIT = 400
const CODE_ATTEMPTS = 6

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function requireFirebase(): void {
  if (!firebaseEnabled) throw new ClassroomError('unavailable')
}

const fsCode = (e: unknown): string => (typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '')

function toClassroomError(e: unknown): ClassroomError {
  if (e instanceof ClassroomError) return e
  const code = fsCode(e)
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'network-request-failed') return new ClassroomError('offline', e)
  if (code === 'auth/network-request-failed') return new ClassroomError('offline', e)
  return new ClassroomError('failed', e)
}

function withTimeout<T>(p: Promise<T>, ms = WRITE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ClassroomError('offline')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

async function signedIn(): Promise<void> {
  requireFirebase()
  try {
    if (!(await ensureAnonymousAuth())) throw new ClassroomError('unavailable')
  } catch (e) {
    throw toClassroomError(e)
  }
}

const trimTo = (s: string, max: number): string => s.trim().replace(/\s+/g, ' ').slice(0, max)

const classRef = (classId: string) => doc(db, 'classes', classId)
const seatRef = (classId: string, seatId: string) => doc(db, 'classes', classId, 'seats', seatId)
const progressRef = (classId: string, seatId: string) => doc(db, 'classes', classId, 'progress', seatId)
const codeRef = (code: string) => doc(db, 'joinCodes', code)

/** Firestore rejects `undefined`: drop it */
const clean = <T extends object>(v: T): T => JSON.parse(JSON.stringify(v)) as T

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function toClass(id: string, d: DocumentData): ClassDoc {
  return { id, teacherUid: String(d.teacherUid ?? ''), name: String(d.name ?? ''), grade: asNumber(d.grade), createdAt: asNumber(d.createdAt) }
}

function toSeat(id: string, d: DocumentData): SeatDoc {
  return {
    id,
    label: String(d.label ?? ''),
    joinCode: String(d.joinCode ?? id),
    linked: d.linked === true,
    ...(typeof d.linkedAt === 'number' ? { linkedAt: d.linkedAt } : {}),
  }
}

function toAssignment(id: string, d: DocumentData): AssignmentDoc {
  return {
    id,
    subject: d.subject,
    skillIds: Array.isArray(d.skillIds) ? d.skillIds.filter((s: unknown): s is string => typeof s === 'string') : [],
    title: String(d.title ?? ''),
    dueDay: String(d.dueDay ?? ''),
    createdAt: asNumber(d.createdAt),
  }
}

async function deleteAll(refs: ReturnType<typeof doc>[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const r of refs.slice(i, i + BATCH_LIMIT)) batch.delete(r)
    await batch.commit()
  }
}

/* ------------------------------------------------------------------ */
/*  Teacher: classes                                                  */
/* ------------------------------------------------------------------ */

export async function createClass(teacherUid: string, input: { name: string; grade: number }): Promise<ClassDoc> {
  requireFirebase()
  const name = trimTo(input.name, CLASS_NAME_MAX)
  if (!name || !Number.isInteger(input.grade) || input.grade < 0 || input.grade > 8) throw new ClassroomError('failed')
  const data = { teacherUid, name, grade: input.grade, createdAt: Date.now() }
  try {
    const ref = await addDoc(collection(db, 'classes'), data)
    return { id: ref.id, ...data }
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function listClasses(teacherUid: string): Promise<ClassDoc[]> {
  requireFirebase()
  try {
    const snap = await getDocs(query(collection(db, 'classes'), where('teacherUid', '==', teacherUid)))
    return snap.docs.map((d) => toClass(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function getClass(classId: string): Promise<ClassDoc | null> {
  requireFirebase()
  try {
    const snap = await getDoc(classRef(classId))
    return snap.exists() ? toClass(snap.id, snap.data()) : null
  } catch (e) {
    throw toClassroomError(e)
  }
}

/** Firestore does not cascade: remove the join-code index, the subcollections, then the class itself */
export async function deleteClass(classId: string): Promise<void> {
  requireFirebase()
  try {
    const seats = await getDocs(collection(db, 'classes', classId, 'seats'))
    const progress = await getDocs(collection(db, 'classes', classId, 'progress'))
    const assignments = await getDocs(collection(db, 'classes', classId, 'assignments'))
    await deleteAll(seats.docs.map((s) => codeRef(s.id)))
    await deleteAll([...seats.docs, ...progress.docs, ...assignments.docs].map((d) => d.ref))
    await deleteDoc(classRef(classId))
  } catch (e) {
    throw toClassroomError(e)
  }
}

/* ------------------------------------------------------------------ */
/*  Teacher: seats                                                    */
/* ------------------------------------------------------------------ */

export async function listSeats(classId: string): Promise<SeatDoc[]> {
  requireFirebase()
  try {
    const snap = await getDocs(collection(db, 'classes', classId, 'seats'))
    return snap.docs.map((d) => toSeat(d.id, d.data()))
  } catch (e) {
    throw toClassroomError(e)
  }
}

/**
 * Write a seat plus its `joinCodes` index entry in one batch. A code that is already taken (by another class)
 * makes the index write a forbidden update, so the whole batch fails and a new code is drawn.
 */
async function createSeat(classId: string, className: string, label: string, replacing?: SeatDoc): Promise<SeatDoc> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateJoinCode()
    const batch = writeBatch(db)
    if (replacing) {
      batch.delete(seatRef(classId, replacing.id))
      batch.delete(progressRef(classId, replacing.id))
      batch.delete(codeRef(replacing.id))
    }
    batch.set(seatRef(classId, code), { label, joinCode: code, linked: false })
    batch.set(codeRef(code), { classId, className } satisfies JoinCodeDoc)
    try {
      await batch.commit()
      return { id: code, label, joinCode: code, linked: false }
    } catch (e) {
      if (fsCode(e) !== 'permission-denied') throw e
    }
  }
  throw new ClassroomError('failed')
}

export async function addSeat(classId: string, rawLabel: string): Promise<SeatDoc> {
  requireFirebase()
  const label = trimTo(rawLabel, SEAT_LABEL_MAX)
  if (!label) throw new ClassroomError('failed')
  try {
    const [cls, seats] = await Promise.all([getClass(classId), listSeats(classId)])
    if (!cls) throw new ClassroomError('failed')
    if (seats.length >= MAX_SEATS_PER_CLASS) throw new ClassroomError('limit')
    return await createSeat(classId, cls.name, label)
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function renameSeat(classId: string, seatId: string, rawLabel: string): Promise<void> {
  requireFirebase()
  const label = trimTo(rawLabel, SEAT_LABEL_MAX)
  if (!label) throw new ClassroomError('failed')
  try {
    await updateDoc(seatRef(classId, seatId), { label })
  } catch (e) {
    throw toClassroomError(e)
  }
}

/** Unlink = the seat gets a new join code and loses its progress; the old device can no longer join or sync */
export async function unlinkSeat(classId: string, seatId: string): Promise<SeatDoc> {
  requireFirebase()
  try {
    const [cls, snap] = await Promise.all([getClass(classId), getDoc(seatRef(classId, seatId))])
    if (!cls || !snap.exists()) throw new ClassroomError('failed')
    return await createSeat(classId, cls.name, toSeat(snap.id, snap.data()).label, toSeat(snap.id, snap.data()))
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function removeSeat(classId: string, seatId: string): Promise<void> {
  requireFirebase()
  try {
    await deleteAll([seatRef(classId, seatId), progressRef(classId, seatId), codeRef(seatId)])
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function listProgress(classId: string): Promise<Record<string, SeatProgressDoc>> {
  requireFirebase()
  try {
    const snap = await getDocs(collection(db, 'classes', classId, 'progress'))
    const out: Record<string, SeatProgressDoc> = {}
    for (const d of snap.docs) {
      const v = d.data()
      out[d.id] = {
        subjects: typeof v.subjects === 'object' && v.subjects !== null ? v.subjects : {},
        playDaysThisWeek: asNumber(v.playDaysThisWeek),
        updatedAt: asNumber(v.updatedAt),
      }
    }
    return out
  } catch (e) {
    throw toClassroomError(e)
  }
}

/* ------------------------------------------------------------------ */
/*  Teacher: assignments                                              */
/* ------------------------------------------------------------------ */

export async function listAssignments(classId: string): Promise<AssignmentDoc[]> {
  requireFirebase()
  try {
    const snap = await getDocs(collection(db, 'classes', classId, 'assignments'))
    return snap.docs.map((d) => toAssignment(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt)
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function createAssignment(classId: string, input: NewAssignment): Promise<AssignmentDoc> {
  requireFirebase()
  const title = trimTo(input.title, ASSIGNMENT_TITLE_MAX)
  const skillIds = [...new Set(input.skillIds)]
  if (
    !title ||
    !CLASS_SUBJECTS.includes(input.subject) ||
    skillIds.length < 1 ||
    skillIds.length > ASSIGNMENT_SKILLS_MAX ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDay)
  ) {
    throw new ClassroomError(skillIds.length > ASSIGNMENT_SKILLS_MAX ? 'limit' : 'failed')
  }
  const data = { subject: input.subject, skillIds, title, dueDay: input.dueDay, createdAt: Date.now() }
  try {
    const ref = await addDoc(collection(db, 'classes', classId, 'assignments'), data)
    return { id: ref.id, ...data }
  } catch (e) {
    throw toClassroomError(e)
  }
}

export async function deleteAssignment(classId: string, assignmentId: string): Promise<void> {
  requireFirebase()
  try {
    await deleteDoc(doc(db, 'classes', classId, 'assignments', assignmentId))
  } catch (e) {
    throw toClassroomError(e)
  }
}

/* ------------------------------------------------------------------ */
/*  Child: join, sync, assignments, leave                             */
/* ------------------------------------------------------------------ */

/**
 * Join a class with a seat's code: read the `joinCodes/{code}` index (get-only), then mark the seat linked
 * (the rules allow exactly that one update, once). The class link is stored on the local profile.
 */
export async function joinClass(profileId: string, rawCode: string): Promise<ClassLink> {
  const code = normalizeJoinCode(rawCode)
  if (!isValidJoinCode(code)) throw new ClassroomError('invalid-code')
  await signedIn()
  const profile = await getProfile(profileId)
  if (!profile) throw new ClassroomError('failed')
  if (profile.classLink) await leaveClass(profileId)

  let index: JoinCodeDoc
  try {
    const snap = await getDoc(codeRef(code))
    if (!snap.exists()) throw new ClassroomError('invalid-code')
    const d = snap.data()
    if (typeof d.classId !== 'string' || !d.classId) throw new ClassroomError('invalid-code')
    index = { classId: d.classId, className: trimTo(String(d.className ?? ''), CLASS_NAME_MAX) }
  } catch (e) {
    throw toClassroomError(e)
  }

  try {
    await withTimeout(updateDoc(seatRef(index.classId, code), { linked: true, linkedAt: Date.now() }))
  } catch (e) {
    const c = fsCode(e)
    if (c === 'permission-denied') throw new ClassroomError('already-used', e)
    if (c === 'not-found') throw new ClassroomError('invalid-code', e)
    throw toClassroomError(e)
  }

  const link: ClassLink = { classId: index.classId, seatId: code, joinCode: code, className: index.className }
  await setClassLink(profileId, link)
  // first data exchange is best effort: the link itself is already saved
  await refreshAssignments(link).catch(() => false)
  await syncProgress(profileId, { force: true })
  return link
}

/** Forget the link on this device; best effort to remove the summary from the class (the child's right to erase) */
export async function leaveClass(profileId: string): Promise<void> {
  const profile = await getProfile(profileId)
  const link = profile?.classLink
  if (!link) return
  if (firebaseEnabled) {
    try {
      await ensureAnonymousAuth()
      await withTimeout(deleteDoc(progressRef(link.classId, link.seatId)), 4000)
    } catch {
      /* offline or already gone: the teacher can still unlink the seat */
    }
  }
  clearClassCaches(link.classId, profileId)
  await setClassLink(profileId, null)
}

export type SyncResult = 'synced' | 'throttled' | 'no-link' | 'unavailable' | 'nothing' | 'offline' | 'revoked' | 'failed'

const syncing = new Map<string, Promise<SyncResult>>()

/**
 * Send the progress summary to the class. At most once per 10 minutes (`force` skips the check, used right
 * after joining). Never throws: offline simply leaves `lastSync` untouched so the next trigger retries.
 */
export function syncProgress(profileId: string, opts: { now?: number; force?: boolean } = {}): Promise<SyncResult> {
  const running = syncing.get(profileId)
  if (running) return running
  const p = doSync(profileId, opts.now ?? Date.now(), opts.force === true).finally(() => syncing.delete(profileId))
  syncing.set(profileId, p)
  return p
}

async function doSync(profileId: string, now: number, force: boolean): Promise<SyncResult> {
  const profile = await getProfile(profileId)
  const link = profile?.classLink
  if (!link) return 'no-link'
  if (!force && now - readLastSync(profileId) < SYNC_MIN_INTERVAL_MS) return 'throttled'
  if (!firebaseEnabled) return 'unavailable'

  const summary = buildClassProgress(await getProgress(profileId), now)
  if (Object.keys(summary.subjects).length === 0) return 'nothing'

  try {
    await signedIn()
    await withTimeout(setDoc(progressRef(link.classId, link.seatId), clean(summary)))
    writeLastSync(profileId, now)
    return 'synced'
  } catch (e) {
    const err = toClassroomError(e)
    if (fsCode((err as { cause?: unknown }).cause ?? e) === 'permission-denied') {
      // the teacher unlinked or deleted the seat? then its join code index is gone as well
      try {
        const index = await getDoc(codeRef(link.joinCode))
        if (!index.exists()) {
          clearClassCaches(link.classId, profileId)
          await setClassLink(profileId, null)
          return 'revoked'
        }
      } catch {
        /* cannot tell: retry later */
      }
      return 'failed'
    }
    return err.code === 'offline' ? 'offline' : err.code === 'unavailable' ? 'unavailable' : 'failed'
  }
}

/** Fetch the class's assignments and keep a copy for offline use */
export async function getAssignments(link: ClassLink): Promise<AssignmentDoc[]> {
  await signedIn()
  try {
    const snap = await withTimeout(getDocs(collection(db, 'classes', link.classId, 'assignments')))
    const list = snap.docs.map((d) => toAssignment(d.id, d.data())).sort((a, b) => a.dueDay.localeCompare(b.dueDay))
    writeCachedAssignments(link.classId, list)
    return list
  } catch (e) {
    throw toClassroomError(e)
  }
}

/** Refresh the cached assignments; true when fresh data was stored */
export async function refreshAssignments(link: ClassLink): Promise<boolean> {
  try {
    await getAssignments(link)
    return true
  } catch {
    return false
  }
}

export const classroomApi: ClassroomApi = {
  listClasses,
  createClass,
  getClass,
  deleteClass,
  listSeats,
  addSeat,
  renameSeat,
  unlinkSeat,
  removeSeat,
  listProgress,
  listAssignments,
  createAssignment,
  deleteAssignment,
  joinClass,
  leaveClass,
}
