import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Confetti from '@/components/ui/Confetti'
import { DESCRIPTOR_THRESHOLDS } from '@/exam/scoring'
import type { AssembledTest, Descriptor, ExamScore } from '@/exam/types'
import { localize } from '@/engine/types'
import { AlbumLink } from '@/ui/album/BonusStickers'
import ProgressBar from '@/ui/learn/ProgressBar'
import { examGradeOf, formatMark } from '@/older/marks'
import MarkCard from '@/ui/older/MarkCard'
import { MascotSvg } from '@/ui/mascot/Mascot'
import type { SessionReward } from '@/ui/session/types'
import { playFinish } from '@/utils/sounds'

export interface ExamResultsProps {
  test: AssembledTest
  score: ExamScore
  reward: SessionReward | null
  overtime: boolean
  /** No child profile: nothing was saved */
  guest: boolean
  /** Kid-readable skill title for an id */
  titleOf: (skillId: string) => string
  onAgain: () => void
  onHome: () => void
}

const DESCRIPTOR_TONE: Record<Descriptor, string> = {
  fb: 'bg-ludiko-green',
  b: 'bg-ludiko-blue',
  s: 'bg-ludiko-yellow',
  i: 'bg-ludiko-orange',
}

const pct = (v: number) => Math.round(v * 100)

/** Practice list is capped so a hard paper does not become a wall of buttons */
const PRACTICE_SHOWN = 6

/**
 * End of an exam simulation. The CHILD sees a celebration only: stars, sticker, a warm line — never a
 * calificativ or a count of mistakes (docs/PLAN.md §6). Everything else is behind "Pentru părinți".
 */
