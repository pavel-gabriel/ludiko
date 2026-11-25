/**
 * Teacher-side aggregation over a class's seat summaries (docs/CLASSROOM.md §5). All pure functions on
 * plain data: the heatmap, the "top gaps" summary, group suggestions, assignment completion and CSV.
 */
import { levelKey } from '@/engine/diagnostic'
import { getSkillsBySubject } from '@/engine/content/registry'
import type { Skill, SkillState, SubjectId } from '@/engine/types'
import type { AssignmentDoc, SeatDoc, SeatProgressDoc } from './types'

/** The skill fields the aggregation needs (a registry Skill fits) */
export type HeatSkill = Pick<Skill, 'id' | 'grade' | 'semester' | 'prerequisites'>

export type ProgressBySeat = Record<string, SeatProgressDoc | undefined>

export const HEAT_STATES: readonly SkillState[] = ['unknown', 'gap', 'learning', 'practised', 'mastered']

const byLevelThenId = (a: HeatSkill, b: HeatSkill) => levelKey(a) - levelKey(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Seats sorted by label, numbers in natural order ("A.M." < "B.C."; "2" < "10") */
export function sortSeats<T extends Pick<SeatDoc, 'label'>>(seats: T[]): T[] {
  return [...seats].sort((a, b) => a.label.localeCompare(b.label, 'ro', { numeric: true, sensitivity: 'base' }))
}

/** Columns of the heatmap: the subject's skills up to `maxGrade`, ordered grade → semester → id */
export function heatmapColumns(subject: SubjectId, maxGrade: number, skills: HeatSkill[] = getSkillsBySubject(subject)): HeatSkill[] {
  return skills.filter((s) => s.grade <= maxGrade).sort(byLevelThenId)
}

/** Columns grouped by grade, in order (for the group header row of the table) */
export function groupByGrade(columns: HeatSkill[]): { grade: number; skills: HeatSkill[] }[] {
  const out: { grade: number; skills: HeatSkill[] }[] = []
  for (const s of columns) {
    const last = out[out.length - 1]
    if (last && last.grade === s.grade) last.skills.push(s)
    else out.push({ grade: s.grade, skills: [s] })
  }
  return out
}

/** State of one skill for one seat; skills the device never reported are `unknown` */
export function skillStateOf(progress: SeatProgressDoc | undefined, subject: SubjectId, skillId: string): SkillState {
  return progress?.subjects[subject]?.skills[skillId] ?? 'unknown'
}

export interface GapCount {
  skillId: string
  /** Seats with the `gap` state, in the given seat order */
  seatIds: string[]
  count: number
}

/** Skills with the most seats in `gap`, most first; ties: deeper (earlier grade) first, then id */
export function topGaps(
  seats: Pick<SeatDoc, 'id'>[],
  progress: ProgressBySeat,
  subject: SubjectId,
  skills: HeatSkill[] = getSkillsBySubject(subject),
  limit = 5,
): GapCount[] {
  const found: GapCount[] = []
  for (const skill of skills) {
    const seatIds = seats.filter((s) => skillStateOf(progress[s.id], subject, skill.id) === 'gap').map((s) => s.id)
    if (seatIds.length > 0) found.push({ skillId: skill.id, seatIds, count: seatIds.length })
  }
  const byId = new Map(skills.map((s) => [s.id, s]))
  found.sort((a, b) => b.count - a.count || byLevelThenId(byId.get(a.skillId)!, byId.get(b.skillId)!))
  return found.slice(0, limit)
}

/** How many prerequisite steps lie below a skill (0 = no prerequisite in the set) */
function depthMap(skills: HeatSkill[]): Map<string, number> {
  const byId = new Map(skills.map((s) => [s.id, s]))
  const memo = new Map<string, number>()
  const depth = (id: string, seen: Set<string>): number => {
    const known = memo.get(id)
    if (known !== undefined) return known
    const skill = byId.get(id)
    if (!skill || seen.has(id)) return 0
    seen.add(id)
    const d = skill.prerequisites.reduce((max, p) => (byId.has(p) ? Math.max(max, 1 + depth(p, seen)) : max), 0)
    seen.delete(id)
    memo.set(id, d)
    return d
  }
  for (const s of skills) depth(s.id, new Set())
  return memo
}

/** The deepest gap of one seat: lowest level first, then fewest prerequisites below it, then id */
export function deepestGap(
  progress: SeatProgressDoc | undefined,
  subject: SubjectId,
  skills: HeatSkill[] = getSkillsBySubject(subject),
  depths: Map<string, number> = depthMap(skills),
): string | undefined {
  const gaps = skills.filter((s) => skillStateOf(progress, subject, s.id) === 'gap')
  gaps.sort((a, b) => levelKey(a) - levelKey(b) || (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0) || (a.id < b.id ? -1 : 1))
  return gaps[0]?.id
}

export interface GroupSuggestion {
  /** The deepest gap the seats share */
  skillId: string
  seatIds: string[]
}

/** Seats grouped by their deepest gap; groups of at least `minSize` seats, biggest first (ties: deeper gap first) */
export function groupSuggestions(
  seats: Pick<SeatDoc, 'id'>[],
  progress: ProgressBySeat,
  subject: SubjectId,
  skills: HeatSkill[] = getSkillsBySubject(subject),
  minSize = 2,
): GroupSuggestion[] {
  const depths = depthMap(skills)
  const groups = new Map<string, string[]>()
  for (const seat of seats) {
    const gap = deepestGap(progress[seat.id], subject, skills, depths)
    if (gap) groups.set(gap, [...(groups.get(gap) ?? []), seat.id])
  }
  const byId = new Map(skills.map((s) => [s.id, s]))
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= minSize)
    .map(([skillId, seatIds]) => ({ skillId, seatIds }))
    .sort((a, b) => b.seatIds.length - a.seatIds.length || byLevelThenId(byId.get(a.skillId)!, byId.get(b.skillId)!))
}

