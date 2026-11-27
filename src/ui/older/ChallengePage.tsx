import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { getAllSkills } from '@/engine/content/registry'
import type { Item, SkillState } from '@/engine/types'
import { CHALLENGE_ITEMS, pickChallengeSkills } from '@/older/challenge'
import { markFromScore } from '@/older/marks'
import { getShowMascot, noteChallengeMark, recordBitDone } from '@/older/olderStore'
import { getProgress } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'
import { MascotSvg } from '@/ui/mascot/Mascot'
import LearnShell, { LearnLoading } from '@/ui/learn/LearnShell'
import RequireProfile from '@/ui/learn/RequireProfile'
import { getSessionItems, skillHasItems } from '@/ui/session/itemSource'
import SessionRunner from '@/ui/session/SessionRunner'
import type { SessionSummary } from '@/ui/session/types'
import { useSessionProgress } from '@/ui/session/useSessionProgress'
import MarkCard from './MarkCard'

/** 5 items, one per skill from different subjects (skills repeat only when there are fewer than 5 playable) */
async function buildChallenge(profile: ChildProfile): Promise<Item[]> {
  const states: Record<string, SkillState | undefined> = {}
  try {
    const progress = await getProgress(profile.id)
    for (const [id, p] of Object.entries(progress.skills)) states[id] = p.state
  } catch {
    /* no progress yet: grade-level skills fill in */
  }
  const playable = getAllSkills().filter(skillHasItems)
  const skills = pickChallengeSkills(playable, states, profile.grade, CHALLENGE_ITEMS)
  if (skills.length === 0) return []
  const wanted = new Map<string, number>()
  for (let i = 0; i < CHALLENGE_ITEMS; i++) {
    const s = skills[i % skills.length]
    wanted.set(s.id, (wanted.get(s.id) ?? 0) + 1)
  }
  const pools = skills.map((s) => getSessionItems(s, wanted.get(s.id) ?? 0))
  const out: Item[] = []
  for (let round = 0; out.length < CHALLENGE_ITEMS; round++) {
    let added = false
    for (const p of pools) if (p[round] && out.length < CHALLENGE_ITEMS) (out.push(p[round]), (added = true))
    if (!added) break
  }
  return out
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Elapsed time, counting up (never a countdown: it measures, it does not rush) */
function Chrono() {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setMs(Date.now() - start), 500)
    return () => clearInterval(id)
  }, [])
  return (
    <p
      className="fixed right-3 top-3 z-40 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-ludiko-text shadow-md"
      data-testid="challenge-chrono"
      aria-hidden="true"
    >
      ⏱ {clock(ms)}
    </p>
  )
}

type Phase = { name: 'intro' } | { name: 'loading' } | { name: 'empty' } | { name: 'run'; items: Item[]; id: number } | { name: 'done'; summary: SessionSummary; timed: boolean; newBest: boolean }

function Challenge({ profile }: { profile: ChildProfile }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const progress = useSessionProgress()
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [timed, setTimed] = useState(false)
  const showMascot = getShowMascot(profile.id)

  const start = useCallback(async () => {
    setPhase({ name: 'loading' })
    progress.reset()
    const items = await buildChallenge(profile).catch(() => [])
    if (items.length === 0) return setPhase({ name: 'empty' })
    setPhase({ name: 'run', items, id: Date.now() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  if (phase.name === 'loading') return <LearnLoading />

  if (phase.name === 'run') {
    return (
      <>
        {timed && <Chrono />}
        <SessionRunner
          key={phase.id}
          items={phase.items}
          mode="check"
          title={t('older.challenge.sessionTitle')}
          onAttempt={progress.onAttempt}
          onFinish={(summary) => {
            if (!summary.completed) return navigate('/learn')
            progress.onFinish(summary)
            recordBitDone(profile.id)
            const mark = markFromScore(summary.correct, summary.total)
            const newBest = mark !== null && noteChallengeMark(profile.id, mark)
            setPhase({ name: 'done', summary, timed, newBest })
          }}
          onExit={() => navigate('/learn')}
        />
      </>
    )
  }

  if (phase.name === 'done') {
    const { summary } = phase
    const mark = markFromScore(summary.correct, summary.total)
    return (
      <LearnShell>
        <section className="rounded-3xl bg-white p-6 text-center shadow-md" aria-labelledby="challenge-done" data-testid="challenge-done">
          {showMascot && (
            <div className="flex justify-center">
              <MascotSvg mood={summary.stars >= 2 ? 'cheer' : 'encourage'} size={88} decorative />
            </div>
          )}
          <div className="flex justify-center gap-2 text-4xl" role="img" aria-label={t('session.results.starsLabel', { n: summary.stars })}>
            {[1, 2, 3].map((n) => (
              <span key={n} className={n <= summary.stars ? '' : 'opacity-25 grayscale'} aria-hidden="true">⭐</span>
            ))}
          </div>
          <h1 id="challenge-done" className="mt-3 text-2xl font-extrabold text-ludiko-text">{t('older.challenge.resultTitle')}</h1>
          <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('session.results.score', { correct: summary.correct, total: summary.total })}</p>
          {mark !== null && <MarkCard mark={mark} className="mt-3" />}
          {phase.timed && (
            <p className="mt-2 text-sm font-bold text-ludiko-text" data-testid="challenge-time">
              {t('older.challenge.time', { time: clock(summary.durationMs) })}
            </p>
          )}
          {phase.newBest && <p className="mt-2 text-sm font-extrabold text-ludiko-text" data-testid="challenge-newbest">{t('older.challenge.newBest')}</p>}
        </section>
        <div className="mt-4 flex flex-col gap-3">
          <button type="button" onClick={() => void start()} className="min-h-[56px] rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95">
            {t('older.challenge.again')}
          </button>
          <Link to="/learn" className="flex min-h-[52px] items-center justify-center rounded-2xl bg-ludiko-blue text-base font-extrabold text-ludiko-text shadow-md">
            {t('older.challenge.home')}
          </Link>
        </div>
      </LearnShell>
    )
  }

  return (
    <LearnShell backTo="/learn" backLabel={t('learn.back')}>
      <section className="rounded-3xl bg-white p-5 shadow-md" data-testid="challenge-intro">
        <h1 className="text-2xl font-extrabold text-ludiko-text">
          <span aria-hidden="true">🏁 </span>
          {t('older.challenge.title')}
        </h1>
        <p className="mt-1 text-base font-semibold text-ludiko-text/80">{t('older.challenge.body')}</p>
        {phase.name === 'empty' && (
          <p role="status" className="mt-3 rounded-xl bg-ludiko-yellow px-3 py-2 text-sm font-bold text-ludiko-text">{t('older.challenge.empty')}</p>
        )}
        <label className="mt-4 flex min-h-[48px] items-center gap-3 text-base font-bold text-ludiko-text">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
            data-testid="challenge-timer-toggle"
            className="h-6 w-6"
          />
          <span>
            {t('older.challenge.timer')}
            <span className="block text-xs font-semibold text-ludiko-text/70">{t('older.challenge.timerHint')}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => void start()}
          data-testid="challenge-start"
          className="mt-4 min-h-[56px] w-full rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('older.challenge.cta')}
        </button>
        <p className="mt-2 text-center text-xs font-semibold text-ludiko-text/70">{t('older.mark.disclaimer')}</p>
      </section>
    </LearnShell>
  )
}

/** /learn/challenge — "Provocarea zilei": 5 mixed items, an estimated mark, best of the week (this device only) */
export default function ChallengePage() {
  return <RequireProfile>{(profile) => <Challenge profile={profile} />}</RequireProfile>
}
