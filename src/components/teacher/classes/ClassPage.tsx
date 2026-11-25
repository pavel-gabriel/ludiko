import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { getClassroomApi } from '@/classroom/api'
import { heatmapCsv, heatmapColumns, sortSeats, type HeatSkill } from '@/classroom/heatmap'
import type { NewAssignment } from '@/classroom/types'
import { getSkill } from '@/engine/content/registry'
import { localize, type SkillState, type SubjectId } from '@/engine/types'
import { downloadCSV } from '@/services/teacherService'
import { LEARN_SUBJECTS } from '@/ui/learn/subjects'
import { useAsync } from '@/ui/learn/useAsync'
import AssignmentsPanel from './AssignmentsPanel'
import ClassSummary from './ClassSummary'
import Heatmap from './Heatmap'
import SeatsPanel from './SeatsPanel'
import TeacherFrame, { ErrorNote, LoadingNote, useTeacherUid } from './TeacherFrame'

type Tab = 'summary' | 'map' | 'assignments' | 'seats'
const TABS: Tab[] = ['summary', 'map', 'assignments', 'seats']

export interface ClassViewProps {
  classId: string
  /** Test/fixture hook: skills used for the columns and the summary instead of the registry's */
  skills?: HeatSkill[]
}

/** One class: summary first, then the heatmap, the assignments and the seats */
export function ClassView({ classId, skills }: ClassViewProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { ready } = useTeacherUid()
  const [tab, setTab] = useState<Tab>('summary')
  const [subject, setSubject] = useState<SubjectId>(LEARN_SUBJECTS[0])
  const [composer, setComposer] = useState<string[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionFailed, setActionFailed] = useState(false)

  const { data, loading, failed, reload } = useAsync(async () => {
    const api = await getClassroomApi()
    const [cls, seats, progress, assignments] = await Promise.all([
      api.getClass(classId),
      api.listSeats(classId),
      api.listProgress(classId),
      api.listAssignments(classId),
    ])
    return { cls, seats: sortSeats(seats), progress, assignments }
  }, ready ? classId : 'none')

  const seats = data?.seats ?? []
  const progress = data?.progress ?? {}

  const act = async (fn: (api: Awaited<ReturnType<typeof getClassroomApi>>) => Promise<unknown>): Promise<void> => {
    setActionFailed(false)
    try {
      await fn(await getClassroomApi())
      reload()
    } catch (e) {
      setActionFailed(true)
      throw e
    }
  }

  const columns = useMemo(() => heatmapColumns(subject, data?.cls?.grade ?? 8, skills), [subject, data?.cls?.grade, skills])

  if (!ready || (loading && !data)) {
    return (
      <TeacherFrame title={t('classroom.loading')} backTo="/teacher/classes" backLabel={t('classroom.backToClasses')}>
        <LoadingNote />
      </TeacherFrame>
    )
  }
  if (failed || !data) {
    return (
      <TeacherFrame title={t('classroom.title')} backTo="/teacher/classes" backLabel={t('classroom.backToClasses')}>
        <ErrorNote onRetry={reload} />
      </TeacherFrame>
    )
  }
  if (!data.cls) {
    return (
      <TeacherFrame title={t('classroom.title')} backTo="/teacher/classes" backLabel={t('classroom.backToClasses')}>
        <p className="rounded-2xl bg-white p-4 text-center font-semibold shadow-sm">{t('classroom.notFound')}</p>
      </TeacherFrame>
    )
  }
  const cls = data.cls

  const openComposer = (skillIds: string[]) => {
    setComposer(skillIds)
    setTab('assignments')
  }

  const exportCsv = () => {
    const cols = columns.map((c) => ({ ...c, title: localize(getSkill(c.id)?.title, i18n.language) || c.id }))
    const csv = heatmapCsv(seats, progress, subject, cols, (s: SkillState) => t(`classroom.state.${s}`), t('classroom.map.seat'))
    downloadCSV(`ludiko-${cls.name.replace(/[^\p{L}\p{N}]+/gu, '-')}-${subject}.csv`, csv)
  }

  return (
    <TeacherFrame title={cls.name} backTo="/teacher/classes" backLabel={t('classroom.backToClasses')}>
      <p className="-mt-3 mb-3 text-sm text-gray-600">{t(`profiles.gradeLabels.${cls.grade}`)}</p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('classroom.subject')} className="flex gap-1.5">
          {LEARN_SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={subject === s}
              onClick={() => setSubject(s)}
              data-testid={`subject-${s}`}
              className={`min-h-[44px] rounded-full px-4 text-sm font-extrabold ${subject === s ? 'bg-ludiko-purple' : 'bg-white shadow-sm'}`}
            >
              {t(`learn.subject.${s}`)}
            </button>
          ))}
        </div>
        <button type="button" onClick={exportCsv} className="ml-auto min-h-[44px] rounded-xl bg-white px-3 text-sm font-bold shadow-sm" data-testid="export-csv">
          {t('classroom.exportCsv')}
        </button>
      </div>

      <div role="tablist" aria-label={t('classroom.title')} className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {TABS.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => setTab(id)}
            data-testid={`tab-${id}`}
            className={`min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-extrabold ${tab === id ? 'bg-ludiko-purple' : ''}`}
          >
            {t(`classroom.tabs.${id}`)}
          </button>
        ))}
      </div>

      {actionFailed && <p role="alert" className="mb-3 font-bold text-red-700">{t('classroom.error.generic')}</p>}

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'summary' && <ClassSummary seats={seats} progress={progress} subject={subject} onAssign={openComposer} skills={skills} />}
        {tab === 'map' && <Heatmap seats={seats} progress={progress} subject={subject} maxGrade={cls.grade} onPickSkill={(id) => openComposer([id])} skills={skills} />}
        {tab === 'assignments' && (
          <AssignmentsPanel
            seats={seats}
            progress={progress}
            assignments={data.assignments.filter((a) => a.subject === subject)}
            subject={subject}
            maxGrade={cls.grade}
            composer={composer}
            onOpenComposer={setComposer}
            onCloseComposer={() => setComposer(null)}
            onCreate={async (input: NewAssignment) => {
              await act((api) => api.createAssignment(classId, input))
              setComposer(null)
            }}
            onDelete={(id) => act((api) => api.deleteAssignment(classId, id)).catch(() => {})}
            skills={skills}
          />
        )}
        {tab === 'seats' && (
          <SeatsPanel
            classId={classId}
            seats={seats}
            onAdd={async (labels) => {
              await act(async (api) => {
                for (const label of labels) await api.addSeat(classId, label)
              })
            }}
            onUnlink={(id) => act((api) => api.unlinkSeat(classId, id))}
            onRemove={(id) => act((api) => api.removeSeat(classId, id))}
          />
        )}
      </div>

      <section className="mt-10 rounded-2xl bg-white p-4 shadow-sm">
        {confirmDelete ? (
          <div role="alertdialog" className="flex flex-col gap-2">
            <p className="font-bold">{t('classroom.deleteClassConfirm', { name: cls.name })}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-xl bg-red-200 px-3 font-extrabold"
                data-testid="class-delete-confirm"
                onClick={() => void act((api) => api.deleteClass(classId)).then(() => navigate('/teacher/classes'), () => {})}
              >
                {t('classroom.confirmYes')}
              </button>
              <button type="button" className="min-h-[44px] rounded-xl bg-gray-100 px-3 font-bold" onClick={() => setConfirmDelete(false)}>
                {t('classroom.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="min-h-[44px] rounded-xl bg-red-50 px-3 text-sm font-bold text-red-700" onClick={() => setConfirmDelete(true)}>
            {t('classroom.deleteClass')}
          </button>
        )}
      </section>
    </TeacherFrame>
  )
}

/** /teacher/classes/:classId */
export default function ClassPage() {
  const { classId } = useParams()
  if (!classId) return null
  return <ClassView key={classId} classId={classId} />
}
