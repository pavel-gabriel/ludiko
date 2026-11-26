import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import FamilyAccountCard from '@/components/family/FamilyAccountCard'
import { getSkill } from '@/engine/content/registry'
import { localize } from '@/engine/types'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import ParentView from './ParentView'
import RequireProfile from './RequireProfile'
import { useAsync } from './useAsync'

function Parent({ profile }: { profile: ChildProfile }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data, loading, failed, reload } = useAsync(() => learnerService.getParentSummary(profile.id), profile.id)

  if (failed) return <LearnError onRetry={reload} backTo="/learn" />
  if (loading || !data) return <LearnLoading />

  const titleOf = (id: string) => {
    const skill = getSkill(id)
    return skill ? localize(skill.title, i18n.language) : id
  }

  return (
    <LearnShell title={t('learn.parent.title')} backTo="/learn">
      <ParentView
        profileName={profile.nickname}
        profileGrade={profile.grade}
        summary={data}
        titleOf={titleOf}
        onRedo={(subject) => {
          learnerService.resetPlacement(profile.id, subject).then(
            () => navigate(`/learn/check/${subject}`),
            reload,
          )
        }}
      />
      {/* "Cont de părinte": the parent area only, never on child screens */}
      <div className="mt-4">
        <FamilyAccountCard />
      </div>
    </LearnShell>
  )
}

/** /learn/parent — plain-language summary for adults (the level statement lives here, not on the child's screens) */
export default function ParentPage() {
  return <RequireProfile>{(profile) => <Parent profile={profile} />}</RequireProfile>
}
