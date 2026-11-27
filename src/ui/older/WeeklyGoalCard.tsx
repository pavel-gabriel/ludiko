import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { bitsThisWeek, getWeeklyGoal, setWeeklyGoal, WEEKLY_GOALS } from '@/older/olderStore'

/**
 * The goal the child sets for the week (3 / 5 / 7 sessions). Progress only ever goes up and a new week starts
 * from zero: nothing is lost, there is no streak to break.
 */
export default function WeeklyGoalCard({ profileId }: { profileId: string }) {
  const { t } = useTranslation()
  const [goal, setGoal] = useState(() => getWeeklyGoal(profileId))
  const [editing, setEditing] = useState(false)
  const done = bitsThisWeek(profileId)
  const choose = (g: number | null) => {
    setWeeklyGoal(profileId, g)
    setGoal(g)
    setEditing(false)
  }
  const picking = goal === null || editing

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" aria-labelledby="weekly-goal-title" data-testid="weekly-goal">
      <h2 id="weekly-goal-title" className="text-lg font-extrabold text-ludiko-text">
        <span aria-hidden="true">🎯 </span>
        {t('older.goal.title')}
      </h2>
      {picking ? (
        <>
          <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('older.goal.body')}</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={t('older.goal.title')}>
            {WEEKLY_GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => choose(g)}
                data-testid={`goal-${g}`}
                aria-pressed={goal === g}
                className={`min-h-[48px] rounded-xl px-1 text-sm font-extrabold text-ludiko-text active:scale-95 ${
                  goal === g ? 'bg-ludiko-green ring-2 ring-ludiko-text/30' : 'bg-ludiko-bg'
                }`}
              >
                {t('older.goal.option', { n: g })}
              </button>
            ))}
          </div>
          {goal !== null && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-ludiko-text underline"
            >
              {t('older.goal.remove')}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-base font-bold text-ludiko-text" data-testid="goal-progress">
            {t('older.goal.progress', { done: Math.min(done, goal), goal })}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={Math.min(done, goal)}
            aria-label={t('older.goal.title')}
            className="mt-2 h-3 overflow-hidden rounded-full bg-ludiko-bg"
          >
            <div className="h-full rounded-full bg-ludiko-green" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
          </div>
          {done >= goal && (
            <p className="mt-2 text-sm font-extrabold text-ludiko-text" data-testid="goal-reached">
              {t('older.goal.reached')}
            </p>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 inline-flex min-h-[44px] items-center text-sm font-bold text-ludiko-text underline"
          >
            {t('older.goal.change')}
          </button>
        </>
      )}
    </section>
  )
}
