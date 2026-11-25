import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import type { Item, SubjectId } from '@/engine/types'
import { triggerClassSync } from '@/classroom/syncGate'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { getSessionItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import BreakOffer from './BreakOffer'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import PlacementCelebration from './PlacementCelebration'
import PlacementIntro from './PlacementIntro'
import ProgressBar from './ProgressBar'
import RequireProfile from './RequireProfile'
import { parseSubject } from './subjects'
import { useAttemptRecorder } from './useAttemptRecorder'

/** After this much play time we offer a rest (docs/PLAN.md §4: 3-minute bites) */
export const BITE_MS = 3 * 60 * 1000

type Phase =
  | { name: 'loading' }
  | { name: 'intro'; resuming: boolean }
  | { name: 'busy' }
  | { name: 'probe'; skillId: string; items: Item[]; runId: number }
  | { name: 'break' }
  | { name: 'done' }
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

function Placement({ profile, subject }: { profile: ChildProfile; subject: SubjectId }) {
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
      if (next.done) {
        if (!rewarded.current) {
          rewarded.current = true
          progressStore.onFinish(COMPLETION_SUMMARY)
        }
        setProgress(1)
        triggerClassSync(profile.id)
        setPhase({ name: 'done' })
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
  }, [profile.id, subject, progressStore.onFinish])

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
          <PlacementIntro resuming={phase.resuming} onStart={start} />
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
            onMission={() => navigate(`/learn/mission/${subject}`)}
            onMap={() => navigate(`/learn/map/${subject}`)}
            onParents={toParents}
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
  const subject = parseSubject(raw)
  if (!subject) return <Navigate to="/learn" replace />
  return <RequireProfile>{(profile) => <Placement profile={profile} subject={subject} />}</RequireProfile>
}
