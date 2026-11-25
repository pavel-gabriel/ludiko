import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assignmentCompletion, groupByGrade, heatmapColumns, topGaps, type HeatSkill, type ProgressBySeat } from '@/classroom/heatmap'
import { ASSIGNMENT_SKILLS_MAX, ASSIGNMENT_TITLE_MAX, type AssignmentDoc, type NewAssignment, type SeatDoc } from '@/classroom/types'
import { getSkill } from '@/engine/content/registry'
import { localize, type SubjectId } from '@/engine/types'
import { formatDay } from '@/classroom/format'
import { toDayString } from '@/profiles/profileService'

export interface AssignmentsPanelProps {
  seats: SeatDoc[]
  progress: ProgressBySeat
  assignments: AssignmentDoc[]
  subject: SubjectId
  maxGrade: number
  /** Skills the composer starts with (from a gap column or the summary); null = composer closed */
  composer: string[] | null
  onOpenComposer: (skillIds: string[]) => void
  onCloseComposer: () => void
  onCreate: (input: NewAssignment) => Promise<void>
  onDelete: (id: string) => Promise<void>
  skills?: HeatSkill[]
}

const inDays = (n: number): string => toDayString(Date.now() + n * 24 * 60 * 60 * 1000)

function Composer({
  initial,
  subject,
  seats,
  progress,
  maxGrade,
  onCancel,
  onCreate,
  skills,
}: {
  initial: string[]
  subject: SubjectId
  seats: SeatDoc[]
  progress: ProgressBySeat
  maxGrade: number
  onCancel: () => void
  onCreate: (input: NewAssignment) => Promise<void>
  skills?: HeatSkill[]
}) {
  const { t, i18n } = useTranslation()
  const titleOf = (id: string) => localize(getSkill(id)?.title, i18n.language) || id
  const [picked, setPicked] = useState<string[]>(initial.slice(0, ASSIGNMENT_SKILLS_MAX))
  const [title, setTitle] = useState(() => (initial[0] ? t('classroom.assign.defaultTitle', { skill: titleOf(initial[0]) }).slice(0, ASSIGNMENT_TITLE_MAX) : ''))
  const [dueDay, setDueDay] = useState(() => inDays(7))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const gaps = useMemo(() => topGaps(seats, progress, subject, skills, 8), [seats, progress, subject, skills])
  const groups = useMemo(() => groupByGrade(heatmapColumns(subject, maxGrade, skills)), [subject, maxGrade, skills])

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= ASSIGNMENT_SKILLS_MAX ? p : [...p, id]))
  const valid = picked.length > 0 && title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDay)

  const submit = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await onCreate({ subject, skillIds: picked, title: title.trim(), dueDay })
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-md"
      aria-labelledby="composer-title"
      data-testid="assign-composer"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid && !busy) void submit()
      }}
    >
      <h3 id="composer-title" className="text-lg font-extrabold">{t('classroom.assign.newTitle')}</h3>

      <label className="flex flex-col gap-1 text-sm font-bold">
        {t('classroom.assign.titleLabel')}
        <input
          value={title}
          maxLength={ASSIGNMENT_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base font-normal"
          data-testid="assign-title"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-bold">
        {t('classroom.assign.dueLabel')}
        <input
          type="date"
          value={dueDay}
          min={toDayString(Date.now())}
          onChange={(e) => setDueDay(e.target.value)}
          className="min-h-[44px] rounded-xl border border-gray-300 px-3 text-base font-normal"
          data-testid="assign-due"
        />
      </label>

      <div>
        <p className="text-sm font-bold">{t('classroom.assign.skills', { n: picked.length, max: ASSIGNMENT_SKILLS_MAX })}</p>
        {picked.length === 0 ? (
          <p className="text-sm text-gray-600">{t('classroom.assign.noneYet')}</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2" data-testid="assign-picked">
            {picked.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex min-h-[40px] items-center gap-1 rounded-full bg-purple-100 px-3 text-sm font-bold"
                  aria-label={t('classroom.assign.remove', { skill: titleOf(id) })}
                >
                  {titleOf(id)} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {gaps.length > 0 && (
        <div>
          <p className="text-sm font-bold">{t('classroom.assign.fromGaps')}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {gaps.map((g) => (
              <li key={g.skillId}>
                <button
                  type="button"
                  onClick={() => toggle(g.skillId)}
                  aria-pressed={picked.includes(g.skillId)}
                  className={`min-h-[40px] rounded-full px-3 text-sm font-bold ${picked.includes(g.skillId) ? 'bg-red-300' : 'bg-red-100'}`}
                >
                  <span aria-hidden="true">! </span>
                  {titleOf(g.skillId)} ({g.count})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl bg-gray-50 p-2">
        <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-bold">{t('classroom.assign.fromList')}</summary>
        <div className="max-h-64 overflow-y-auto">
          {groups.map((g) => (
            <fieldset key={g.grade} className="mb-2">
              <legend className="text-xs font-extrabold text-purple-800">{t(`profiles.gradeLabels.${g.grade}`)}</legend>
              {g.skills.map((s) => (
                <label key={s.id} className="flex min-h-[40px] items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
                  {titleOf(s.id)}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </details>

      {failed && <p role="alert" className="font-bold text-red-700">{t('classroom.error.generic')}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!valid || busy}
          data-testid="assign-submit"
          className="min-h-[48px] flex-1 rounded-xl bg-ludiko-green px-4 font-extrabold shadow-sm disabled:opacity-50"
        >
          {t('classroom.assign.create')}
        </button>
        <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl bg-gray-100 px-4 font-bold">
          {t('classroom.cancel')}
        </button>
      </div>
    </form>
  )
}

/** Assignments ("Teme"): create from a gap column or the skill list, and follow completion per seat */
export default function AssignmentsPanel(props: AssignmentsPanelProps) {
  const { seats, progress, assignments, subject, maxGrade, composer, onOpenComposer, onCloseComposer, onCreate, onDelete, skills } = props
  const { t, i18n } = useTranslation()
  const titleOf = (id: string) => localize(getSkill(id)?.title, i18n.language) || id

  return (
    <div className="flex flex-col gap-4" data-testid="assignments-panel">
      {composer ? (
        <Composer
          key={composer.join('|')}
          initial={composer}
          subject={subject}
          seats={seats}
          progress={progress}
          maxGrade={maxGrade}
          onCancel={onCloseComposer}
          onCreate={onCreate}
          skills={skills}
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpenComposer([])}
          data-testid="assign-new"
          className="min-h-[52px] rounded-xl bg-ludiko-yellow px-4 text-lg font-extrabold shadow-sm active:scale-95"
        >
          {t('classroom.assign.new')}
        </button>
      )}

      {assignments.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center font-semibold shadow-sm">{t('classroom.assign.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {assignments.map((a) => {
            const rows = seats.map((s) => ({ seat: s, c: assignmentCompletion(a, progress[s.id]) }))
            const finished = rows.filter((r) => r.c.complete).length
            return (
              <li key={a.id} className="rounded-2xl bg-white p-4 shadow-sm" data-testid={`assignment-${a.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-extrabold">{a.title}</p>
                    <p className="text-sm text-gray-600">
                      {t('classroom.assign.due', { day: formatDay(a.dueDay, i18n.language) })} · {t(`learn.subject.${a.subject}`)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDelete(a.id)}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-red-50 text-sm font-bold text-red-700"
                    aria-label={t('classroom.assign.delete', { title: a.title })}
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 text-sm">{a.skillIds.map(titleOf).join(' · ')}</p>
                <p className="mt-2 font-bold" data-testid={`assignment-${a.id}-done`}>
                  {t('classroom.assign.finished', { done: finished, total: seats.length })}
                </p>
                <details className="mt-1">
                  <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-bold">{t('classroom.assign.perSeat')}</summary>
                  <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {rows.map(({ seat, c }) => (
                      <li key={seat.id} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${c.complete ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <span className="font-bold">{seat.label}</span>
                        <span>
                          <span aria-hidden="true">{c.complete ? '✓ ' : '· '}</span>
                          {t('classroom.assign.progress', { done: c.done, total: c.total })}
                          <span className="sr-only"> {c.complete ? t('classroom.assign.complete') : t('classroom.assign.open')}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
