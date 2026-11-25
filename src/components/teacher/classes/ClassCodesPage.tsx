import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { getClassroomApi } from '@/classroom/api'
import { formatJoinCode } from '@/classroom/joinCode'
import { sortSeats } from '@/classroom/heatmap'
import { useAsync } from '@/ui/learn/useAsync'
import TeacherFrame, { ErrorNote, LoadingNote, useTeacherUid } from './TeacherFrame'

/** /teacher/classes/:classId/codes — one card per seat, to print and cut out (labels and codes only) */
export function ClassCodesView({ classId }: { classId: string }) {
  const { t } = useTranslation()
  const { ready } = useTeacherUid()
  const { data, loading, failed, reload } = useAsync(async () => {
    const api = await getClassroomApi()
    const [cls, seats] = await Promise.all([api.getClass(classId), api.listSeats(classId)])
    return { cls, seats: sortSeats(seats) }
  }, ready ? classId : 'none')

  return (
    <TeacherFrame title={data?.cls?.name ?? t('classroom.codes.title')} backTo={`/teacher/classes/${classId}`} backLabel={t('classroom.backToClass')}>
      {!ready || loading ? (
        <LoadingNote />
      ) : failed || !data ? (
        <ErrorNote onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="min-w-0 flex-1 basis-60 text-sm text-gray-700">{t('classroom.codes.help')}</p>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[48px] rounded-xl bg-ludiko-blue px-5 font-extrabold shadow-sm"
              data-testid="print"
            >
              {t('classroom.codes.print')}
            </button>
          </div>

          {data.seats.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-center font-semibold shadow-sm">{t('classroom.codes.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2" data-testid="codes-grid">
              {data.seats.map((s) => (
                <li
                  key={s.id}
                  className="break-inside-avoid rounded-2xl border-2 border-dashed border-gray-400 bg-white p-4 text-center print:rounded-none print:shadow-none"
                >
                  <p className="text-lg font-extrabold">{s.label}</p>
                  <p className="my-1 font-mono text-4xl font-extrabold tracking-[0.2em]" data-testid={`print-code-${s.id}`}>
                    {formatJoinCode(s.joinCode)}
                  </p>
                  <p className="text-xs text-gray-700">{t('classroom.codes.steps')}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </TeacherFrame>
  )
}

export default function ClassCodesPage() {
  const { classId } = useParams()
  return classId ? <ClassCodesView classId={classId} /> : null
}
