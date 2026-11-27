import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { SubjectId } from '@/engine/types'
import type { CheckState } from '@/learner/checkSubjects'
import type { AgeBand } from '@/older/ageBand'
import { bandText } from '@/ui/guide/guideStore'
import { subjectEmoji } from './subjects'

export type { CheckState }

export interface CheckStatus {
  subject: SubjectId
  placement: CheckState
}

/** The subject to check next: a started check first (resume), else the first one not done, in the given order */
export function nextToCheck(list: readonly CheckStatus[], except?: SubjectId): CheckStatus | undefined {
  const open = list.filter((s) => s.placement !== 'done' && s.subject !== except)
  return open.find((s) => s.placement === 'inProgress') ?? open[0]
}

const ICON: Record<CheckState, string> = { done: '✅', inProgress: '⏳', none: '⭕' }

/**
 * "Hai să vedem ce știi!": the level check as the obvious first step, with progress across subjects (which
 * are checked, which are not). Every chip opens that subject's check; the big button resumes or starts the
 * next one. Renders nothing once every subject is checked. Gentle: a nudge, never a wall.
 */
export default function CheckProgressCard({
  checks,
  band,
  testId = 'check-progress',
}: {
  checks: readonly CheckStatus[]
  band: AgeBand
  testId?: string
}) {
  const { t } = useTranslation()
  const next = nextToCheck(checks)
  if (!next) return null
  const done = checks.filter((c) => c.placement === 'done').length
  const name = (s: SubjectId) => t(`learn.subject.${s}`)

  return (
    <section
      className="rounded-3xl bg-ludiko-yellow p-4 shadow-md ring-4 ring-ludiko-orange"
      aria-labelledby={`${testId}-title`}
      data-testid={testId}
      data-guide="check-cta"
    >
      <h2 id={`${testId}-title`} className="text-2xl font-extrabold leading-tight text-ludiko-text">
        <span aria-hidden="true">🧭 </span>
        {bandText(t, 'guide.check.title', band)}
      </h2>
      <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{bandText(t, 'guide.check.body', band)}</p>

      <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-ludiko-text/70" data-testid={`${testId}-count`}>
        {t('guide.check.progress', { done, total: checks.length })}
      </p>
      <ul className="mt-1 flex flex-wrap gap-2">
        {checks.map((c) => {
          const status = t(`guide.check.status.${c.placement}`)
          return (
            <li key={c.subject}>
              <Link
                to={`/learn/check/${c.subject}`}
                data-testid={`${testId}-${c.subject}`}
                data-state={c.placement}
                aria-label={t('guide.check.subjectAria', { subject: name(c.subject), status })}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-extrabold text-ludiko-text shadow-sm active:scale-95 ${
                  c.placement === 'done' ? 'bg-white/60' : 'bg-white'
                }`}
              >
                <span aria-hidden="true">{subjectEmoji(c.subject)}</span>
                {name(c.subject)}
                <span aria-hidden="true">{ICON[c.placement]}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link
        to={`/learn/check/${next.subject}`}
        data-testid={`${testId}-go`}
        className="mt-3 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-ludiko-green px-4 text-center text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        <span aria-hidden="true">{subjectEmoji(next.subject)}</span>
        {t(next.placement === 'inProgress' ? 'guide.check.resume' : 'guide.check.start', { subject: name(next.subject) })}
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}
