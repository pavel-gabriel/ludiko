import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import { localize, type SubjectId } from '@/engine/types'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireProfile from './RequireProfile'
import SkillMapView, { type MapIsland } from './SkillMapView'
import { parseSubject } from './subjects'
import { useAsync } from './useAsync'

function SkillMap({ profile, subject }: { profile: ChildProfile; subject: SubjectId }) {
  const { t, i18n } = useTranslation()
  const { data, loading, failed, reload } = useAsync(async (): Promise<MapIsland[]> => {
    const nodes = await learnerService.getSkillMap(profile.id, subject)
    return nodes.map((n) => {
      const skill = getSkill(n.skillId)
      return { ...n, title: skill ? localize(skill.title, i18n.language) : n.skillId }
    })
  }, `${profile.id}:${subject}:${i18n.language}`)

  if (failed) return <LearnError onRetry={reload} backTo="/learn" />
  if (loading || !data) return <LearnLoading />

  return (
    <LearnShell title={t('learn.map.title')} backTo="/learn">
      <p className="-mt-2 mb-4 text-center text-base font-semibold text-ludiko-text/70">{t('learn.map.subtitle')}</p>
      <SkillMapView islands={data} />
    </LearnShell>
  )
}

/** /learn/map/:subject — the skill map as an adventure map of islands */
export default function SkillMapPage() {
  const { subject: raw } = useParams()
  const subject = parseSubject(raw)
  if (!subject) return <Navigate to="/learn" replace />
  return <RequireProfile>{(profile) => <SkillMap profile={profile} subject={subject} />}</RequireProfile>
}
