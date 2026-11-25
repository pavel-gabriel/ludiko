/**
 * In-memory ClassroomApi with a seeded class, for /dev/classroom and UI tests (Firebase is not configured
 * locally). Pure data, no Firebase; the numbers are made up and no real child is represented.
 */
import { levelKey } from '@/engine/diagnostic'
import { getSkillsBySubject } from '@/engine/content/registry'
import type { SkillState } from '@/engine/types'
import { generateJoinCode } from '../joinCode'
import type { AssignmentDoc, ClassDoc, ClassroomApi, SeatDoc, SeatProgressDoc } from '../types'

export const DEV_CLASS_ID = 'dev-class'
export const DEV_TEACHER_UID = 'dev-teacher'

interface SeatSpec {
  label: string
  /** How many of the grade-ordered maths skills the pupil has reached */
  reached: number
  gaps?: string[]
  learning?: string[]
  /** No summary sent yet */
  silent?: boolean
  linked?: boolean
}

const SPECS: SeatSpec[] = [
  { label: 'A.M.', reached: 30, gaps: [] },
  { label: 'B.C.', reached: 24, gaps: ['mat.sub.borrow.100'], learning: ['mat.add.carry.1000'] },
  { label: 'C.D.', reached: 22, gaps: ['mat.sub.borrow.100', 'mat.mul.table.large'] },
  { label: 'D.E.', reached: 26, gaps: ['mat.mul.table.large'] },
  { label: 'E.F.', reached: 18, gaps: ['mat.sub.borrow.100', 'mat.add.carry.100'], learning: ['mat.sub.noborrow.100'] },
  { label: 'F.G.', reached: 28, gaps: [] },
  { label: 'G.H.', reached: 20, gaps: ['mat.sub.borrow.100'] },
  { label: 'H.I.', reached: 16, gaps: ['mat.add.carry.20', 'mat.sub.borrow.20'], learning: ['mat.placevalue.100'] },
  { label: 'I.J.', reached: 25, gaps: ['mat.mul.table.large', 'mat.div.table'] },
  { label: 'J.K.', reached: 29, gaps: [] },
  { label: 'K.L.', reached: 21, gaps: ['mat.sub.borrow.100'], learning: ['mat.mul.table.small'] },
  { label: 'L.M.', reached: 0, silent: true },
  { label: '12', reached: 0, silent: true, linked: false },
  { label: '13', reached: 27, gaps: ['mat.clock.minutes'] },
]

function progressFor(spec: SeatSpec, now: number): SeatProgressDoc {
  const mat = [...getSkillsBySubject('mat')].sort((a, b) => levelKey(a) - levelKey(b) || (a.id < b.id ? -1 : 1))
  const skills: Record<string, SkillState> = {}
  mat.forEach((s, i) => {
    if (spec.gaps?.includes(s.id)) skills[s.id] = 'gap'
    else if (spec.learning?.includes(s.id)) skills[s.id] = 'learning'
    else if (i < spec.reached) skills[s.id] = i < spec.reached - 3 ? 'mastered' : 'practised'
  })
  return {
    subjects: { mat: { level: { grade: 3, semester: 1 }, missingCount: spec.gaps?.length ?? 0, skills } },
    playDaysThisWeek: (spec.reached % 5) + 1,
    updatedAt: now,
  }
}

export function createFakeApi(now: number = Date.now()): ClassroomApi {
  const cls: ClassDoc = { id: DEV_CLASS_ID, teacherUid: DEV_TEACHER_UID, name: 'Clasa a III-a B', grade: 3, createdAt: now }
  let classes: ClassDoc[] = [cls]
  let seats: SeatDoc[] = []
  let progress: Record<string, SeatProgressDoc> = {}
  let assignments: AssignmentDoc[] = [
    {
      id: 'as1',
      subject: 'mat',
      skillIds: ['mat.sub.borrow.100'],
      title: 'Scăderea cu împrumut până la 100',
      dueDay: new Date(now + 3 * 86_400_000).toISOString().slice(0, 10),
      createdAt: now,
    },
  ]
  let n = 0
  const newCode = () => generateJoinCode()
  SPECS.forEach((spec) => {
    const code = newCode()
    const linked = spec.linked ?? true
    seats.push({ id: code, label: spec.label, joinCode: code, linked, ...(linked ? { linkedAt: now } : {}) })
    if (!spec.silent) progress[code] = progressFor(spec, now)
  })

  return {
    async listClasses() {
      return [...classes]
    },
    async createClass(uid, input) {
      const c: ClassDoc = { id: `class-${++n}`, teacherUid: uid, name: input.name.trim(), grade: input.grade, createdAt: Date.now() }
      classes = [c, ...classes]
      return c
    },
    async getClass(id) {
      return classes.find((c) => c.id === id) ?? null
    },
    async deleteClass(id) {
      classes = classes.filter((c) => c.id !== id)
    },
    async listSeats() {
      return seats.map((s) => ({ ...s }))
    },
    async addSeat(_classId, label) {
      const code = newCode()
      const seat: SeatDoc = { id: code, label, joinCode: code, linked: false }
      seats = [...seats, seat]
      return seat
    },
    async renameSeat(_classId, id, label) {
      seats = seats.map((s) => (s.id === id ? { ...s, label } : s))
    },
    async unlinkSeat(_classId, id) {
      const old = seats.find((s) => s.id === id)
      const code = newCode()
      const seat: SeatDoc = { id: code, label: old?.label ?? '?', joinCode: code, linked: false }
      seats = seats.map((s) => (s.id === id ? seat : s))
      delete progress[id]
      return seat
    },
    async removeSeat(_classId, id) {
      seats = seats.filter((s) => s.id !== id)
      delete progress[id]
    },
    async listProgress() {
      return { ...progress }
    },
    async listAssignments() {
      return [...assignments]
    },
    async createAssignment(_classId, input) {
      const a: AssignmentDoc = { ...input, id: `as${assignments.length + 1}`, createdAt: Date.now() }
      assignments = [a, ...assignments]
      return a
    },
    async deleteAssignment(_classId, id) {
      assignments = assignments.filter((a) => a.id !== id)
    },
    async joinClass(_profileId, code) {
      return { classId: DEV_CLASS_ID, seatId: code, joinCode: code, className: cls.name }
    },
    async leaveClass() {},
  }
}
