import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { familyAvailable, getFamilyApi } from '@/family/api'
import { FamilyError, type FamilyApi } from '@/family/types'
import { useFamilySession } from '@/family/useFamilySession'
import { useProfileStore } from '@/store/profileStore'
import FamilyImportPrompt from './FamilyImportPrompt'

type Mode = 'home' | 'create' | 'signin' | 'forgot'

const box = 'rounded-2xl bg-white p-4 shadow-sm'
const heading = 'text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60'
const field =
  'min-h-[48px] w-full rounded-xl border-2 border-ludiko-purple/30 bg-white px-3 text-base text-ludiko-text focus:border-ludiko-purple focus:outline-none'
const primary =
  'min-h-[52px] w-full rounded-2xl bg-ludiko-green px-4 text-lg font-extrabold text-ludiko-text shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100'
const secondary =
  'min-h-[48px] w-full rounded-2xl bg-ludiko-yellow px-4 text-base font-extrabold text-ludiko-text shadow-sm active:scale-95 disabled:opacity-50'
const textBtn = 'inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-bold text-ludiko-text underline'

const errorCode = (e: unknown): string => (e instanceof FamilyError ? e.code : 'failed')

function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The plain-language "what is stored" screen with the consent checkbox (docs/PARENT_SYNC.md §2) */
function ConsentBlock({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="flex flex-col gap-3" data-testid="family-consent">
      <h3 className="text-lg font-extrabold text-ludiko-text">{t('family.consent.title')}</h3>
      <div className="flex flex-col gap-2 text-sm font-semibold text-ludiko-text/90">
        <p>{t('family.consent.storedIntro')}</p>
        <ul className="list-disc pl-5">
          <li>{t('family.consent.stored1')}</li>
          <li>{t('family.consent.stored2')}</li>
        </ul>
        <p>
          <strong>{t('family.consent.neverTitle')}</strong> {t('family.consent.never')}
        </p>
        <p className="text-xs font-bold text-ludiko-text/70">{t('family.consent.privacy')}</p>
        <p className="text-xs font-bold text-ludiko-text/70">{t('family.consent.howDelete')}</p>
      </div>
      <label htmlFor={id} className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl bg-ludiko-yellow/60 p-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          data-testid="family-consent-checkbox"
          className="mt-0.5 h-6 w-6 shrink-0 accent-ludiko-purple"
        />
        <span className="text-sm font-bold text-ludiko-text">{t('family.consent.checkbox')}</span>
      </label>
    </div>
  )
}

function ErrorLine({ code }: { code: string | null }) {
  const { t } = useTranslation()
  if (!code) return null
  return (
    <p role="alert" className="text-sm font-bold text-red-700" data-testid="family-error">
      {t(`family.errors.${code}`, { defaultValue: t('family.errors.failed') })}
    </p>
  )
}

function SignedOut({ api, onNeedsConsent, onSignedIn }: { api: () => Promise<FamilyApi>; onNeedsConsent: () => void; onSignedIn: () => void }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('home')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const emailId = useId()
  const passId = useId()

  const go = (m: Mode) => {
    setMode(m)
    setError(null)
    setResetSent(false)
  }

  const run = async (fn: (a: FamilyApi) => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn(await api())
    } catch (e) {
      setError(errorCode(e))
    }
    setBusy(false)
  }

  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!consent || busy) return // no account without the checkbox
    void run(async (a) => {
      await a.createAccount(email, password, true)
      onSignedIn()
    })
  }
  const signIn = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    void run(async (a) => {
      const { needsConsent } = await a.signIn(email, password)
      if (needsConsent) onNeedsConsent()
      else onSignedIn()
    })
  }
  const reset = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    void run(async (a) => {
      await a.resetPassword(email)
      setResetSent(true)
    })
  }

  if (mode === 'home') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base font-semibold text-ludiko-text/90">{t('family.intro')}</p>
        <button type="button" className={primary} onClick={() => go('create')} data-testid="family-create">
          {t('family.createCta')}
        </button>
        <button type="button" className={secondary} onClick={() => go('signin')} data-testid="family-signin">
          {t('family.signInCta')}
        </button>
      </div>
    )
  }

  const emailField = (
    <div className="flex flex-col gap-1">
      <label htmlFor={emailId} className="text-sm font-bold text-ludiko-text">{t('family.form.email')}</label>
      <input
        id={emailId}
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={field}
        data-testid="family-email"
      />
    </div>
  )
  const passwordField = (autoComplete: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={passId} className="text-sm font-bold text-ludiko-text">{t('family.form.password')}</label>
      <input
        id={passId}
        type="password"
        autoComplete={autoComplete}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={field}
        data-testid="family-password"
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <button type="button" className={`${textBtn} -ml-2 self-start`} onClick={() => go('home')}>
        <span aria-hidden="true">← </span>
        {t('family.back')}
      </button>

      {mode === 'create' && (
        <form onSubmit={create} className="flex flex-col gap-3" data-testid="family-create-form">
          <ConsentBlock checked={consent} onChange={setConsent} />
          {emailField}
          {passwordField('new-password')}
          <ErrorLine code={error} />
          {!consent && <p className="text-xs font-bold text-ludiko-text/70">{t('family.form.needCheckbox')}</p>}
          <button
            type="submit"
            className={primary}
            disabled={busy || !consent || !email.trim() || password.length < 6}
            data-testid="family-create-submit"
          >
            {busy ? t('family.form.working') : t('family.form.createSubmit')}
          </button>
        </form>
      )}

      {mode === 'signin' && (
        <form onSubmit={signIn} className="flex flex-col gap-3" data-testid="family-signin-form">
          {emailField}
          {passwordField('current-password')}
          <ErrorLine code={error} />
          <button type="submit" className={primary} disabled={busy || !email.trim() || !password} data-testid="family-signin-submit">
            {busy ? t('family.form.working') : t('family.form.signInSubmit')}
          </button>
          <button type="button" className={textBtn} onClick={() => go('forgot')}>
            {t('family.form.forgot')}
          </button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={reset} className="flex flex-col gap-3" data-testid="family-forgot-form">
          {emailField}
          <ErrorLine code={error} />
          {resetSent && (
            <p role="status" className="text-sm font-bold text-ludiko-text">{t('family.form.resetSent')}</p>
          )}
          <button type="submit" className={primary} disabled={busy || !email.trim()}>
            {busy ? t('family.form.working') : t('family.form.sendReset')}
          </button>
        </form>
      )}
    </div>
  )
}

