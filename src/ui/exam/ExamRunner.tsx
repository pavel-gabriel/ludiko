import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localize, type Item, type ItemResult } from '@/engine/types'
import type { AssembledTest, ExamAnswers } from '@/exam/types'
import ItemView from '@/ui/items/ItemView'
import { ItemFeedbackContext } from '@/ui/items/itemFeedback'
import ProgressBar from '@/ui/learn/ProgressBar'
import ExamDialog from './ExamDialog'

export interface ExamRunResult {
  answers: ExamAnswers
  durationMs: number
  /** The child kept working after the recommended time ran out */
  overtime: boolean
}

export interface ExamRunnerProps {
  test: AssembledTest
  /** Whether the clock is on screen at the start (it can be toggled any time) */
  showTimer?: boolean
  /** Fires for every answer (feeds the learner's play-day streak; no verdict is shown to the child) */
  onAttempt?: (result: ItemResult, item: Item) => void
  onFinish: (result: ExamRunResult) => void
  onExit: () => void
}

type Dialog = 'none' | 'pause' | 'timeup' | 'exit'

export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * One exam paper: section intro screens, one question at a time with NO verdict or explanation,
 * a calm optional clock, a "Pauză" that stops it, and a time-up that never cuts the child off.
 */
export default function ExamRunner({ test, showTimer = true, onAttempt, onFinish, onExit }: ExamRunnerProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const total = useMemo(() => test.sections.reduce((n, s) => n + s.items.length, 0), [test])

  const [pos, setPos] = useState({ s: 0, i: 0, intro: true })
  const [answered, setAnswered] = useState(0)
  const [dialog, setDialog] = useState<Dialog>('none')
  const [clockOn, setClockOn] = useState(showTimer)
  const [remainingMs, setRemainingMs] = useState(test.timeLimitMin * 60_000)
  const [overtime, setOvertime] = useState(false)

  const answers = useRef<ExamAnswers>({})
  const startedAt = useRef(Date.now())
  const pausedMs = useRef(0)
  const finished = useRef(false)
  const remainingRef = useRef(remainingMs)
  remainingRef.current = remainingMs

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinish({
      answers: answers.current,
      durationMs: Math.max(0, Date.now() - startedAt.current - pausedMs.current),
      overtime: overtime || remainingRef.current <= 0,
    })
  }, [onFinish, overtime])

  /* The clock runs only while the paper is in front of the child */
  const running = dialog === 'none' && !overtime
  useEffect(() => {
    if (!running) return
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const delta = now - last
      last = now
      setRemainingMs((ms) => Math.max(0, ms - delta))
    }, 250)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (remainingMs <= 0 && dialog === 'none' && !overtime) setDialog('timeup')
  }, [remainingMs, dialog, overtime])

  /* Time spent in a dialog does not count towards the duration shown to parents */
  const dialogSince = useRef<number | null>(null)
  useEffect(() => {
    if (dialog !== 'none') dialogSince.current = Date.now()
    else if (dialogSince.current !== null) {
      pausedMs.current += Date.now() - dialogSince.current
      dialogSince.current = null
    }
  }, [dialog])

  const section = test.sections[pos.s]
  const item = section?.items[pos.i]

  const handleAnswer = (result: ItemResult) => {
    if (!item || finished.current) return
    answers.current[item.id] = result.correct
    setAnswered((n) => n + 1)
    onAttempt?.(result, item)
    if (pos.i + 1 < section.items.length) setPos({ s: pos.s, i: pos.i + 1, intro: false })
    else if (pos.s + 1 < test.sections.length) setPos({ s: pos.s + 1, i: 0, intro: true })
    else finish()
  }

  if (!section) return null

  const clock = overtime ? t('exam.runner.timerOver') : formatClock(remainingMs)
  const current = Math.min(answered + 1, total)

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-4">
      <header className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDialog('exit')}
          aria-label={t('exam.runner.exit')}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl font-extrabold text-ludiko-text shadow active:scale-95"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <h1 className="min-w-0 flex-1 line-clamp-2 text-center text-base font-extrabold leading-tight text-ludiko-text">
          {localize(test.title, lang)}
        </h1>
        <button
          type="button"
          onClick={() => setDialog('pause')}
          className="flex h-12 shrink-0 items-center gap-1 rounded-full bg-white px-4 text-base font-extrabold text-ludiko-text shadow active:scale-95"
        >
          <span aria-hidden="true">⏸</span>
          {t('exam.runner.pause')}
        </button>
      </header>

      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-base font-extrabold text-ludiko-text" aria-live="polite">
          {t('exam.runner.progress', { current, total })}
        </p>
        {clockOn && (
          <span
            role="timer"
            aria-label={t('exam.runner.timer', { time: formatClock(remainingMs) })}
            className="shrink-0 rounded-full bg-white px-3 py-1 text-base font-extrabold tabular-nums text-ludiko-text shadow-sm"
            data-testid="exam-clock"
          >
            <span aria-hidden="true">⏱ </span>
            <span aria-hidden="true">{clock}</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setClockOn((v) => !v)}
          aria-pressed={clockOn}
          aria-label={clockOn ? t('exam.runner.hideTimer') : t('exam.runner.showTimerBtn')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow-sm active:scale-95"
        >
          <span aria-hidden="true">{clockOn ? '🙈' : '⏱'}</span>
        </button>
      </div>
      <ProgressBar thin value={total ? answered / total : 0} label={t('exam.runner.progress', { current, total })} className="mb-1 shadow" />
      <p className="mb-4 h-4 truncate text-xs font-bold text-ludiko-text/60">
        {!pos.intro && `${t('exam.runner.sectionOf', { current: pos.s + 1, total: test.sections.length })} · ${localize(section.title, lang)}`}
      </p>

      {dialog === 'pause' ? null : pos.intro ? (
        <section className="rounded-3xl bg-white p-6 text-center shadow-md" data-testid="section-intro">
          <p className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">
            {t('exam.runner.sectionOf', { current: pos.s + 1, total: test.sections.length })}
          </p>
          <h2 className="mt-1 text-3xl font-extrabold leading-tight text-ludiko-text">{localize(section.title, lang)}</h2>
          <p className="mt-3 text-lg font-semibold text-ludiko-text/80">{localize(section.intro, lang)}</p>
          <p className="mt-2 text-sm font-bold text-ludiko-text/60">
            {t('exam.runner.sectionCount', { count: section.items.length })}
          </p>
          <button
            type="button"
            onClick={() => setPos({ ...pos, intro: false })}
            className="mt-5 min-h-[60px] w-full rounded-2xl bg-ludiko-green text-2xl font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {t('exam.runner.sectionGo')}
          </button>
        </section>
      ) : (
        item && (
          <ItemFeedbackContext.Provider value="neutral">
            <div key={item.id} className="flex flex-col gap-3">
              <ItemView item={item} onAnswer={handleAnswer} disabled={dialog !== 'none'} />
            </div>
          </ItemFeedbackContext.Provider>
        )
      )}

      {dialog === 'pause' && (
        <ExamDialog
          icon="🍃"
          title={t('exam.runner.pausedTitle')}
          body={t('exam.runner.pausedBody')}
          primary={{ label: t('exam.runner.resume'), onClick: () => setDialog('none') }}
        />
      )}
      {dialog === 'timeup' && (
        <ExamDialog
          icon="🕰️"
          title={t('exam.runner.timeUpTitle')}
          body={t('exam.runner.timeUpBody')}
          primary={{
            label: t('exam.runner.timeUpKeep'),
            onClick: () => {
              setOvertime(true)
              setDialog('none')
            },
          }}
          secondary={{ label: t('exam.runner.timeUpFinish'), onClick: finish }}
        />
      )}
      {dialog === 'exit' && (
        <ExamDialog
          icon="🚪"
          title={t('exam.runner.exitTitle')}
          body={t('exam.runner.exitBody')}
          primary={{ label: t('exam.runner.exitStay'), onClick: () => setDialog('none') }}
          secondary={{ label: t('exam.runner.exitLeave'), onClick: onExit }}
        />
      )}
    </main>
  )
}
