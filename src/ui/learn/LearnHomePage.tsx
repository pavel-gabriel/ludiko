import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { refreshClassData } from '@/classroom/syncGate'
import { knownStickers } from '@/ui/album/earning'
import { learnerService, type AssignmentBit } from '@/learner'
import { availableSubjects, lockedSubjects, subjectMinGrade } from '@/learner/availability'
import type { ChildProfile } from '@/profiles/types'
import { getProgress } from '@/profiles/profileService'
import LearnHomeView, { type LearnHomeViewProps, type SubjectHome } from './LearnHomeView'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireProfile from './RequireProfile'
import { LEARN_SUBJECTS, parseSubject } from './subjects'
import { useAsync } from './useAsync'

type HomeData = Pick<LearnHomeViewProps, 'stars' | 'playDays' | 'plan' | 'subjects' | 'locked' | 'assignments' | 'stickerCount'>

async function loadSubject(profileId: string, subject: SubjectHome['subject']): Promise<SubjectHome> {
  const placement = await learnerService.getPlacement(profileId, subject)
  return { subject, placement: placement?.completedAt ? 'done' : placement ? 'inProgress' : 'none' }
}

async function loadHome(profile: ChildProfile): Promise<HomeData> {
  const profileId = profile.id
  // only subjects the child's grade has content for are playable; the rest are a teaser
  const playable = availableSubjects(LEARN_SUBJECTS, profile.grade)
  const [subjects, plan] = await Promise.all([
    Promise.all(playable.map((s) => loadSubject(profileId, s))),
    // the plan is the front door, but a failure to prepare it must not block the rest of the page
    learnerService.getTodayPlan(profileId).then((p) => p.bits, () => undefined),
  ])
  // stars and the streak are nice-to-have: never block the front door on them
  const [playDays, progress] = await Promise.all([
    learnerService.getParentSummary(profileId).then((s) => s.playDaysThisWeek, () => 0),
    getProgress(profileId).then((p) => ({ stars: p.stars, stickers: knownStickers(p.stickers).length }), () => ({ stars: 0, stickers: 0 })),
  ])
  // class assignments come from a local copy: absent link, empty cache or a failure all mean "none"
  const assignments: AssignmentBit[] = await (async () => learnerService.getClassAssignments(profileId))().catch(() => [])
  return {
    subjects,
    plan,
    locked: lockedSubjects(LEARN_SUBJECTS, profile.grade),
    playDays,
    stars: progress.stars,
    assignments,
    stickerCount: progress.stickers,
  }
}

function LearnHome({ profile }: { profile: ChildProfile }) {
  const { data, failed, reload } = useAsync(() => loadHome(profile), `${profile.id}:${profile.grade}`)
  const refresh = useCallback(() => reload(), [reload])

  // linked to a class: refresh the cached assignments in the background (offline-safe) and sync the summary if due
  useEffect(() => {
    if (profile.classLink) refreshClassData(profile.id, refresh)
  }, [profile.id, profile.classLink, refresh])

  // /learn?locked=geo: a screen for a subject above the child's grade sent them here (see RequireSubject)
  const [params] = useSearchParams()
  const lockedSubject = parseSubject(params.get('locked') ?? undefined)
  const lockedMin = lockedSubject ? subjectMinGrade(lockedSubject) : undefined
  const lockedNote =
    lockedSubject && lockedMin !== undefined && lockedMin > profile.grade ? { subject: lockedSubject, minGrade: lockedMin } : undefined

  if (failed) return <LearnError onRetry={reload} />
  if (!data) return <LearnLoading />

  return (
    <LearnShell backTo="/" backLabel="Ludiko">
      <LearnHomeView profile={profile} lockedNote={lockedNote} {...data} />
    </LearnShell>
  )
}

/** /learn — the learner's home: today's plan (bits across subjects), every subject below, stars and the gentle streak */
export default function LearnHomePage() {
  return <RequireProfile>{(profile) => <LearnHome profile={profile} />}</RequireProfile>
}
