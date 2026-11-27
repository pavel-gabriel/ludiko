import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { buildFamilyRow } from '@/learner/historyModels'
import { getProgress } from '@/profiles/profileService'
import { useProfileStore } from '@/store/profileStore'
import LearnShell, { LearnError, LearnLoading } from '@/ui/learn/LearnShell'
import { useAsync } from '@/ui/learn/useAsync'
import FamilyOverview from './FamilyOverview'

/** /learn/family: all local children at a glance (the parents area; no parent gate exists in the app yet) */
export default function FamilyOverviewPage() {
  const { t } = useTranslation()
  const { profiles, loaded, load } = useProfileStore()
  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])
  const key = profiles.map((p) => p.id).join(',')
  const { data, failed, reload } = useAsync(
    async () => {
      const now = Date.now()
      return Promise.all(profiles.map(async (p) => buildFamilyRow(p, await getProgress(p.id), now)))
    },
    loaded ? `loaded:${key}` : 'loading',
  )

  if (failed) return <LearnError onRetry={reload} backTo="/learn/parent" />
  if (!loaded || !data) return <LearnLoading />
  return (
    <LearnShell title={t('family.extras.overview.title')} backTo="/learn/parent" backLabel={t('family.extras.overview.back')}>
      <p className="mb-3 text-center text-sm font-semibold text-ludiko-text/80">{t('family.extras.overview.intro')}</p>
      <FamilyOverview rows={data} />
    </LearnShell>
  )
}
