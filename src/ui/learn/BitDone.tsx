import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Confetti from '@/components/ui/Confetti'
import type { BitKind } from '@/learner'
import type { SessionReward } from '@/ui/session/types'
import { AlbumLink, BonusStickers } from '@/ui/album/BonusStickers'
import { MascotSvg } from '@/ui/mascot/Mascot'
import { playFinish } from '@/utils/sounds'
import { BIT_ICON } from './BitTiles'

interface BitDoneProps {
  kind: BitKind
  stars: number
  /** Set when the bit held a mastery check */
  passed?: boolean
  reward: SessionReward | null
  /** Every bit of the day is done */
  allDone: boolean
  /** There is another bit left to offer */
  hasNext: boolean
  onNext: () => void
  onStop: () => void
}

/** A small celebration after each bit, then "Încă un bit?" or "Gata pe azi" — never pressure to continue */
export default function BitDone({ kind, stars, passed, reward, allDone, hasNext, onNext, onStop }: BitDoneProps) {
  const { t } = useTranslation()
  useEffect(() => {
    playFinish()
  }, [])
  const body =
    passed === undefined
      ? allDone
        ? t('bits.allDoneBody')
        : t('bits.doneBody')
      : passed
        ? t('learn.mission.checkPassed')
        : t('learn.mission.checkNotYet')

  return (
    <section className="flex flex-col gap-4 pt-6" aria-labelledby="bit-done-title" data-testid="bit-done">
      {(stars >= 2 || passed) && <Confetti />}
      <div className="rounded-3xl bg-white p-6 text-center shadow-md">
        <div className="flex items-end justify-center gap-2">
          <MascotSvg mood={stars >= 2 || passed ? 'cheer' : 'encourage'} size={104} decorative />
          <span className="pb-2 text-4xl" aria-hidden="true">{BIT_ICON[kind]}</span>
        </div>
        <h1 id="bit-done-title" className="mt-2 text-3xl font-extrabold text-ludiko-text">
          {t('bits.doneTitle')}
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

      <BonusStickers reward={reward} />
      {(reward?.sticker || (reward?.bonus && reward.bonus.length > 0)) && (
        <div className="flex justify-center">
          <AlbumLink />
        </div>
      )}

      {hasNext && (
        <div className="rounded-3xl bg-ludiko-green p-4 text-center shadow-md">
          <p className="text-xl font-extrabold text-ludiko-text">{t('bits.another')}</p>
          <button
            type="button"
            onClick={onNext}
            data-testid="bit-another"
            className="mt-3 min-h-[60px] w-full rounded-2xl bg-white text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {t('bits.anotherCta')}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onStop}
        data-testid="bit-stop"
        className={`min-h-[56px] w-full rounded-2xl text-lg font-extrabold text-ludiko-text shadow-md active:scale-95 ${
          hasNext ? 'bg-white' : 'bg-ludiko-green'
        }`}
      >
        {t('bits.stop')}
      </button>
    </section>
  )
}
