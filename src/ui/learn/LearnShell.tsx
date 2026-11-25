import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

interface LearnShellProps {
  title?: string
  /** Where the back arrow goes; omit for no back link */
  backTo?: string
  backLabel?: string
  children: ReactNode
}

/** Common page frame for the learner screens: back link, title, a column that is comfortable at 360px */
export default function LearnShell({ title, backTo, backLabel, children }: LearnShellProps) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-4">
      {backTo && (
        <Link to={backTo} className="inline-flex min-h-[44px] items-center text-sm font-bold text-ludiko-text underline">
          <span aria-hidden="true">← </span>
          {backLabel ?? t('learn.back')}
        </Link>
      )}
      {title && <h1 className="mb-4 mt-1 text-center text-3xl font-extrabold leading-tight text-ludiko-text">{title}</h1>}
      {children}
    </main>
  )
}

/** Placeholder used while a screen's data loads */
export function LearnLoading() {
  const { t } = useTranslation()
  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <div className="text-6xl motion-safe:animate-bounce" aria-hidden="true">⭐</div>
      <p className="text-lg font-bold text-ludiko-text">{t('learn.loading')}</p>
    </main>
  )
}

/** Friendly failure with a retry button (never a raw error) */
export function LearnError({ onRetry, backTo = '/' }: { onRetry?: () => void; backTo?: string }) {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-6xl" aria-hidden="true">🌧️</div>
      <p className="text-xl font-extrabold text-ludiko-text">{t('learn.error')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[52px] rounded-2xl bg-ludiko-blue px-8 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('learn.retry')}
        </button>
      )}
      <Link to={backTo} className="inline-flex min-h-[44px] items-center text-sm font-bold underline">
        {t('learn.toHome')}
      </Link>
    </main>
  )
}
