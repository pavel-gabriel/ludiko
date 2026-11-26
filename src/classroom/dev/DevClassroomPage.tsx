import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { setClassroomApi } from '@/classroom/api'
import { deriveAssignmentBits } from '@/learner/assignmentOps'
import ClassLinkSection from '@/components/profiles/ClassLinkSection'
import { ClassCodesView } from '@/components/teacher/classes/ClassCodesPage'
import { ClassView } from '@/components/teacher/classes/ClassPage'
import ClassesPage from '@/components/teacher/classes/ClassesPage'
import type { ChildProfile, ClassLink } from '@/profiles/types'
import { useAuthStore } from '@/store/authStore'
import LearnHomeView from '@/ui/learn/LearnHomeView'
import { createFakeApi, DEV_CLASS_ID, DEV_TEACHER_UID } from './fakeApi'

const VIEWS = ['teacher', 'classes', 'codes', 'child'] as const
type DevView = (typeof VIEWS)[number]

const LINK: ClassLink = { classId: DEV_CLASS_ID, seatId: 'ABC234', joinCode: 'ABC234', className: 'Clasa a III-a B' }

function profileWith(link?: ClassLink): ChildProfile {
  return {
    id: 'dev-child',
    nickname: 'Ursulet',
    avatar: '🐻',
    grade: 3,
    language: 'ro',
    createdAt: 0,
    updatedAt: 0,
    recoveryCode: 'AAAA-BBBB-CCCC',
    ...(link ? { classLink: link } : {}),
  }
}

/** The child's side: "Clasa mea" in the profile settings, and the assignment bit on /learn */
function ChildFixture() {
  const [profile, setProfile] = useState<ChildProfile>(() => profileWith())
  // the fixture's join/leave only change this local profile
  useMemo(() => {
    const base = createFakeApi()
    setClassroomApi({
      ...base,
      async joinClass(_id, code) {
        if (code.replace(/\W/g, '').toUpperCase() === 'WRONG2') throw new (await import('@/classroom/types')).ClassroomError('invalid-code')
        setProfile(profileWith(LINK))
        return LINK
      },
      async leaveClass() {
        setProfile(profileWith())
      },
    })
  }, [])

  const now = Date.now()
  const day = (n: number) => new Date(now + n * 86_400_000).toISOString().slice(0, 10)
  const assignments = deriveAssignmentBits(
    [
      { id: 'a1', subject: 'mat', skillIds: ['mat.sub.borrow.100', 'mat.add.carry.100'], title: 'Scăderea cu împrumut până la 100', dueDay: day(2) },
      { id: 'a2', subject: 'mat', skillIds: ['mat.count.20'], title: 'Numărăm până la 20', dueDay: day(-1) },
    ],
    (id) => (id === 'mat.add.carry.100' || id === 'mat.count.20' ? 'practised' : id === 'mat.sub.borrow.100' ? 'gap' : undefined),
    now,
  )

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-10">
      <div className="card w-full">
        <ClassLinkSection profile={profile} />
      </div>
      <LearnHomeView
        profile={profile}
        stars={12}
        playDays={3}
        subjects={[{ subject: 'mat', placement: 'done' }]}
        plan={[
          { index: 0, kind: 'warmup', day: '2026-03-20', steps: [], itemCount: 5, done: true, subject: 'mat', source: 'mission', bitIndex: 0 },
          { index: 1, kind: 'island', day: '2026-03-20', steps: [], itemCount: 5, done: false, subject: 'rom', source: 'placement' },
        ]}
        assignments={assignments}
      />
    </div>
  )
}

/** /dev/classroom — Firebase is not configured locally: the teacher and child classroom screens on in-memory data */
export default function DevClassroomPage() {
  const [params] = useSearchParams()
  const view: DevView = (VIEWS as readonly string[]).includes(params.get('view') ?? '') ? (params.get('view') as DevView) : 'teacher'

  // install the fake API and a signed-in teacher before the screens first render
  const [ready, setReady] = useState(false)
  useEffect(() => {
    useAuthStore.setState({ uid: DEV_TEACHER_UID, loading: false })
    if (view !== 'child') setClassroomApi(createFakeApi())
    setReady(true)
  }, [view])

  return (
    <div className="min-h-screen">
      <nav className="flex flex-wrap gap-3 px-4 py-2 text-sm font-bold" aria-label="dev">
        {VIEWS.map((v) => (
          <Link key={v} to={`/dev/classroom?view=${v}`} className={v === view ? 'underline' : ''}>
            {v}
          </Link>
        ))}
      </nav>
      {ready && view === 'teacher' && <ClassView classId={DEV_CLASS_ID} />}
      {ready && view === 'classes' && <ClassesPage />}
      {ready && view === 'codes' && <ClassCodesView classId={DEV_CLASS_ID} />}
      {ready && view === 'child' && <ChildFixture />}
    </div>
  )
}
