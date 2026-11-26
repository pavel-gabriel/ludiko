import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { familyAvailable } from '@/family/api'
import { useFamilySession } from '@/family/useFamilySession'
import { useProfileStore } from '@/store/profileStore'
import type { EraseStepResult } from '@/privacy/eraseAll'

const STEPS = ['classes', 'push', 'family', 'local', 'signout'] as const

/** "Șterge tot" for parents: one confirmed action across cloud account, class, push and (optionally) this device */
export default function EraseAllCard() {
  const { t } = useTranslation()
  const session = useFamilySession()
  const loadProfiles = useProfileStore((s) => s.load)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [deleteLocal, setDeleteLocal] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<EraseStepResult[] | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const { eraseAll } = await import('@/privacy/eraseAll')
      setResults(await eraseAll({ deleteLocal, password: password || undefined }))
    } catch {
      setResults(STEPS.map((s) => ({ id: s, status: 'failed' as const })))
    }
    setPassword('')
    setOpen(false)
    setBusy(false)
    await loadProfiles().catch(() => {})
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby={`${id}-t`} data-testid="erase-all-card">
      <h2 id={`${id}-t`} className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">
        {t('privacyTools.title')}
      </h2>
      <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('privacyTools.intro')}</p>
      {results && (
        <div role="status" className="mt-3 rounded-xl bg-ludiko-yellow/50 p-3" data-testid="erase-results">
          <p className="text-sm font-extrabold text-ludiko-text">{t('privacyTools.resultTitle')}</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm font-semibold text-ludiko-text">
            {results.map((r) => (
              <li key={r.id} data-testid={`erase-${r.id}`} data-status={r.status}>
                {t(`privacyTools.status.${r.status}`)} · {t(`privacyTools.steps.${r.id}`)}
                {r.detail ? ` (${t(`privacyTools.detail.${r.detail}`, { defaultValue: r.detail })})` : ''}
              </li>
            ))}
          </ul>
          {results.some((r) => r.status === 'failed' || r.status === 'partial') && (
            <p className="mt-2 text-xs font-bold text-ludiko-text/80">{t('privacyTools.retry')}</p>
          )}
        </div>
      )}
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            setResults(null)
          }}
          className="mt-3 min-h-[48px] w-full rounded-2xl bg-red-100 px-4 text-base font-extrabold text-red-800 active:scale-95"
          data-testid="erase-open"
        >
          {t('privacyTools.button')}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3" data-testid="erase-confirm">
          <p className="text-sm font-bold text-ludiko-text">{t('privacyTools.willDo')}</p>
          <ul className="list-disc pl-5 text-sm font-semibold text-ludiko-text/90">
            <li>{t('privacyTools.steps.family')}</li>
            <li>{t('privacyTools.steps.classes')}</li>
            <li>{t('privacyTools.steps.push')}</li>
            <li>{t('privacyTools.steps.signout')}</li>
          </ul>
          <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl bg-ludiko-yellow/60 p-3">
            <input
              type="checkbox"
              checked={deleteLocal}
              onChange={(e) => setDeleteLocal(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-ludiko-purple"
              data-testid="erase-local"
            />
            <span className="text-sm font-bold text-ludiko-text">{t('privacyTools.localCheckbox')}</span>
          </label>
          {session && familyAvailable() && (
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('privacyTools.password')}
              aria-label={t('privacyTools.password')}
              className="min-h-[48px] w-full rounded-xl border-2 border-ludiko-purple/30 bg-white px-3 text-base text-ludiko-text focus:border-ludiko-purple focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="min-h-[48px] flex-1 rounded-2xl bg-red-600 px-4 text-base font-extrabold text-white active:scale-95 disabled:opacity-50"
              data-testid="erase-confirm-btn"
            >
              {busy ? t('privacyTools.working') : t('privacyTools.confirm')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
              className="min-h-[48px] rounded-2xl bg-gray-100 px-4 text-base font-extrabold text-ludiko-text active:scale-95"
            >
              {t('privacyTools.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
