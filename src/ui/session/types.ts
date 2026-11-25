import type { Item, ItemResult, LocalizedText } from '@/engine/types'

export type SessionMode = 'practice' | 'sprint' | 'check'

/** Extra info passed with each attempt */
export interface AttemptMeta {
  /** true when this is the second try of an item the child got wrong earlier in the session */
  retry: boolean
}

/** One answered item, in the order the child answered */
export interface SessionAttempt {
  itemId: string
  skillId: string
  correct: boolean
  timeMs: number
  retry: boolean
}

/** An item the child got wrong on the first try (for the "de mai exersat" list) */
export interface ReviewEntry {
  itemId: string
  skillId: string
  prompt: LocalizedText
}

/**
 * What a finished (or abandoned) session reports to its caller.
 * - practice / check: `total` counts distinct items; `correct` counts those right on the FIRST try.
 *   Retries after an explanation are listed in `attempts` (retry: true) but never change `correct`.
 * - sprint: `total` counts answers given before the time ran out.
 */
export interface SessionSummary {
  mode: SessionMode
  /** false when the child left early; progress is not rewarded then */
  completed: boolean
  total: number
  correct: number
  /** correct / total, 0 when total is 0 */
  accuracy: number
  /** 1–3 once anything was answered; 0 only when nothing was answered (never a "zero" for effort) */
  stars: 0 | 1 | 2 | 3
  review: ReviewEntry[]
  attempts: SessionAttempt[]
  durationMs: number
}

/** Callback shape of SessionRunner.onAttempt (the third argument is optional to implement) */
export type AttemptHandler = (result: ItemResult, item: Item, meta: AttemptMeta) => void

/** What a finished session earned, once it has been saved (or would have been, for a guest) */
export interface SessionReward {
  stars: number
  /** Sticker emoji unlocked in this session, if any */
  sticker?: string
  /** false when the child already owned the sticker */
  newSticker: boolean
  /** false for guests: nothing was written anywhere */
  saved: boolean
  /** Extra sticker ids earned on top (mission bonus, island conquered, finished set, play-day milestone) */
  bonus?: string[]
}
