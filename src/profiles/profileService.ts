import type { Grade } from '@/engine/types'
import { dbDelete, dbGet, dbGetAll, dbPut } from './db'
import { generateRecoveryCode, isValidRecoveryCode } from './recoveryCode'
import {
  MISSIONS_KEPT,
  NICKNAME_MAX,
  type ChildProfile,
  type ClassLink,
  type ProfileBackup,
  type ProfileLanguage,
  type ProfileProgress,
  type SkillProgress,
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

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max

/** A class link read from storage or a backup file, or undefined if it is not well formed */
export function sanitizeClassLink(v: unknown): ClassLink | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const l = v as Record<string, unknown>
  if (!isStr(l.classId, 128) || !isStr(l.seatId, 64) || !isStr(l.joinCode, 16) || !isStr(l.className, 120)) return undefined
  return { classId: l.classId, seatId: l.seatId, joinCode: l.joinCode, className: l.className }
}

/** Set (or, with null, remove) the profile's class link. Does not bump `updatedAt`. */
export async function setClassLink(id: string, link: ClassLink | null): Promise<ChildProfile> {
  const existing = await getProfile(id)
  if (!existing) throw new Error('profile not found')
  const { classLink: _old, ...rest } = existing
  void _old
  const next: ChildProfile = link ? { ...rest, classLink: { ...link } } : rest
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

const progressLocks = new Map<string, Promise<unknown>>()

/**
 * Serialised read-modify-write on one profile's progress: every writer goes through here so
 * concurrent callers (session attempts, mission bookkeeping, stars) never overwrite each other.
 * `fn` may mutate the progress it gets (and must return the result); it is saved afterwards.
 */
export function updateProgress<T>(profileId: string, fn: (progress: ProfileProgress) => T | Promise<T>): Promise<T> {
  const prev = progressLocks.get(profileId) ?? Promise.resolve()
  const run = prev
    .catch(() => {})
    .then(async () => {
      const progress = await getProgress(profileId)
      const result = await fn(progress)
      await saveProgress(progress)
      return result
    })
  const tail = run.catch(() => {})
  progressLocks.set(profileId, tail)
  void tail.then(() => {
    if (progressLocks.get(profileId) === tail) progressLocks.delete(profileId)
  })
  return run
}

/** Add `now`'s local day to playDays (sorted, unique). */
export function markPlayDay(progress: ProfileProgress, now: number): void {
  const day = toDayString(now)
  if (!progress.playDays.includes(day)) progress.playDays.push(day)
  progress.playDays.sort()
}

/** Counters only (attempts/correct/lastSeen) on one skill record; no mastery maths. Mutates `progress`. */
export function applyAttemptCounters(progress: ProfileProgress, skillId: string, correct: boolean, now: number): SkillProgress {
  const prev = progress.skills[skillId] ?? {
    state: 'unknown' as const,
    pMastery: 0,
    attempts: 0,
    correct: 0,
    lastSeen: now,
  }
  const next: SkillProgress = {
    ...prev,
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    lastSeen: now,
  }
  progress.skills[skillId] = next
  return next
}

/** Record one attempt on a skill: attempts/correct/lastSeen/playDays only (no mastery maths). */
export async function recordAttempt(
  profileId: string,
  skillId: string,
  correct: boolean,
  now: number = Date.now(),
): Promise<ProfileProgress> {
  return updateProgress(profileId, (progress) => {
    applyAttemptCounters(progress, skillId, correct, now)
    markPlayDay(progress, now)
    return progress
  })
}

export async function addStars(profileId: string, n: number): Promise<ProfileProgress> {
  return updateProgress(profileId, (progress) => {
    progress.stars = Math.max(0, progress.stars + n)
    return progress
  })
}

export async function addSticker(profileId: string, sticker: string): Promise<ProfileProgress> {
  return updateProgress(profileId, (progress) => {
    if (!progress.stickers.includes(sticker)) progress.stickers.push(sticker)
    return progress
  })
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
  // class link: kept when well formed, dropped otherwise (never trusted blindly)
  const classLink = sanitizeClassLink(b.profile.classLink)
  if (classLink) profile.classLink = classLink
  else delete profile.classLink
  await dbPut('profiles', profile)
  const g = b.progress
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
  // Optional wave-3 fields: absent in older backups (still version 1), kept when present
  await dbPut('progress', {
    profileId: profile.id,
    skills: g.skills,
    stars: Number(g.stars) || 0,
    stickers: g.stickers,
    playDays: g.playDays,
    ...(isObj(g.placements) ? { placements: g.placements } : {}),
    ...(isObj(g.levelHistory) ? { levelHistory: g.levelHistory } : {}),
    ...(Array.isArray(g.missions) ? { missions: g.missions.slice(-MISSIONS_KEPT) } : {}),
  } satisfies ProfileProgress)
  return profile
}
