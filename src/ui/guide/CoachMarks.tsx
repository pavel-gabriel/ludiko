import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { AgeBand } from '@/older/ageBand'
import { MascotSvg } from '@/ui/mascot/Mascot'
import ReadAloudButton from '@/ui/speech/ReadAloudButton'

export interface CoachStep {
  /** `data-guide` value of the element the step points at; a missing element just centres the bubble */
  target: string
  text: string
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 6

function measure(target: string): Box | null {
  const el = document.querySelector(`[data-guide="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/**
 * First-run coach marks: one short bubble at a time, pointing at a part of the screen (ring + dimmed rest).
 * Skippable at any step ("Sari peste"), Escape closes, the primary button gets focus, read-aloud for the
 * younger bands. Rendered in a portal so fixed positioning is never trapped by a parent.
 */
export default function CoachMarks({ steps, band, onClose }: { steps: CoachStep[]; band: AgeBand; onClose: () => void }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const textId = useId()
  const step = steps[index]
  const last = index === steps.length - 1

  const remeasure = useCallback(() => {
    if (step) setBox(measure(step.target))
  }, [step])

  useLayoutEffect(() => {
    if (!step) return
    const el = document.querySelector(`[data-guide="${step.target}"]`)
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ;(el as HTMLElement | null)?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    remeasure()
    // smooth scrolling moves the target after this frame: measure again once it settles
    const timers = [120, 400, 800].map((ms) => window.setTimeout(remeasure, ms))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [step, remeasure])

  useEffect(() => {
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [remeasure])

  useEffect(() => {
    primary.current?.focus()
  }, [index])

  if (!step) return null

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  let bubble: React.CSSProperties
  if (!box) bubble = { top: '50%', transform: 'translateY(-50%)' }
  else if (box.top + box.height + 230 < vh) bubble = { top: Math.max(8, box.top + box.height + PAD + 10) }
  else if (box.top > 230) bubble = { bottom: Math.max(8, vh - box.top + PAD + 10) }
  else bubble = { bottom: 16 }

  const next = () => (last ? onClose() : setIndex((i) => i + 1))

  return createPortal(
    <div className="fixed inset-0 z-50" data-testid="coach-marks" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      {/* catches taps so the page behind does not react while the guide talks */}
      <div className={`absolute inset-0 ${box ? '' : 'bg-black/45'}`} aria-hidden="true" onClick={next} />
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-3xl ring-4 ring-ludiko-yellow motion-safe:transition-all"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-describedby={textId}
        aria-label={t('guide.help')}
        className="absolute inset-x-4 mx-auto max-w-sm rounded-3xl bg-white p-4 shadow-xl"
        style={bubble}
        data-testid="coach-bubble"
        data-step={step.target}
      >
        <div className="flex items-start gap-3">
          {band !== 'big' && <MascotSvg mood="wave" size={48} decorative className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-wide text-ludiko-text/60">
              {t('guide.stepOf', { n: index + 1, total: steps.length })}
            </p>
            <p id={textId} className={`mt-0.5 font-extrabold leading-snug text-ludiko-text ${band === 'big' ? 'text-base' : 'text-lg'}`}>
              {step.text}
            </p>
          </div>
        </div>
        {band !== 'big' && <ReadAloudButton text={step.text} className="mt-2" />}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="coach-skip"
            className="min-h-[48px] flex-1 rounded-2xl bg-ludiko-bg px-3 text-base font-bold text-ludiko-text active:scale-95"
          >
            {t('guide.skip')}
          </button>
          <button
            ref={primary}
            type="button"
            onClick={next}
            data-testid="coach-next"
            className="min-h-[48px] flex-[2] rounded-2xl bg-ludiko-green px-3 text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
          >
            {last ? t('guide.done') : t('guide.next')}
            {!last && <span aria-hidden="true"> →</span>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
