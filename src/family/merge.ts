/**
 * Pure, deterministic merge of one child's synced data (docs/PARENT_SYNC.md §4). No I/O, no clock.
 * merge(a, b) never loses evidence: counters only go up, sets only grow, and merge(a, a) equals a.
 * Where a choice is arbitrary (equal timestamps) a stable tie-break keeps merge(a, b) == merge(b, a)
 * (the only order-dependent part is the order of stickers: the local ones come first).
 */
import type { SubjectId } from '@/engine/types'
import type { LevelHistoryEntry, Mission, PlacementRecord } from '@/learner/contract'
import { MISSIONS_KEPT, type ChildProfile, type ProfileProgress, type SkillProgress } from '@/profiles/types'
import type { CloudProfile, FamilyChildDoc } from './types'

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** JSON with sorted object keys: equal content gives equal text, whatever the key order */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/** Deterministic pick between two records that compare as equal: the one with the greater text */
function tieBreak<T>(a: T, b: T): T {
  return stableStringify(a) >= stableStringify(b) ? a : b
}

/** The profile fields that go to the cloud (never recoveryCode or classLink) */
export function toCloudProfile(p: ChildProfile | CloudProfile): CloudProfile {
  return {
    id: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    grade: p.grade,
    language: p.language,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

/* ------------------------------ progress ------------------------------ */

function mergeSkill(a: SkillProgress, b: SkillProgress): SkillProgress {
  // more evidence = later lastSeen, then more attempts
  const cmp = a.lastSeen !== b.lastSeen ? a.lastSeen - b.lastSeen : a.attempts - b.attempts
  const winner = cmp > 0 ? a : cmp < 0 ? b : tieBreak(a, b)
  return { ...clone(winner), attempts: Math.max(a.attempts, b.attempts), correct: Math.max(a.correct, b.correct) }
}

function mergeSkills(a: Record<string, SkillProgress>, b: Record<string, SkillProgress>): Record<string, SkillProgress> {
  const out: Record<string, SkillProgress> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[id] = id in a && id in b ? mergeSkill(a[id], b[id]) : clone(id in a ? a[id] : b[id])
  }
  return out
}

function mergePlacement(a: PlacementRecord, b: PlacementRecord): PlacementRecord {
  const aDone = a.completedAt !== undefined
  const bDone = b.completedAt !== undefined
  if (aDone !== bDone) return clone(aDone ? a : b) // a completed placement beats an in-progress one
  if (a.updatedAt !== b.updatedAt) return clone(a.updatedAt > b.updatedAt ? a : b)
  return clone(tieBreak(a, b))
}

function mergeLevelHistory(a: LevelHistoryEntry[], b: LevelHistoryEntry[]): LevelHistoryEntry[] {
  const byAt = new Map<number, LevelHistoryEntry>()
  for (const e of [...a, ...b]) {
    const prev = byAt.get(e.at)
    byAt.set(e.at, prev ? tieBreak(prev, e) : e)
  }
  return [...byAt.values()].sort((x, y) => x.at - y.at).map(clone)
}

const stepsDone = (m: Mission) => m.steps.filter((s) => s.done).length

function mergeMission(a: Mission, b: Mission): Mission {
  const da = stepsDone(a)
  const db = stepsDone(b)
  if (da !== db) return clone(da > db ? a : b)
  const aFin = a.completedAt !== undefined
  const bFin = b.completedAt !== undefined
  if (aFin !== bFin) return clone(aFin ? a : b)
  return clone(tieBreak(a, b))
}

function mergeMissions(a: Mission[], b: Mission[]): Mission[] {
  const byKey = new Map<string, Mission>()
  for (const m of [...a, ...b]) {
    const key = `${m.day}|${m.subject}`
    const prev = byKey.get(key)
    byKey.set(key, prev ? mergeMission(prev, m) : m)
  }
  return [...byKey.values()]
    .sort((x, y) => (x.day === y.day ? (x.subject < y.subject ? -1 : x.subject > y.subject ? 1 : 0) : x.day < y.day ? -1 : 1))
    .slice(-MISSIONS_KEPT)
    .map(clone)
}

/** Stickers: all of `a` (in order), then the ones only `b` has */
function unionKeepOrder(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

export function mergeProgress(a: ProfileProgress, b: ProfileProgress): ProfileProgress {
  const out: ProfileProgress = {
    profileId: a.profileId,
    skills: mergeSkills(a.skills, b.skills),
    stars: Math.max(a.stars, b.stars),
    stickers: unionKeepOrder(a.stickers, b.stickers),
    playDays: [...new Set([...a.playDays, ...b.playDays])].sort(),
  }
  if (a.placements || b.placements) {
    const placements: Partial<Record<SubjectId, PlacementRecord>> = {}
    const pa = a.placements ?? {}
    const pb = b.placements ?? {}
    for (const s of new Set([...Object.keys(pa), ...Object.keys(pb)]) as Set<SubjectId>) {
      const x = pa[s]
      const y = pb[s]
      placements[s] = x && y ? mergePlacement(x, y) : clone((x ?? y)!)
    }
    out.placements = placements
  }
  if (a.levelHistory || b.levelHistory) {
    const levelHistory: Partial<Record<SubjectId, LevelHistoryEntry[]>> = {}
    const la = a.levelHistory ?? {}
    const lb = b.levelHistory ?? {}
    for (const s of new Set([...Object.keys(la), ...Object.keys(lb)]) as Set<SubjectId>) {
      levelHistory[s] = mergeLevelHistory(la[s] ?? [], lb[s] ?? [])
    }
    out.levelHistory = levelHistory
  }
  if (a.missions || b.missions) out.missions = mergeMissions(a.missions ?? [], b.missions ?? [])
  return out
}

/* ------------------------------ one child ------------------------------ */

function mergeCloudProfile(a: CloudProfile, b: CloudProfile): CloudProfile {
  const winner = a.updatedAt !== b.updatedAt ? (a.updatedAt > b.updatedAt ? a : b) : tieBreak(a, b)
  return { ...toCloudProfile(winner), createdAt: Math.min(a.createdAt, b.createdAt) }
}

const newer = (a: FamilyChildDoc, b: FamilyChildDoc) =>
  a.updatedAt !== b.updatedAt ? (a.updatedAt > b.updatedAt ? a : b) : tieBreak(a, b)

/**
 * Merge two versions of the same child (`local` and `remote`). Tombstones: a deletion that is at least
 * as new as the other side wins, a later edit on the other side brings the child back.
 */
export function merge(local: FamilyChildDoc, remote: FamilyChildDoc): FamilyChildDoc {
  const aDel = local.deleted === true
  const bDel = remote.deleted === true
  if (aDel && bDel) return clone(newer(local, remote))
  if (aDel || bDel) {
    const tomb = aDel ? local : remote
    const alive = aDel ? remote : local
    return clone(tomb.updatedAt >= alive.updatedAt ? tomb : alive)
  }
  return {
    profile: mergeCloudProfile(local.profile, remote.profile),
    progress: mergeProgress(local.progress, remote.progress),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    deviceId: newer(local, remote).deviceId,
  }
}

const normData = (c: FamilyChildDoc) =>
  stableStringify({
    profile: c.profile,
    progress: { ...c.progress, stickers: [...c.progress.stickers].sort() },
    deleted: c.deleted === true,
  })

/** Same profile and progress (sticker order, updatedAt and deviceId do not count) */
export function sameData(a: FamilyChildDoc, b: FamilyChildDoc): boolean {
  return normData(a) === normData(b)
}

/** Same document apart from deviceId (which is only for debugging) */
export function sameContent(a: FamilyChildDoc, b: FamilyChildDoc): boolean {
  return a.updatedAt === b.updatedAt && sameData(a, b)
}

/* ------------------------------ building entries ------------------------------ */

/** When a progress record last changed, as far as the data itself says (0 for an empty one) */
export function progressStamp(p: ProfileProgress): number {
  let t = 0
  for (const s of Object.values(p.skills)) t = Math.max(t, s.lastSeen ?? 0, s.stateChangedAt ?? 0)
  for (const pl of Object.values(p.placements ?? {})) if (pl) t = Math.max(t, pl.updatedAt ?? 0, pl.completedAt ?? 0)
  for (const list of Object.values(p.levelHistory ?? {})) for (const e of list ?? []) t = Math.max(t, e.at ?? 0)
  for (const m of p.missions ?? []) t = Math.max(t, m.completedAt ?? 0)
  const lastDay = p.playDays[p.playDays.length - 1]
  if (lastDay) {
    const d = Date.parse(`${lastDay}T00:00:00`)
    if (Number.isFinite(d)) t = Math.max(t, d)
  }
  return t
}

/** The entry for a profile that exists on this device */
export function toFamilyChild(profile: ChildProfile, progress: ProfileProgress, deviceId: string): FamilyChildDoc {
  return {
    profile: toCloudProfile(profile),
    progress: clone(progress),
    updatedAt: Math.max(profile.updatedAt, progressStamp(progress)),
    deviceId,
  }
}

/** The entry that propagates a deletion (no progress data is kept) */
export function toTombstone(profile: CloudProfile, at: number, deviceId: string): FamilyChildDoc {
  return {
    profile: toCloudProfile(profile),
    progress: { profileId: profile.id, skills: {}, stars: 0, stickers: [], playDays: [] },
    updatedAt: at,
    deviceId,
    deleted: true,
  }
}

/* ------------------------------ reading remote data ------------------------------ */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/**
 * A child document read from the cloud, checked and cleaned; null when it is not usable.
 * (The rules guard writes, but another app version or a hand edit must never crash a sync.)
 */
export function parseChildDoc(id: string, data: unknown): FamilyChildDoc | null {
  if (!isObj(data) || !isObj(data.profile) || !isObj(data.progress)) return null
  const p = data.profile
  const nickname = typeof p.nickname === 'string' ? p.nickname.trim() : ''
  if (
    p.id !== id || !nickname || typeof p.avatar !== 'string' ||
    !num(p.grade) || p.grade < 0 || p.grade > 8 || (p.language !== 'ro' && p.language !== 'en') ||
    !num(p.createdAt) || !num(p.updatedAt) || !num(data.updatedAt)
  ) return null
  const g = data.progress
  const skills: Record<string, SkillProgress> = {}
  if (isObj(g.skills)) {
    for (const [sid, s] of Object.entries(g.skills)) {
      if (isObj(s) && typeof s.state === 'string' && num(s.pMastery) && num(s.attempts) && num(s.correct) && num(s.lastSeen)) {
        skills[sid] = s as unknown as SkillProgress
      }
    }
  }
  const progress: ProfileProgress = {
    profileId: id,
    skills,
    stars: num(g.stars) ? Math.max(0, g.stars) : 0,
    stickers: strs(g.stickers),
    playDays: strs(g.playDays).sort(),
  }
  if (isObj(g.placements)) progress.placements = g.placements as ProfileProgress['placements']
  if (isObj(g.levelHistory)) progress.levelHistory = g.levelHistory as ProfileProgress['levelHistory']
  if (Array.isArray(g.missions)) progress.missions = (g.missions as Mission[]).filter(isObj).slice(-MISSIONS_KEPT)
  const doc: FamilyChildDoc = {
    profile: {
      id,
      nickname,
      avatar: p.avatar,
      grade: p.grade as CloudProfile['grade'],
      language: p.language,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    },
    progress,
    updatedAt: data.updatedAt,
    deviceId: typeof data.deviceId === 'string' ? data.deviceId : '',
  }
  if (data.deleted === true) doc.deleted = true
  return doc
}
