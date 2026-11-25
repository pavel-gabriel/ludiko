import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReportButton from '@/components/ui/ReportButton'
import type { Explanation, Item, ItemResult } from '@/engine/types'
import FramesPlayer from '@/ui/frames/FramesPlayer'
import { MascotSvg } from '@/ui/mascot/Mascot'
import ItemView from '@/ui/items/ItemView'
import ExitDialog from './ExitDialog'
import ProgressDots from './ProgressDots'
import {
  buildQueue,
  buildSummary,
  filterForMode,
  requeue,
  type QueueEntry,
} from './sessionLogic'
import type { AttemptMeta, SessionAttempt, SessionMode, SessionSummary } from './types'

export const DEFAULT_SPRINT_SECONDS = 60
/** Sprint answers are confirmed quickly: the clock is running */
const SPRINT_FEEDBACK_MS = 350

export interface SessionRunnerProps {
  items: Item[]
  mode: SessionMode
  title?: string
  /** Sprint length, default 60 */
  sprintSeconds?: number
  /**
   * Resolve an explanation. Called with `item.explanationId`, or with `item.skillId` when the item has none,
   * so a caller can serve skill-level explanations. Practice mode only.
   */
  getExplanation?: (id: string) => Explanation | undefined
  /** Fires for every answer, including retries (see `meta.retry`) */
  onAttempt?: (result: ItemResult, item: Item, meta: AttemptMeta) => void
  /** Fires once, when the session is over (also when leaving early without `onExit`: `completed: false`) */
  onFinish: (summary: SessionSummary) => void
  /** Leaving early. If omitted, leaving calls `onFinish` with `completed: false` */
  onExit?: () => void
}

type Phase = 'intro' | 'question' | 'explain'

/**
 * Runs one session over a list of items.
 * - practice: one item at a time; after a wrong answer the explanation plays and the item comes back once, a few items later.
 * - sprint: timed, number-input / choice items only, no explanations.
 * - check: like practice but no explanations and no retry.
 */
