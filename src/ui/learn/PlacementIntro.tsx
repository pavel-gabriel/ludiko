import { useTranslation } from 'react-i18next'
import Mascot from './Mascot'

interface PlacementIntroProps {
  resuming: boolean
  onStart: () => void
}

/** Start of "Verifică-te": a friendly adventure invitation, never the word "test" */
export default function PlacementIntro({ resuming, onStart }: PlacementIntroProps) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-5" aria-labelledby="check-intro-title">
      <Mascot>
        <h1 id="check-intro-title" className="text-2xl font-extrabold leading-snug text-ludiko-text">
          {resuming ? t('learn.check.resumeTitle') : t('learn.check.introTitle')}
        </h1>
        <p className="mt-2 text-base font-semibold text-ludiko-text/80">
          {resuming ? t('learn.check.resumeBody') : t('learn.check.introBody')}
        </p>
      </Mascot>

      {!resuming && (
        <ul className="flex flex-col gap-2">
          {(['introPoint1', 'introPoint2', 'introPoint3'] as const).map((k, i) => (
            <li key={k} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-base font-bold text-ludiko-text shadow-sm">
              <span className="text-2xl" aria-hidden="true">{['⏱️', '☕', '💛'][i]}</span>
              {t(`learn.check.${k}`)}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onStart}
        className="min-h-[64px] w-full rounded-2xl bg-ludiko-green text-2xl font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {resuming ? t('learn.check.resume') : t('learn.check.start')}
      </button>
    </section>
  )
}
