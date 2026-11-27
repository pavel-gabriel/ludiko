import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { GIM_BLUEPRINTS, gimQuestionCount, hasEstimatedMark, maxPoints, type GimExamId } from '@/exam/gimBlueprints'
import { localize } from '@/engine/types'
import LearnShell from '@/ui/learn/LearnShell'

/** /learn/exam for grades VI–VIII: EN VI and EN VIII simulations (docs/EXAM_PRACTICE.md §7) */
export default function GimExamPicker({ exams }: { exams: GimExamId[] }) {
  const { t, i18n } = useTranslation()
  const [exam, setExam] = useState<GimExamId>(exams[0])
  const papers = ([1, 2] as const).map((test) => ({
    test,
    tests: GIM_BLUEPRINTS.filter((b) => b.exam === exam && b.test === test),
  }))

  return (
    <LearnShell title={t('examGim.title')} backTo="/learn">
      <div className="flex flex-col gap-4">
        <p className="text-center text-base font-bold text-ludiko-text/80">{t('examGim.picker.intro')}</p>

        <div role="tablist" aria-label={t('examGim.title')} className="grid grid-cols-2 gap-2">
          {exams.map((id) => {
            const on = id === exam
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setExam(id)}
                data-testid={`tab-${id}`}
                className={`flex min-h-[64px] flex-col items-center justify-center rounded-2xl px-2 py-2 text-center text-base font-extrabold leading-tight text-ludiko-text shadow-sm active:scale-95 ${
                  on ? 'bg-ludiko-purple ring-2 ring-ludiko-text/30' : 'bg-white'
                }`}
              >
                <span aria-hidden="true" className="text-xl">{t(`examGim.exams.${id}.emoji`)}</span>
                {t(`examGim.exams.${id}.short`)}
                {id === exams[0] && (
                  <span className="mt-0.5 rounded-full bg-white/80 px-2 text-xs font-bold">{t('examGim.picker.recommended')}</span>
                )}
              </button>
            )
          })}
        </div>

        <p className="text-center text-sm font-bold text-ludiko-text/70" data-testid="gim-mark-note">
          {hasEstimatedMark(exam) ? t('examGim.picker.mark') : t('examGim.picker.noMark')}
        </p>

        <div role="tabpanel" className="flex flex-col gap-5">
          {papers.map(({ test, tests }) => (
            <section key={test} aria-labelledby={`paper-${exam}-${test}`}>
              <h2 id={`paper-${exam}-${test}`} className="mb-2 text-lg font-extrabold text-ludiko-text">
                <span aria-hidden="true">{test === 1 ? '📖 ' : '🔢 '}</span>
                {t(`examGim.papers.${exam}.${test}`)}
              </h2>
              <ul className="flex flex-col gap-2">
                {tests.map((bp) => (
                  <li key={bp.id}>
                    <Link
                      to={`/learn/exam/${bp.exam}/${bp.test}/${bp.variant}`}
                      data-testid={`test-${bp.id}`}
                      className="flex min-h-[72px] flex-col justify-center rounded-2xl bg-ludiko-blue px-4 py-2 shadow-md transition-transform active:scale-95"
                    >
                      <span className="text-lg font-extrabold leading-tight text-ludiko-text">{localize(bp.title, i18n.language)}</span>
                      <span className="text-sm font-semibold text-ludiko-text/80">
                        {t('examGim.picker.meta', { count: gimQuestionCount(bp), points: maxPoints(bp), min: bp.timeLimitMin })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <section className="rounded-2xl bg-ludiko-yellow p-4 shadow-sm" aria-labelledby="exam-gim-note" data-testid="exam-parent-note">
          <h2 id="exam-gim-note" className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/70">
            {t('examGim.picker.parentTitle')}
          </h2>
          <p className="mt-1 text-sm font-bold text-ludiko-text">{t('examGim.picker.parentNote')}</p>
          <p className="mt-2 text-xs font-semibold text-ludiko-text/80">{t('examGim.picker.todo')}</p>
        </section>
      </div>
    </LearnShell>
  )
}
