import type { Grade, SkillState, SubjectId } from '@/engine/types'
import type { LevelHistoryEntry, Mission, PlacementRecord } from '@/learner/contract'

export type ProfileLanguage = 'ro' | 'en'

/** Link to a teacher's class (docs/CLASSROOM.md): set after joining with a seat's join code. */
export interface ClassLink {
  classId: string
  /** Same as joinCode (the seat's document id) */
  seatId: string
  joinCode: string
  className: string
}

/** Data-minimised child profile: no real name, email or birth date. */
export interface ChildProfile {
  id: string
  nickname: string
  avatar: string
  grade: Grade
  language: ProfileLanguage
  createdAt: number
  updatedAt: number
  recoveryCode: string
  /** Present once the device joined a class; the progress summary is synced to it */
  classLink?: ClassLink
}

export interface SkillProgress {
  state: SkillState
  pMastery: number
  attempts: number
  correct: number
  lastSeen: number
  nextReview?: number
  /** Index into the spaced-review ladder (engine MasteryRecord.reviewStep) */
  reviewStep?: number
  /** epoch ms of the last failed mastery check — the planner waits 2 days before offering another */
  checkFailedAt?: number
  /** epoch ms when `state` last changed (not set by placement seeding) — feeds "improved this week" */
  stateChangedAt?: number
}

export interface ProfileProgress {
  profileId: string
  skills: Record<string, SkillProgress>
  stars: number
  stickers: string[]
  /** YYYY-MM-DD, for the gentle streak */
  playDays: string[]
  /** Saved placements ("Verifică-te") per subject; absent in data written before wave 3 */
  placements?: Partial<Record<SubjectId, PlacementRecord>>
  /** One entry per completed placement, oldest first */
  levelHistory?: Partial<Record<SubjectId, LevelHistoryEntry[]>>
  /** Daily missions, oldest first; only the last MISSIONS_KEPT are kept */
  missions?: Mission[]
}

export const MISSIONS_KEPT = 14

export interface ProfileBackup {
  app: 'ludiko'
  kind: 'profile-backup'
  version: 1
  exportedAt: number
  profile: ChildProfile
  progress: ProfileProgress
}

export const NICKNAME_MAX = 20
