import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Confetti from '@/components/ui/Confetti'
import { localize } from '@/engine/types'
import { playFinish } from '@/utils/sounds'
import type { SessionReward, SessionSummary } from './types'

interface SessionResultsProps {
  summary: SessionSummary
  /** Result of saving progress; null while it is still being saved */
  reward: SessionReward | null
  /** No profile selected: progress is not saved */
  isGuest?: boolean
  onAgain: () => void
  onDone: () => void
}

/** End-of-session screen: always encouraging, stars from 1 up, never a "fail" state. */
export default function SessionResults({ summary, reward, isGuest, onAgain, onDone }: SessionResultsProps) {
  const { t, i18n } = useTranslation()
  const { stars, total, correct, mode } = summary

  useEffect(() => {
    playFinish()
  }, [])

  const tier = stars >= 3 ? 'three' : stars === 2 ? 'two' : stars === 1 ? 'one' : 'none'
  const headline = mode === 'sprint' && summary.completed ? t('session.results.timeUp') : t(`session.results.${tier}.title`)

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-8">
      {stars >= 2 && <Confetti />}

      <section className="rounded-3xl bg-white p-6 text-center shadow-md" aria-labelledby="session-results-title">
        <div
          className="flex justify-center gap-2 text-5xl"
          role="img"
          aria-label={t('session.results.starsLabel', { n: stars })}
        >
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">
              ⭐
            </span>
          ))}
        </div>
        <h1 id="session-results-title" className="mt-3 text-3xl font-extrabold text-ludiko-text">
          {headline}
        </h1>
        <p className="mt-2 text-lg font-semibold text-ludiko-text/80">{t(`session.results.${tier}.body`)}</p>

        {total > 0 && (
          <p className="mt-4 rounded-2xl bg-ludiko-bg px-4 py-3 text-xl font-extrabold text-ludiko-text">
            {t(mode === 'sprint' ? 'session.results.sprintScore' : 'session.results.score', { correct, total })}
          </p>
        )}
      </section>

      {reward?.sticker && (
        <section
          className="mt-4 flex items-center gap-4 rounded-3xl bg-ludiko-yellow p-4 shadow-md"
          aria-label={t('session.results.stickerTitle')}
          data-testid="sticker-unlock"
        >
          <span className="text-6xl" aria-hidden="true">
            {reward.sticker}
          </span>
          <div className="text-left">
            <p className="text-lg font-extrabold text-ludiko-text">
              {reward.newSticker ? t('session.results.stickerTitle') : t('session.results.stickerOwned')}
            </p>
            <p className="text-sm font-semibold text-ludiko-text/80">
              {isGuest ? t('session.results.stickerGuest') : t('session.results.stickerBody')}
            </p>
          </div>
        </section>
      )}

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-md" aria-labelledby="session-review-title">
        <h2 id="session-review-title" className="text-lg font-extrabold text-ludiko-text">
          {t('session.results.reviewTitle')}
        </h2>
        {summary.review.length === 0 ? (
          <p className="mt-1 text-base font-semibold text-ludiko-text/80">
            {total > 0 ? t('session.results.reviewNone') : ''}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-ludiko-text/70">{t('session.results.reviewHint')}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {summary.review.map((r) => (
                <li
                  key={r.itemId}
                  className="rounded-xl bg-amber-50 px-3 py-2 text-base font-bold text-ludiko-text"
                >
                  {localize(r.prompt, i18n.language)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {isGuest && (
        <p className="mt-4 rounded-2xl bg-ludiko-orange/60 px-4 py-3 text-center text-sm font-semibold text-ludiko-text">
          {t('session.guestNote')}{' '}
          <Link to="/profiles" className="font-extrabold underline">
            {t('session.pickProfile')}
          </Link>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onAgain}
          className="min-h-[60px] rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('session.results.again')}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-[56px] rounded-2xl bg-ludiko-blue text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('session.results.done')}
        </button>
      </div>
    </main>
  )
}
