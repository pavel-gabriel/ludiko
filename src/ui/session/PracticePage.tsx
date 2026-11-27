import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getExplanation, getSkill } from '@/engine/content/registry'
import { isBig } from '@/older/ageBand'
import { recordBitDone } from '@/older/olderStore'
import { localize, type Item, type Skill } from '@/engine/types'
import { getSessionItems } from './itemSource'
import SessionResults from './SessionResults'
import SessionRunner from './SessionRunner'
import type { SessionMode, SessionSummary } from './types'
import { useSessionProgress } from './useSessionProgress'

const PRACTICE_COUNT = 8
const SPRINT_COUNT = 20

/** `?n=10` sets the length of a check (the self-chosen test of grades V–VIII) */
function parseCount(raw: string | null): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null
}

function itemsFor(skill: Skill, mode: SessionMode, checkCount: number | null = null): Item[] {
  const count = mode === 'sprint' ? SPRINT_COUNT : mode === 'check' ? (checkCount ?? skill.masteryCheck.items) : PRACTICE_COUNT
  return getSessionItems(skill, count)
}

function parseMode(raw: string | null): SessionMode | null {
  return raw === 'practice' || raw === 'sprint' || raw === 'check' ? raw : null
}

/** /practice/:skillId — pick a mode, run a session, see the results. `?mode=` skips the picker. */
export default function PracticePage() {
  const { skillId = '' } = useParams()
  const [params] = useSearchParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const skill = getSkill(skillId)
  const progress = useSessionProgress()
  const resetReward = progress.reset

  const checkCount = parseCount(params.get('n'))
  const [mode, setMode] = useState<SessionMode | null>(() => parseMode(params.get('mode')))
  const [items, setItems] = useState<Item[] | null>(() => {
    const initial = parseMode(params.get('mode'))
    return initial && skill ? itemsFor(skill, initial, checkCount) : null
  })
  const [runId, setRunId] = useState(0)
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  const start = useCallback(
    (m: SessionMode) => {
      if (!skill) return
      setItems(itemsFor(skill, m, checkCount))
      setMode(m)
      setSummary(null)
      setRunId((n) => n + 1)
      resetReward()
    },
    [skill, resetReward, checkCount],
  )

  const explanationFor = useCallback(
    (id: string) => {
      const direct = getExplanation(id)
      if (direct) return direct
      // runner passes the skill id when an item has no explanationId of its own
      const first = skill?.id === id ? skill.explanations[0] : undefined
      return first ? getExplanation(first) : undefined
    },
    [skill],
  )

  const backToList = () => navigate(progress.profile && isBig(progress.profile.grade) ? '/learn' : '/practice')

  if (!skill) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-6xl" aria-hidden="true">🔎</div>
        <p className="text-xl font-extrabold text-ludiko-text">{t('session.skillMissing')}</p>
        <Link to="/practice" className="rounded-2xl bg-ludiko-blue px-6 py-3 text-lg font-extrabold shadow-md">
          {t('session.back')}
        </Link>
      </main>
    )
  }

  /* ---------- results ---------- */
  if (summary) {
    return (
      <SessionResults
        summary={summary}
        reward={progress.reward}
        isGuest={progress.isGuest}
        profile={progress.profile}
        onAgain={() => start(summary.mode)}
        onDone={backToList}
      />
    )
  }

  /* ---------- running ---------- */
  if (mode && items) {
    return (
      <SessionRunner
        key={runId}
        items={items}
        mode={mode}
        title={localize(skill.title, i18n.language)}
        getExplanation={explanationFor}
        onAttempt={progress.onAttempt}
        onFinish={(s) => {
          setSummary(s)
          if (s.completed && progress.profile) recordBitDone(progress.profile.id)
          progress.onFinish(s)
        }}
        onExit={backToList}
      />
    )
  }

  /* ---------- mode picker ---------- */
  const hasItems = getSessionItems(skill, 1).length > 0
  const modeCard = 'flex min-h-[110px] w-full items-center gap-4 rounded-3xl p-4 text-left shadow-md active:scale-95 transition-transform'

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-10 pt-4">
      <Link to="/practice" className="inline-flex min-h-[44px] items-center text-sm font-bold underline">
        ← {t('session.back')}
      </Link>

      <header className="mt-2 text-center">
        <h1 className="text-2xl font-extrabold leading-snug text-ludiko-text">{localize(skill.title, i18n.language)}</h1>
        <p className="mt-1 text-sm font-semibold text-ludiko-text/70">
          {t('profiles.gradeLabels.' + skill.grade)}
        </p>
      </header>

      {progress.profile ? (
        <p className="mx-auto mt-3 w-fit rounded-full bg-white px-4 py-1 text-sm font-bold shadow-sm">
          <span aria-hidden="true">{progress.profile.avatar} </span>
          {t('session.playingAs', { name: progress.profile.nickname })}
        </p>
      ) : (
        progress.isGuest && (
          <p className="mt-3 rounded-2xl bg-ludiko-orange/60 px-4 py-3 text-center text-sm font-semibold">
            {t('session.guestNote')}{' '}
            <Link to="/profiles" className="font-extrabold underline">
              {t('session.pickProfile')}
            </Link>
          </p>
        )
      )}

      {hasItems ? (
        <section className="mt-5 flex flex-col gap-4" aria-label={t('session.pickMode')}>
          <h2 className="text-center text-lg font-extrabold">{t('session.pickMode')}</h2>
          <button type="button" onClick={() => start('practice')} className={`${modeCard} bg-ludiko-green`}>
            <span className="text-5xl" aria-hidden="true">🌱</span>
            <span>
              <span className="block text-xl font-extrabold text-ludiko-text">{t('session.mode.practice')}</span>
              <span className="block text-sm font-semibold text-ludiko-text/80">{t('session.practiceDesc')}</span>
            </span>
          </button>
          <button type="button" onClick={() => start('sprint')} className={`${modeCard} bg-ludiko-yellow`}>
            <span className="text-5xl" aria-hidden="true">⚡</span>
            <span>
              <span className="block text-xl font-extrabold text-ludiko-text">{t('session.mode.sprint')}</span>
              <span className="block text-sm font-semibold text-ludiko-text/80">{t('session.sprintDesc')}</span>
            </span>
          </button>
        </section>
      ) : (
        <p className="mt-8 rounded-3xl bg-white p-6 text-center text-lg font-bold shadow-md">
          <span className="block text-5xl" aria-hidden="true">🌱</span>
          {t('session.empty')}
        </p>
      )}
    </main>
  )
}
