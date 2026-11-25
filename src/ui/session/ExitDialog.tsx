import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface ExitDialogProps {
  onStay: () => void
  onLeave: () => void
}

/** "Facem o pauză?" confirmation. Esc or the backdrop keeps playing. */
export default function ExitDialog({ onStay, onLeave }: ExitDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const stayRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    stayRef.current?.focus()
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onStay()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onStay()
        }}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"
      >
        <div className="text-5xl" aria-hidden="true">⏸️</div>
        <h2 id={titleId} className="mt-2 text-2xl font-extrabold text-ludiko-text">
          {t('session.pauseTitle')}
        </h2>
        <p className="mt-2 text-base font-semibold text-ludiko-text/80">{t('session.pauseBody')}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            ref={stayRef}
            type="button"
            onClick={onStay}
            className="min-h-[56px] rounded-2xl bg-ludiko-green px-6 text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {t('session.keepGoing')}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="min-h-[52px] rounded-2xl bg-gray-100 px-6 text-lg font-bold text-ludiko-text active:scale-95"
          >
            {t('session.leave')}
          </button>
        </div>
      </div>
    </div>
  )
}
