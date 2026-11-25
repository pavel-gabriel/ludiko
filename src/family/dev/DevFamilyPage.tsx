import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import FamilyAccountCard from '@/components/family/FamilyAccountCard'
import ProfilePickerPage from '@/components/profiles/ProfilePickerPage'
import { dbPut } from '@/profiles/db'
import { deleteProfile, listProfiles } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import LearnShell from '@/ui/learn/LearnShell'
import { setFamilyApi } from '../api'
import { clearFamilyState, startFamilySession, updateFamilyState } from '../familyState'
import type { RemoteChildInfo } from '../types'
import { createFakeFamilyApi, DEV_EMAIL, DEV_UID } from './fakeApi'

/**
 * Dev fixture for the parent account (Firebase is not configured in dev): /dev/family?state=out|in|import|needs
 * and &page=card|profiles. Seeds two local children and installs an in-memory family API.
 */
const kid = (id: string, nickname: string, avatar: string, grade: ChildProfile['grade']): ChildProfile => ({
  id,
  nickname,
  avatar,
  grade,
  language: 'ro',
  createdAt: 1,
  updatedAt: 1,
  recoveryCode: 'AAAA-BBBB-CCCC',
})

const REMOTE: RemoteChildInfo[] = [
  { id: 'dev-1', nickname: 'Matei', avatar: '🦊', grade: 3, updatedAt: 1 },
  { id: 'dev-2', nickname: 'Ana', avatar: '🐼', grade: 1, updatedAt: 1 },
  { id: 'dev-3', nickname: 'Tudor', avatar: '🦁', grade: 2, updatedAt: 1 },
]

export default function DevFamilyPage() {
  const [params] = useSearchParams()
  const state = params.get('state') ?? 'out'
  const page = params.get('page') ?? 'card'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const p of await listProfiles()) await deleteProfile(p.id, { fromSync: true })
      const local = state === 'import' ? [kid('dev-1', 'Matei', '🦊', 3)] : [kid('dev-1', 'Matei', '🦊', 3), kid('dev-2', 'Ana', '🐼', 1)]
      if (state === 'new-device') local.length = 0
      for (const p of local) {
        await dbPut('profiles', p)
        await dbPut('progress', { profileId: p.id, skills: {}, stars: 0, stickers: [], playDays: [] })
      }
      const remote = state === 'import' || state === 'new-device' ? REMOTE : local.map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar, grade: p.grade, updatedAt: 1 }))
      setFamilyApi(createFakeFamilyApi(remote, { needsConsent: state === 'needs' }))
      clearFamilyState()
      if (state === 'in' || state === 'needs') {
        startFamilySession(DEV_UID, DEV_EMAIL, true)
        updateFamilyState({ lastSync: Date.now() - 5 * 60_000, syncedIds: ['dev-1'] })
      }
      if (state === 'import' || state === 'new-device') startFamilySession(DEV_UID, DEV_EMAIL, false)
      await useProfileStore.getState().load()
      if (!cancelled) setReady(true)
    })().catch(() => setReady(true))
    return () => {
      cancelled = true
    }
  }, [state])

  if (!ready) return null
  if (page === 'profiles') return <ProfilePickerPage />
  return (
    <LearnShell title="Părinți" backTo="/">
      <FamilyAccountCard showUnavailable />
    </LearnShell>
  )
}
