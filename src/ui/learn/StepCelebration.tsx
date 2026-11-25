import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Confetti from '@/components/ui/Confetti'
import type { MissionStepKind } from '@/learner'
import type { SessionReward } from '@/ui/session/types'
import { playFinish } from '@/utils/sounds'
import { KIND_ICON } from './TreasurePath'

interface StepCelebrationProps {
  kind: MissionStepKind
  stars: number
  /** Only for the "Provocarea" step: did the mastery check pass */
  passed?: boolean
  reward: SessionReward | null
  onNext: () => void
}

/** After each step: stars, a kind word, never a score or a "fail" */
export default function StepCelebration({ kind, stars, passed, reward, onNext }: StepCelebrationProps) {
  const { t } = useTranslation()
  useEffect(() => {
    playFinish()
  }, [])
  const body =
    kind === 'check'
      ? passed
        ? t('learn.mission.checkPassed')
        : t('learn.mission.checkNotYet')
      : t('learn.mission.stepDoneBody')

  return (
    <section className="flex flex-col gap-4 pt-6" aria-labelledby="step-done-title">
      {(stars >= 2 || passed) && <Confetti />}
      <div className="rounded-3xl bg-white p-6 text-center shadow-md">
        <div className="text-6xl" aria-hidden="true">{KIND_ICON[kind]}</div>
        <h1 id="step-done-title" className="mt-2 text-3xl font-extrabold text-ludiko-text">
          {t('learn.mission.stepDoneTitle')}
        </h1>
        <p className="mt-2 text-lg font-semibold text-ludiko-text/80">{body}</p>
        <div className="mt-3 flex justify-center gap-2 text-4xl" role="img" aria-label={t('learn.mission.stepStars', { n: stars })}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">⭐</span>
          ))}
        </div>
      </div>

      {reward?.sticker && (
        <div className="flex items-center gap-4 rounded-3xl bg-ludiko-yellow p-4 shadow-md" data-testid="sticker-unlock">
          <span className="text-6xl" aria-hidden="true">{reward.sticker}</span>
          <p className="text-lg font-extrabold text-ludiko-text">{t('learn.check.stickerTitle')}</p>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="min-h-[64px] w-full rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('learn.mission.next')}
      </button>
    </section>
  )
}
