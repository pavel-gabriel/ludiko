import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatMark } from '@/older/marks'
import { getChallengeBest } from '@/older/olderStore'

/** Home tile for "Provocarea zilei" with the best mark of this week (kept on this device only) */
export default function ChallengeCard({ profileId }: { profileId: string }) {
  const { t, i18n } = useTranslation()
  const best = getChallengeBest(profileId)
  return (
    <Link
      to="/learn/challenge"
      data-testid="card-challenge"
      className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-ludiko-pink px-4 py-3 text-left shadow-sm transition-transform active:scale-95"
    >
      <span className="text-3xl" aria-hidden="true">🏁</span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold leading-tight text-ludiko-text">{t('older.challenge.title')}</span>
        <span className="block text-sm font-semibold text-ludiko-text/80">{t('older.challenge.body')}</span>
        <span className="block text-sm font-bold text-ludiko-text" data-testid="challenge-best">
          {best === null ? t('older.challenge.bestNone') : t('older.challenge.best', { mark: formatMark(best, i18n.language) })}
        </span>
      </span>
    </Link>
  )
}
