/** Pure session logic (no React): queue handling, sprint filtering, summary and stars. */
import type { Item, ItemType } from '@/engine/types'
import type { ReviewEntry, SessionAttempt, SessionMode, SessionSummary } from './types'

/** Items a sprint can show: quick single-tap or typed-number answers only */
export const SPRINT_TYPES: readonly ItemType[] = ['number-input', 'choice', 'picture-choice']

export function filterForMode(items: Item[], mode: SessionMode): Item[] {
  return mode === 'sprint' ? items.filter((i) => SPRINT_TYPES.includes(i.type)) : items
}

/** One slot in the queue. `key` is unique per slot so a repeated item still remounts cleanly. */
export interface QueueEntry {
  key: string
  item: Item
  retry: boolean
}

export function buildQueue(items: Item[], prefix = ''): QueueEntry[] {
  return items.map((item, i) => ({ key: `${prefix}${i}:${item.id}`, item, retry: false }))
}

/** How many items later a missed item comes back (not immediately: a little time to forget the shape of the answer). */
export const REQUEUE_GAP = 3

/** Insert a retry of `item` REQUEUE_GAP slots after position `index` (or at the end if the queue is shorter). */
export function requeue(queue: QueueEntry[], index: number, item: Item, serial: number): QueueEntry[] {
  const entry: QueueEntry = { key: `r${serial}:${item.id}`, item, retry: true }
  const at = Math.min(queue.length, index + 1 + REQUEUE_GAP)
  return [...queue.slice(0, at), entry, ...queue.slice(at)]
}

/** Stars by first-try accuracy. Everyone who answered anything gets at least one. */
export function starsForAccuracy(accuracy: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0
  if (accuracy >= 0.9) return 3
  if (accuracy >= 0.6) return 2
  return 1
}

export interface SummaryInput {
  mode: SessionMode
  completed: boolean
  attempts: SessionAttempt[]
  /** every item that was shown, by id (to build the review list) */
  itemsById: Map<string, Item>
  durationMs: number
}

export function buildSummary({ mode, completed, attempts, itemsById, durationMs }: SummaryInput): SessionSummary {
  const counted = attempts.filter((a) => !a.retry)
  const total = counted.length
  const correct = counted.filter((a) => a.correct).length
  const accuracy = total > 0 ? correct / total : 0
  const seen = new Set<string>()
  const review: ReviewEntry[] = []
  for (const a of counted) {
    if (a.correct || seen.has(a.itemId)) continue
    seen.add(a.itemId)
    const item = itemsById.get(a.itemId)
    if (item) review.push({ itemId: a.itemId, skillId: a.skillId, prompt: item.prompt })
  }
  return {
    mode,
    completed,
    total,
    correct,
    accuracy,
    stars: starsForAccuracy(accuracy, total),
    review,
    attempts,
    durationMs,
  }
}
