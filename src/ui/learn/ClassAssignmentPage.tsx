import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { triggerClassSync } from '@/classroom/syncGate'
import Confetti from '@/components/ui/Confetti'
import { getSkill } from '@/engine/content/registry'
import { localize, type Item } from '@/engine/types'
import { learnerService, type AssignmentBit } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { getSessionItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import { playFinish } from '@/utils/sounds'
import { dueText } from './AssignmentCard'
import { explanationFor } from './explanations'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireProfile from './RequireProfile'
import { useAttemptRecorder } from './useAttemptRecorder'

/** One round per assigned skill: short, like any other bit */
const ROUND_ITEMS = 6

type View =
  | { name: 'loading' }
  | { name: 'notFound' }
  | { name: 'overview'; bit: AssignmentBit; justPlayed: boolean }
  | { name: 'play'; bit: AssignmentBit; skillId: string; items: Item[]; runId: number }
  | { name: 'done'; bit: AssignmentBit; stars: number }
  | { name: 'error' }

function Runner({ profile, assignmentId }: { profile: ChildProfile; assignmentId: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const progressStore = useSessionProgress()
  const recorder = useAttemptRecorder(profile.id, 'practice')
  const [view, setView] = useState<View>({ name: 'loading' })
  const [nonce, setNonce] = useState(0)
  const runs = useRef(0)
  const earned = useRef<number[]>([])

  const titleOf = (skillId: string) => {
    const skill = getSkill(skillId)
    return skill ? localize(skill.title, i18n.language) : skillId
  }

  const findBit = async (): Promise<AssignmentBit | undefined> =>
    (await learnerService.getClassAssignments(profile.id)).find((b) => b.assignmentId === assignmentId)

  useEffect(() => {
    let cancelled = false
    earned.current = []
    findBit().then(
      (bit) => {
        if (cancelled) return
        setView(bit ? { name: 'overview', bit, justPlayed: false } : { name: 'notFound' })
      },
      () => !cancelled && setView({ name: 'error' }),
    )
    return () => {
      cancelled = true
    }
    // findBit closes over profile.id and assignmentId only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, assignmentId, nonce])

  const startRound = (bit: AssignmentBit) => {
    const next = bit.skills.find((s) => !s.done)
    const skill = next && getSkill(next.skillId)
    const items = skill ? getSessionItems(skill, ROUND_ITEMS) : []
    progressStore.reset()
    if (!next || items.length === 0) {
      setView({ name: 'overview', bit, justPlayed: false })
      return
    }
    runs.current += 1
    setView({ name: 'play', bit, skillId: next.skillId, items, runId: runs.current })
  }

  const finishRound = async (summary: SessionSummary) => {
    if (!summary.completed) {
      navigate('/learn')
      return
    }
    setView({ name: 'loading' })
    try {
      await recorder.flush()
      progressStore.onFinish(summary)
      earned.current.push(summary.stars)
      const bit = await findBit()
      if (!bit) return setView({ name: 'notFound' })
      triggerClassSync(profile.id)
      if (bit.done) {
        const stars = Math.max(1, Math.round(earned.current.reduce((a, b) => a + b, 0) / earned.current.length))
        setView({ name: 'done', bit, stars })
      } else {
        setView({ name: 'overview', bit, justPlayed: true })
      }
    } catch {
      setView({ name: 'error' })
    }
  }

  useEffect(() => {
    if (view.name === 'done') playFinish()
  }, [view.name])

  switch (view.name) {
    case 'loading':
      return <LearnLoading />
    case 'error':
      return <LearnError onRetry={() => setNonce((n) => n + 1)} backTo="/learn" />
    case 'notFound':
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md" data-testid="assignment-not-found">
            <div className="text-6xl" aria-hidden="true">🧭</div>
            <p className="mt-2 text-lg font-bold text-ludiko-text">{t('classroom.child.notFound')}</p>
            <Link
              to="/learn"
              className="mt-5 flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('learn.toHome')}
            </Link>
          </section>
        </LearnShell>
      )
    case 'overview': {
      const { bit } = view
      return (
        <LearnShell backTo="/learn">
          <section className="mt-2 flex flex-col gap-4" aria-labelledby="assignment-heading" data-testid="assignment-overview">
            <div className="rounded-3xl bg-ludiko-orange p-5 shadow-md">
              <p className="text-sm font-extrabold text-ludiko-text/80">
                <span aria-hidden="true">🏫 </span>
                {t('classroom.child.assignmentTitle')}
              </p>
              <h1 id="assignment-heading" className="mt-1 break-words text-2xl font-extrabold leading-tight text-ludiko-text">{bit.title}</h1>
              <p className="mt-1 text-sm font-bold text-ludiko-text/80">{dueText(t, bit)}</p>
              {view.justPlayed && <p className="mt-2 font-bold text-ludiko-text">{t('classroom.child.keepGoing')}</p>}
            </div>
            <ul className="flex flex-col gap-2">
              {bit.skills.map((s) => (
                <li
                  key={s.skillId}
                  data-done={s.done}
                  className={`flex min-h-[56px] items-center gap-3 rounded-2xl p-3 shadow-sm ${s.done ? 'bg-ludiko-green' : 'bg-white'}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg font-extrabold" aria-hidden="true">
                    {s.done ? '✓' : '🌱'}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-bold text-ludiko-text">{titleOf(s.skillId)}</span>
                  <span className="sr-only">{s.done ? t('classroom.child.skillDone') : t('classroom.child.skillOpen')}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => startRound(bit)}
              data-testid="assignment-start"
              className="min-h-[60px] rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {view.justPlayed ? t('classroom.child.again') : t('classroom.child.start')}
            </button>
            <Link to="/learn" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-white font-bold text-ludiko-text shadow-sm">
              {t('bits.stop')}
            </Link>
          </section>
        </LearnShell>
      )
    }
    case 'done':
      return (
        <LearnShell>
          <section className="flex flex-col gap-4 pt-6" data-testid="assignment-done">
            <Confetti />
            <div className="rounded-3xl bg-white p-6 text-center shadow-md">
              <div className="text-6xl" aria-hidden="true">🏫</div>
              <h1 className="mt-2 text-3xl font-extrabold text-ludiko-text">{t('classroom.child.doneTitle')}</h1>
              <p className="mt-2 text-lg font-semibold text-ludiko-text/80">{t('classroom.child.doneBody')}</p>
              <div className="mt-3 flex justify-center gap-2 text-4xl" role="img" aria-label={t('learn.mission.stepStars', { n: view.stars })}>
                {[1, 2, 3].map((n) => (
                  <span key={n} className={n <= view.stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">⭐</span>
                ))}
              </div>
            </div>
            <Link
              to="/learn"
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('learn.toHome')}
            </Link>
          </section>
        </LearnShell>
      )
    case 'play':
      return (
        <SessionRunner
          key={view.runId}
          items={view.items}
          mode="practice"
          title={t('classroom.child.sessionTitle', { title: titleOf(view.skillId) })}
          getExplanation={explanationFor}
          onAttempt={recorder.onAttempt}
          onFinish={(summary) => void finishRound(summary)}
          onExit={() => navigate('/learn')}
        />
      )
  }
}

/** /learn/class/:assignmentId — plays the skills of a class assignment, round by round, until each is practised */
export default function ClassAssignmentPage() {
  const { assignmentId } = useParams()
  if (!assignmentId) return <Navigate to="/learn" replace />
  return <RequireProfile>{(profile) => <Runner key={assignmentId} profile={profile} assignmentId={assignmentId} />}</RequireProfile>
}
