import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router-dom'
import { buildProgressHistory } from '@/learner/historyModels'
import { getProgress } from '@/profiles/profileService'
import { useProfileStore } from '@/store/profileStore'
import LearnShell, { LearnError, LearnLoading } from '@/ui/learn/LearnShell'
import { useAsync } from '@/ui/learn/useAsync'
import ProgressHistoryView from './ProgressHistory'

function History({ profileId }: { profileId: string }) {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId))
  const { data, failed, reload } = useAsync(async () => buildProgressHistory(await getProgress(profileId), Date.now()), profileId)

  if (!profile) return <Navigate to="/learn/parent" replace />
  if (failed) return <LearnError onRetry={reload} backTo="/learn/parent" />
  if (!data) return <LearnLoading />
  return (
    <LearnShell title={t('family.extras.history.title')} backTo="/learn/family" backLabel={t('family.extras.overview.back')}>
      <p className="family-noprint mb-3 rounded-2xl bg-ludiko-yellow px-4 py-2 text-center text-sm font-bold text-ludiko-text">
        {profile.avatar} {profile.nickname}
      </p>
      <ProgressHistoryView history={data} name={profile.nickname} />
    </LearnShell>
  )
}

/** /learn/parent/history?profile=<id>: the full history of one child (print / save as PDF from here) */
export default function ProgressHistoryPage() {
  const [params] = useSearchParams()
  const { loaded, load, activeProfile } = useProfileStore()
  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])
  if (!loaded) return <LearnLoading />
  const id = params.get('profile') ?? activeProfile?.id
  if (!id) return <Navigate to="/profiles" replace />
  return <History profileId={id} />
}
