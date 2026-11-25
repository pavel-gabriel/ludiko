import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import ProfileForm from './ProfileForm'
import ProfileSettings from './ProfileSettings'
import { useProfileStore } from '@/store/profileStore'
import { isPersistent } from '@/profiles/db'
import type { ChildProfile, ProfileLanguage } from '@/profiles/types'

type View =
  | { name: 'pick' }
  | { name: 'create' }
  | { name: 'created'; profile: ChildProfile }
  | { name: 'settings'; id: string }
  | { name: 'edit'; id: string }

export default function ProfilePickerPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { profiles, activeProfile, loaded, load, create, update, setActive } = useProfileStore()
  const [view, setView] = useState<View>({ name: 'pick' })
  const [managing, setManaging] = useState(false)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const lang: ProfileLanguage = i18n.language?.startsWith('en') ? 'en' : 'ro'
  const byId = (id: string) => profiles.find((p) => p.id === id)

  const choose = (p: ChildProfile) => {
    if (managing) {
      setView({ name: 'settings', id: p.id })
      return
    }
    setActive(p.id)
    if (p.language !== i18n.language) void i18n.changeLanguage(p.language)
    navigate('/')
  }

  let body: React.ReactNode

  if (view.name === 'create') {
    body = (
      <ProfileForm
        defaultLanguage={lang}
        onCancel={() => setView({ name: 'pick' })}
        onSubmit={async (input) => {
          const p = await create(input)
          setActive(p.id)
          setView({ name: 'created', profile: p })
        }}
      />
    )
  } else if (view.name === 'created') {
    const p = view.profile
    body = (
      <div className="card w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <div className="text-7xl" aria-hidden="true">{p.avatar}</div>
        <h2 className="text-2xl font-extrabold text-ludiko-purple">{t('profiles.recoveryTitle')}</h2>
        <p
          data-testid="recovery-code"
          className="text-3xl font-mono font-extrabold tracking-wider bg-ludiko-yellow/50 rounded-xl px-4 py-3"
        >
          {p.recoveryCode}
        </p>
        <p className="opacity-80">{t('profiles.recoveryHint')}</p>
        <Button variant="green" size="lg" className="w-full" onClick={() => navigate('/')}>
          {t('profiles.done')}
        </Button>
      </div>
    )
  } else if (view.name === 'settings' && byId(view.id)) {
    body = (
      <ProfileSettings
        profile={byId(view.id)!}
        onEdit={() => setView({ name: 'edit', id: view.id })}
        onClose={() => setView({ name: 'pick' })}
      />
    )
  } else if (view.name === 'edit' && byId(view.id)) {
    body = (
      <ProfileForm
        initial={byId(view.id)!}
        defaultLanguage={lang}
        onCancel={() => setView({ name: 'settings', id: view.id })}
        onSubmit={async (input) => {
          await update(view.id, input)
          setView({ name: 'settings', id: view.id })
        }}
      />
    )
  } else {
    body = (
      <div className="w-full max-w-sm flex flex-col items-center gap-5">
        {!isPersistent() && loaded && (
          <p role="alert" className="text-sm bg-ludiko-orange/60 rounded-xl p-3 text-center">
            {t('profiles.notPersistent')}
          </p>
        )}
        {profiles.length === 0 && loaded && <p className="text-center opacity-80">{t('profiles.empty')}</p>}
        <div className="grid grid-cols-2 gap-4 w-full">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => choose(p)}
              aria-pressed={activeProfile?.id === p.id}
              className={`bg-white rounded-3xl shadow-md p-4 flex flex-col items-center gap-1 min-h-[9rem] active:scale-95 transition-transform ${
                activeProfile?.id === p.id ? 'ring-4 ring-ludiko-purple' : ''
              }`}
            >
              <span className="text-6xl" aria-hidden="true">{p.avatar}</span>
              <span className="font-extrabold text-lg max-w-full truncate">{p.nickname}</span>
              <span className="text-xs opacity-70">{t(`profiles.gradeLabels.${p.grade}`)}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setView({ name: 'create' })}
            className="rounded-3xl border-4 border-dashed border-ludiko-purple/50 bg-ludiko-purple/10 p-4 flex flex-col items-center justify-center gap-1 min-h-[9rem] active:scale-95 transition-transform"
          >
            <span className="text-5xl text-ludiko-purple" aria-hidden="true">+</span>
            <span className="font-extrabold text-lg text-ludiko-purple">{t('profiles.add')}</span>
          </button>
        </div>
        <Button variant={managing ? 'purple' : 'yellow'} size="md" className="w-full" onClick={() => setManaging(!managing)} aria-pressed={managing}>
          {t('profiles.manage')}
        </Button>
        <p className="text-xs opacity-60 text-center">{t('profiles.privacy')}</p>
      </div>
    )
  }

  return (
    <div className="page relative">
      {view.name === 'pick' && (
        <>
          <button
            onClick={() => navigate('/')}
            className="absolute top-4 left-4 w-11 h-11 rounded-full bg-white shadow flex items-center justify-center text-xl"
            aria-label={t('profiles.back')}
          >
            ←
          </button>
          <h1 className="text-4xl font-extrabold text-ludiko-purple mb-6 text-center">{t('profiles.who')}</h1>
        </>
      )}
      {body}
    </div>
  )
}