export default function ExamResults({ test, score, reward, overtime, guest, titleOf, onAgain, onHome }: ExamResultsProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [showParents, setShowParents] = useState(false)
  const [allPractice, setAllPractice] = useState(false)
  const panelId = useId()
  useEffect(() => {
    playFinish()
  }, [])

  const unanswered = score.total - score.answered
  const sectionTitle = (id: string) => localize(test.sections.find((s) => s.id === id)?.title, lang)
  const firstPractice = score.practice[0]

  return (
    <div className="flex flex-col gap-4" data-testid="exam-results">
      <Confetti />
      <section className="rounded-3xl bg-white p-6 text-center shadow-md" aria-labelledby="exam-done-title">
        <div className="flex items-end justify-center gap-1" aria-hidden="true">
          <span className="pb-2 text-4xl">🎉</span>
          <MascotSvg mood="cheer" size={120} decorative />
          <span className="pb-2 text-4xl">⭐</span>
        </div>
        <h1 id="exam-done-title" className="mt-3 text-3xl font-extrabold text-ludiko-text">
          {t('exam.results.title')}
        </h1>
        <p className="mt-2 text-xl font-bold text-ludiko-text/80">{t('exam.results.body')}</p>
        {score.stars > 0 && (
          <p className="mt-3 text-4xl" role="img" aria-label={t('exam.results.starsLabel', { n: score.stars })} data-testid="exam-stars">
            {'⭐'.repeat(score.stars)}
          </p>
        )}
        {score.mark !== null && examGradeOf(test.exam) >= 5 && <MarkCard mark={score.mark} className="mt-3" />}
      </section>

      {reward?.sticker && (
        <>
          <div className="flex items-center gap-4 rounded-3xl bg-ludiko-yellow p-4 shadow-md" data-testid="sticker-unlock">
            <span className="text-6xl" aria-hidden="true">{reward.sticker}</span>
            <p className="text-lg font-extrabold text-ludiko-text">{t('exam.results.stickerTitle')}</p>
          </div>
          <div className="flex justify-center">
            <AlbumLink />
          </div>
        </>
      )}

      {firstPractice && (
        <Link
          to={`/practice/${firstPractice.skillId}`}
          className="flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          <span aria-hidden="true">🎮 </span>
          {t('exam.results.toPractice')}
        </Link>
      )}
      <button
        type="button"
        onClick={onAgain}
        className="min-h-[56px] w-full rounded-2xl bg-ludiko-blue text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('exam.results.again')}
      </button>
      <button
        type="button"
        onClick={onHome}
        className="mx-auto inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-bold text-ludiko-text shadow-sm"
      >
        {t('exam.results.home')}
      </button>

      <button
        type="button"
        onClick={() => setShowParents((v) => !v)}
        aria-expanded={showParents}
        aria-controls={panelId}
        className="mx-auto mt-2 inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-bold text-ludiko-text shadow-sm"
        data-testid="exam-parent-toggle"
      >
        <span aria-hidden="true">👨‍👩‍👧 </span>
        {showParents ? t('exam.results.parentHide') : t('exam.results.parentToggle')}
      </button>

      <section
        id={panelId}
        hidden={!showParents}
        aria-label={t('exam.results.parent.title')}
        className={`${showParents ? 'flex' : 'hidden'} flex-col gap-3 rounded-3xl bg-ludiko-bg p-3 ring-2 ring-white`}
        data-testid="exam-parent-panel"
      >
        {showParents && (
          <>
            <h2 className="text-2xl font-extrabold text-ludiko-text">{t('exam.results.parent.title')}</h2>
            <p className="rounded-2xl bg-ludiko-yellow px-4 py-3 text-sm font-bold text-ludiko-text">
              {t('exam.results.parent.disclaimer')}
            </p>

            <div className={`rounded-2xl p-4 shadow-sm ${DESCRIPTOR_TONE[score.descriptor]}`} data-testid="exam-descriptor">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/70">
                {t('exam.results.parent.scoreLabel')}
              </h3>
              <p className="mt-1 text-3xl font-extrabold text-ludiko-text">{t(`exam.descriptor.${score.descriptor}.label`)}</p>
              {score.mark !== null && examGradeOf(test.exam) >= 5 && (
                <div className="mt-2 rounded-xl bg-white/70 px-3 py-2" data-testid="exam-mark">
                  <p className="text-xl font-extrabold text-ludiko-text">
                    {t('exam.results.parent.mark')}: {formatMark(score.mark, lang)}
                  </p>
                  <p className="text-xs font-semibold text-ludiko-text/80">{t('exam.results.parent.markNote')}</p>
                </div>
              )}
              <p className="mt-1 text-base font-bold text-ludiko-text">
                {t('exam.results.parent.score', { correct: score.correct, total: score.total })} ({pct(score.ratio)}%)
              </p>
              <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t(`exam.descriptor.${score.descriptor}.text`)}</p>
              {unanswered > 0 && (
                <p className="mt-2 text-sm font-bold text-ludiko-text">{t('exam.results.parent.unanswered', { n: unanswered })}</p>
              )}
              {overtime && <p className="mt-1 text-sm font-bold text-ludiko-text">{t('exam.results.parent.overtime')}</p>}
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">{t('exam.results.parent.sections')}</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {score.sections.map((s) => (
                  <li key={s.sectionId} data-testid={`exam-section-${s.sectionId}`}>
                    <div className="flex items-baseline justify-between gap-2 text-base font-bold text-ludiko-text">
                      <span className="min-w-0">{sectionTitle(s.sectionId)}</span>
                      <span className="shrink-0">
                        {s.correct}/{s.total}
                      </span>
                    </div>
                    <ProgressBar className="mt-1" value={s.ratio} label={`${sectionTitle(s.sectionId)}: ${s.correct}/${s.total}`} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">{t('exam.results.parent.practiceTitle')}</h3>
              {score.practice.length === 0 ? (
                <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('exam.results.parent.practiceNone')}</p>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('exam.results.parent.practiceBody')}</p>
                  <ul className="mt-2 flex flex-col gap-2" data-testid="exam-practice">
                    {(allPractice ? score.practice : score.practice.slice(0, PRACTICE_SHOWN)).map((p) => (
                      <li key={p.skillId}>
                        <Link
                          to={`/practice/${p.skillId}`}
                          className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-ludiko-blue/40 px-4 py-2 text-base font-bold text-ludiko-text active:scale-95"
                        >
                          <span className="min-w-0">{titleOf(p.skillId)}</span>
                          <span className="shrink-0 text-sm">
                            {t('exam.results.parent.practiceItem', { wrong: p.wrong, total: p.total })}
                            <span aria-hidden="true"> ›</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {score.practice.length > PRACTICE_SHOWN && (
                    <button
                      type="button"
                      onClick={() => setAllPractice((v) => !v)}
                      aria-expanded={allPractice}
                      className="mt-2 min-h-[44px] w-full rounded-2xl bg-white text-sm font-extrabold text-ludiko-text underline"
                    >
                      {allPractice ? t('exam.results.parent.practiceLess') : t('exam.results.parent.practiceMore', { n: score.practice.length })}
                    </button>
                  )}
                </>
              )}
            </div>

            <p className="px-1 text-xs font-semibold text-ludiko-text/70">
              {t('exam.results.parent.thresholds', {
                fb: pct(DESCRIPTOR_THRESHOLDS.fb),
                b: pct(DESCRIPTOR_THRESHOLDS.b),
                s: pct(DESCRIPTOR_THRESHOLDS.s),
              })}
            </p>
            {test.skippedSections.length > 0 && (
              <p className="px-1 text-xs font-semibold text-ludiko-text/70">{t('exam.results.parent.skipped')}</p>
            )}
            <p className="px-1 text-xs font-semibold text-ludiko-text/70">
              {guest ? t('exam.results.parent.guest') : t('exam.results.parent.saved')}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
