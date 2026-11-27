import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { assembleTest, blueprintSkills, testItems } from '@/exam/assemble'
import { packsForSkills } from '@/engine/content/packs'
import ContentGate from '@/ui/content/ContentGate'
import { getGimBlueprint, gimQuestionCount, isGimExam, maxPoints } from '@/exam/gimBlueprints'
import { partialFraction, scoreGimExam, type GimScore } from '@/exam/gimScoring'
import type { AssembledTest, ExamBlueprint, ExamTestNo } from '@/exam/types'
import { getSkill } from '@/engine/content/registry'
import { localize, type Item, type ItemResult } from '@/engine/types'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import LearnShell from '@/ui/learn/LearnShell'
import RequireProfile from '@/ui/learn/RequireProfile'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import ExamGimResults from './ExamGimResults'
import ExamRunner, { type ExamRunResult } from './ExamRunner'

type Stage =
  | { name: 'start' }
  | { name: 'run'; test: AssembledTest; showTimer: boolean }
  | { name: 'results'; test: AssembledTest; score: GimScore; overtime: boolean }

function Start({ bp, onStart }: { bp: ExamBlueprint; onStart: (showTimer: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const [showTimer, setShowTimer] = useState(true)
  return (
    <LearnShell backTo="/learn/exam">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 text-center shadow-md" data-testid="exam-start">
        <div className="text-5xl" aria-hidden="true">{t(`examGim.exams.${bp.exam}.emoji`)}</div>
        <p className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">
          {t(`examGim.exams.${bp.exam}.name`)} · {t(`examGim.papers.${bp.exam}.${bp.test}`)}
        </p>
        <h1 className="text-2xl font-extrabold leading-tight text-ludiko-text">{localize(bp.title, i18n.language)}</h1>
        <h2 className="text-lg font-extrabold text-ludiko-text">{t('examGim.start.title')}</h2>
        <p className="text-base font-semibold text-ludiko-text/80">{t('examGim.start.body')}</p>
        <p className="text-sm font-bold text-ludiko-text/70">
          {t('examGim.start.meta', { count: gimQuestionCount(bp), points: maxPoints(bp), min: bp.timeLimitMin })}
        </p>
        <label className="flex min-h-[48px] items-center justify-center gap-3 text-base font-bold text-ludiko-text">
          <input type="checkbox" checked={showTimer} onChange={(e) => setShowTimer(e.target.checked)} className="h-6 w-6 accent-ludiko-purple" />
          {t('exam.start.showTimer')}
        </label>
        <button
          type="button"
          onClick={() => onStart(showTimer)}
          className="min-h-[60px] w-full rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('exam.start.go')}
        </button>
      </section>
    </LearnShell>
  )
}

function GimFlow({ profile, bp }: { profile: ChildProfile; bp: ExamBlueprint }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const progress = useSessionProgress({ mode: 'check' })
  const [stage, setStage] = useState<Stage>({ name: 'start' })
  const [empty, setEmpty] = useState(false)
  const recorded = useRef(false)
  /** item id -> share of right questions (reading texts earn partial points) */
  const fractions = useRef<Record<string, number>>({})

  const begin = (showTimer: boolean) => {
    const test = assembleTest(bp, { seed: bp.seed })
    if (testItems(test).length === 0) {
      setEmpty(true)
      return
    }
    recorded.current = false
    fractions.current = {}
    setStage({ name: 'run', test, showTimer })
  }

  const onAttempt = useCallback(
    (result: ItemResult, item: Item) => {
      fractions.current[item.id] = partialFraction(item, result.response)
      progress.onAttempt(result, item, { retry: false })
    },
    // progress.onAttempt is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.onAttempt],
  )

  const finish = (test: AssembledTest, run: ExamRunResult) => {
    const score = scoreGimExam(test, run.answers, fractions.current)
    if (!recorded.current) {
      recorded.current = true
      const summary: SessionSummary = {
        mode: 'check',
        completed: true,
        total: score.answered,
        correct: score.correct,
        accuracy: score.answered ? score.correct / score.answered : 0,
        stars: score.stars,
        review: [],
        attempts: [],
        durationMs: run.durationMs,
      }
      progress.onFinish(summary)
      const entries = testItems(test)
        .filter((i) => run.answers[i.id] !== undefined)
        .map((item) => ({ item, correct: run.answers[item.id] }))
      void learnerService.recordExamResults(profile.id, entries).catch(() => {})
    }
    setStage({ name: 'results', test, score, overtime: run.overtime })
  }

  const titleOf = (id: string) => {
    const skill = getSkill(id)
    return skill ? localize(skill.title, i18n.language) : id
  }

  if (stage.name === 'run') {
    return <ExamRunner test={stage.test} showTimer={stage.showTimer} onAttempt={onAttempt} onFinish={(r) => finish(stage.test, r)} onExit={() => navigate('/learn/exam')} />
  }
  if (stage.name === 'results') {
    return (
      <LearnShell>
        <ExamGimResults
          test={stage.test}
          score={stage.score}
          reward={progress.reward}
          overtime={stage.overtime}
          titleOf={titleOf}
          onAgain={() => navigate('/learn/exam')}
          onHome={() => navigate('/learn')}
        />
      </LearnShell>
    )
  }
  return (
    <>
      <Start bp={bp} onStart={begin} />
      {empty && (
        <p role="status" className="mx-auto mt-3 max-w-md px-4 text-center text-base font-bold text-ludiko-text">
          {t('exam.start.empty')}
        </p>
      )}
    </>
  )
}

/** /learn/exam/:exam/:test/:variant — EN VI / EN VIII simulation: start screen, the paper, the results */
export default function ExamGimRunPage() {
  const { exam, test, variant } = useParams()
  const testNo: ExamTestNo | null = test === '1' ? 1 : test === '2' ? 2 : null
  const bp = isGimExam(exam) && testNo ? getGimBlueprint(exam, testNo, Number(variant)) : undefined
  if (!bp) return <Navigate to="/learn/exam" replace />
  return (
    <RequireProfile>
      {(profile) => (
        <ContentGate packs={packsForSkills(blueprintSkills(bp))} backTo="/learn/exam">
          <GimFlow profile={profile} bp={bp} />
        </ContentGate>
      )}
    </RequireProfile>
  )
}