export default function SessionRunner({
  items,
  mode,
  title,
  sprintSeconds = DEFAULT_SPRINT_SECONDS,
  getExplanation,
  onAttempt,
  onFinish,
  onExit,
}: SessionRunnerProps) {
  const { t } = useTranslation()
  const isSprint = mode === 'sprint'

  const playable = useMemo(() => filterForMode(items, mode), [items, mode])
  const itemsById = useMemo(() => new Map(playable.map((i) => [i.id, i])), [playable])

  const [queue, setQueue] = useState<QueueEntry[]>(() => buildQueue(playable))
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(isSprint ? 'intro' : 'question')
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [outcomes, setOutcomes] = useState<(boolean | null)[]>([])
  const [remainingMs, setRemainingMs] = useState(sprintSeconds * 1000)

  const attempts = useRef<SessionAttempt[]>([])
  const startedAt = useRef(Date.now())
  const finished = useRef(false)
  /* Each explanation plays at most once per session — repeating it after every slip feels like a punishment */
  const shownExplanations = useRef(new Set<string>())
  const serial = useRef(0)
  const cycle = useRef(0)

  const finish = useCallback(
    (completed: boolean) => {
      if (finished.current) return
      finished.current = true
      onFinish(
        buildSummary({
          mode,
          completed,
          attempts: attempts.current,
          itemsById,
          durationMs: Date.now() - startedAt.current,
        }),
      )
    },
    [mode, itemsById, onFinish],
  )
  const finishRef = useRef(finish)
  finishRef.current = finish

  /* Sprint clock: counts down only while a question is on screen and the exit dialog is closed */
  const clockRunning = isSprint && phase === 'question' && !confirmExit && playable.length > 0
  useEffect(() => {
    if (!clockRunning) return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - last
      last = now
      setRemainingMs((ms) => Math.max(0, ms - delta))
    }, 200)
    return () => clearInterval(id)
  }, [clockRunning])

  useEffect(() => {
    if (isSprint && phase === 'question' && remainingMs <= 0) finishRef.current(true)
  }, [isSprint, phase, remainingMs])

  const entry = queue[index] as QueueEntry | undefined

  const advance = (q: QueueEntry[]) => {
    if (index + 1 < q.length) {
      setIndex(index + 1)
    } else if (isSprint) {
      cycle.current += 1
      setQueue([...q, ...buildQueue(playable, `c${cycle.current}-`)])
      setIndex(index + 1)
    } else {
      finish(true)
      return
    }
    setPhase('question')
  }

  const handleAnswer = (result: ItemResult) => {
    if (!entry || finished.current) return
    const { item, retry } = entry
    attempts.current.push({
      itemId: item.id,
      skillId: item.skillId,
      correct: result.correct,
      timeMs: result.timeMs,
      retry,
    })
    setOutcomes((o) => {
      const next = [...o]
      next[index] = result.correct
      return next
    })
    onAttempt?.(result, item, { retry })

    let nextQueue = queue
    if (!result.correct && mode === 'practice' && !retry) {
      serial.current += 1
      nextQueue = requeue(queue, index, item, serial.current)
      setQueue(nextQueue)
      const found = getExplanation?.(item.explanationId ?? item.skillId)
      if (found && !shownExplanations.current.has(found.id)) {
        shownExplanations.current.add(found.id)
        setExplanation(found)
        setPhase('explain')
        return
      }
    }
    advance(nextQueue)
  }

  const leave = () => {
    setConfirmExit(false)
    if (onExit) onExit()
    else finish(false)
  }

  /* ---------- empty (e.g. a sprint over a bank without number/choice items) ---------- */
  if (playable.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 text-center">
        <div className="text-6xl" aria-hidden="true">🌱</div>
        <p className="text-xl font-extrabold text-ludiko-text">{t('session.empty')}</p>
        <button
          type="button"
          onClick={leave}
          className="min-h-[52px] rounded-2xl bg-ludiko-blue px-8 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('session.back')}
        </button>
      </main>
    )
  }

  const heading = title ?? t(`session.mode.${mode}`)
  const secondsLeft = Math.ceil(remainingMs / 1000)
  const sprintCorrect = attempts.current.filter((a) => a.correct).length

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-4">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          aria-label={t('session.exit')}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl font-extrabold text-ludiko-text shadow active:scale-95"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <h1 className="min-w-0 flex-1 line-clamp-2 text-center text-base font-extrabold leading-tight text-ludiko-text">{heading}</h1>
        {isSprint ? (
          <div
            role="timer"
            aria-label={t('session.timeLeft', { n: secondsLeft })}
            className={`flex h-12 min-w-[3.5rem] shrink-0 items-center justify-center rounded-full px-3 text-xl font-extrabold shadow ${
              secondsLeft <= 10 ? 'bg-ludiko-orange' : 'bg-white'
            } text-ludiko-text`}
          >
            <span aria-hidden="true">{secondsLeft}</span>
          </div>
        ) : (
          <div className="h-12 w-12 shrink-0" aria-hidden="true" />
        )}
      </header>

      {!isSprint && (
        <ProgressDots
          total={queue.length}
          current={index}
          outcomes={outcomes}
          label={t('session.progress', { current: Math.min(index + 1, queue.length), total: queue.length })}
        />
      )}
      {isSprint && phase !== 'intro' && (
        <p className="mb-3 text-center text-sm font-bold text-ludiko-text/70" aria-live="polite">
          <span aria-hidden="true">⭐ </span>
          {t('session.sprintCount', { n: sprintCorrect })}
        </p>
      )}

      {phase === 'intro' && (
        <section className="rounded-3xl bg-white p-6 text-center shadow-md">
          <div className="text-6xl" aria-hidden="true">⚡</div>
          <h2 className="mt-2 text-2xl font-extrabold text-ludiko-text">{t('session.sprintReady')}</h2>
          <p className="mt-2 text-base font-semibold text-ludiko-text/80">
            {t('session.sprintRules', { n: sprintSeconds })}
          </p>
          <button
            type="button"
            onClick={() => setPhase('question')}
            className="mt-5 min-h-[60px] w-full rounded-2xl bg-ludiko-green text-2xl font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {t('session.start')}
          </button>
        </section>
      )}

      {phase === 'question' && entry && (
        <div key={entry.key} className="flex flex-col gap-3">
          {entry.retry && (
            <p className="mx-auto rounded-full bg-ludiko-yellow px-4 py-1 text-sm font-bold text-ludiko-text shadow-sm">
              <span aria-hidden="true">🔁 </span>
              {t('session.retryBadge')}
            </p>
          )}
          <ItemView
            item={entry.item}
            onAnswer={handleAnswer}
            feedbackMs={isSprint ? SPRINT_FEEDBACK_MS : undefined}
            disabled={confirmExit}
          />
          <div className="flex justify-end">
            <ReportButton itemId={entry.item.id.replace(/~\d+$/, '')} skillId={entry.item.skillId} />
          </div>
        </div>
      )}

      {phase === 'explain' && explanation && (
        <div className="flex flex-col gap-3">
          <p
            role="status"
            className="flex items-center justify-center gap-2 rounded-2xl bg-ludiko-yellow px-4 py-2 text-center text-base font-bold text-ludiko-text"
          >
            <MascotSvg mood="encourage" size={48} className="shrink-0" decorative />
            <span>{t('session.explainIntro')}</span>
          </p>
          <FramesPlayer explanation={explanation} onDone={() => advance(queue)} />
          <button
            type="button"
            onClick={() => advance(queue)}
            className="mx-auto min-h-[44px] rounded-xl px-4 text-sm font-bold text-ludiko-text/70 underline"
          >
            {t('session.skipExplanation')}
          </button>
        </div>
      )}

      {confirmExit && <ExitDialog onStay={() => setConfirmExit(false)} onLeave={leave} />}
    </main>
  )
}
