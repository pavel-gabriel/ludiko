import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { examForGrade } from '@/exam/blueprints'
import { recommendedGimExam } from '@/exam/gimBlueprints'

/**
 * Door to /learn/exam. Shown for profiles in grades II–IV (grade 2 -> EN II, 3–4 -> EN IV) and VI–VIII
 * (VI -> EN VI, VII–VIII -> EN VIII simulations, docs/EXAM_PRACTICE.md §7);
 * renders nothing otherwise, so callers can drop it in unconditionally.
 */
export default function ExamEntryCard({ grade, compact = false }: { grade: number | undefined; compact?: boolean }) {
  const { t } = useTranslation()
  const exam = grade === undefined ? null : examForGrade(grade) ?? recommendedGimExam(grade)
  if (!exam) return null
  const gim = exam === 'en6' || exam === 'en8'
  return (
    <Link
      to="/learn/exam"
      data-testid="card-exam"
      className={`flex w-full items-center gap-4 rounded-3xl bg-ludiko-purple/60 p-4 text-left shadow-md transition-transform active:scale-95 ${
        compact ? 'min-h-[88px]' : 'min-h-[112px]'
      }`}
    >
      <span className={compact ? 'text-4xl' : 'text-5xl'} aria-hidden="true">📝</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-extrabold leading-tight text-ludiko-text">{gim ? t('examGim.entry.title') : t('exam.entry.title')}</span>
        <span className="block text-sm font-semibold text-ludiko-text/80">{gim ? t(`examGim.entry.body_${exam}`) : t(`exam.entry.body_${exam}`)}</span>
      </span>
    </Link>
  )
}
