import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { makeGateChallenge } from '@/utils/parentalGate'

interface ParentalGateProps {
  onPass: () => void
  onCancel: () => void
}

/** Modal "ask an adult" check shown before anything that leaves the app (links, mailto, purchases). */
export default function ParentalGate({ onPass, onCancel }: ParentalGateProps) {
  const { t } = useTranslation()
  const challenge = useMemo(() => makeGateChallenge(), [])
  const [wrong, setWrong] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="parental-gate">
      <div role="dialog" aria-modal="true" aria-labelledby="gate-title" className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
        <h2 id="gate-title" className="text-xl font-extrabold text-ludiko-purple">{t('parentalGate.title')}</h2>
        <p className="mt-2 text-sm text-gray-600">{t('parentalGate.body')}</p>
        <p className="mt-4 text-2xl font-extrabold" data-testid="gate-question">
          {challenge.a} × {challenge.b} = ?
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {challenge.options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => (o === challenge.answer ? onPass() : setWrong(true))}
              className="min-h-[48px] rounded-2xl border-2 border-ludiko-blue bg-white text-lg font-bold hover:bg-ludiko-bg"
            >
              {o}
            </button>
          ))}
        </div>
        {wrong && <p role="alert" className="mt-3 text-sm text-red-600">{t('parentalGate.wrong')}</p>}
        <button type="button" onClick={onCancel} className="mt-4 min-h-[44px] px-4 text-sm font-semibold text-gray-500 hover:underline">
          {t('parentalGate.cancel')}
        </button>
      </div>
    </div>
  )
}
