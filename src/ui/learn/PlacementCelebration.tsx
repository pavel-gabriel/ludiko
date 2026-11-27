import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Confetti from '@/components/ui/Confetti'
import type { SessionReward } from '@/ui/session/types'
import { AlbumLink } from '@/ui/album/BonusStickers'
import { MascotSvg } from '@/ui/mascot/Mascot'
import { playFinish } from '@/utils/sounds'

interface PlacementCelebrationProps {
  reward: SessionReward | null
  /** Straight into today's plan (/learn) */
  onPlan: () => void
  onMap: () => void
  onParents: () => void
  /** Another subject still waits for its check: "Acum hai la <subject>" */
  nextSubject?: { name: string; onGo: () => void }
}

/**
 * End of the first check, for the CHILD: stickers and "your islands are ready".
 * Deliberately no level, score or gap count here — that statement is for parents (docs/PLAN.md §6).
 */
export default function PlacementCelebration({ reward, onPlan, onMap, onParents, nextSubject }: PlacementCelebrationProps) {
  const { t } = useTranslation()
  useEffect(() => {
    playFinish()
  }, [])

  return (
    <section className="flex flex-col gap-4" aria-labelledby="check-done-title">
      <Confetti />
      <div className="rounded-3xl bg-white p-6 text-center shadow-md">
        <div className="flex items-end justify-center gap-1" aria-hidden="true">
          <span className="pb-2 text-4xl">🏝️</span>
          <MascotSvg mood="cheer" size={120} decorative />
          <span className="pb-2 text-4xl">⭐</span>
        </div>
        <h1 id="check-done-title" className="mt-3 text-3xl font-extrabold text-ludiko-text">
          {t('learn.check.doneTitle')}
        </h1>
        <p className="mt-2 text-xl font-bold text-ludiko-text/80">{t('learn.check.doneBody')}</p>
      </div>

      {reward?.sticker && (
        <div className="flex items-center gap-4 rounded-3xl bg-ludiko-yellow p-4 shadow-md" data-testid="sticker-unlock">
          <span className="text-6xl" aria-hidden="true">{reward.sticker}</span>
          <p className="text-lg font-extrabold text-ludiko-text">{t('learn.check.stickerTitle')}</p>
        </div>
      )}

      {reward?.sticker && (
        <div className="flex justify-center">
          <AlbumLink />
        </div>
      )}

      <button
        type="button"
        onClick={onPlan}
        data-testid="after-check-plan"
        className="min-h-[64px] w-full rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        <span aria-hidden="true">✨ </span>
        {t('guide.check.afterPlan')}
      </button>
      {nextSubject && (
        <button
          type="button"
          onClick={nextSubject.onGo}
          data-testid="after-check-next"
          className="min-h-[56px] w-full rounded-2xl bg-ludiko-yellow text-lg font-extrabold text-ludiko-text shadow-md ring-2 ring-ludiko-orange active:scale-95"
        >
          <span aria-hidden="true">🧭 </span>
          {t('guide.check.afterNext', { subject: nextSubject.name })}
        </button>
      )}
      <button
        type="button"
        onClick={onMap}
        className="min-h-[56px] w-full rounded-2xl bg-ludiko-blue text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        <span aria-hidden="true">🏝️ </span>
        {t('learn.check.doneMap')}
      </button>
      <button
        type="button"
        onClick={onParents}
        className="mx-auto mt-2 inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-bold text-ludiko-text shadow-sm"
      >
        <span aria-hidden="true">👨‍👩‍👧 </span>
        {t('learn.check.forParents')}
      </button>
    </section>
  )
}
