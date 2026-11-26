import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BLUEPRINTS, examForGrade, requiredQuestionCount } from '@/exam/blueprints'
import type { ExamId } from '@/exam/types'
import { localize } from '@/engine/types'
import LearnShell from '@/ui/learn/LearnShell'
import RequireProfile from '@/ui/learn/RequireProfile'

const EXAMS: ExamId[] = ['en2', 'en4']

function Picker({ grade }: { grade: number }) {
  const { t, i18n } = useTranslation()
  const recommended = examForGrade(grade)
  const [exam, setExam] = useState<ExamId>(recommended ?? 'en2')
  const tests = BLUEPRINTS.filter((b) => b.exam === exam)

  return (
    <LearnShell title={t('exam.title')} backTo="/learn">
      <div className="flex flex-col gap-4">
        <p className="text-center text-lg font-bold text-ludiko-text/80">{t('exam.picker.intro')}</p>

        <div role="tablist" aria-label={t('exam.title')} className="grid grid-cols-2 gap-2">
          {EXAMS.map((id) => {
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
                <span aria-hidden="true" className="text-xl">{t(`exam.exams.${id}.emoji`)}</span>
                {t(`exam.exams.${id}.short`)}
                {id === recommended && (
                  <span className="mt-0.5 rounded-full bg-white/80 px-2 text-xs font-bold">{t('exam.picker.recommended')}</span>
                )}
              </button>
            )
          })}
        </div>

        <ul className="flex flex-col gap-3" role="tabpanel">
          {tests.map((bp) => (
            <li key={bp.id}>
              <Link
                to={`/learn/exam/${bp.exam}/${bp.test}`}
                data-testid={`test-${bp.id}`}
                className="flex min-h-[96px] items-center gap-4 rounded-3xl bg-ludiko-blue p-4 shadow-md transition-transform active:scale-95"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-3xl" aria-hidden="true">
                  {bp.test === 1 ? '📖' : '🔢'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold uppercase tracking-wide text-ludiko-text/70">
                    {t('exam.picker.test', { n: bp.test })}
                  </span>
                  <span className="block text-xl font-extrabold leading-tight text-ludiko-text">{localize(bp.title, i18n.language)}</span>
                  <span className="block text-sm font-semibold text-ludiko-text/80">
                    {t('exam.picker.testMeta', { count: requiredQuestionCount(bp), min: bp.timeLimitMin })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="rounded-2xl bg-ludiko-yellow p-4 shadow-sm" aria-labelledby="exam-parent-note" data-testid="exam-parent-note">
          <h2 id="exam-parent-note" className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/70">
            <span aria-hidden="true">👨‍👩‍👧 </span>
            {t('exam.picker.parentTitle')}
          </h2>
          <p className="mt-1 text-base font-bold text-ludiko-text">{t('exam.picker.parentNote')}</p>
        </section>
      </div>
    </LearnShell>
  )
}

/** /learn/exam — choose EN II or EN IV, then Test 1 or 2 */
export default function ExamPickerPage() {
  return <RequireProfile>{(profile) => <Picker grade={profile.grade} />}</RequireProfile>
}
