import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import type { Item, SubjectId } from '@/engine/types'
import { triggerClassSync } from '@/classroom/syncGate'
import { learnerService, type PlanBit } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { getSessionItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import BitDone from './BitDone'
import BreakOffer from './BreakOffer'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import PlacementCelebration from './PlacementCelebration'
import PlacementIntro from './PlacementIntro'
import ProgressBar from './ProgressBar'
import RequireSubject from './RequireSubject'
import { lockedPath } from './RequireSubject'
import { nextPlanBit, planBitPath } from './planRoutes'
import { checkSubjects } from '@/learner/checkSubjects'
import { nextToCheck } from './CheckProgressCard'
import { LEARN_SUBJECTS, parseSubject } from './subjects'
import { useAttemptRecorder } from './useAttemptRecorder'

/** After this much play time we offer a rest (docs/PLAN.md §4: 3-minute bites) */
export const BITE_MS = 3 * 60 * 1000

type Phase =
  | { name: 'loading' }
  | { name: 'intro'; resuming: boolean }
  | { name: 'busy' }
  | { name: 'probe'; skillId: string; items: Item[]; runId: number }
  | { name: 'break' }
  | { name: 'done'; next?: SubjectId }
  | { name: 'chunkDone'; next?: PlanBit; allDone: boolean }
  | { name: 'unavailable' }
  | { name: 'error' }

/** The finished check earns the celebration reward, as one full session would */
const COMPLETION_SUMMARY: SessionSummary = {
  mode: 'check',
  completed: true,
  total: 0,
  correct: 0,
  accuracy: 1,
  stars: 3,
  review: [],
  attempts: [],
  durationMs: 0,
}

/** After a finished check: the next subject whose check is still to do (resume first), if any */
async function nextSubjectToCheck(profile: ChildProfile, done: SubjectId): Promise<SubjectId | undefined> {
  try {
    const subjects = checkSubjects(profile, LEARN_SUBJECTS).filter((s) => s !== done)
    const states = await Promise.all(
      subjects.map(async (s) => {
        const rec = await learnerService.getPlacement(profile.id, s)
        return { subject: s, placement: rec?.completedAt !== undefined ? ('done' as const) : rec ? ('inProgress' as const) : ('none' as const) }
      }),
    )
    return nextToCheck(states)?.subject
  } catch {
    return undefined // a nicety: the plan button is always there
  }
}

/** `plan`: played as one bit of today's plan (a short chunk of the check, then back to the plan) */
function Placement({ profile, subject, plan }: { profile: ChildProfile; subject: SubjectId; plan: boolean }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const progressStore = useSessionProgress()
  const recorder = useAttemptRecorder(profile.id, 'placement')
  const [phase, setPhase] = useState<Phase>({ name: 'loading' })
  const [progress, setProgress] = useState(0)
  const biteStart = useRef(Date.now())
  const runs = useRef(0)
  const rewarded = useRef(false)

  /* Where are we? Done already -> home; started -> resume; else the invitation */
  useEffect(() => {
    let cancelled = false
    learnerService.getPlacement(profile.id, subject).then(
      (record) => {
        if (cancelled) return
        if (record?.completedAt) navigate('/learn', { replace: true })
        else setPhase({ name: 'intro', resuming: Boolean(record) })
      },
      () => !cancelled && setPhase({ name: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [profile.id, subject, navigate])

  const loadNext = useCallback(async () => {
    setPhase({ name: 'busy' })
    try {
      const next = await learnerService.placementNext(profile.id, subject)
      if ('unavailable' in next) {
        navigate(lockedPath(subject), { replace: true }) // nothing to check at this grade: say so, never 'done'
        return
      }
      if (next.done) {
        if (!rewarded.current) {
          rewarded.current = true
          progressStore.onFinish(COMPLETION_SUMMARY)
        }
        setProgress(1)
        triggerClassSync(profile.id)
        setPhase({ name: 'done', next: await nextSubjectToCheck(profile, subject) })
        return
      }
      const skill = getSkill(next.skillId)
      const items = skill ? getSessionItems(skill, next.itemCount) : []
      setProgress(next.progress)
      if (items.length === 0) {
        setPhase({ name: 'unavailable' })
        return
      }
      runs.current += 1
      setPhase({ name: 'probe', skillId: next.skillId, items, runId: runs.current })
    } catch {
      setPhase({ name: 'error' })
    }
    // progressStore.onFinish is stable (useCallback with no deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, subject, navigate, progressStore.onFinish])

  const start = () => {
    biteStart.current = Date.now()
    void loadNext()
  }

  const finishProbe = async (skillId: string, summary: SessionSummary) => {
    if (!summary.completed) {
      navigate('/learn')
      return
    }
    setPhase({ name: 'busy' })
    try {
      await recorder.flush()
      // first-try answers, in the order they were given
      const results = summary.attempts.filter((a) => !a.retry).map((a) => a.correct)
      await learnerService.placementRecord(profile.id, subject, skillId, results)
    } catch {
      setPhase({ name: 'error' })
      return
    }
    if (plan) {
      // a chunk of the check is one bit of today's plan: when it is done, celebrate and offer the next bit
      try {
        const today = await learnerService.getTodayPlan(profile.id)
        const mine = today.bits.find((b) => b.subject === subject && b.source === 'placement')
        if (mine?.done) {
          setPhase({ name: 'chunkDone', next: nextPlanBit(today.bits, mine.index), allDone: today.bits.every((b) => b.done) })
          return
        }
      } catch {
        /* the plan is a nicety here: keep checking */
      }
    }
    if (Date.now() - biteStart.current >= BITE_MS) setPhase({ name: 'break' })
    else await loadNext()
  }

  const toParents = () => navigate('/learn/parent')

  switch (phase.name) {
    case 'loading':
    case 'busy':
      return <LearnLoading />
    case 'error':
      return <LearnError onRetry={() => navigate(0)} backTo="/learn" />
    case 'intro':
      return (
        <LearnShell backTo="/learn">
          <PlacementIntro resuming={phase.resuming} onStart={start} subjectName={plan ? t(`learn.subject.${subject}`) : undefined} />
        </LearnShell>
      )
    case 'chunkDone':
      return (
        <LearnShell>
          <BitDone
            kind="island"
            stars={2}
            reward={null}
            allDone={phase.allDone}
            hasNext={phase.next !== undefined}
            onNext={() => phase.next && navigate(planBitPath(phase.next))}
            onStop={() => navigate('/learn')}
          />
        </LearnShell>
      )
    case 'break':
      return (
        <LearnShell>
          <BreakOffer
            progress={progress}
            onStop={() => navigate('/learn')}
            onContinue={() => {
              biteStart.current = Date.now()
              void loadNext()
            }}
          />
        </LearnShell>
      )
    case 'unavailable':
      return (
        <LearnShell backTo="/learn">
          <p className="rounded-3xl bg-white p-6 text-center text-lg font-bold text-ludiko-text shadow-md">
            <span className="block text-5xl" aria-hidden="true">🌱</span>
            {t('learn.check.unavailable')}
          </p>
        </LearnShell>
      )
    case 'done':
      return (
        <LearnShell>
          <PlacementCelebration
            reward={progressStore.reward}
            onPlan={() => navigate('/learn')}
            onMap={() => navigate(`/learn/map/${subject}`)}
            onParents={toParents}
            nextSubject={
              phase.next ? { name: t(`learn.subject.${phase.next}`), onGo: () => navigate(`/learn/check/${phase.next}`) } : undefined
            }
          />
        </LearnShell>
      )
    case 'probe':
      return (
        <>
          <div className="fixed inset-x-0 top-0 z-10 mx-auto w-full max-w-md px-4 pt-2">
            <ProgressBar thin value={progress} label={t('learn.check.progress', { pct: Math.round(progress * 100) })} />
          </div>
          <SessionRunner
            key={phase.runId}
            items={phase.items}
            mode="check"
            title={t('learn.check.sessionTitle')}
            onAttempt={recorder.onAttempt}
            onFinish={(summary) => void finishProbe(phase.skillId, summary)}
            onExit={() => navigate('/learn')}
          />
        </>
      )
  }
}

/** /learn/check/:subject — "Verifică-te!": the placement as a resumable adventure in short bites */
export default function PlacementPage() {
  const { subject: raw } = useParams()
  const [params] = useSearchParams()
  const subject = parseSubject(raw)
  if (!subject) return <Navigate to="/learn" replace />
  const plan = params.get('plan') === '1'
  return (
    <RequireSubject subject={subject}>{(profile) => <Placement key={subject} profile={profile} subject={subject} plan={plan} />}</RequireSubject>
  )
}
