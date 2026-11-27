import { useTranslation } from 'react-i18next'

/** Round "?" button that shows a screen's guide again */
export default function GuideButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('guide.help')}
      title={t('guide.help')}
      data-testid="guide-help"
      data-guide="help"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xl font-extrabold text-ludiko-purple shadow-md active:scale-95 ${className}`}
    >
      <span aria-hidden="true">?</span>
    </button>
  )
}
