import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import { localize, type SubjectId } from '@/engine/types'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import CoachMarks from '@/ui/guide/CoachMarks'
import GuideButton from '@/ui/guide/GuideButton'
import { ageBand, bandText } from '@/ui/guide/guideStore'
import { useFirstRunGuide } from '@/ui/guide/useFirstRunGuide'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireSubject from './RequireSubject'
import SkillMapView, { type MapIsland } from './SkillMapView'
import { parseSubject } from './subjects'
import { useAsync } from './useAsync'

interface MapData {
  islands: MapIsland[]
  /** The level check for this subject is finished (else: a gentle "check first" note) */
  checked: boolean
}

function SkillMap({ profile, subject }: { profile: ChildProfile; subject: SubjectId }) {
  const { t, i18n } = useTranslation()
  const band = ageBand(profile.grade)
  const guide = useFirstRunGuide('map', profile.id)
  const { data, loading, failed, reload } = useAsync(async (): Promise<MapData> => {
    const [nodes, placement] = await Promise.all([
      learnerService.getSkillMap(profile.id, subject),
      learnerService.getPlacement(profile.id, subject).catch(() => undefined),
    ])
    const islands = nodes.map((n) => {
      const skill = getSkill(n.skillId)
      return { ...n, title: skill ? localize(skill.title, i18n.language) : n.skillId }
    })
    return { islands, checked: placement?.completedAt !== undefined }
  }, `${profile.id}:${subject}:${i18n.language}`)

  if (failed) return <LearnError onRetry={reload} backTo="/learn" />
  if (loading || !data) return <LearnLoading />

  return (
    <LearnShell title={t('learn.map.title')} backTo="/learn">
      <div className="-mt-2 mb-4 flex items-center gap-2">
        <p className="flex-1 text-center text-base font-semibold text-ludiko-text/70">{t('learn.map.subtitle')}</p>
        <GuideButton onClick={guide.show} />
      </div>
      {!data.checked && data.islands.length > 0 && (
        <Link
          to={`/learn/check/${subject}`}
          data-testid="map-check-first"
          className="mb-4 flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-4 py-3 text-base font-bold text-ludiko-text shadow-sm ring-2 ring-ludiko-orange active:scale-[0.98]"
        >
          <span className="text-2xl" aria-hidden="true">🧭</span>
          <span className="flex-1">{t('guide.map.checkFirst')}</span>
          <span aria-hidden="true">→</span>
        </Link>
      )}
      <SkillMapView islands={data.islands} upToGrade={profile.grade} />
      {guide.open && data.islands.length > 0 && (
        <CoachMarks
          band={band}
          onClose={guide.close}
          steps={[
            { target: 'next-island', text: bandText(t, 'guide.map.next', band) },
            { target: 'map-filters', text: bandText(t, 'guide.map.filters', band) },
            { target: 'map-route', text: bandText(t, 'guide.map.route', band) },
          ]}
        />
      )}
    </LearnShell>
  )
}

/** /learn/map/:subject — the skill map as an ordered route of islands */
export default function SkillMapPage() {
  const { subject: raw } = useParams()
  const subject = parseSubject(raw)
  if (!subject) return <Navigate to="/learn" replace />
  return <RequireSubject subject={subject}>{(profile) => <SkillMap profile={profile} subject={subject} />}</RequireSubject>
}
