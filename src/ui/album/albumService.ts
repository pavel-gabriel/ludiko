import { earnedMilestones } from '@/learner/extrasUnlocks'
import * as profiles from '@/profiles/profileService'
import { addSticker, getProgress } from '@/profiles/profileService'
import type { ChildProfile, ProfileProgress } from '@/profiles/types'
import { dueSpecialStickers, migrateStickers, missionBonusSticker } from './earning'

/** Skills the child has mastered: each one is an island conquered */
export function masteredSkillIds(progress: Pick<ProfileProgress, 'skills'>): string[] {
  return Object.entries(progress.skills)
    .filter(([, s]) => s.state === 'mastered')
    .map(([id]) => id)
    .sort()
}

/**
 * Give every special sticker that is due (island conquered, set finished, play-day milestone).
 * Idempotent and catch-up friendly: it only adds what is missing. Returns the ids it added.
 */
export async function awardSpecials(profileId: string): Promise<string[]> {
  const progress = await getProgress(profileId)
  const added: string[] = []
  // the grade tells which level checks are expected; without a profile that milestone simply waits
  let grade: { grade: ChildProfile['grade'] } | undefined
  try {
    grade = await profiles.getProfile(profileId)
  } catch {
    grade = undefined
  }
  const milestones = earnedMilestones(progress, grade)
  // set stickers depend on regular ones only, so one extra pass is enough; the loop is just a safety net
  for (let pass = 0; pass < 2; pass++) {
    const due = dueSpecialStickers(
      progress.stickers,
      { masteredSkillIds: masteredSkillIds(progress), playDays: progress.playDays.length, milestones },
      added,
    )
    if (due.length === 0) break
    for (const id of due) {
      await addSticker(profileId, id)
      added.push(id)
    }
  }
  return added
}

/** Rule 2: the mission bonus sticker (from the set closest to done), then any special that became due. */
export async function awardMissionBonus(profileId: string, seed = Date.now()): Promise<{ bonus?: string; specials: string[] }> {
  const progress = await getProgress(profileId)
  const bonus = missionBonusSticker(migrateStickers(progress.stickers), seed)
  if (bonus) await addSticker(profileId, bonus)
  const specials = await awardSpecials(profileId)
  return { bonus, specials }
}

/* ---------- "new!" memory: how many stickers the child had seen the last time the album was open ---------- */

const seenKey = (profileId: string) => `ludiko.album.seen.${profileId}`

export function loadSeenCount(profileId: string): number | null {
  try {
    const raw = localStorage.getItem(seenKey(profileId))
    if (raw === null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function saveSeenCount(profileId: string, count: number): void {
  try {
    localStorage.setItem(seenKey(profileId), String(count))
  } catch {
    /* private mode: the badge simply stays off */
  }
}
