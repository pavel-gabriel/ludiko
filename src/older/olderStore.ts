/**
 * Small per-profile settings and counters for the grade V–VIII experience, in localStorage (same reasoning as
 * src/learner/planStore.ts: ProfileProgress is validated field by field by the family-sync rules and these are
 * device-level conveniences — mascot on/off, the weekly goal the child set, a best-of-the-week — not learning
 * evidence). Memory fallback when localStorage is unavailable. Nothing here is loss-based: a new week simply
 * starts from zero, nothing is "lost".
 */
const memory = new Map<string, string>()
const k = (profileId: string, what: string) => `ludiko-older-${what}-${profileId}`

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory.get(key) ?? null // storage unavailable: this session's memory copy
  }
}

function write(key: string, value: string): void {
  memory.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {
    /* memory copy stays */
  }
}

/** ISO week key "2026-W48" (Monday-based) for a timestamp, in local time */
export function weekKey(now = Date.now()): string {
  const d = new Date(now)
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/* ---- "Arată-l pe Ludi" ---- */

export function getShowMascot(profileId: string): boolean {
  return read(k(profileId, 'mascot')) === '1'
}
export function setShowMascot(profileId: string, on: boolean): void {
  write(k(profileId, 'mascot'), on ? '1' : '0')
}

/* ---- weekly goal (bits per week) ---- */

export const WEEKLY_GOALS = [3, 5, 7] as const

export function getWeeklyGoal(profileId: string): number | null {
  const n = Number(read(k(profileId, 'goal')))
  return (WEEKLY_GOALS as readonly number[]).includes(n) ? n : null
}
export function setWeeklyGoal(profileId: string, goal: number | null): void {
  write(k(profileId, 'goal'), goal === null ? '' : String(goal))
}

/** A "bit" = one finished session (daily-plan bit, self-chosen practice or test, challenge). */
export function recordBitDone(profileId: string, now = Date.now()): number {
  const next = bitsThisWeek(profileId, now) + 1
  write(k(profileId, 'bits'), JSON.stringify({ week: weekKey(now), n: next }))
  return next
}
export function bitsThisWeek(profileId: string, now = Date.now()): number {
  try {
    const v = JSON.parse(read(k(profileId, 'bits')) ?? 'null') as { week?: string; n?: number } | null
    return v && v.week === weekKey(now) && typeof v.n === 'number' ? v.n : 0
  } catch {
    return 0
  }
}

/* ---- "Provocarea zilei": best mark of the week ---- */

export interface ChallengeBest {
  week: string
  mark: number
}
export function getChallengeBest(profileId: string, now = Date.now()): number | null {
  try {
    const v = JSON.parse(read(k(profileId, 'best')) ?? 'null') as ChallengeBest | null
    return v && v.week === weekKey(now) && typeof v.mark === 'number' ? v.mark : null
  } catch {
    return null
  }
}
/** Stores the mark if it beats this week's best; returns whether it did */
export function noteChallengeMark(profileId: string, mark: number, now = Date.now()): boolean {
  const best = getChallengeBest(profileId, now)
  if (best !== null && best >= mark) return false
  write(k(profileId, 'best'), JSON.stringify({ week: weekKey(now), mark } satisfies ChallengeBest))
  return true
}
