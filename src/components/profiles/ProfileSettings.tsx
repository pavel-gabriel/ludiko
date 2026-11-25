import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { useProfileStore } from '@/store/profileStore'
import { downloadBackup, exportProfile } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'

interface Props {
  profile: ChildProfile
  onEdit: () => void
  onClose: () => void
}

export default function ProfileSettings({ profile, onEdit, onClose }: Props) {
  const { t } = useTranslation()
  const remove = useProfileStore((s) => s.remove)
  const importBackup = useProfileStore((s) => s.importBackup)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => downloadBackup(await exportProfile(profile.id))

  const doImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const p = await importBackup(await file.text())
      setMessage({ ok: true, text: t('profiles.importOk', { name: p.nickname }) })
    } catch {
      setMessage({ ok: false, text: t('profiles.importError') })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="card w-full max-w-sm flex flex-col gap-4">
      <div className="text-center">
        <div className="text-6xl" aria-hidden="true">{profile.avatar}</div>
        <h2 className="text-2xl font-extrabold text-ludiko-purple">{profile.nickname}</h2>
        <p className="opacity-70">{t(`profiles.gradeLabels.${profile.grade}`)}</p>
      </div>

      <div className="rounded-xl bg-ludiko-yellow/40 p-3 text-center">
        <p className="text-sm font-bold">{t('profiles.parentArea')} · {t('profiles.recoveryLabel')}</p>
        <p className="text-2xl font-mono font-extrabold tracking-wider">{profile.recoveryCode}</p>
      </div>

      <Button variant="blue" onClick={onEdit}>{t('profiles.edit')}</Button>

      <div>
        <Button variant="green" className="w-full" onClick={doExport}>{t('profiles.export')}</Button>
        <p className="text-sm opacity-70 mt-1">{t('profiles.exportHint')}</p>
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          data-testid="import-input"
          onChange={(e) => doImport(e.target.files?.[0])}
        />
        <Button variant="orange" className="w-full" onClick={() => fileRef.current?.click()}>
          {t('profiles.import')}
        </Button>
      </div>

      {message && (
        <p role="status" className={`text-center font-bold ${message.ok ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}

      {confirming ? (
        <div role="alertdialog" className="rounded-xl bg-red-50 p-3 flex flex-col gap-2">
          <p className="font-bold text-center">{t('profiles.deleteConfirm', { name: profile.nickname })}</p>
          <Button variant="pink" onClick={async () => { await remove(profile.id); onClose() }}>
            {t('profiles.deleteYes')}
          </Button>
          <Button variant="yellow" onClick={() => setConfirming(false)}>{t('profiles.deleteNo')}</Button>
        </div>
      ) : (
        <Button variant="pink" size="sm" onClick={() => setConfirming(true)}>{t('profiles.delete')}</Button>
      )}

      <Button variant="yellow" onClick={onClose}>{t('profiles.back')}</Button>
    </div>
  )
}
