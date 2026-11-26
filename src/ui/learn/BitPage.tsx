import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getSkill } from '@/engine/content/registry'
import { localize, type Item, type SubjectId } from '@/engine/types'
import { triggerClassSync } from '@/classroom/syncGate'
import { learnerService, type Bit } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import { hasPushSubscription } from '@/services/pushAvailability'
import { getSessionItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import BitDone from './BitDone'
import { explanationFor } from './explanations'
import LearnShell, { LearnError, LearnLoading } from './LearnShell'
import RequireSubject from './RequireSubject'
import { nextPlanBit, planBitPath } from './planRoutes'
import { parseSubject } from './subjects'
import { useAttemptRecorder } from './useAttemptRecorder'

type View =
  | { name: 'loading' }
  | { name: 'needCheck' }
  | { name: 'notFound' }
  | { name: 'play'; pos: number; items: Item[]; runId: number }
  | { name: 'empty'; pos: number }
  | { name: 'saving' }
  | { name: 'done'; passed?: boolean; stars: number; allDone: boolean; nextPath?: string }
  | { name: 'error' }

/** A finished bit counts as a play day for the push reminders: tell the sender (only when this device subscribed) */
function reportPlayedToday() {
  if (!hasPushSubscription()) return
  void import('@/services/pushService').then((m) => m.markPlayedToday()).catch(() => {})
}

const averageStars = (stars: number[]) => (stars.length ? Math.max(1, Math.round(stars.reduce((a, b) => a + b, 0) / stars.length)) : 1)

/** `plan`: opened from today's plan, so "another bit" means the next bit of the plan (any subject) */
function BitRunner({ profile, subject, index, plan }: { profile: ChildProfile; subject: SubjectId; index: number; plan: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const progressStore = useSessionProgress()
  const [bit, setBit] = useState<Bit | null>(null)
  const [view, setView] = useState<View>({ name: 'loading' })
  const [nonce, setNonce] = useState(0)
  const runs = useRef(0)
  const earned = useRef<number[]>([])
  const checkResult = useRef<boolean | undefined>(undefined)

  /* A mastery check plays in check mode; everything else is practice */
  const playing = view.name === 'play' && bit ? bit.steps[view.pos] : undefined
  const recorder = useAttemptRecorder(profile.id, playing?.kind === 'check' ? 'check' : 'practice')

  const titleOf = (skillId: string) => {
    const skill = getSkill(skillId)
    return skill ? localize(skill.title, i18n.language) : skillId
  }

  const startStep = useCallback(
    (current: Bit, pos: number) => {
      const step = current.steps[pos]
      const skill = step && getSkill(step.skillId)
      const items = skill ? getSessionItems(skill, step.itemCount) : []
      progressStore.reset()
      if (items.length === 0) {
        setView({ name: 'empty', pos })
        return
      }
      runs.current += 1
      setView({ name: 'play', pos, items, runId: runs.current })
    },
    // progressStore.reset is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    let cancelled = false
    setView({ name: 'loading' })
    earned.current = []
    checkResult.current = undefined
    learnerService.getTodayBits(profile.id, subject).then(
      (bits) => {
        if (cancelled) return
        if (!bits) return setView({ name: 'needCheck' })
        const found = bits[index]
        if (!found) return setView({ name: 'notFound' })
        setBit(found)
        startStep(found, 0)
      },
      () => !cancelled && setView({ name: 'error' }),
    )
    return () => {
      cancelled = true
    }
  }, [profile.id, subject, index, startStep, nonce])

  /** Save one finished part of the bit (the mastery check if any, then the mission step), then go on */
  const completePart = async (pos: number, accuracy: number, summary?: SessionSummary, items?: Item[]) => {
    if (!bit) return
    const step = bit.steps[pos]
    setView({ name: 'saving' })
    try {
      await recorder.flush()
      if (summary && items && step.kind === 'check') {
        const results = summary.attempts.filter((a) => !a.retry).map((a) => a.correct)
        checkResult.current = (await learnerService.applyMasteryCheck(profile.id, step.skillId, results, items[0].type)).passed
      }
      await learnerService.completeMissionStep(profile.id, subject, bit.day, step.stepIndex, accuracy)
      if (summary) {
        progressStore.onFinish(summary)
        earned.current.push(summary.stars)
      }
      if (pos + 1 < bit.steps.length) return startStep(bit, pos + 1)

      // the bit is finished: what is left for today?
      const bits = (await learnerService.getTodayBits(profile.id, subject)) ?? []
      const pending = bits.filter((b) => !b.done && b.index !== bit.index)
      const nextIndex = (pending.find((b) => b.index > bit.index) ?? pending[0])?.index
      if (bits.every((b) => b.done) && !bit.done) progressStore.onMissionComplete()
      reportPlayedToday()
      triggerClassSync(profile.id)
      let allDone = bits.every((b) => b.done)
      let nextPath = nextIndex === undefined ? undefined : `/learn/bit/${subject}/${nextIndex}`
      if (plan) {
        // from today's plan: "another bit" and "all done" are about the whole plan, across subjects
        const today = await learnerService.getTodayPlan(profile.id).catch(() => undefined)
        if (today) {
          const here = today.bits.find((b) => b.subject === subject && b.bitIndex === bit.index)
          const next = nextPlanBit(today.bits, here?.index ?? -1)
          allDone = today.bits.every((b) => b.done)
          nextPath = next && planBitPath(next)
        }
      }
      setView({
        name: 'done',
        stars: averageStars(earned.current),
        passed: checkResult.current,
        allDone,
        nextPath,
      })
    } catch {
      setView({ name: 'error' })
    }
  }

  switch (view.name) {
    case 'loading':
    case 'saving':
      return <LearnLoading />
    case 'error':
      return <LearnError onRetry={() => setNonce((n) => n + 1)} backTo="/learn" />
    case 'notFound':
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md">
            <div className="text-6xl" aria-hidden="true">🧭</div>
            <p className="mt-2 text-lg font-bold text-ludiko-text">{t('bits.notFound')}</p>
            <Link
              to="/learn"
              className="mt-5 flex min-h-[56px] items-center justify-center rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('learn.toHome')}
            </Link>
          </section>
        </LearnShell>
      )
    case 'needCheck':
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md">
            <div className="text-6xl" aria-hidden="true">🧭</div>
            <h1 className="mt-2 text-2xl font-extrabold text-ludiko-text">{t('bits.needCheckTitle')}</h1>
            <p className="mt-2 text-base font-semibold text-ludiko-text/80">{t('bits.needCheckBody')}</p>
            <Link
              to={`/learn/check/${subject}`}
              className="mt-5 flex min-h-[60px] items-center justify-center rounded-2xl bg-ludiko-yellow text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('bits.needCheckCta')}
            </Link>
          </section>
        </LearnShell>
      )
    case 'empty': {
      const pos = view.pos
      return (
        <LearnShell backTo="/learn">
          <section className="mt-6 rounded-3xl bg-white p-6 text-center shadow-md">
            <div className="text-6xl" aria-hidden="true">🌱</div>
            <p className="mt-2 text-lg font-bold text-ludiko-text">{t('bits.empty')}</p>
            <button
              type="button"
              onClick={() => void completePart(pos, 1)}
              className="mt-5 min-h-[56px] w-full rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
            >
              {t('bits.skip')}
            </button>
          </section>
        </LearnShell>
      )
    }
    case 'done':
      return (
        <LearnShell>
          <BitDone
            kind={bit!.kind}
            stars={view.stars}
            passed={view.passed}
            reward={progressStore.reward}
            allDone={view.allDone}
            hasNext={view.nextPath !== undefined}
            onNext={() => view.nextPath && navigate(view.nextPath)}
            onStop={() => navigate('/learn')}
          />
        </LearnShell>
      )
    case 'play': {
      const step = bit!.steps[view.pos]
      const isCheck = step.kind === 'check'
      return (
        <SessionRunner
          key={view.runId}
          items={view.items}
          mode={isCheck ? 'check' : 'practice'}
          title={t('bits.sessionTitle', { kind: t(`bits.kinds.${bit!.kind}`), title: titleOf(step.skillId) })}
          getExplanation={isCheck ? undefined : explanationFor}
          onAttempt={recorder.onAttempt}
          onFinish={(summary) => {
            if (!summary.completed) navigate('/learn')
            else void completePart(view.pos, summary.accuracy, summary, view.items)
          }}
          onExit={() => navigate('/learn')}
        />
      )
    }
  }
}

/** /learn/bit/:subject/:index — one ~3-minute bit of today's mission, with a small celebration at the end */
export default function BitPage() {
  const { subject: raw, index: rawIndex } = useParams()
  const subject = parseSubject(raw)
  const [params] = useSearchParams()
  const plan = params.get('plan') === '1'
  const index = Number(rawIndex)
  if (!subject || !Number.isInteger(index) || index < 0) return <Navigate to="/learn" replace />
  return (
    <RequireSubject subject={subject}>
      {(profile) => <BitRunner key={`${subject}-${index}`} profile={profile} subject={subject} index={index} plan={plan} />}
    </RequireSubject>
  )
}