export interface ClassCounts {
  seats: number
  /** Seats with a linked device */
  linked: number
  /** Seats that have sent a summary */
  withSummary: number
  /** Seats with at least one gap in this subject */
  withGaps: number
}

export function classCounts(seats: Pick<SeatDoc, 'id' | 'linked'>[], progress: ProgressBySeat, subject: SubjectId): ClassCounts {
  return {
    seats: seats.length,
    linked: seats.filter((s) => s.linked).length,
    withSummary: seats.filter((s) => progress[s.id] !== undefined).length,
    withGaps: seats.filter((s) => Object.values(progress[s.id]?.subjects[subject]?.skills ?? {}).includes('gap')).length,
  }
}

/** A skill counts as done for an assignment once it is practised or mastered */
export const isSkillDone = (state: SkillState): boolean => state === 'practised' || state === 'mastered'

export interface SeatCompletion {
  done: number
  total: number
  complete: boolean
}

export function assignmentCompletion(assignment: Pick<AssignmentDoc, 'subject' | 'skillIds'>, progress: SeatProgressDoc | undefined): SeatCompletion {
  const done = assignment.skillIds.filter((id) => isSkillDone(skillStateOf(progress, assignment.subject, id))).length
  return { done, total: assignment.skillIds.length, complete: assignment.skillIds.length > 0 && done === assignment.skillIds.length }
}

/** Escape a CSV field; neutralise leading formula characters so the file cannot inject a spreadsheet formula */
export function csvField(value: string | number): string {
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

/** The heatmap as CSV: labels only (never anything that identifies a child beyond the teacher's own label) */
export function heatmapCsv(
  seats: Pick<SeatDoc, 'id' | 'label'>[],
  progress: ProgressBySeat,
  subject: SubjectId,
  columns: (HeatSkill & { title: string })[],
  stateLabel: (state: SkillState) => string,
  seatHeader: string,
): string {
  const header = [seatHeader, ...columns.map((c) => `${c.title} [${c.id}]`)].map(csvField).join(',')
  const rows = seats.map((seat) =>
    [seat.label, ...columns.map((c) => stateLabel(skillStateOf(progress[seat.id], subject, c.id)))].map(csvField).join(','),
  )
  return [header, ...rows].join('\n')
}
