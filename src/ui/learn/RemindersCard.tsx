import { useCallback, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PUSH_DEFAULT_HOUR,
  PUSH_HOUR_MAX,
  PUSH_HOUR_MIN,
  PushError,
  getStatus,
  subscribe,
  unsubscribe,
  updateSettings,
  type PushStatus,
} from '@/services/pushService'

const HOURS = Array.from({ length: PUSH_HOUR_MAX - PUSH_HOUR_MIN + 1 }, (_, i) => PUSH_HOUR_MIN + i)
const section = 'rounded-2xl bg-white p-4 shadow-sm'
const heading = 'text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60'

/**
 * "Mementouri zilnice": opt-in web push (docs/NOTIFICATIONS.md §5). Parent view only.
 * This module is lazy-loaded by ParentView because it pulls in pushService (and with it Firebase).
 */
export default function RemindersCard() {
  const { t, i18n } = useTranslation()
  const hourId = useId()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [hour, setHour] = useState(PUSH_DEFAULT_HOUR)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'denied' | 'failed' | null>(null)

  useEffect(() => {
    let cancelled = false
    void getStatus().then((s) => {
      if (cancelled) return
      setStatus(s)
      setHour(s.hour)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback(async (job: () => Promise<PushStatus | void>) => {
    setBusy(true)
    setError(null)
    try {
      const next = await job()
      if (next) setStatus(next)
      else setStatus(await getStatus())
    } catch (e) {
      setError(e instanceof PushError && e.code === 'denied' ? 'denied' : 'failed')
      setStatus(await getStatus())
    } finally {
      setBusy(false)
    }
  }, [])

  if (!status || status.state === 'unsupported') return null

  if (status.state === 'needs-install') {
    return (
      <section className={`${section} bg-ludiko-yellow/60`} data-testid="reminders-install" aria-labelledby={`${hourId}-t`}>
        <h3 id={`${hourId}-t`} className={heading}>
          <span aria-hidden="true">📲 </span>
          {t('push.needsInstallTitle')}
        </h3>
        <p className="mt-1 text-base font-semibold text-ludiko-text">{t('push.needsInstall')}</p>
      </section>
    )
  }

  const on = status.state === 'on' || status.state === 'paused'
  const paused = status.state === 'paused'
  const statusText = paused
    ? t('push.status.paused')
    : status.state === 'on'
      ? t('push.status.on', { hour: status.hour })
      : t('push.status.off')

  const toggle = () =>
    run(() => (on ? unsubscribe() : subscribe(hour, i18n.language)))

  return (
    <section className={section} data-testid="reminders" aria-labelledby={`${hourId}-title`}>
      <h3 id={`${hourId}-title`} className={heading}>
        <span aria-hidden="true">🔔 </span>
        {t('push.title')}
      </h3>
      <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('push.intro')}</p>
      <p className="mt-2 rounded-xl bg-ludiko-bg p-3 text-sm font-semibold leading-snug text-ludiko-text/80" data-testid="reminders-consent">
        {t('push.consent')}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span id={`${hourId}-label`} className="text-base font-extrabold text-ludiko-text">{t('push.toggle')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${hourId}-label`}
          disabled={busy}
          onClick={toggle}
          data-testid="reminders-toggle"
          className={`relative h-9 w-16 shrink-0 rounded-full shadow-inner transition-colors disabled:opacity-60 ${on ? 'bg-ludiko-green' : 'bg-ludiko-text/20'}`}
        >
          <span
            className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${on ? 'left-8' : 'left-1'}`}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <label htmlFor={hourId} className="text-base font-bold text-ludiko-text">{t('push.hour')}</label>
        <select
          id={hourId}
          value={hour}
          disabled={busy}
          data-testid="reminders-hour"
          onChange={(e) => {
            const h = Number(e.target.value)
            setHour(h)
            if (on) void run(() => updateSettings({ hour: h }))
          }}
          className="min-h-[44px] rounded-xl bg-ludiko-bg px-3 text-base font-extrabold text-ludiko-text"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {t('push.hourOption', { h: String(h).padStart(2, '0') })}
            </option>
          ))}
        </select>
      </div>

      {on && (
        <button
          type="button"
          disabled={busy}
          data-testid="reminders-pause"
          onClick={() => run(() => updateSettings({ active: paused }))}
          className="mt-3 min-h-[44px] w-full rounded-2xl bg-ludiko-bg text-base font-extrabold text-ludiko-text active:scale-95 disabled:opacity-60"
        >
          <span aria-hidden="true">{paused ? '▶️ ' : '⏸️ '}</span>
          {paused ? t('push.resume') : t('push.pause')}
        </button>
      )}

      <p className="mt-3 text-sm font-bold text-ludiko-text" role="status" data-testid="reminders-status">
        {busy ? t('push.busy') : statusText}
      </p>
      {status.state === 'denied' && !error && (
        <p className="mt-1 text-sm font-bold text-ludiko-text" data-testid="reminders-error">{t('push.denied')}</p>
      )}
      {error && (
        <p className="mt-1 text-sm font-bold text-ludiko-text" data-testid="reminders-error">
          {error === 'denied' ? t('push.denied') : t('push.failed')}
        </p>
      )}
    </section>
  )
}
