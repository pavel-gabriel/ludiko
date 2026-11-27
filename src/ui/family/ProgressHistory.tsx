import { useTranslation } from 'react-i18next'
import { monthChangeMessages, type ProgressHistory as History, type SubjectHistory } from '@/learner/historyModels'
import { subjectEmoji } from '@/ui/learn/subjects'
import { levelLabel, longDate, shortDate } from './format'
import PlayCalendar from './PlayCalendar'
import WeeklyBars from './WeeklyBars'
import './print.css'

const card = 'rounded-2xl bg-white p-4 shadow-sm'
const heading = 'text-sm font-extrabold uppercase tracking-wide text-ludiko-text/60'

function SubjectBlock({ s }: { s: SubjectHistory }) {
  const { t, i18n } = useTranslation()
  const total = s.weeklyMastered.reduce((a, b) => a + b, 0)
  return (
    <section className={card} aria-labelledby={`hist-${s.subject}`} data-testid={`history-${s.subject}`}>
      <h4 id={`hist-${s.subject}`} className="text-xl font-extrabold text-ludiko-purple">
        <span aria-hidden="true">{subjectEmoji(s.subject)} </span>
        {t(`learn.subject.${s.subject}`)}
      </h4>
      <p className="text-sm font-semibold text-ludiko-text/80">
        {t('family.extras.weekly.mastered', { done: s.masteredTotal, total: s.totalSkills })}
      </p>

      <h5 className={`${heading} mt-3`}>{t('family.extras.checks.title')}</h5>
      {s.checks.length === 0 ? (
        <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('family.extras.checks.none')}</p>
      ) : (
        <ol className="mt-1 flex flex-col gap-1 border-l-4 border-ludiko-purple/50 pl-3" data-testid="check-timeline">
          {s.checks.map((c, i) => (
            <li key={`${c.at}-${i}`} className="text-base font-semibold text-ludiko-text">
              {t('family.extras.checks.row', {
                date: shortDate(i18n.language, c.at),
                level: levelLabel(t, c.level),
                gaps: c.missingCount === 0 ? t('family.extras.checks.gapsNone') : t('family.extras.checks.gaps', { count: c.missingCount }),
              })}
            </li>
          ))}
        </ol>
      )}

      {total > 0 && (
        <>
          <h5 className={`${heading} mt-3`}>{t('family.extras.weekly.title')}</h5>
          <WeeklyBars
            values={s.weeklyMastered}
            label={t('family.extras.weekly.chart', { values: s.weeklyMastered.join(', ') })}
          />
        </>
      )}
    </section>
  )
}

interface ProgressHistoryProps {
  history: History
  name: string
  /** Show the print button (default); the page itself prints the same content */
  printable?: boolean
}

/** The parents' progress history: month in words, weekly progress, level-check timelines, play days, time */
export default function ProgressHistoryView({ history, name, printable = true }: ProgressHistoryProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const messages = monthChangeMessages(history.month)
  const weeklyTotal = history.weeklyMastered.reduce((a, b) => a + b, 0)
  // subjects with something to tell: a check, progress or at least one mastered island
  const shown = history.subjects.filter((s) => s.checks.length > 0 || s.masteredTotal > 0)
  const perDay = history.practice.daysCounted ? Math.round(history.practice.totalMinutes / history.practice.daysCounted) : 0

  const mapMessage = (m: (typeof messages)[number]) => {
    const vars = { ...m.vars }
    if (typeof vars.subject === 'string') vars.subject = t(`learn.subject.${vars.subject}`)
    return t(`family.extras.month.${m.key}`, vars)
  }

  return (
    <div className="family-print flex flex-col gap-4" data-testid="progress-history">
      <div className="family-print-only">
        <h1 style={{ fontSize: '20pt', fontWeight: 800 }}>{t('family.extras.history.printTitle', { name })}</h1>
        <p>{t('family.extras.history.printedOn', { date: longDate(lang, history.now) })}</p>
      </div>

      <section className={card} aria-labelledby="hist-month" data-testid="history-month">
        <h3 id="hist-month" className={heading}>
          {t('family.extras.month.title')}
        </h3>
        <ul className="mt-1 list-disc pl-5 text-base font-semibold text-ludiko-text">
          {messages.map((m, i) => (
            <li key={i}>{mapMessage(m)}</li>
          ))}
        </ul>
      </section>

      <section className={card} aria-labelledby="hist-weekly" data-testid="history-weekly">
        <h3 id="hist-weekly" className={heading}>
          {t('family.extras.weekly.title')}
        </h3>
        <p className="text-sm font-semibold text-ludiko-text/80">{t('family.extras.weekly.desc')}</p>
        <div className="mt-2">
          <WeeklyBars
            values={history.weeklyMastered}
            label={t('family.extras.weekly.chart', { values: history.weeklyMastered.join(', ') })}
          />
        </div>
        <p className="mt-1 text-base font-bold text-ludiko-text">{t('family.extras.weekly.total', { count: weeklyTotal })}</p>
      </section>

      {shown.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className={heading}>{t('family.extras.weekly.subjectTitle')}</h3>
          {shown.map((s) => (
            <SubjectBlock key={s.subject} s={s} />
          ))}
        </div>
      )}

      <section className={card} aria-labelledby="hist-days" data-testid="history-days">
        <h3 id="hist-days" className={heading}>
          {t('family.extras.calendar.title')}
        </h3>
        <p className="mb-2 text-sm font-semibold text-ludiko-text/80">{t('family.extras.calendar.desc')}</p>
        <PlayCalendar weeks={history.calendar} />
        <p className="mt-2 text-base font-bold text-ludiko-text">
          {t('family.extras.calendar.total', { count: history.playDaysInCalendar })}
        </p>
      </section>

      <section className={card} aria-labelledby="hist-time" data-testid="history-time">
        <h3 id="hist-time" className={heading}>
          {t('family.extras.practice.title')}
        </h3>
        <p className="mt-1 text-base font-bold text-ludiko-text">
          {t('family.extras.practice.total', { count: history.practice.totalMinutes })}
        </p>
        {perDay > 0 && <p className="text-sm font-semibold text-ludiko-text/80">{t('family.extras.practice.perDay', { count: perDay })}</p>}
        <div className="mt-2">
          <WeeklyBars
            values={history.practice.weeklyMinutes}
            color="#2F7FA8"
            label={t('family.extras.practice.chart', { values: history.practice.weeklyMinutes.join(', ') })}
          />
        </div>
        <p className="mt-1 text-xs font-semibold text-ludiko-text/70">{t('family.extras.practice.note')}</p>
      </section>

      <p className="text-xs font-semibold text-ludiko-text/70">{t('family.extras.history.intro')}</p>

      {printable && (
        <div className="family-noprint flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="print-history"
            className="min-h-[48px] w-full rounded-2xl bg-ludiko-yellow px-4 text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
          >
            <span aria-hidden="true">🖨️ </span>
            {t('family.extras.history.print')}
          </button>
          <p className="text-center text-xs font-semibold text-ludiko-text/70">{t('family.extras.history.printHint')}</p>
        </div>
      )}
    </div>
  )
}
