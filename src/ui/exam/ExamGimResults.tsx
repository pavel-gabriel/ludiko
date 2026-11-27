import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Confetti from '@/components/ui/Confetti'
import type { GimScore } from '@/exam/gimScoring'
import type { AssembledTest } from '@/exam/types'
import { localize } from '@/engine/types'
import { formatMark } from '@/older/marks'
import { AlbumLink } from '@/ui/album/BonusStickers'
import ProgressBar from '@/ui/learn/ProgressBar'
import type { SessionReward } from '@/ui/session/types'
import { playFinish } from '@/utils/sounds'

export interface ExamGimResultsProps {
  test: AssembledTest
  score: GimScore
  reward: SessionReward | null
  overtime: boolean
  titleOf: (skillId: string) => string
  onAgain: () => void
  onHome: () => void
}

const PRACTICE_SHOWN = 6
const fmt = (n: number) => String(Math.round(n * 10) / 10)

/**
 * End of a gimnaziu simulation. Older kids see their result straight away: an estimated mark for EN VIII
 * ("Nota estimată: 8,50 — estimativă, nu e notă oficială") or a percentage for EN VI (no official mark).
 * Calm tone: no red, no "fail" wording. Per-part and per-competence feedback follow.
 */
export default function ExamGimResults({ test, score, reward, overtime, titleOf, onAgain, onHome }: ExamGimResultsProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  useEffect(() => {
    playFinish()
  }, [])
  const sectionTitle = (id: string) => localize(test.sections.find((s) => s.id === id)?.title, lang)
  const unanswered = score.total - score.answered
  const practice = score.practice.slice(0, PRACTICE_SHOWN)

  return (
    <div className="flex flex-col gap-4" data-testid="exam-gim-results">
      <Confetti />
      <section className="rounded-3xl bg-white p-6 text-center shadow-md" aria-labelledby="gim-done-title">
        <h1 id="gim-done-title" className="text-2xl font-extrabold text-ludiko-text">{t('examGim.results.title')}</h1>
        <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('examGim.results.body')}</p>
        {score.stars > 0 && (
          <p className="mt-2 text-3xl" role="img" aria-label={t('examGim.results.starsLabel', { n: score.stars })}>
            {'⭐'.repeat(score.stars)}
          </p>
        )}
        {score.markApplies && score.mark !== null ? (
          <div className="mt-3 rounded-2xl bg-ludiko-bg px-4 py-3" data-testid="gim-mark">
            <p className="text-3xl font-extrabold text-ludiko-text">{t('examGim.results.mark', { mark: formatMark(score.mark, lang) })}</p>
            <p className="mt-1 text-sm font-semibold text-ludiko-text/70">{t('examGim.results.markNote')}</p>
          </div>
        ) : (
          <div className="mt-3 rounded-2xl bg-ludiko-bg px-4 py-3" data-testid="gim-percent">
            <p className="text-3xl font-extrabold text-ludiko-text">{t('examGim.results.noMark', { percent: score.percent })}</p>
            <p className="mt-1 text-sm font-semibold text-ludiko-text/70">{t('examGim.results.noMarkNote')}</p>
          </div>
        )}
        <p className="mt-2 text-base font-bold text-ludiko-text">
          {t('examGim.results.points', { points: fmt(score.points), max: score.maxPoints })} ({score.percent}%)
        </p>
        {unanswered > 0 && <p className="mt-1 text-sm font-bold text-ludiko-text">{t('examGim.results.unanswered', { n: unanswered })}</p>}
        {overtime && <p className="mt-1 text-sm font-bold text-ludiko-text">{t('examGim.results.overtime')}</p>}
      </section>

      {reward?.sticker && (
        <>
          <div className="flex items-center gap-4 rounded-3xl bg-ludiko-yellow p-4 shadow-md" data-testid="sticker-unlock">
            <span className="text-5xl" aria-hidden="true">{reward.sticker}</span>
            <p className="text-lg font-extrabold text-ludiko-text">{t('exam.results.stickerTitle')}</p>
          </div>
          <div className="flex justify-center">
            <AlbumLink />
          </div>
        </>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="gim-competences">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">{t('examGim.results.competences')}</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {score.competences.map((c) => (
            <li key={c.competence} data-testid={`gim-comp-${c.competence}`}>
              <div className="flex items-baseline justify-between gap-2 text-base font-bold text-ludiko-text">
                <span className="min-w-0">{t(`examGim.comp.${c.competence}`)}</span>
                <span className="shrink-0">{fmt(c.points)}/{c.max}</span>
              </div>
              <ProgressBar className="mt-1" value={c.ratio} label={`${t(`examGim.comp.${c.competence}`)}: ${fmt(c.points)}/${c.max}`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="gim-sections">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">{t('examGim.results.sections')}</h2>
        <ul className="mt-2 flex flex-col gap-3">
          {score.sectionPoints.map((s) => (
            <li key={s.sectionId}>
              <div className="flex items-baseline justify-between gap-2 text-base font-bold text-ludiko-text">
                <span className="min-w-0">{sectionTitle(s.sectionId)}</span>
                <span className="shrink-0">{fmt(s.points)}/{s.max}</span>
              </div>
              <ProgressBar className="mt-1" value={s.ratio} label={`${sectionTitle(s.sectionId)}: ${fmt(s.points)}/${s.max}`} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60">{t('examGim.results.practiceTitle')}</h2>
        {practice.length === 0 ? (
          <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('examGim.results.practiceNone')}</p>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('examGim.results.practiceBody')}</p>
            <ul className="mt-2 flex flex-col gap-2" data-testid="gim-practice">
              {practice.map((p) => (
                <li key={p.skillId}>
                  <Link
                    to={`/practice/${p.skillId}`}
                    className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl bg-ludiko-blue/40 px-4 py-2 text-base font-bold text-ludiko-text active:scale-95"
                  >
                    <span className="min-w-0">{titleOf(p.skillId)}</span>
                    <span className="shrink-0 text-sm">
                      {t('examGim.results.practiceItem', { wrong: p.wrong, total: p.total })}
                      <span aria-hidden="true"> ›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="px-1 text-xs font-semibold text-ludiko-text/70">{t('examGim.results.todo')}</p>
      <p className="px-1 text-xs font-semibold text-ludiko-text/70">{t('examGim.results.saved')}</p>

      {score.practice[0] && (
        <Link
          to={`/practice/${score.practice[0].skillId}`}
          className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('examGim.results.toPractice')}
        </Link>
      )}
      <button
        type="button"
        onClick={onAgain}
        className="min-h-[52px] w-full rounded-2xl bg-ludiko-blue text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
      >
        {t('examGim.results.again')}
      </button>
      <button
        type="button"
        onClick={onHome}
        className="mx-auto inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-bold text-ludiko-text shadow-sm"
      >
        {t('examGim.results.home')}
      </button>
    </div>
  )
}
