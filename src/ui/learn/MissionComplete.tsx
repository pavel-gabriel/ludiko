import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Confetti from '@/components/ui/Confetti'
import { playFinish } from '@/utils/sounds'

interface MissionCompleteProps {
  /** Celebrate with confetti and a fanfare (true right after finishing, false when just revisiting) */
  fresh?: boolean
  onMap: () => void
  onHome: () => void
}

/** Treasure found: the mission is over, and there is always a gentle "keep playing" */
export default function MissionComplete({ fresh = true, onMap, onHome }: MissionCompleteProps) {
  const { t } = useTranslation()
  useEffect(() => {
    if (fresh) playFinish()
  }, [fresh])

  return (
    <section className="flex flex-col gap-4 pt-6" aria-labelledby="mission-done-title">
      {fresh && <Confetti />}
      <div className="rounded-3xl bg-white p-6 text-center shadow-md">
        <div className="text-7xl" aria-hidden="true">💎</div>
        <h1 id="mission-done-title" className="mt-2 text-3xl font-extrabold text-ludiko-text">
          {t('learn.mission.completeTitle')}
        </h1>
        <p className="mt-2 text-lg font-semibold text-ludiko-text/80">{t('learn.mission.completeBody')}</p>
      </div>
      <button
        type="button"
        onClick={onMap}
        className="min-h-[60px] w-full rounded-2xl bg-ludiko-blue text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        <span aria-hidden="true">🏝️ </span>
        {t('learn.mission.keepPlaying')}
      </button>
      <button
        type="button"
        onClick={onHome}
        className="min-h-[52px] w-full rounded-2xl bg-white text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('learn.toHome')}
      </button>
    </section>
  )
}
