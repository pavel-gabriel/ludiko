import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getSkillsBySubject } from '@/engine/content/registry'
import { localize, type SkillState } from '@/engine/types'
import type { ParentSummary, PlanBit } from '@/learner'
import BitDone from './BitDone'
import BreakOffer from './BreakOffer'
import LearnHomeView from './LearnHomeView'
import MissionComplete from './MissionComplete'
import ParentView from './ParentView'
import PlacementCelebration from './PlacementCelebration'
import PlacementIntro from './PlacementIntro'
import SkillMapView, { type MapIsland } from './SkillMapView'
import StepCelebration from './StepCelebration'
import TreasurePath from './TreasurePath'

const noop = () => {}
const profile = { nickname: 'Matei', avatar: '🦊' }

/** A plan of three bits (Matematică, Limba română, Științe) with the given done flags; `check` makes them placement chunks */
function planFixture(done: boolean[], check = false): PlanBit[] {
  const subjects = ['mat', 'rom', 'stiinte'] as const
  const kinds = ['warmup', 'island', 'challenge'] as const
  return done.map((d, index) => ({
    index,
    kind: kinds[index],
    day: '2026-03-20',
    steps: [],
    itemCount: 5,
    done: d,
    subject: subjects[index],
    source: check ? 'placement' : 'mission',
    ...(check ? {} : { bitIndex: 0 }),
  }))
}

function Frame({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-preview={id} className="mx-auto w-full max-w-md">
      <h2 className="mb-2 rounded-lg bg-ludiko-text px-3 py-1 text-sm font-bold text-white">{title}</h2>
      <div className="rounded-3xl bg-ludiko-bg p-4 ring-1 ring-black/10">{children}</div>
    </section>
  )
}

/** Cycles through every island state so the map preview shows them all */
function fixtureIslands(lang: string): MapIsland[] {
  const cycle: { state: SkillState; unlocked: boolean; dueForReview: boolean }[] = [
    { state: 'mastered', unlocked: true, dueForReview: false },
    { state: 'practised', unlocked: true, dueForReview: false },
    { state: 'learning', unlocked: true, dueForReview: false },
    { state: 'gap', unlocked: true, dueForReview: false },
    { state: 'practised', unlocked: true, dueForReview: true },
    { state: 'unknown', unlocked: false, dueForReview: false },
  ]
  return getSkillsBySubject('mat').map((s, i) => ({
    skillId: s.id,
    grade: s.grade,
    semester: s.semester,
    pMastery: 0.5,
    prerequisites: s.prerequisites,
    ...cycle[i % cycle.length],
    title: localize(s.title, lang),
  }))
}

const parentSummary: ParentSummary = {
  profileId: 'fixture',
  subjects: [
    {
      subject: 'mat',
      placement: {
        subject: 'mat',
        level: { grade: 1, semester: 2 },
        gaps: ['mat.add.carry.20', 'mat.sub.borrow.20'],
        missingCount: 4,
        estimatedWeeks: 3,
        statement: {
          ro: 'Matematică: nivel clasa I, semestrul 2. Clasa reală: a II-a. Lipsesc 4 competențe — estimat 3 săptămâni de misiuni.',
          en: 'Maths: level grade I, semester 2. Actual grade: II. 4 competences missing, about 3 weeks of missions.',
        },
      },
      improved: ['mat.count.20', 'mat.add.nocarry.20'],
      nextUp: ['mat.add.carry.20', 'mat.sub.noborrow.20'],
      masteredCount: 7,
      totalSkills: 18,
    },
  ],
  playDaysThisWeek: 3,
  tip: {
    ro: 'Numărați banii la cumpărături: copilul exersează adunarea fără să știe.',
    en: 'Count the money when shopping: your child practises adding without noticing.',
  },
}

