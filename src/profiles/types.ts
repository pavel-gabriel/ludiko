import type { Grade, SkillState } from '@/engine/types'

export type ProfileLanguage = 'ro' | 'en'

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
}

export interface SkillProgress {
  state: SkillState
  pMastery: number
  attempts: number
  correct: number
  lastSeen: number
  nextReview?: number
}

export interface ProfileProgress {
  profileId: string
  skills: Record<string, SkillProgress>
  stars: number
  stickers: string[]
  /** YYYY-MM-DD, for the gentle streak */
  playDays: string[]
}

export interface ProfileBackup {
  app: 'ludiko'
  kind: 'profile-backup'
  version: 1
  exportedAt: number
  profile: ChildProfile
  progress: ProfileProgress
}

export const NICKNAME_MAX = 20
