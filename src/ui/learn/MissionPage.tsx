import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import { localize, type Item, type SubjectId } from '@/engine/types'
import { learnerService, type Mission, type MissionStepKind } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { getSessionItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import { explanationFor } from './explanations'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import MissionComplete from './MissionComplete'
import RequireSubject from './RequireSubject'
import StepCelebration from './StepCelebration'
import TreasurePath from './TreasurePath'
import { parseSubject } from './subjects'
import { useAttemptRecorder } from './useAttemptRecorder'

type View =
  | { name: 'loading' }
  | { name: 'needCheck' }
  | { name: 'path' }
  | { name: 'play'; index: number; items: Item[]; runId: number }
  | { name: 'empty'; index: number }
  | { name: 'saving' }
  | { name: 'stepDone'; kind: MissionStepKind; stars: number; passed?: boolean }
  | { name: 'complete'; fresh: boolean }
  | { name: 'error' }

function Mission({ profile, subject }: { profile: ChildProfile; subject: SubjectId }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const progressStore = useSessionProgress()
  const [mission, setMission] = useState<Mission | null>(null)
  const [view, setView] = useState<View>({ name: 'loading' })
  const runs = useRef(0)

  /* The mastery check step plays in check mode; everything else is practice */
  const playing = view.name === 'play' && mission ? mission.steps[view.index] : undefined
  const recorder = useAttemptRecorder(profile.id, playing?.kind === 'check' ? 'check' : 'practice')

  const load = useCallback(() => {
    setView({ name: 'loading' })
    learnerService.getTodayMission(profile.id, subject).then(
      (m) => {
        if (!m) setView({ name: 'needCheck' })
        else {
          setMission(m)
          setView(m.completedAt ? { name: 'complete', fresh: false } : { name: 'path' })
        }
      },
      () => setView({ name: 'error' }),
    )
  }, [profile.id, subject])

  useEffect(() => {
    load()
  }, [load])

  const titleOf = (skillId: string) => {
    const skill = getSkill(skillId)
    return skill ? localize(skill.title, i18n.language) : skillId
  }

  const startStep = (index: number) => {
    const step = mission?.steps[index]
    if (!step) return
    const skill = getSkill(step.skillId)
    const items = skill ? getSessionItems(skill, step.itemCount) : []
    progressStore.reset()
    if (items.length === 0) {
      setView({ name: 'empty', index })
      return
    }
    runs.current += 1
    setView({ name: 'play', index, items, runId: runs.current })
  }

  /** Save a finished step: the mastery check (if any), then the step itself */
  const completeStep = async (index: number, accuracy: number, summary?: SessionSummary, items?: Item[]) => {
    if (!mission) return
    const step = mission.steps[index]
    setView({ name: 'saving' })
    try {
      await recorder.flush()
      let passed: boolean | undefined
      if (summary && items && step.kind === 'check') {
        const results = summary.attempts.filter((a) => !a.retry).map((a) => a.correct)
        passed = (await learnerService.applyMasteryCheck(profile.id, step.skillId, results, items[0].type)).passed
      }
      const updated = await learnerService.completeMissionStep(profile.id, subject, mission.day, index, accuracy)
      setMission(updated)
      if (summary) {
        progressStore.onFinish(summary)
        if (updated.completedAt && !mission.completedAt) progressStore.onMissionComplete()
        setView({ name: 'stepDone', kind: step.kind, stars: summary.stars, passed })
      } else {
        setView(updated.completedAt ? { name: 'complete', fresh: true } : { name: 'path' })
      }
    } catch {
      setView({ name: 'error' })
    }
  }

  const afterStep = () => setView(mission?.completedAt ? { name: 'complete', fresh: true } : { name: 'path' })

  switch (view.name) {
    case 'loading':
    case 'saving':
      return <LearnLoading />
    case 'error':
      return <LearnError onRetry={load} backTo="/learn" />
    case 'needCheck':
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md">
            <div className="text-6xl" aria-hidden="true">🧭</div>
            <h1 className="mt-2 text-2xl font-extrabold text-ludiko-text">{t('learn.mission.needCheckTitle')}</h1>
            <p className="mt-2 text-base font-semibold text-ludiko-text/80">{t('learn.mission.needCheckBody')}</p>
            <Link
              to={`/learn/check/${subject}`}
              className="mt-5 flex min-h-[60px] items-center justify-center rounded-2xl bg-ludiko-yellow text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('learn.mission.needCheckCta')}
            </Link>
          </section>
        </LearnShell>
      )
    case 'complete':
      return (
        <LearnShell>
          <MissionComplete
            fresh={view.fresh}
            onMap={() => navigate(`/learn/map/${subject}`)}
            onHome={() => navigate('/learn')}
          />
        </LearnShell>
      )
    case 'stepDone':
      return (
        <LearnShell>
          <StepCelebration
            kind={view.kind}
            stars={view.stars}
            passed={view.passed}
            reward={progressStore.reward}
            onNext={afterStep}
          />
        </LearnShell>
      )
    case 'empty': {
      const index = view.index
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md">
            <div className="text-6xl" aria-hidden="true">🌱</div>
            <p className="mt-2 text-lg font-bold text-ludiko-text">{t('learn.mission.emptyStep')}</p>
            <button
              type="button"
              onClick={() => void completeStep(index, 1)}
              className="mt-5 min-h-[56px] w-full rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('learn.mission.skipStep')}
            </button>
          </section>
        </LearnShell>
      )
    }
    case 'play': {
      const step = mission!.steps[view.index]
      const isCheck = step.kind === 'check'
      return (
        <SessionRunner
          key={view.runId}
          items={view.items}
          mode={isCheck ? 'check' : 'practice'}
          title={t('learn.mission.sessionTitle', {
            kind: t(`learn.mission.kinds.${step.kind}`),
            title: titleOf(step.skillId),
          })}
          getExplanation={isCheck ? undefined : explanationFor}
          onAttempt={recorder.onAttempt}
          onFinish={(summary) => {
            if (!summary.completed) setView({ name: 'path' })
            else void completeStep(view.index, summary.accuracy, summary, view.items)
          }}
          onExit={() => setView({ name: 'path' })}
        />
      )
    }
    case 'path': {
      const steps = (mission?.steps ?? []).map((s) => ({ kind: s.kind, title: titleOf(s.skillId), done: s.done }))
      return (
        <LearnShell title={t('learn.mission.title')} backTo="/learn">
          <p className="mb-4 text-center text-base font-semibold text-ludiko-text/80">{t('learn.mission.hint')}</p>
          <TreasurePath steps={steps} onStart={startStep} />
        </LearnShell>
      )
    }
  }
}

/** /learn/mission/:subject — today's mission as a treasure-map path, one step per session */
export default function MissionPage() {
  const { subject: raw } = useParams()
  const subject = parseSubject(raw)
  if (!subject) return <Navigate to="/learn" replace />
  return <RequireSubject subject={subject}>{(profile) => <Mission profile={profile} subject={subject} />}</RequireSubject>
}
