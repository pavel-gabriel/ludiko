import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { buildProgressHistory } from '@/learner/historyModels'
import { getProgress } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { useAsync } from '@/ui/learn/useAsync'
import ProgressHistoryView from './ProgressHistory'

/**
 * "Extra pentru familie" on /learn/parent: tools for adults that sit beside, never inside, the learning core
 * (progress history, the all-children overview). Free for now; kept in its own section so it could become an
 * optional paid tier later while learning stays free. A failure here never breaks the parents page.
 */
export default function FamilyExtras({ profile }: { profile: ChildProfile }) {
  const { t } = useTranslation()
  const many = useProfileStore((s) => s.profiles.length) > 1
  const { data, loading } = useAsync(async () => buildProgressHistory(await getProgress(profile.id), Date.now()), profile.id)

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-ludiko-purple/25 p-3 ring-2 ring-white" aria-labelledby="family-extras" data-testid="family-extras">
      <div className="family-noprint">
        <h2 id="family-extras" className="text-2xl font-extrabold text-ludiko-purple">
          <span aria-hidden="true">🎁 </span>
          {t('family.extras.title')}
        </h2>
        <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('family.extras.subtitle')}</p>
      </div>

      <h3 className="family-noprint text-lg font-extrabold text-ludiko-text">{t('family.extras.history.title')}</h3>
      {loading && (
        <p role="status" className="family-noprint text-sm font-semibold text-ludiko-text/70">
          {t('family.extras.history.loading')}
        </p>
      )}
      {data && <ProgressHistoryView history={data} name={profile.nickname} />}

      {many && (
        <Link
          to="/learn/family"
          data-testid="link-family-overview"
          className="family-noprint flex min-h-[48px] items-center justify-center rounded-2xl bg-white text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
        >
          <span aria-hidden="true">👨‍👩‍👧 </span>
          {t('family.extras.allChildren')}
        </Link>
      )}
    </section>
  )
}
