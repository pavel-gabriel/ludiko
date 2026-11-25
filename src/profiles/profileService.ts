import type { Grade } from '@/engine/types'
import { dbDelete, dbGet, dbGetAll, dbPut } from './db'
import { generateRecoveryCode, isValidRecoveryCode } from './recoveryCode'
import {
  NICKNAME_MAX,
  type ChildProfile,
  type ProfileBackup,
  type ProfileLanguage,
  type ProfileProgress,
} from './types'

export { generateRecoveryCode, isValidRecoveryCode } from './recoveryCode'
export { isPersistent } from './db'

const ACTIVE_KEY = 'ludiko-active-profile'

export interface ProfileInput {
  nickname: string
  avatar: string
  grade: Grade
  language: ProfileLanguage
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function validateNickname(raw: string): string {
  const nick = raw.trim().slice(0, NICKNAME_MAX)
  if (!nick) throw new Error('nickname required')
  return nick
}

export function emptyProgress(profileId: string): ProfileProgress {
  return { profileId, skills: {}, stars: 0, stickers: [], playDays: [] }
}

export async function listProfiles(): Promise<ChildProfile[]> {
  const all = await dbGetAll<ChildProfile>('profiles')
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getProfile(id: string): Promise<ChildProfile | undefined> {
  return dbGet<ChildProfile>('profiles', id)
}

export async function createProfile(input: ProfileInput): Promise<ChildProfile> {
  const now = Date.now()
  const profile: ChildProfile = {
    id: uuid(),
    nickname: validateNickname(input.nickname),
    avatar: input.avatar,
    grade: input.grade,
    language: input.language,
    createdAt: now,
    updatedAt: now,
    recoveryCode: generateRecoveryCode(),
  }
  await dbPut('profiles', profile)
  await dbPut('progress', emptyProgress(profile.id))
  return profile
}

export async function updateProfile(id: string, patch: Partial<ProfileInput>): Promise<ChildProfile> {
  const existing = await getProfile(id)
  if (!existing) throw new Error('profile not found')
  const next: ChildProfile = {
    ...existing,
    ...(patch.nickname !== undefined ? { nickname: validateNickname(patch.nickname) } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
    ...(patch.grade !== undefined ? { grade: patch.grade } : {}),
    ...(patch.language !== undefined ? { language: patch.language } : {}),
    updatedAt: Date.now(),
  }
  await dbPut('profiles', next)
  return next
}

export async function deleteProfile(id: string): Promise<void> {
  await dbDelete('profiles', id)
  await dbDelete('progress', id)
  if (getActiveProfileId() === id) setActiveProfileId(null)
}

export function getActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveProfileId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* storage unavailable */
  }
}

// ---------- progress ----------

export async function getProgress(profileId: string): Promise<ProfileProgress> {
  return (await dbGet<ProfileProgress>('progress', profileId)) ?? emptyProgress(profileId)
}

export async function saveProgress(progress: ProfileProgress): Promise<void> {
  await dbPut('progress', progress)
}

export function toDayString(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Record one attempt on a skill: attempts/correct/lastSeen/playDays only (no mastery maths). */
export async function recordAttempt(
  profileId: string,
  skillId: string,
  correct: boolean,
  now: number = Date.now(),
): Promise<ProfileProgress> {
  const progress = await getProgress(profileId)
  const prev = progress.skills[skillId] ?? {
    state: 'unknown' as const,
    pMastery: 0,
    attempts: 0,
    correct: 0,
    lastSeen: now,
  }
  progress.skills[skillId] = {
    ...prev,
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    lastSeen: now,
  }
  const day = toDayString(now)
  if (!progress.playDays.includes(day)) progress.playDays.push(day)
  progress.playDays.sort()
  await saveProgress(progress)
  return progress
}

export async function addStars(profileId: string, n: number): Promise<ProfileProgress> {
  const progress = await getProgress(profileId)
  progress.stars = Math.max(0, progress.stars + n)
  await saveProgress(progress)
  return progress
}

export async function addSticker(profileId: string, sticker: string): Promise<ProfileProgress> {
  const progress = await getProgress(profileId)
  if (!progress.stickers.includes(sticker)) progress.stickers.push(sticker)
  await saveProgress(progress)
  return progress
}

// ---------- backup ----------

export async function exportProfile(id: string): Promise<ProfileBackup> {
  const profile = await getProfile(id)
  if (!profile) throw new Error('profile not found')
  return {
    app: 'ludiko',
    kind: 'profile-backup',
    version: 1,
    exportedAt: Date.now(),
    profile,
    progress: await getProgress(id),
  }
}

export function backupFileName(profile: ChildProfile): string {
  const safe = profile.nickname.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'profil'
  return `ludiko-${safe}.json`
}

export function downloadBackup(backup: ProfileBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(backup.profile)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseBackup(text: string): ProfileBackup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('invalid backup')
  }
  const b = data as Partial<ProfileBackup> | null
  if (!b || b.app !== 'ludiko' || b.kind !== 'profile-backup' || b.version !== 1 || !b.profile || !b.progress) {
    throw new Error('invalid backup')
  }
  const p = b.profile
  if (
    typeof p.id !== 'string' || typeof p.nickname !== 'string' || !p.nickname.trim() ||
    typeof p.avatar !== 'string' || typeof p.grade !== 'number' || p.grade < 0 || p.grade > 8 ||
    (p.language !== 'ro' && p.language !== 'en') || typeof p.recoveryCode !== 'string' ||
    !isValidRecoveryCode(p.recoveryCode)
  ) {
    throw new Error('invalid backup')
  }
  const g = b.progress
  if (typeof g.skills !== 'object' || g.skills === null || !Array.isArray(g.stickers) || !Array.isArray(g.playDays)) {
    throw new Error('invalid backup')
  }
  return b as ProfileBackup
}

/** Import a backup. An existing profile with the same id is replaced. */
export async function importProfile(text: string): Promise<ChildProfile> {
  const b = parseBackup(text)
  const profile: ChildProfile = {
    ...b.profile,
    nickname: validateNickname(b.profile.nickname),
    updatedAt: Date.now(),
  }
  await dbPut('profiles', profile)
  await dbPut('progress', {
    profileId: profile.id,
    skills: b.progress.skills,
    stars: Number(b.progress.stars) || 0,
    stickers: b.progress.stickers,
    playDays: b.progress.playDays,
  } satisfies ProfileProgress)
  return profile
}
