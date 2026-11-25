import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Explanation, MediaRef } from '@/engine/types'
import { localize } from '@/engine/types'
import Visual from '@/ui/visuals/Visual'
import { resolveMediaSrc } from '@/ui/visuals/ImageVisual'
import './frames.css'

interface Props {
  explanation: Explanation
  onDone: () => void
}

const SWIPE_MIN_PX = 48

/**
 * Plays an Explanation one frame at a time: one idea, one picture.
 * Big Back/Next buttons, progress dots, swipe + arrow keys, optional narration.
 */
export default function FramesPlayer({ explanation, onDone }: Props) {
  // Remount on a different explanation so index/audio state resets cleanly
  return <Player key={explanation.id} explanation={explanation} onDone={onDone} />
}

function Player({ explanation, onDone }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'ro'
  const frames = explanation.frames
  const total = frames.length
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [playing, setPlaying] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const frame = frames[index]
  const isLast = index >= total - 1

  const stopAudio = useCallback(() => {
    const a = audioRef.current
    if (a) {
      a.pause()
      audioRef.current = null
    }
    setPlaying(false)
  }, [])

  // Narration belongs to one frame: stop it when the frame changes or the player unmounts
  useEffect(() => {
    setAudioError(false)
    return stopAudio
  }, [index, stopAudio])

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next > total - 1 || next === index) return
      setDirection(next > index ? 'forward' : 'back')
      setIndex(next)
    },
    [index, total],
  )
  const goNext = useCallback(() => goTo(index + 1), [goTo, index])
  const goBack = useCallback(() => goTo(index - 1), [goTo, index])

  const toggleAudio = (media: MediaRef) => {
    if (playing) {
      stopAudio()
      return
    }
    const href = resolveMediaSrc(media.src)
    if (!href || typeof Audio === 'undefined') {
      setAudioError(true)
      return
    }
    try {
      const a = new Audio(href)
      audioRef.current = a
      a.onended = () => setPlaying(false)
      a.onerror = () => {
        setPlaying(false)
        setAudioError(true)
      }
      setAudioError(false)
      setPlaying(true)
      const p = a.play()
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          setPlaying(false)
          setAudioError(true)
        })
      }
    } catch {
      setPlaying(false)
      setAudioError(true)
    }
  }

  /* Swipe: pointer events only, no library. Mostly-horizontal drags change the frame. */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipeStart.current
    swipeStart.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) goNext()
    else goBack()
  }
  const onPointerCancel = () => {
    swipeStart.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') goNext()
    else if (e.key === 'ArrowLeft') goBack()
  }

  if (!frame) return null

  return (
    <section
      className="mx-auto w-full max-w-xl rounded-3xl bg-white p-4 shadow-md sm:p-6"
      aria-label={localize(explanation.title, lang)}
      onKeyDown={onKeyDown}
    >
      <p className="text-center text-sm font-semibold text-ludiko-text/70">{t('frames.intro')}</p>
      <h2 className="mb-3 text-center text-xl font-extrabold text-ludiko-text">{localize(explanation.title, lang)}</h2>

      {/* progress: dots + words, so it is never colour-only */}
      <div className="mb-3 flex flex-col items-center gap-1">
        <ol className="flex items-center gap-2" aria-label={t('frames.stepsLabel')}>
          {frames.map((_, i) => (
            <li key={i} className="list-none">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('frames.stepOf', { current: i + 1, total })}
                aria-current={i === index ? 'step' : undefined}
                className="flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span
                  className={`block rounded-full border-2 border-ludiko-text/60 transition-all ${
                    i === index ? 'h-4 w-4 bg-ludiko-pink' : i < index ? 'h-3 w-3 bg-ludiko-blue' : 'h-3 w-3 bg-white'
                  }`}
                />
              </button>
            </li>
          ))}
        </ol>
        <span className="text-xs font-semibold text-ludiko-text/70" aria-hidden="true">
          {t('frames.stepOf', { current: index + 1, total })}
        </span>
      </div>

      {/* the frame itself — swipeable, vertical scroll still works */}
      <div
        className="touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        tabIndex={0}
        role="group"
        aria-label={t('frames.frameRegion')}
        data-testid="frame-area"
      >
        <div key={index} className={direction === 'forward' ? 'frames-enter' : 'frames-enter-back'} aria-live="polite">
          {frame.visual && (
            <div className="mb-4 rounded-2xl bg-ludiko-bg p-3">
              <Visual spec={frame.visual} size="lg" />
            </div>
          )}
          <p className="text-center text-xl font-bold leading-snug text-ludiko-text sm:text-2xl">{localize(frame.text, lang)}</p>
        </div>
      </div>

      {frame.audio && (
        <div className="mt-3 flex flex-col items-center">
          <button
            type="button"
            onClick={() => toggleAudio(frame.audio!)}
            aria-pressed={playing}
            className="min-h-[44px] rounded-full bg-ludiko-yellow px-5 py-2 font-bold text-ludiko-text shadow active:scale-95"
          >
            <span aria-hidden="true">{playing ? '⏹ ' : '🔊 '}</span>
            {playing ? t('frames.stopListening') : t('frames.listen')}
          </button>
          {audioError && (
            <p role="status" className="mt-1 text-sm text-ludiko-text/80">
              {t('frames.audioFailed')}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={index === 0}
          className="flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-orange px-4 py-3 text-lg font-extrabold text-ludiko-text shadow-md transition active:scale-95 disabled:opacity-40"
        >
          <span aria-hidden="true">← </span>
          {t('frames.back')}
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={onDone}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-green px-4 py-3 text-lg font-extrabold text-ludiko-text shadow-md transition active:scale-95"
          >
            {t('frames.understood')}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-blue px-4 py-3 text-lg font-extrabold text-ludiko-text shadow-md transition active:scale-95"
          >
            {t('frames.next')}
            <span aria-hidden="true"> →</span>
          </button>
        )}
      </div>
    </section>
  )
}
