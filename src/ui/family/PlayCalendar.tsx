import { useTranslation } from 'react-i18next'
import type { CalendarDay } from '@/learner/historyModels'
import { shortDate } from './format'

const LEVEL_CLASS = ['bg-ludiko-bg ring-1 ring-black/10', 'bg-ludiko-green/70', 'bg-ludiko-green', 'bg-ludiko-blue'] as const

/** Heat-map of play days: one row per week (Monday first), shade = how much was done that day */
export default function PlayCalendar({ weeks }: { weeks: CalendarDay[][] }) {
  const { t, i18n } = useTranslation()
  const days = t('family.extras.calendar.days', { returnObjects: true }) as unknown as string[]
  return (
    <div role="group" aria-label={t('family.extras.calendar.label')} data-testid="play-calendar">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ludiko-text/70" aria-hidden="true">
        {days.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ul className="mt-1 flex flex-col gap-1">
        {weeks.map((week, w) => (
          <li key={w} className="grid grid-cols-7 gap-1">
            {week.map((c) => {
              const state = c.future ? t('family.extras.calendar.state.future') : t(`family.extras.calendar.state.${c.level}`)
              return (
                <span
                  key={c.day}
                  role="img"
                  aria-label={t('family.extras.calendar.cell', { date: shortDate(i18n.language, c.day), state })}
                  data-level={c.future ? 'future' : c.level}
                  className={`h-7 rounded-md ${c.future ? 'border border-dashed border-black/10' : LEVEL_CLASS[c.level]}`}
                />
              )
            })}
          </li>
        ))}
      </ul>
    </div>
  )
}
