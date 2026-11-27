import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { SubjectId } from '@/engine/types'
import type { AssignmentBit, PlanBit } from '@/learner'
import { isBig } from '@/older/ageBand'
import { getShowMascot, setShowMascot } from '@/older/olderStore'
import { MascotSvg } from '@/ui/mascot/Mascot'
import ChallengeCard from '@/ui/older/ChallengeCard'
import ChoosePanel from '@/ui/older/ChoosePanel'
import WeeklyGoalCard from '@/ui/older/WeeklyGoalCard'
import ExamEntryCard from '@/ui/exam/ExamEntryCard'
import CoachMarks, { type CoachStep } from '@/ui/guide/CoachMarks'
import GuideButton from '@/ui/guide/GuideButton'
import { ageBand, bandText } from '@/ui/guide/guideStore'
import { useFirstRunGuide } from '@/ui/guide/useFirstRunGuide'
import AssignmentCard from './AssignmentCard'
import BitTiles from './BitTiles'
import CheckProgressCard from './CheckProgressCard'
import { subjectEmoji } from './subjects'

export interface SubjectHome {
  subject: SubjectId
  placement: 'none' | 'inProgress' | 'done'
}

export interface LockedSubject {
  subject: SubjectId
  /** Grade the subject's content starts at */
  minGrade: number
}

