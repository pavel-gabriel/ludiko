import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LegalLink from '@/components/legal/LegalLink'
import type { SubjectId } from '@/engine/types'
import type { ParentSummary } from '@/learner'
import { isPushSupported, needsInstall } from '@/services/pushAvailability'
import { isBig } from '@/older/ageBand'
import { formatMark, markFromScore } from '@/older/marks'
import ExamEntryCard from '@/ui/exam/ExamEntryCard'
import FilterChips from '@/ui/common/FilterChips'
import ProgressBar from './ProgressBar'
import { subjectEmoji } from './subjects'

/* Pulls in pushService (and Firebase): only fetched where reminders can work, i.e. configured + supported */
const RemindersCard = lazy(() => import('./RemindersCard'))

interface ParentViewProps {
  profileName: string
  /** Declared grade: II–IV profiles get the national-exam practice card */
  profileGrade?: number
  summary: ParentSummary
  /** Kid-readable skill title for an id */
  titleOf: (skillId: string) => string
  /** The parent confirmed: discard the placement of this subject */
  onRedo: (subject: SubjectId) => void
}

function ConfirmRedo({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const noRef = useRef<HTMLButtonElement>(null)
  useEffect(() => noRef.current?.focus(), [])
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onNo()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => e.key === 'Escape' && onNo()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"
      >
        <div className="text-5xl" aria-hidden="true">🧭</div>
        <h2 id={titleId} className="mt-2 text-2xl font-extrabold text-ludiko-text">{t('learn.parent.redoTitle')}</h2>
        <p className="mt-2 text-base font-semibold text-ludiko-text/80">{t('learn.parent.redoBody')}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            ref={noRef}
            type="button"
            onClick={onNo}
            className="min-h-[52px] rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {t('learn.parent.redoNo')}
          </button>
          <button
            type="button"
            onClick={onYes}
            className="min-h-[48px] rounded-2xl bg-ludiko-orange text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
          >
            {t('learn.parent.redoYes')}
          </button>
        </div>
      </div>
    </div>
  )
}

const section = 'rounded-2xl bg-white p-4 shadow-sm'
const heading = 'text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60'

