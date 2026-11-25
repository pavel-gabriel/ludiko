import { useTranslation } from 'react-i18next'
import type { MissionStepKind } from '@/learner'

export interface PathStep {
  kind: MissionStepKind
  /** Kid-readable skill title */
  title: string
  done: boolean
}

interface TreasurePathProps {
  steps: PathStep[]
  /** Called with the index of the next step when the child taps it */
  onStart: (index: number) => void
}

export const KIND_ICON: Record<MissionStepKind, string> = {
  new: '🏝️',
  practice: '🎯',
  review: '🔄',
  check: '🗝️',
}

const W = 320
const ROW = 132
const R = 36
/** Stones zigzag left and right so the path winds like a treasure map */
const X = [72, 248]

const nodeX = (i: number) => X[i % X.length]
const nodeY = (i: number) => R + 8 + i * ROW

/** Today's mission as a winding treasure-map path: tap the glowing stone to play the next step */
export default function TreasurePath({ steps, onStart }: TreasurePathProps) {
  const { t } = useTranslation()
  const next = steps.findIndex((s) => !s.done)
  const count = steps.length
  const H = nodeY(count) + R + 28

  // one smooth curve through every stone and on to the treasure
  let d = `M ${nodeX(0)} ${nodeY(0)}`
  for (let i = 1; i <= count; i++) {
    d += ` C ${nodeX(i - 1)} ${nodeY(i - 1) + 70}, ${nodeX(i)} ${nodeY(i) - 70}, ${nodeX(i)} ${nodeY(i)}`
  }
  const pos = (i: number) => ({ left: `${(nodeX(i) / W) * 100}%`, top: `calc(${(nodeY(i) / H) * 100}% - ${R}px)` })
  const allDone = next === -1

  return (
    <div className="relative w-full rounded-3xl bg-gradient-to-b from-sky-100 to-amber-50 p-0 shadow-inner" data-testid="treasure-path">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden="true">
        <path d={d} fill="none" stroke="#d6a95c" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
        <path d={d} fill="none" stroke="#b9822f" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
      </svg>

      {steps.map((step, i) => {
        const isNext = i === next
        const kind = t(`learn.mission.kinds.${step.kind}`)
        const stateKey = step.done ? 'done' : isNext ? 'next' : 'later'
        const state = t(`learn.mission.state.${stateKey}`)
        const tone = step.done
          ? 'bg-ludiko-green'
          : isNext
            ? 'bg-ludiko-yellow ring-4 ring-ludiko-orange motion-safe:animate-pulse'
            : 'bg-white opacity-70'
        return (
          <div
            key={i}
            style={pos(i)}
            className="absolute flex w-[132px] -translate-x-1/2 flex-col items-center"
            data-testid={`step-${i}`}
          >
            <button
              type="button"
              disabled={!isNext}
              onClick={() => onStart(i)}
              aria-label={isNext ? t('learn.mission.startStep', { kind, title: step.title }) : `${kind}: ${step.title}, ${state}`}
              className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full text-4xl shadow-lg transition-transform enabled:active:scale-90 ${tone}`}
            >
              <span aria-hidden="true" className={step.done || isNext ? '' : 'grayscale'}>{KIND_ICON[step.kind]}</span>
              {step.done && (
                <span
                  className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-base font-extrabold text-green-700 shadow"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
            <span className="mt-1 w-full rounded-xl bg-white/95 px-2 py-1 text-center shadow-sm">
              <span className="block text-sm font-extrabold leading-tight text-ludiko-text">{kind}</span>
              <span className="block line-clamp-2 text-xs font-semibold leading-tight text-ludiko-text/80">{step.title}</span>
              <span className="mt-0.5 block text-[11px] font-bold uppercase tracking-wide text-ludiko-text/60">{state}</span>
            </span>
          </div>
        )
      })}

      <div style={pos(count)} className="absolute flex w-[132px] -translate-x-1/2 flex-col items-center" data-testid="treasure">
        <span
          className={`flex h-[72px] w-[72px] items-center justify-center rounded-full text-4xl shadow-lg ${
            allDone ? 'bg-ludiko-yellow ring-4 ring-ludiko-orange' : 'bg-white opacity-70'
          }`}
          aria-hidden="true"
        >
          💎
        </span>
        <span className="mt-1 rounded-xl bg-white/95 px-3 py-1 text-sm font-extrabold text-ludiko-text shadow-sm">
          {t('learn.mission.treasure')}
        </span>
      </div>
    </div>
  )
}
