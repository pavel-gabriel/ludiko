import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { SubjectId } from '@/engine/types'
import type { AssignmentBit } from '@/learner'
import { MascotSvg } from '@/ui/mascot/Mascot'
import ExamEntryCard from '@/ui/exam/ExamEntryCard'
import AssignmentCard from './AssignmentCard'
import BitTiles, { type HomeBit } from './BitTiles'
import ProgressBar from './ProgressBar'
import { subjectEmoji } from './subjects'

export interface SubjectHome {
  subject: SubjectId
  placement: 'none' | 'inProgress' | 'done'
  /** Today's bits (a slice of the mission), once the placement is done */
  bits?: HomeBit[]
  /** Today's mission, once the placement is done */
  mission?: { done: number; total: number; minutes: number; complete: boolean }
}

export interface LearnHomeViewProps {
  profile: { nickname: string; avatar: string; grade?: number }
  stars: number
  playDays: number
  subjects: SubjectHome[]
  /** Assignments from the child's class (docs/CLASSROOM.md), shown as an extra bit; absent without a class link */
  assignments?: AssignmentBit[]
  /** Stickers in the album (the chip shows it); absent in fixtures */
  stickerCount?: number
}

/** "N zile de joacă" with the language's own plural form; zero is an invitation, never a reset message */
function streakText(t: TFunction, lang: string, n: number): string {
  if (n <= 0) return t('learn.streak.zero')
  const category = new Intl.PluralRules(lang).select(n)
  const key = ['one', 'few'].includes(category) ? category : 'other'
  return t(`learn.streak.${key}`, { n })
}

const card =
  'flex w-full items-center gap-4 rounded-3xl p-4 text-left shadow-md transition-transform active:scale-95 min-h-[112px]'

function BigCard({ to, tone, icon, children, testId }: { to: string; tone: string; icon: string; children: ReactNode; testId?: string }) {
  return (
    <Link to={to} className={`${card} ${tone}`} data-testid={testId}>
      <span className="text-5xl" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </Link>
  )
}

/** The learner's front door: greeting, stars, gentle streak, and one big card per thing to do */
export default function LearnHomeView({ profile, stars, playDays, subjects, assignments, stickerCount }: LearnHomeViewProps) {
  const { t, i18n } = useTranslation()
  const streak = streakText(t, i18n.language, playDays)
  const multi = subjects.length > 1

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ludiko-purple text-3xl" aria-hidden="true">
          {profile.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold leading-tight text-ludiko-text">
            {t('learn.greeting', { name: profile.nickname })}
          </h1>
          <p className="text-sm font-semibold text-ludiko-text/70">{t('learn.greetingSub')}</p>
        </div>
        <MascotSvg mood="wave" size={72} className="-my-2 shrink-0" label={t('mascot.label.wave')} />
      </header>

      <div className="flex flex-wrap gap-2" data-testid="learn-chips">
        <span className="rounded-full bg-ludiko-yellow px-4 py-2 text-sm font-extrabold text-ludiko-text shadow-sm">
          <span aria-hidden="true">⭐ </span>
          {t('learn.starsLabel', { n: stars })}
        </span>
        <span className="rounded-full bg-ludiko-pink px-4 py-2 text-sm font-extrabold text-ludiko-text shadow-sm" data-testid="streak">
          <span aria-hidden="true">🌈 </span>
          {streak}
        </span>
        <Link
          to="/learn/album"
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-ludiko-purple px-4 py-2 text-sm font-extrabold text-ludiko-text shadow-sm"
          data-testid="link-album"
        >
          <span aria-hidden="true">🎨 </span>
          {t('album.homeChip')}
          {stickerCount !== undefined && <span className="ml-1 rounded-full bg-white/70 px-2 text-xs">{stickerCount}</span>}
        </Link>
      </div>

      {assignments && assignments.length > 0 && <AssignmentCard assignments={assignments} />}

      {subjects.map((s) => (
        <section key={s.subject} className="flex flex-col gap-3" aria-label={t(`learn.subject.${s.subject}`)}>
          {multi && (
            <h2 className="text-xl font-extrabold text-ludiko-purple">
              <span aria-hidden="true">{subjectEmoji(s.subject)} </span>
              {t(`learn.subject.${s.subject}`)}
            </h2>
          )}

          {s.placement === 'done' ? (
            s.bits && s.bits.length > 0 ? (
              <BitTiles subject={s.subject} bits={s.bits} />
            ) : (
              <BigCard to={`/learn/mission/${s.subject}`} tone="bg-ludiko-green" icon="🗺️" testId="card-mission">
                <span className="block text-xl font-extrabold text-ludiko-text">{t('learn.home.missionTitle')}</span>
                <span className="block text-sm font-semibold text-ludiko-text/80">
                  {s.mission ? t('learn.home.missionBody', { min: s.mission.minutes }) : t('learn.home.missionPreparing')}
                </span>
                {s.mission && s.mission.done > 0 && (
                  <>
                    <span className="mt-1 block text-sm font-bold text-ludiko-text">
                      {t('learn.home.missionProgress', { done: s.mission.done, total: s.mission.total })}
                    </span>
                    <ProgressBar
                      className="mt-1"
                      value={s.mission.total ? s.mission.done / s.mission.total : 0}
                      label={t('learn.home.missionProgress', { done: s.mission.done, total: s.mission.total })}
                    />
                  </>
                )}
              </BigCard>
            )
          ) : (
            <BigCard to={`/learn/check/${s.subject}`} tone="bg-ludiko-yellow ring-2 ring-ludiko-orange" icon="🧭" testId="card-check">
              <span className="block text-xl font-extrabold text-ludiko-text">{t('learn.home.checkTitle')}</span>
              <span className="block text-sm font-semibold text-ludiko-text/80">
                {s.placement === 'inProgress' ? t('learn.home.checkResumeBody') : t('learn.home.checkBody')}
              </span>
              <span className="mt-2 inline-block rounded-full bg-white px-4 py-1 text-sm font-extrabold text-ludiko-text">
                {s.placement === 'inProgress' ? t('learn.home.checkResumeCta') : t('learn.home.checkCta')}
              </span>
            </BigCard>
          )}

          <BigCard to={`/learn/map/${s.subject}`} tone="bg-ludiko-blue" icon="🏝️" testId="card-map">
            <span className="block text-xl font-extrabold text-ludiko-text">{t('learn.home.mapTitle')}</span>
            <span className="block text-sm font-semibold text-ludiko-text/80">{t('learn.home.mapBody')}</span>
          </BigCard>
        </section>
      ))}

      <ExamEntryCard grade={profile.grade} />

      <Link
        to="/learn/parent"
        className="mx-auto mt-2 inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-sm font-bold text-ludiko-text shadow-sm"
        data-testid="link-parents"
      >
        <span aria-hidden="true">👨‍👩‍👧 </span>
        {t('learn.home.parents')}
      </Link>
    </div>
  )
}
