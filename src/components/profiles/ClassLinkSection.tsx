import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClassroomApi } from '@/classroom/api'
import { JOIN_CODE_LENGTH, normalizeJoinCode } from '@/classroom/joinCode'
import { ClassroomError } from '@/classroom/types'
import Button from '@/components/ui/Button'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'

/** "Clasa mea" in the profile settings: join the teacher's class with a code, or leave it */
export default function ClassLinkSection({ profile }: { profile: ChildProfile }) {
  const { t } = useTranslation()
  const reload = useProfileStore((s) => s.load)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const link = profile.classLink

  const join = async () => {
    setBusy(true)
    setError(null)
    try {
      await (await getClassroomApi()).joinClass(profile.id, code)
      setCode('')
      await reload()
    } catch (e) {
      setError(e instanceof ClassroomError ? e.code : 'failed')
    }
    setBusy(false)
  }

  const leave = async () => {
    setBusy(true)
    setError(null)
    try {
      await (await getClassroomApi()).leaveClass(profile.id)
      setConfirmLeave(false)
      await reload()
    } catch {
      setError('failed')
    }
    setBusy(false)
  }

  return (
    <section className="rounded-xl bg-ludiko-blue/30 p-3" aria-labelledby="class-link-title" data-testid="class-link">
      <h3 id="class-link-title" className="text-center text-lg font-extrabold">
        <span aria-hidden="true">🏫 </span>
        {t('classroom.child.title')}
      </h3>

      {link ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-center font-bold" data-testid="class-link-name">{t('classroom.child.inClass', { name: link.className })}</p>
          <p className="text-sm opacity-80">{t('classroom.child.sharedInfo')}</p>
          {confirmLeave ? (
            <div role="alertdialog" className="flex flex-col gap-2 rounded-xl bg-red-50 p-3">
              <p className="text-center font-bold">{t('classroom.child.leaveConfirm')}</p>
              <Button variant="pink" disabled={busy} onClick={() => void leave()} data-testid="class-leave-yes">
                {t('classroom.child.leaveYes')}
              </Button>
              <Button variant="yellow" onClick={() => setConfirmLeave(false)}>{t('classroom.cancel')}</Button>
            </div>
          ) : (
            <Button variant="pink" size="sm" onClick={() => setConfirmLeave(true)} data-testid="class-leave">
              {t('classroom.child.leave')}
            </Button>
          )}
        </div>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (normalizeJoinCode(code).length === JOIN_CODE_LENGTH && !busy) void join()
          }}
        >
          <p className="text-sm opacity-80">{t('classroom.child.help')}</p>
          <label className="text-sm font-bold" htmlFor="class-code">{t('classroom.child.codeLabel')}</label>
          <input
            id="class-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={JOIN_CODE_LENGTH + 2}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            placeholder="ABC DEF"
            className="min-h-[52px] rounded-xl border-2 border-gray-300 bg-white px-3 text-center font-mono text-2xl font-extrabold tracking-[0.25em]"
            data-testid="class-code"
          />
          <Button
            type="submit"
            variant="green"
            disabled={busy || normalizeJoinCode(code).length !== JOIN_CODE_LENGTH}
            data-testid="class-join"
          >
            {t('classroom.child.join')}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 text-center font-bold text-red-700" data-testid="class-error">
          {t(`classroom.child.error.${error}`, { defaultValue: t('classroom.child.error.failed') })}
        </p>
      )}
    </section>
  )
}
