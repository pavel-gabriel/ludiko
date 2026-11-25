import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getFamilyApi } from '@/family/api'
import { acceptFamilyImport } from '@/family/familyState'
import type { RemoteChildInfo } from '@/family/types'
import { useFamilySession } from '@/family/useFamilySession'
import { useProfileStore } from '@/store/profileStore'

/**
 * "Am găsit N copii în cont": shown to a signed-in parent on a device that does not have some of the
 * children of the account yet (docs/PARENT_SYNC.md §5). Renders nothing otherwise, and never loads
 * Firebase unless a parent is signed in and has not answered yet.
 */
export default function FamilyImportPrompt({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const session = useFamilySession()
  const { profiles, loaded, load } = useProfileStore()
  const [found, setFound] = useState<RemoteChildInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])

  const watching = Boolean(session && !session.accepted && loaded)
  const localIds = profiles.map((p) => p.id).join(',')
  useEffect(() => {
    if (!watching) {
      setFound([])
      return
    }
    let cancelled = false
    getFamilyApi()
      .then((api) => api.listRemoteChildren())
      .then((list) => {
        if (!cancelled) setFound(list.filter((c) => !localIds.split(',').includes(c.id)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [watching, localIds, session?.lastSync])

  const importAll = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const api = await getFamilyApi()
      for (const c of found) await api.importRemoteChild(c.id)
      acceptFamilyImport()
      await load()
      setFound([])
      setDone(true)
      void api.syncNow().catch(() => {})
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  if (done) {
    return (
      <p role="status" className={`rounded-2xl bg-ludiko-green/60 px-4 py-3 text-center text-sm font-bold text-ludiko-text ${className}`}>
        {t('family.import.done')}
      </p>
    )
  }
  if (dismissed || found.length === 0) return null

  return (
    <section
      aria-labelledby="family-import-title"
      data-testid="family-import"
      className={`flex flex-col gap-3 rounded-2xl bg-ludiko-yellow p-4 text-ludiko-text shadow-sm ${className}`}
    >
      <h2 id="family-import-title" className="text-lg font-extrabold">
        <span aria-hidden="true">☁️ </span>
        {t('family.import.found', { count: found.length })}
      </h2>
      <ul className="flex flex-wrap gap-2" aria-label={t('family.signedIn.children')}>
        {found.map((c) => (
          <li key={c.id} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-bold">
            <span aria-hidden="true">{c.avatar}</span>
            <span className="max-w-[9rem] truncate">{c.nickname}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-semibold">{t('family.import.hint')}</p>
      {failed && (
        <p role="alert" className="text-sm font-bold text-red-700">{t('family.errors.failed')}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void importAll()}
        data-testid="family-import-all"
        className="min-h-[52px] rounded-2xl bg-ludiko-green px-4 text-lg font-extrabold shadow-md active:scale-95 disabled:opacity-60"
      >
        {busy ? t('family.import.working') : t('family.import.action')}
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="min-h-[44px] text-sm font-bold underline">
        {t('family.import.later')}
      </button>
    </section>
  )
}
