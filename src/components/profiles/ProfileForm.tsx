import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Grade } from '@/engine/types'
import Button from '@/components/ui/Button'
import EmojiPicker, { EMOJI_OPTIONS } from '@/components/ui/EmojiPicker'
import { NICKNAME_MAX, type ChildProfile, type ProfileLanguage } from '@/profiles/types'
import type { ProfileInput } from '@/profiles/profileService'

const GRADES: Grade[] = [0, 1, 2, 3, 4, 5, 6, 7, 8]

interface Props {
  initial?: ChildProfile
  defaultLanguage: ProfileLanguage
  onSubmit: (input: ProfileInput) => void | Promise<void>
  onCancel: () => void
}

export default function ProfileForm({ initial, defaultLanguage, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const [nickname, setNickname] = useState(initial?.nickname ?? '')
  const [avatar, setAvatar] = useState(initial?.avatar ?? EMOJI_OPTIONS[Math.floor(Math.random() * EMOJI_OPTIONS.length)])
  const [grade, setGrade] = useState<Grade>(initial?.grade ?? 1)
  const [language, setLanguage] = useState<ProfileLanguage>(initial?.language ?? defaultLanguage)
  const [busy, setBusy] = useState(false)

  const valid = nickname.trim().length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      await onSubmit({ nickname: nickname.trim(), avatar, grade, language })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm flex flex-col gap-5">
      <h2 className="text-2xl font-extrabold text-ludiko-purple text-center">
        {initial ? t('profiles.editTitle') : t('profiles.newTitle')}
      </h2>

      <div>
        <label htmlFor="profile-nickname" className="block font-bold mb-1">{t('profiles.nickname')}</label>
        <div className="flex flex-wrap items-center gap-2">
          <EmojiPicker selected={avatar} onChange={setAvatar} />
          <input
            id="profile-nickname"
            value={nickname}
            maxLength={NICKNAME_MAX}
            onChange={(e) => setNickname(e.target.value)}
            placeholder={t('profiles.nicknamePlaceholder')}
            autoComplete="off"
            className="flex-1 min-w-0 px-4 py-3 text-lg rounded-xl border-2 border-gray-200 focus:border-ludiko-purple outline-none"
          />
        </div>
        <p className="text-sm opacity-70 mt-1">{t('privacyHints.nickname')}</p>
      </div>

      <div>
        <label htmlFor="profile-grade" className="block font-bold mb-1">{t('profiles.grade')}</label>
        <select
          id="profile-grade"
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value) as Grade)}
          className="w-full px-4 py-3 text-lg rounded-xl border-2 border-gray-200 focus:border-ludiko-purple outline-none bg-white"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>{t(`profiles.gradeLabels.${g}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <span className="block font-bold mb-1">{t('profiles.language')}</span>
        <div className="flex gap-2">
          {(['ro', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={language === l}
              onClick={() => setLanguage(l)}
              className={`flex-1 py-3 rounded-xl font-bold text-lg border-2 ${
                language === l ? 'bg-ludiko-purple/20 border-ludiko-purple' : 'bg-white border-gray-200'
              }`}
            >
              {l === 'ro' ? 'Română' : 'English'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" variant="green" size="lg" disabled={!valid || busy}>
          {initial ? t('profiles.save') : t('profiles.create')}
        </Button>
        <Button type="button" variant="yellow" size="md" onClick={onCancel}>
          {t('profiles.cancel')}
        </Button>
      </div>
    </form>
  )
}
