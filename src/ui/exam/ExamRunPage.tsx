import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { assembleTest, blueprintSkills, testItems } from '@/exam/assemble'
import { packsForSkills } from '@/engine/content/packs'
import ContentGate from '@/ui/content/ContentGate'
import { BLUEPRINTS, getBlueprint, parseExamId, requiredQuestionCount } from '@/exam/blueprints'
import { scoreExam } from '@/exam/scoring'
import type { AssembledTest, ExamScore, ExamTestNo } from '@/exam/types'
import { getSkill } from '@/engine/content/registry'
import { localize, type Item, type ItemResult } from '@/engine/types'
import { learnerService } from '@/learner'
import type { ChildProfile } from '@/profiles/types'
import LearnShell from '@/ui/learn/LearnShell'
import RequireProfile from '@/ui/learn/RequireProfile'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import ExamResults from './ExamResults'
import ExamRunner, { type ExamRunResult } from './ExamRunner'

type Stage =
  | { name: 'start' }
  | { name: 'run'; test: AssembledTest; showTimer: boolean }
  | { name: 'results'; test: AssembledTest; score: ExamScore; overtime: boolean }

function Start({ blueprintId, onStart }: { blueprintId: string; onStart: (showTimer: boolean) => void }) {
  const { t, i18n } = useTranslation()
  const bp = BLUEPRINTS.find((b) => b.id === blueprintId)
  const [showTimer, setShowTimer] = useState(true)
  if (!bp) return null
  const count = requiredQuestionCount(bp)
  return (
    <LearnShell backTo="/learn/exam">
      <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 text-center shadow-md" data-testid="exam-start">
        <div className="text-6xl" aria-hidden="true">{bp.exam === 'en2' ? '🌱' : '🚀'}</div>
        <p className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">
          {t(`exam.exams.${bp.exam}.name`)} · {t('exam.picker.test', { n: bp.test })}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight text-ludiko-text">{localize(bp.title, i18n.language)}</h1>
        <h2 className="text-xl font-extrabold text-ludiko-text">{t('exam.start.title')}</h2>
        <p className="text-base font-semibold text-ludiko-text/80">{t('exam.start.body')}</p>
        <p className="text-sm font-bold text-ludiko-text/70">
          {t('exam.start.meta', { count, min: bp.timeLimitMin, sections: bp.sections.filter((s) => !s.optional).length })}
        </p>
        <label className="flex min-h-[48px] items-center justify-center gap-3 text-base font-bold text-ludiko-text">
          <input
            type="checkbox"
            checked={showTimer}
            onChange={(e) => setShowTimer(e.target.checked)}
            className="h-6 w-6 accent-ludiko-purple"
          />
          {t('exam.start.showTimer')}
        </label>
        <p className="-mt-2 text-xs font-semibold text-ludiko-text/60">{t('exam.start.timerHint')}</p>
        <button
          type="button"
          onClick={() => onStart(showTimer)}
          className="min-h-[64px] w-full rounded-2xl bg-ludiko-green text-2xl font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('exam.start.go')}
        </button>
      </section>
    </LearnShell>
  )
}

function ExamFlow({ profile, blueprintId, exam, testNo }: { profile: ChildProfile; blueprintId: string; exam: string; testNo: ExamTestNo }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const progress = useSessionProgress({ mode: 'check' })
  const [stage, setStage] = useState<Stage>({ name: 'start' })
  const [empty, setEmpty] = useState(false)
  const recorded = useRef(false)

  const begin = (showTimer: boolean) => {
    const bp = getBlueprint(parseExamId(exam) ?? 'en2', testNo)
    if (!bp) return
    const test = assembleTest(bp, { seed: Math.floor(Math.random() * 2 ** 31) })
    if (testItems(test).length === 0) {
      setEmpty(true)
      return
    }
    recorded.current = false
    setStage({ name: 'run', test, showTimer })
  }

  const onAttempt = useCallback(
    (result: ItemResult, item: Item) => progress.onAttempt(result, item, { retry: false }),
    // progress.onAttempt is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.onAttempt],
  )

  const finish = (test: AssembledTest, run: ExamRunResult) => {
    const score = scoreExam(test, run.answers)
    if (!recorded.current) {
      recorded.current = true
      // Stars/sticker for finishing, like any session; mastery gets every answered item once
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
        <ExamResults
          test={stage.test}
          score={stage.score}
          reward={progress.reward}
          overtime={stage.overtime}
          guest={false}
          titleOf={titleOf}
          onAgain={() => navigate('/learn/exam')}
          onHome={() => navigate('/learn')}
        />
      </LearnShell>
    )
  }
  return (
    <>
      <Start blueprintId={blueprintId} onStart={begin} />
      {empty && (
        <p role="status" className="mx-auto mt-3 max-w-md px-4 text-center text-base font-bold text-ludiko-text">
          {t('exam.start.empty')}
        </p>
      )}
    </>
  )
}

/** /learn/exam/:exam/:test — start screen, the paper, then the results */
export default function ExamRunPage() {
  const { exam: rawExam, test: rawTest } = useParams()
  const exam = parseExamId(rawExam)
  const testNo = rawTest === '1' ? 1 : rawTest === '2' ? 2 : null
  const bp = exam && testNo ? getBlueprint(exam, testNo) : undefined
  if (!exam || !testNo || !bp) return <Navigate to="/learn/exam" replace />
  return (
    <RequireProfile>
      {(profile) => (
        <ContentGate packs={packsForSkills(blueprintSkills(bp))} backTo="/learn/exam">
          <ExamFlow profile={profile} blueprintId={bp.id} exam={exam} testNo={testNo} />
        </ContentGate>
      )}
    </RequireProfile>
  )
}
