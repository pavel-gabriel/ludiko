import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ensurePacks, packsLoaded } from '@/engine/content/packs'
import { LearnError, LearnLoading } from '@/ui/learn/LearnShell'

type Status = 'ready' | 'loading' | 'error'

/**
 * Loads content packs (docs/ENGINE.md "Content packs"); `ready` is true at once when they are already in
 * memory, so a page that was prefetched never flashes a loading state.
 */
export function usePacks(packs: readonly string[]): { status: Status; retry: () => void } {
  const key = [...new Set(packs)].sort().join(',')
  const ready = packsLoaded(packs)
  const [, setLoaded] = useState(0)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (packsLoaded(ids)) return
    let alive = true
    ensurePacks(ids).then(
      () => alive && setLoaded((n) => n + 1),
      () => alive && setFailedKey(key),
    )
    return () => {
      alive = false
    }
  }, [key, attempt])

  const status: Status = ready ? 'ready' : failedKey === key ? 'error' : 'loading'
  return {
    status,
    retry: () => {
      setFailedKey(null)
      setAttempt((n) => n + 1)
    },
  }
}

/**
 * Renders `children` only once `packs` are loaded, so everything inside can generate items and read
 * explanations synchronously. Full-screen loading / error (offline and not cached) by default;
 * `inline` for a part of a page (e.g. a skill list).
 */
export default function ContentGate({
  packs,
  inline = false,
  backTo,
  children,
}: {
  packs: readonly string[]
  inline?: boolean
  backTo?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { status, retry } = usePacks(packs)
  if (status === 'ready') return <>{children}</>
  if (!inline) return status === 'loading' ? <LearnLoading /> : <LearnError onRetry={retry} backTo={backTo} />
  if (status === 'loading') {
    return (
      <p role="status" aria-live="polite" className="py-4 text-center font-bold text-ludiko-text">
        {t('learn.loading')}
      </p>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="font-bold text-ludiko-text">{t('learn.error')}</p>
      <button
        type="button"
        onClick={retry}
        className="min-h-[44px] rounded-2xl bg-ludiko-blue px-6 font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('learn.retry')}
      </button>
    </div>
  )
}
