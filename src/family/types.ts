/**
 * Parent account & cross-device sync (docs/PARENT_SYNC.md). Types and constants shared by the
 * pure merge, the (lazy, Firebase) service, the Firebase-free gate and the UI.
 */
import type { Grade } from '@/engine/types'
import type { ChildProfile, ProfileLanguage, ProfileProgress } from '@/profiles/types'

/** Wording of the consent screen the parent accepted; bump when what is stored changes */
export const CONSENT_VERSION = '2026-11-v1'
/** Cloud syncs are throttled to at most one per minute */
export const FAMILY_SYNC_MIN_INTERVAL_MS = 60_000
/** `progress` must stay well under the 1 MiB document limit (docs/PARENT_SYNC.md §3) */
export const PROGRESS_MAX_BYTES = 900 * 1024
/** Limits mirrored in firestore.rules (section "Families"); tests keep them in step */
export const FAMILY_LIMITS = {
  nickname: 20,
  avatar: 32,
  deviceId: 64,
  consentVersion: 32,
  skills: 2000,
  stickers: 500,
  playDays: 1500,
  missions: 14,
  levelHistory: 200,
} as const

/** The child profile as stored in the cloud: NO recoveryCode, NO classLink */
export interface CloudProfile {
  id: string
  nickname: string
  avatar: string
  grade: Grade
  language: ProfileLanguage
  createdAt: number
  updatedAt: number
}

/** families/{uid}/children/{profileId} */
export interface FamilyChildDoc {
  profile: CloudProfile
  progress: ProfileProgress
  updatedAt: number
  deviceId: string
  deleted?: boolean
}

/** families/{uid} */
export interface FamilyDoc {
  consentAt: number
  consentVersion: string
  createdAt: number
  updatedAt: number
}

export interface FamilyExport {
  app: 'ludiko'
  kind: 'family-export'
  version: 1
  exportedAt: number
  family: FamilyDoc | null
  children: Record<string, FamilyChildDoc>
}

/** What the device remembers about the signed-in parent (localStorage, no secrets) */
export interface FamilySession {
  uid: string
  email: string
  /** epoch ms of the last successful sync, 0 = never */
  lastSync: number
  /** Children that exist in the cloud and on this device */
  syncedIds: string[]
  /** The parent already answered "found N children": later children from other devices are imported by sync */
  accepted: boolean
}

export interface RemoteChildInfo {
  id: string
  nickname: string
  avatar: string
  grade: Grade
  updatedAt: number
}

export interface SyncResult {
  at: number
  pushed: number
  pulled: number
  removed: number
  /** Children in the cloud that this device has not imported yet */
  pending: RemoteChildInfo[]
}

export type FamilyErrorCode =
  | 'unavailable'
  | 'offline'
  | 'consent-required'
  | 'signed-out'
  | 'email-in-use'
  | 'invalid-email'
  | 'weak-password'
  | 'wrong-credentials'
  | 'too-many-requests'
  | 'reauth-required'
  | 'too-large'
  | 'not-found'
  | 'failed'

export class FamilyError extends Error {
  readonly code: FamilyErrorCode
  readonly cause?: unknown
  constructor(code: FamilyErrorCode, cause?: unknown) {
    super(`family: ${code}`)
    this.name = 'FamilyError'
    this.code = code
    this.cause = cause
  }
}

/** What screens call (via `getFamilyApi()`), so Firebase stays out of the initial bundle; tests/fixtures swap it */
export interface FamilyApi {
  /** `consent` must be true: the parent ticked the checkbox */
  createAccount(email: string, password: string, consent: boolean): Promise<FamilySession>
  signIn(email: string, password: string): Promise<{ session: FamilySession; needsConsent: boolean }>
  /** Saves consentAt/consentVersion for an account that has none yet */
  recordConsent(): Promise<void>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  syncNow(): Promise<SyncResult>
  listRemoteChildren(): Promise<RemoteChildInfo[]>
  importRemoteChild(id: string): Promise<ChildProfile>
  /** Deletes families/{uid}/** and then the Auth user. `password` re-authenticates (Firebase wants a recent login) */
  deleteCloudAccount(password?: string): Promise<void>
  exportAll(): Promise<FamilyExport>
}
