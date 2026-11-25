import { useCallback, useRef } from 'react'
import type { Item, ItemResult } from '@/engine/types'
import { learnerService, type AttemptMeta as LearnerAttemptMeta } from '@/learner'
import type { AttemptMeta } from '@/ui/session/types'

/**
 * Feeds every answered item to learnerService.recordItemResult (counters, play days, mastery),
 * with the retry flag from the runner and the mode of the current session.
 * Writes are chained: each one is a read-modify-write on the same profile record.
 * Storage errors are swallowed so a hiccup never interrupts a child mid-game.
 */
export function useAttemptRecorder(profileId: string, mode: LearnerAttemptMeta['mode']) {
  const pending = useRef<Promise<unknown>>(Promise.resolve())
  const modeRef = useRef(mode)
  modeRef.current = mode

  const onAttempt = useCallback(
    (result: ItemResult, item: Item, meta: AttemptMeta) => {
      const record = { retry: meta.retry, mode: modeRef.current }
      pending.current = pending.current
        .then(() => learnerService.recordItemResult(profileId, item, result, record))
        .catch(() => {})
    },
    [profileId],
  )

  /** Resolves once every attempt reported so far has been written */
  const flush = useCallback(() => pending.current, [])

  return { onAttempt, flush }
}
