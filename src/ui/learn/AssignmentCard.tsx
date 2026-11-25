import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { AssignmentBit } from '@/learner'
import ProgressBar from './ProgressBar'

/** Gentle due text: a late assignment is never a failure ("you can still do it") */
export function dueText(t: (key: string, o?: Record<string, unknown>) => string, bit: Pick<AssignmentBit, 'daysLeft' | 'done'>): string {
  if (bit.done) return t('classroom.child.due.done')
  if (bit.daysLeft < 0) return t('classroom.child.due.late')
  if (bit.daysLeft === 0) return t('classroom.child.due.today')
  if (bit.daysLeft === 1) return t('classroom.child.due.tomorrow')
  return t('classroom.child.due.days', { count: bit.daysLeft })
}

const MAX_SHOWN = 3

/** "Tema de la clasă": the teacher's assignments as an extra bit on /learn, with done state from the child's own skill states */
export default function AssignmentCard({ assignments }: { assignments: AssignmentBit[] }) {
  const { t } = useTranslation()
  const open = assignments.filter((a) => !a.done)
  const shown = (open.length > 0 ? open : assignments.slice(0, 1)).slice(0, MAX_SHOWN)
  if (shown.length === 0) return null

  return (
    <section className="rounded-3xl bg-ludiko-orange p-4 shadow-md" aria-labelledby="class-assignment-title" data-testid="card-class-assignments">
      <h2 id="class-assignment-title" className="text-xl font-extrabold text-ludiko-text">
        <span aria-hidden="true">🏫 </span>
        {t('classroom.child.assignmentTitle')}
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {shown.map((a) => (
          <li key={a.assignmentId}>
            <Link
              to={`/learn/class/${a.assignmentId}`}
              data-testid={`assignment-${a.assignmentId}`}
              data-done={a.done}
              className={`relative flex min-h-[88px] flex-col justify-center gap-1 rounded-2xl p-3 shadow-sm transition-transform active:scale-95 ${a.done ? 'bg-white/80' : 'bg-white'}`}
            >
              {a.done && (
                <span
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ludiko-green text-base font-extrabold shadow-sm"
                  data-testid={`assignment-${a.assignmentId}-tick`}
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
              <span className="block break-words pr-8 text-lg font-extrabold leading-tight text-ludiko-text">{a.title}</span>
              <span className="block text-sm font-bold text-ludiko-text/80">{dueText(t, a)}</span>
              <ProgressBar
                className="!bg-gray-200"
                value={a.total ? a.doneCount / a.total : 0}
                label={t('classroom.child.progress', { done: a.doneCount, total: a.total })}
              />
              <span className="block text-sm font-bold text-ludiko-text">{t('classroom.child.progress', { done: a.doneCount, total: a.total })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
