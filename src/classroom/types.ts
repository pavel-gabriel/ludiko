/**
 * Classroom data shapes and limits (docs/CLASSROOM.md §2). Pure types and constants: no Firebase here,
 * so child-side code can import this file without pulling Firestore into the initial bundle.
 */
import type { SkillState, SubjectId } from '@/engine/types'
import type { ClassLink } from '@/profiles/types'

export type { ClassLink }

/** Limits mirrored by firestore.rules (section "Classroom") */
export const CLASS_NAME_MAX = 60
export const SEAT_LABEL_MAX = 20
export const ASSIGNMENT_TITLE_MAX = 60
export const ASSIGNMENT_SKILLS_MAX = 10
export const MAX_SEATS_PER_CLASS = 60
export const SKILLS_PER_SUBJECT_MAX = 400
/** Seconds-free throttle between two progress syncs (docs/CLASSROOM.md §4) */
export const SYNC_MIN_INTERVAL_MS = 10 * 60 * 1000

/** Subject ids accepted in a progress summary and an assignment (same list as the engine's SubjectId) */
export const CLASS_SUBJECTS: readonly SubjectId[] = ['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim']

export interface ClassDoc {
  /** Firestore document id (not stored in the document) */
  id: string
  teacherUid: string
  name: string
  /** 0–8 */
  grade: number
  createdAt: number
}

export interface SeatDoc {
  /** Document id; equals `joinCode` */
  id: string
  /** Teacher-chosen, ≤ 20 chars: never required to be a real name */
  label: string
  /** 6 chars from JOIN_CODE_ALPHABET, globally unique */
  joinCode: string
  linked: boolean
  linkedAt?: number
}

export interface SubjectProgress {
  level?: { grade: number; semester: 1 | 2 }
  missingCount?: number
  skills: Record<string, SkillState>
}

/** `classes/{classId}/progress/{seatId}`: written by the linked child device only */
export interface SeatProgressDoc {
  subjects: Partial<Record<SubjectId, SubjectProgress>>
  playDaysThisWeek: number
  updatedAt: number
}

export interface AssignmentDoc {
  /** Document id */
  id: string
  subject: SubjectId
  skillIds: string[]
  title: string
  /** YYYY-MM-DD */
  dueDay: string
  createdAt: number
}

export type NewAssignment = Omit<AssignmentDoc, 'id' | 'createdAt'>

/** The `joinCodes/{code}` index document: the only thing a child device reads to join */
export interface JoinCodeDoc {
  classId: string
  className: string
}

export type ClassroomErrorCode =
  | 'unavailable' // Firebase not configured / not signed in
  | 'invalid-code' // wrong format or no such code
  | 'already-used' // the seat is already linked to a device
  | 'offline' // network problem: try again later
  | 'limit' // too many seats / skills
  | 'failed'

export class ClassroomError extends Error {
  constructor(
    public code: ClassroomErrorCode,
    cause?: unknown,
  ) {
    super(`classroom: ${code}`)
    this.name = 'ClassroomError'
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause
  }
}

/** The service surface the screens use. `classroomService` implements it; tests and /dev/classroom swap it. */
export interface ClassroomApi {
  /* teacher */
  listClasses(teacherUid: string): Promise<ClassDoc[]>
  createClass(teacherUid: string, input: { name: string; grade: number }): Promise<ClassDoc>
  getClass(classId: string): Promise<ClassDoc | null>
  deleteClass(classId: string): Promise<void>
  listSeats(classId: string): Promise<SeatDoc[]>
  addSeat(classId: string, label: string): Promise<SeatDoc>
  renameSeat(classId: string, seatId: string, label: string): Promise<void>
  /** Remove the link: the seat gets a NEW join code (the old one stops working) and loses its progress */
  unlinkSeat(classId: string, seatId: string): Promise<SeatDoc>
  removeSeat(classId: string, seatId: string): Promise<void>
  listProgress(classId: string): Promise<Record<string, SeatProgressDoc>>
  listAssignments(classId: string): Promise<AssignmentDoc[]>
  createAssignment(classId: string, input: NewAssignment): Promise<AssignmentDoc>
  deleteAssignment(classId: string, assignmentId: string): Promise<void>
  /* child */
  joinClass(profileId: string, code: string): Promise<ClassLink>
  leaveClass(profileId: string): Promise<void>
}