/** Plain-language weekly summary for adults: level statement, what improved, what is next, one tip. No charts. */
export default function ParentView({ profileName, profileGrade, summary, titleOf, onRedo }: ParentViewProps) {
  const { t, i18n } = useTranslation()
  const [confirm, setConfirm] = useState<SubjectId | null>(null)
  const [only, setOnly] = useState<'all' | SubjectId>('all')
  const shown = summary.subjects.filter((s) => only === 'all' || s.subject === only)
  const en = i18n.language.startsWith('en')
  const big = isBig(profileGrade)
  const pick = (text: { ro: string; en: string }) => (en && text.en) || text.ro

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-ludiko-yellow px-4 py-3 text-center text-sm font-bold text-ludiko-text">
        {t('learn.parent.intro', { name: profileName })}
      </p>

      {big && (
        <p className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-ludiko-text" data-testid="marks-note">
          {t('learn.parent.marksNote')}
        </p>
      )}

      <p className={`${section} text-base font-bold text-ludiko-text`} data-testid="play-days">
        <span aria-hidden="true">🌈 </span>
        {t('learn.parent.playDays', { n: summary.playDaysThisWeek })}
      </p>

      {summary.subjects.length > 2 && (
        <FilterChips
          label={t('filters.subject')}
          options={[
            { value: 'all' as const, label: t('filters.allSubjects') },
            ...summary.subjects.map((s) => ({ value: s.subject, label: t(`learn.subject.${s.subject}`), icon: subjectEmoji(s.subject) })),
          ]}
          value={only}
          onChange={setOnly}
          testId="parent-filter"
        />
      )}

      {shown.map((s) => (
        <section
          key={s.subject}
          className="flex flex-col gap-3 rounded-3xl bg-ludiko-bg p-3 ring-2 ring-white"
          aria-labelledby={`parent-${s.subject}`}
          data-testid={`parent-${s.subject}`}
        >
          <h2 id={`parent-${s.subject}`} className="text-2xl font-extrabold text-ludiko-purple">
            <span aria-hidden="true">{subjectEmoji(s.subject)} </span>
            {t(`learn.subject.${s.subject}`)}
          </h2>

          <div className={section}>
            <h3 className={heading}>{t('learn.parent.level')}</h3>
            {s.placement ? (
              <p className="mt-1 text-lg font-bold leading-snug text-ludiko-text" data-testid="level-statement">
                {pick(s.placement.statement)}
              </p>
            ) : (
              <>
                <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('learn.parent.noPlacement')}</p>
                <Link
                  to={`/learn/check/${s.subject}`}
                  className="mt-3 flex min-h-[48px] items-center justify-center rounded-2xl bg-ludiko-yellow text-base font-extrabold text-ludiko-text shadow-sm"
                >
                  {t('learn.parent.doCheck')}
                </Link>
              </>
            )}
          </div>

          <div className={section}>
            <h3 className={heading}>{t('learn.parent.mastered', { done: s.masteredCount, total: s.totalSkills })}</h3>
            <ProgressBar
              className="mt-2"
              value={s.totalSkills ? s.masteredCount / s.totalSkills : 0}
              label={t('learn.parent.mastered', { done: s.masteredCount, total: s.totalSkills })}
            />
            {big && s.totalSkills > 0 && (
              <p className="mt-2 text-sm font-bold text-ludiko-text" data-testid="parent-mark">
                {t('learn.parent.estimatedMark', { mark: formatMark(markFromScore(s.masteredCount, s.totalSkills) ?? 1, i18n.language) })}
              </p>
            )}
          </div>

          <div className={section}>
            <h3 className={heading}>{t('learn.parent.improved')}</h3>
            {s.improved.length === 0 ? (
              <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('learn.parent.improvedNone')}</p>
            ) : (
              <ul className="mt-1 list-disc pl-5 text-base font-semibold text-ludiko-text" data-testid="improved">
                {s.improved.map((id) => (
                  <li key={id}>{titleOf(id)}</li>
                ))}
              </ul>
            )}
          </div>

          <div className={section}>
            <h3 className={heading}>{t('learn.parent.nextUp')}</h3>
            {s.nextUp.length === 0 ? (
              <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('learn.parent.nextUpNone')}</p>
            ) : (
              <ul className="mt-1 list-disc pl-5 text-base font-semibold text-ludiko-text" data-testid="next-up">
                {s.nextUp.map((id) => (
                  <li key={id}>{titleOf(id)}</li>
                ))}
              </ul>
            )}
          </div>

          {s.placement && (
            <button
              type="button"
              onClick={() => setConfirm(s.subject)}
              className="min-h-[48px] rounded-2xl bg-white text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
            >
              <span aria-hidden="true">🔁 </span>
              {t('learn.parent.redo')}
            </button>
          )}
        </section>
      ))}

      <ExamEntryCard grade={profileGrade} compact />

      {(isPushSupported() || needsInstall()) && (
        <Suspense fallback={null}>
          <RemindersCard />
        </Suspense>
      )}

      <div className={`${section} bg-ludiko-green/60`}>
        <h3 className={heading}>
          <span aria-hidden="true">💡 </span>
          {t('learn.parent.tip')}
        </h3>
        <p className="mt-1 text-base font-bold text-ludiko-text" data-testid="tip">{pick(summary.tip)}</p>
      </div>

      <p className="flex flex-wrap justify-center gap-x-4 text-sm text-ludiko-text">
        <LegalLink to="privacy" className="inline-flex min-h-[44px] items-center font-bold underline">{t('legal.privacyLink')}</LegalLink>
        <LegalLink to="terms" className="inline-flex min-h-[44px] items-center font-bold underline">{t('legal.termsLink')}</LegalLink>
      </p>

      {confirm && (
        <ConfirmRedo
          onNo={() => setConfirm(null)}
          onYes={() => {
            const subject = confirm
            setConfirm(null)
            onRedo(subject)
          }}
        />
      )}
    </div>
  )
}