function NeedsConsent({ api, onDone }: { api: () => Promise<FamilyApi>; onDone: () => void }) {
  const { t } = useTranslation()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accept = async () => {
    if (!consent || busy) return
    setBusy(true)
    setError(null)
    try {
      await (await api()).recordConsent()
      onDone()
    } catch (e) {
      setError(errorCode(e))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xl font-extrabold text-ludiko-text">{t('family.consent.needsTitle')}</h3>
      <p className="text-sm font-semibold text-ludiko-text/90">{t('family.consent.needsBody')}</p>
      <ConsentBlock checked={consent} onChange={setConsent} />
      <ErrorLine code={error} />
      <button type="button" className={primary} disabled={!consent || busy} onClick={() => void accept()} data-testid="family-accept">
        {t('family.consent.accept')}
      </button>
    </div>
  )
}

function SignedIn({ api, onSignedOut, onNeedsConsent }: { api: () => Promise<FamilyApi>; onSignedOut: (deleted: boolean) => void; onNeedsConsent: () => void }) {
  const { t, i18n } = useTranslation()
  const session = useFamilySession()!
  const { profiles, loaded, load } = useProfileStore()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const passId = useId()
  const sync = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])

  sync.current = async () => {
    setStatus('syncing')
    setError(null)
    setNotice(null)
    try {
      await (await api()).syncNow()
      setStatus('done')
    } catch (e) {
      setStatus('idle')
      if (errorCode(e) === 'consent-required') onNeedsConsent()
      else setError(errorCode(e))
    }
  }

  // opening the parent area is a good moment to sync (also picks up children created on another device)
  useEffect(() => {
    void sync.current()
  }, [])

  const doExport = async () => {
    setError(null)
    setNotice(null)
    try {
      downloadJson('ludiko-cont.json', await (await api()).exportAll())
      setNotice(t('family.signedIn.exportDone'))
    } catch (e) {
      setError(errorCode(e))
    }
  }

  const doDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await (await api()).deleteCloudAccount(password)
      setConfirmDelete(false)
      setPassword('')
      onSignedOut(true)
    } catch (e) {
      setError(errorCode(e))
    }
    setBusy(false)
  }

  const doSignOut = async () => {
    try {
      await (await api()).signOut()
    } catch {
      /* the device forgets the account either way */
    }
    onSignedOut(false)
  }

  const lastSync = session.lastSync
    ? t('family.signedIn.lastSync', { time: new Date(session.lastSync).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })
    : t('family.signedIn.neverSynced')

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-semibold text-ludiko-text/80">
        {t('family.signedIn.as')}{' '}
        <strong className="break-all text-ludiko-text" data-testid="family-email-shown">{session.email}</strong>
      </p>

      <FamilyImportPrompt />

      <div>
        <h3 className={heading}>{t('family.signedIn.children')}</h3>
        {profiles.length === 0 ? (
          <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('family.signedIn.noChildren')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2" data-testid="family-children">
            {profiles.map((p) => {
              const synced = session.syncedIds.includes(p.id)
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-ludiko-bg px-3 py-2">
                  <span className="text-3xl" aria-hidden="true">{p.avatar}</span>
                  <span className="min-w-0 flex-1 truncate text-base font-extrabold text-ludiko-text">{p.nickname}</span>
                  <span className={`shrink-0 text-xs font-bold ${synced ? 'text-green-800' : 'text-ludiko-text/60'}`}>
                    <span aria-hidden="true">{synced ? '☁️ ' : ''}</span>
                    {synced ? t('family.signedIn.synced') : t('family.signedIn.notSynced')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ludiko-text/80" data-testid="family-last-sync">{lastSync}</p>
        <button type="button" className={primary} disabled={status === 'syncing'} onClick={() => void sync.current()} data-testid="family-sync">
          {status === 'syncing' ? t('family.signedIn.syncing') : t('family.signedIn.syncNow')}
        </button>
        {status === 'done' && !error && (
          <p role="status" className="text-sm font-bold text-green-800">{t('family.signedIn.syncDone')}</p>
        )}
        <ErrorLine code={error} />
        {notice && <p role="status" className="text-sm font-bold text-ludiko-text">{notice}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" className={secondary} onClick={() => void doExport()} data-testid="family-export">
          {t('family.signedIn.export')}
        </button>
        <button type="button" className={secondary} onClick={() => void doSignOut()} data-testid="family-signout">
          {t('family.signedIn.signOut')}
        </button>
        <p className="text-center text-xs font-semibold text-ludiko-text/70">{t('family.signedIn.signOutHint')}</p>
      </div>

      {confirmDelete ? (
        <div role="alertdialog" aria-labelledby="family-delete-title" className="flex flex-col gap-3 rounded-xl bg-red-50 p-3" data-testid="family-delete-dialog">
          <h3 id="family-delete-title" className="text-center text-lg font-extrabold text-ludiko-text">{t('family.signedIn.deleteTitle')}</h3>
          <p className="text-sm font-semibold text-ludiko-text/90">{t('family.signedIn.deleteBody')}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={passId} className="text-sm font-bold text-ludiko-text">{t('family.signedIn.deletePassword')}</label>
            <input
              id={passId}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              data-testid="family-delete-password"
            />
          </div>
          <ErrorLine code={error} />
          <button
            type="button"
            disabled={busy || !password}
            onClick={() => void doDelete()}
            data-testid="family-delete-yes"
            className="min-h-[48px] rounded-2xl bg-ludiko-orange px-4 text-base font-extrabold text-ludiko-text shadow-sm active:scale-95 disabled:opacity-50"
          >
            {t('family.signedIn.deleteConfirm')}
          </button>
          <button
            type="button"
            className={textBtn}
            onClick={() => {
              setConfirmDelete(false)
              setPassword('')
              setError(null)
            }}
          >
            {t('family.signedIn.deleteCancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="min-h-[44px] self-center px-2 text-sm font-bold text-red-700 underline"
          onClick={() => setConfirmDelete(true)}
          data-testid="family-delete"
        >
          {t('family.signedIn.delete')}
        </button>
      )}
    </div>
  )
}

/**
 * "Cont de părinte" (docs/PARENT_SYNC.md §5): create an account / sign in, and, when signed in, the synced
 * children, sync, sign out, export and delete. Lives in the parent area only, never on child screens.
 */
export default function FamilyAccountCard({ showUnavailable = false }: { showUnavailable?: boolean }) {
  const { t } = useTranslation()
  const session = useFamilySession()
  const [needsConsent, setNeedsConsent] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const api = getFamilyApi

  if (!familyAvailable()) {
    if (!showUnavailable) return null
    return (
      <section className={box} aria-labelledby="family-title" data-testid="family-card">
        <h2 id="family-title" className={heading}>{t('family.title')}</h2>
        <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('family.unavailable')}</p>
      </section>
    )
  }

  return (
    <section className={box} aria-labelledby="family-title" data-testid="family-card">
      <h2 id="family-title" className={`${heading} mb-3`}>
        <span aria-hidden="true">👨‍👩‍👧 </span>
        {t('family.title')}
      </h2>
      {deleted && !session && (
        <p role="status" className="mb-3 rounded-xl bg-ludiko-green/60 px-3 py-2 text-sm font-bold text-ludiko-text">
          {t('family.signedIn.deleted')}
        </p>
      )}
      {!session ? (
        <SignedOut
          api={api}
          onNeedsConsent={() => setNeedsConsent(true)}
          onSignedIn={() => setDeleted(false)}
        />
      ) : needsConsent ? (
        <NeedsConsent api={api} onDone={() => setNeedsConsent(false)} />
      ) : (
        <SignedIn
          api={api}
          onNeedsConsent={() => setNeedsConsent(true)}
          onSignedOut={(wasDeleted) => {
            setDeleted(wasDeleted)
            setNeedsConsent(false)
          }}
        />
      )}
    </section>
  )
}
