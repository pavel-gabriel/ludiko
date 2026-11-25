import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { getProgress } from '@/profiles/profileService'
import LearnHomeView, { type LearnHomeViewProps, type SubjectHome } from './LearnHomeView'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireProfile from './RequireProfile'
import { LEARN_SUBJECTS } from './subjects'
import { useAsync } from './useAsync'

type HomeData = Pick<LearnHomeViewProps, 'stars' | 'playDays' | 'subjects'>

async function loadSubject(profileId: string, subject: SubjectHome['subject']): Promise<SubjectHome> {
  const placement = await learnerService.getPlacement(profileId, subject)
  const finished = Boolean(placement?.completedAt)
  const status: SubjectHome['placement'] = finished ? 'done' : placement ? 'inProgress' : 'none'
  if (!finished) return { subject, placement: status }
  const mission = await learnerService.getTodayMission(profileId, subject).catch(() => undefined)
  const bits = await learnerService.getTodayBits(profileId, subject).catch(() => undefined)
  return {
    subject,
    placement: status,
    bits: bits?.map((b) => ({ index: b.index, kind: b.kind, done: b.done })),
    mission: mission && {
      done: mission.steps.filter((s) => s.done).length,
      total: mission.steps.length,
      minutes: Math.max(1, Math.round(mission.estimatedSeconds / 60)),
      complete: Boolean(mission.completedAt),
    },
  }
}

async function loadHome(profileId: string): Promise<HomeData> {
  const subjects = await Promise.all(LEARN_SUBJECTS.map((s) => loadSubject(profileId, s)))
  // stars and the streak are nice-to-have: never block the front door on them
  const [playDays, stars] = await Promise.all([
    learnerService.getParentSummary(profileId).then((s) => s.playDaysThisWeek, () => 0),
    getProgress(profileId).then((p) => p.stars, () => 0),
  ])
  return { subjects, playDays, stars }
}

function LearnHome({ profile }: { profile: ChildProfile }) {
  const { data, loading, failed, reload } = useAsync(() => loadHome(profile.id), profile.id)

  if (failed) return <LearnError onRetry={reload} />
  if (loading || !data) return <LearnLoading />

  return (
    <LearnShell backTo="/" backLabel="Ludiko">
      <LearnHomeView profile={profile} {...data} />
    </LearnShell>
  )
}

/** /learn — the learner's home: today's mission or the first check, the map, stars and the gentle streak */
export default function LearnHomePage() {
  return <RequireProfile>{(profile) => <LearnHome profile={profile} />}</RequireProfile>
}