export interface LearnHomeViewProps {
  profile: { id?: string; nickname: string; avatar: string; grade?: number }
  stars: number
  playDays: number
  /** Today's plan across subjects (Biții de azi); absent when it could not be prepared */
  plan?: PlanBit[]
  /** Subjects the child's grade has content for, for "Toate materiile" */
  subjects: SubjectHome[]
  /**
   * Subjects the "Hai să vedem ce știi" card tracks (checkSubjects), with their check state; the card shows
   * while one is not done. Absent: no card.
   */
  checks?: SubjectHome[]
  /** Subjects that start in a later grade: a small non-clickable teaser */
  locked?: LockedSubject[]
  /** A subject the child tried to open that has nothing for their grade yet (friendly note) */
  lockedNote?: LockedSubject
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

/** "De la clasa a IV-a": the grade a teaser row starts at, in the child's language */
function gradeFrom(t: TFunction, grade: number): string {
  return t(`learn.locked.grades.${grade}`)
}

/** One row of "Toate materiile": the subject's check or mission, and its map */
function SubjectRow({ s }: { s: SubjectHome }) {
  const { t } = useTranslation()
  const done = s.placement === 'done'
  return (
    <li className="rounded-2xl bg-white p-3 shadow-sm" data-testid={`subject-${s.subject}`}>
      <h3 className="text-lg font-extrabold text-ludiko-purple">
        <span aria-hidden="true">{subjectEmoji(s.subject)} </span>
        {t(`learn.subject.${s.subject}`)}
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {done ? (
          <Link
            to={`/learn/mission/${s.subject}`}
            data-testid="card-mission"
            className="flex min-h-[56px] items-center justify-center gap-1 rounded-xl bg-ludiko-green px-2 text-center text-sm font-extrabold text-ludiko-text active:scale-95"
          >
            <span aria-hidden="true">🗺️</span>
            {t('learn.home.missionTitle')}
          </Link>
        ) : (
          <Link
            to={`/learn/check/${s.subject}`}
            data-testid="card-check"
            className="flex min-h-[56px] items-center justify-center gap-1 rounded-xl bg-ludiko-yellow px-2 text-center text-sm font-extrabold text-ludiko-text ring-2 ring-ludiko-orange active:scale-95"
          >
            <span aria-hidden="true">🧭</span>
            {s.placement === 'inProgress' ? t('learn.home.checkResumeCta') : t('learn.home.checkTitle')}
          </Link>
        )}
        <Link
          to={`/learn/map/${s.subject}`}
          data-testid="card-map"
          className="flex min-h-[56px] items-center justify-center gap-1 rounded-xl bg-ludiko-blue px-2 text-center text-sm font-extrabold text-ludiko-text active:scale-95"
        >
          <span aria-hidden="true">🏝️</span>
          {t('learn.home.mapTitle')}
        </Link>
      </div>
    </li>
  )
}

/** The learner's front door: greeting, stars, gentle streak, today's plan, and every subject below */
export default function LearnHomeView({ profile, stars, playDays, plan, subjects, checks, locked, lockedNote, assignments, stickerCount }: LearnHomeViewProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const big = isBig(profile.grade)
  const band = ageBand(profile.grade)
  const pid = profile.id ?? ''
  const guide = useFirstRunGuide('learn', pid || undefined)
  const checking = !!checks && checks.some((c) => c.placement !== 'done')
  const guideSteps: CoachStep[] = [
    ...(checking ? [{ target: 'check-cta', text: bandText(t, 'guide.learn.check', band) }] : []),
    ...(plan && plan.length > 0 ? [{ target: 'plan', text: bandText(t, 'guide.learn.plan', band) }] : []),
    { target: 'subjects', text: bandText(t, 'guide.learn.subjects', band) },
    { target: 'help', text: bandText(t, 'guide.learn.help', band) },
  ]
  const [mascotOn, setMascotOn] = useState(() => (big && pid ? getShowMascot(pid) : true))
  const showMascot = !big || mascotOn
  const streak = big && playDays <= 0 ? t('older.streakZero') : streakText(t, i18n.language, playDays)
  // teaser rows: one per grade, "Istorie, Geografie — de la clasa a IV-a"
  const teasers = [...new Set((locked ?? []).map((l) => l.minGrade))].map((minGrade) => ({
    minGrade,
    names: (locked ?? []).filter((l) => l.minGrade === minGrade).map((l) => t(`learn.subject.${l.subject}`)),
  }))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ludiko-purple text-3xl" aria-hidden="true">
          {profile.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold leading-tight text-ludiko-text">
            {t(big ? 'older.greeting' : 'learn.greeting', { name: profile.nickname })}
          </h1>
          <p className="text-sm font-semibold text-ludiko-text/70">{t(big ? 'older.greetingSub' : 'learn.greetingSub')}</p>
        </div>
        {showMascot && <MascotSvg mood="wave" size={big ? 56 : 72} className="-my-2 shrink-0" label={t('mascot.label.wave')} />}
      </header>

      {lockedNote && (
        <p role="status" className="rounded-2xl bg-ludiko-yellow p-4 text-base font-bold text-ludiko-text shadow-sm" data-testid="locked-note">
          <span aria-hidden="true">🌱 </span>
          {t('learn.locked.note', {
            subject: t(`learn.subject.${lockedNote.subject}`),
            grade: gradeFrom(t, lockedNote.minGrade),
          })}
        </p>
      )}

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
        <GuideButton onClick={guide.show} className="ml-auto" />
      </div>

      {checking && <CheckProgressCard checks={checks!} band={band} />}

      {plan && plan.length > 0 && (
        <div data-guide="plan">
          <BitTiles bits={plan} big={big} mascot={showMascot} />
        </div>
      )}

      {big && pid && (
        <>
          <ChoosePanel subjects={subjects.map((x) => x.subject)} grade={profile.grade ?? 5} profileId={pid} />
          <WeeklyGoalCard profileId={pid} />
          <ChallengeCard profileId={pid} />
        </>
      )}

      {assignments && assignments.length > 0 && <AssignmentCard assignments={assignments} />}

      <section aria-label={t('bits.plan.allSubjects')} className="flex flex-col gap-2" data-guide="subjects">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="all-subjects"
          data-testid="toggle-subjects"
          className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-white px-4 text-left text-lg font-extrabold text-ludiko-text shadow-sm active:scale-95"
        >
          <span aria-hidden="true">📚</span>
          <span className="flex-1">{t('bits.plan.allSubjects')}</span>
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <ul id="all-subjects" className="flex flex-col gap-2" data-testid="all-subjects">
            {subjects.map((s) => (
              <SubjectRow key={s.subject} s={s} />
            ))}
          </ul>
        )}
        {teasers.map((row) => (
          <p
            key={row.minGrade}
            className="rounded-2xl bg-white/60 px-4 py-2 text-sm font-bold text-ludiko-text/70"
            data-testid="locked-teaser"
          >
            <span aria-hidden="true">🌱 </span>
            {t('learn.locked.teaser', { subjects: row.names.join(', '), grade: gradeFrom(t, row.minGrade) })}
          </p>
        ))}
      </section>

      <ExamEntryCard grade={profile.grade} />

      {big && pid && (
        <label className="mx-auto flex min-h-[44px] items-center gap-3 text-sm font-bold text-ludiko-text">
          <input
            type="checkbox"
            checked={mascotOn}
            data-testid="toggle-mascot"
            onChange={(e) => {
              setShowMascot(pid, e.target.checked)
              setMascotOn(e.target.checked)
            }}
            className="h-6 w-6"
          />
          {t('older.mascot.toggle')}
        </label>
      )}

      {guide.open && <CoachMarks steps={guideSteps} band={band} onClose={guide.close} />}

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
