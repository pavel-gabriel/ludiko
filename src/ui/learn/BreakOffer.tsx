import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'
import ProgressBar from './ProgressBar'

interface BreakOfferProps {
  /** 0..1 */
  progress: number
  onStop: () => void
  onContinue: () => void
}

/** After about three minutes: a kind offer to rest. The child may simply keep going. */
export default function BreakOffer({ progress, onStop, onContinue }: BreakOfferProps) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-5" aria-labelledby="break-title">
      <Mascot mood="sleep">
        <h1 id="break-title" className="text-2xl font-extrabold text-ludiko-text">
          {t('learn.check.breakTitle')}
        </h1>
        <p className="mt-2 text-base font-semibold text-ludiko-text/80">{t('learn.check.breakBody')}</p>
      </Mascot>
      <ProgressBar value={progress} label={t('learn.check.progress', { pct: Math.round(progress * 100) })} />
      <button
        type="button"
        onClick={onStop}
        className="min-h-[60px] w-full rounded-2xl bg-ludiko-blue px-4 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('learn.check.breakStop')}
      </button>
      <button
        type="button"
        onClick={onContinue}
        className="min-h-[60px] w-full rounded-2xl bg-ludiko-green px-4 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('learn.check.breakGo')}
      </button>
    </section>
  )
}