/** /dev/learn — every learner screen rendered from fixtures (no service calls), for visual QA */
export default function LearnPreviewPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const islands = useMemo(() => fixtureIslands(lang), [lang])
  const titleOf = (id: string) => islands.find((i) => i.skillId === id)?.title ?? id

  return (
    <main className="flex min-h-screen w-full flex-col gap-8 px-4 py-6">
      <Link to="/" className="text-sm font-bold underline">← Ludiko</Link>

      <Frame id="home-new" title="Learner home: no placement yet">
        <LearnHomeView profile={profile} stars={12} playDays={0} subjects={[{ subject: 'mat', placement: 'none' }]} plan={planFixture([false, false, false], true)} />
      </Frame>
      <Frame id="home-mission" title="Learner home: placement done, mission in progress">
        <LearnHomeView
          profile={profile}
          stars={48}
          playDays={3}
          subjects={[{ subject: 'mat', placement: 'done' }, { subject: 'rom', placement: 'none' }]}
          plan={planFixture([true, false, false])}
          locked={[{ subject: 'ist', minGrade: 4 }, { subject: 'geo', minGrade: 4 }]}
        />
      </Frame>
      <Frame id="home-done" title="Learner home: mission complete">
        <LearnHomeView
          profile={profile}
          stars={60}
          playDays={5}
          subjects={[{ subject: 'mat', placement: 'done' }, { subject: 'rom', placement: 'done' }]}
          plan={planFixture([true, true, true])}
        />
      </Frame>
      <Frame id="check-intro" title="Check: intro">
        <PlacementIntro resuming={false} onStart={noop} />
      </Frame>
      <Frame id="check-resume" title="Check: resume">
        <PlacementIntro resuming onStart={noop} />
      </Frame>
      <Frame id="check-break" title="Check: break offer">
        <BreakOffer progress={0.45} onStop={noop} onContinue={noop} />
      </Frame>
      <Frame id="check-done" title="Check: celebration (child)">
        <PlacementCelebration reward={{ stars: 3, sticker: '🦊', newSticker: true, saved: true }} onMission={noop} onMap={noop} onParents={noop} />
      </Frame>
      <Frame id="mission-path" title="Mission: treasure path">
        <TreasurePath
          onStart={noop}
          steps={[
            { kind: 'review', title: titleOf('mat.count.10'), done: true },
            { kind: 'new', title: titleOf('mat.add.carry.20'), done: false },
            { kind: 'practice', title: titleOf('mat.sub.noborrow.20'), done: false },
            { kind: 'check', title: titleOf('mat.count.100'), done: false },
          ]}
        />
      </Frame>
      <Frame id="mission-step" title="Mission: step done">
        <StepCelebration kind="practice" stars={2} reward={null} onNext={noop} />
      </Frame>
      <Frame id="mission-check-ok" title="Mission: challenge passed">
        <StepCelebration kind="check" stars={3} passed reward={{ stars: 3, sticker: '🐼', newSticker: true, saved: true }} onNext={noop} />
      </Frame>
      <Frame id="mission-check-not-yet" title="Mission: challenge not yet">
        <StepCelebration kind="check" stars={1} passed={false} reward={null} onNext={noop} />
      </Frame>
      <Frame id="bit-done" title="Bit: done, another one offered">
        <BitDone kind="island" stars={2} reward={null} allDone={false} hasNext onNext={noop} onStop={noop} />
      </Frame>
      <Frame id="bit-done-last" title="Bit: last bit of the day">
        <BitDone kind="challenge" stars={3} passed reward={{ stars: 3, sticker: '🐼', newSticker: true, saved: true }} allDone hasNext={false} onNext={noop} onStop={noop} />
      </Frame>
      <Frame id="mission-complete"title="Mission: complete">
        <MissionComplete onMap={noop} onHome={noop} fresh={false} />
      </Frame>
      <Frame id="map" title="Skill map">
        <SkillMapView islands={islands} />
      </Frame>
      <Frame id="parent" title="Parent view">
        <ParentView profileName={profile.nickname} summary={parentSummary} titleOf={titleOf} onRedo={noop} />
      </Frame>
    </main>
  )
}
