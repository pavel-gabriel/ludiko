import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getClassroomApi } from '@/classroom/api'
import { CLASS_NAME_MAX } from '@/classroom/types'
import { useAsync } from '@/ui/learn/useAsync'
import TeacherFrame, { ErrorNote, LoadingNote, useTeacherUid } from './TeacherFrame'

/** /teacher/classes — the teacher's classes and a form to create one */
export default function ClassesPage() {
  const { t } = useTranslation()
  const { uid, ready } = useTeacherUid()
  const { data, loading, failed, reload } = useAsync(
    async () => (uid ? (await getClassroomApi()).listClasses(uid) : []),
    ready ? uid! : 'none',
  )
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const create = async () => {
    if (!uid || !name.trim() || busy) return
    setBusy(true)
    setError(false)
    try {
      await (await getClassroomApi()).createClass(uid, { name, grade })
      setName('')
      reload()
    } catch {
      setError(true)
    }
    setBusy(false)
  }

  return (
    <TeacherFrame title={t('classroom.classes.title')} backTo="/teacher" backLabel={t('classroom.backToTeacher')}>
      {!ready || loading ? (
        <LoadingNote />
      ) : failed ? (
        <ErrorNote onRetry={reload} />
      ) : (
        <div className="flex flex-col gap-4">
          {data && data.length > 0 ? (
            <ul className="flex flex-col gap-2" data-testid="class-list">
              {data.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/teacher/classes/${c.id}`}
                    className="flex min-h-[64px] items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-extrabold">{c.name}</span>
                      <span className="block text-sm text-gray-600">{t(`profiles.gradeLabels.${c.grade}`)}</span>
                    </span>
                    <span aria-hidden="true" className="text-2xl">›</span>
                    <span className="sr-only">{t('classroom.classes.open')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-center font-semibold shadow-sm">{t('classroom.classes.empty')}</p>
          )}

          <form
            className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              void create()
            }}
          >
            <h2 className="text-lg font-extrabold">{t('classroom.classes.newTitle')}</h2>
            <label className="flex flex-col gap-1 text-sm font-bold">
              {t('classroom.classes.nameLabel')}
              <input
                value={name}
                maxLength={CLASS_NAME_MAX}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('classroom.classes.namePlaceholder')}
                className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base font-normal"
                data-testid="class-name"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              {t('classroom.classes.gradeLabel')}
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-3 text-base font-normal"
                data-testid="class-grade"
              >
                {Array.from({ length: 9 }, (_, g) => (
                  <option key={g} value={g}>{t(`profiles.gradeLabels.${g}`)}</option>
                ))}
              </select>
            </label>
            {error && <p role="alert" className="font-bold text-red-700">{t('classroom.error.generic')}</p>}
            <button
              type="submit"
              disabled={!name.trim() || busy}
              data-testid="class-create"
              className="min-h-[48px] rounded-xl bg-ludiko-green px-4 font-extrabold shadow-sm disabled:opacity-50"
            >
              {t('classroom.classes.create')}
            </button>
            <p className="text-xs text-gray-600">{t('classroom.privacyNote')}</p>
          </form>
        </div>
      )}
    </TeacherFrame>
  )
}
