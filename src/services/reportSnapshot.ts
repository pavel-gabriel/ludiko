import { getSkill } from '@/engine/content/registry'
import type { CardContent, Item, SubjectId } from '@/engine/types'

/**
 * What the admin needs to see to understand a report: the question as the child saw it.
 * No personal data: no profile ids, no names, and never the answer the child gave.
 */

export const REPORT_CONTEXTS = ['practice', 'bit', 'mission', 'exam', 'game', 'placement'] as const
export type ReportContext = (typeof REPORT_CONTEXTS)[number]

const SUBJECTS: readonly SubjectId[] = ['mat', 'rom', 'eng', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim']

export const SNAPSHOT_MAX_OPTIONS = 10
export const SNAPSHOT_MAX_OPTION_LENGTH = 120
export const SNAPSHOT_MAX_PROMPT_LENGTH = 500
export const SNAPSHOT_MAX_CORRECT_LENGTH = 200
export const SNAPSHOT_MAX_ROUTE_LENGTH = 100
export const SNAPSHOT_MAX_SHORT_LENGTH = 40

export interface ReportSnapshot {
  type: string
  prompt: string
  options?: string[]
  correct: string
  visualKind?: string
  skillId: string
  subject: SubjectId
  grade: number
  context: ReportContext
  route: string
}

const cut = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s)

function cardText(c: CardContent): string {
  return c.text?.ro?.trim() || (c.visual ? `[${c.visual.kind}]` : '')
}

/** Guess the context from the page path when the caller did not pass one. */
export function contextFromRoute(pathname: string): ReportContext {
  if (/\/learn\/check\//.test(pathname)) return 'placement'
  if (/\/learn\/mission\//.test(pathname)) return 'mission'
  if (/\/learn\/bit\//.test(pathname)) return 'bit'
  if (/\/learn\/exam/.test(pathname)) return 'exam'
  if (/\/game(\/|$)/.test(pathname)) return 'game'
  return 'practice'
}

/** Pathname only (no query, no hash), without the deploy base. */
export function currentRoute(): string {
  try {
    let p = window.location.pathname
    const base = (import.meta.env.BASE_URL as string | undefined) ?? '/'
    if (base !== '/' && p.startsWith(base)) p = `/${p.slice(base.length)}`
    return p
  } catch {
    return '/'
  }
}

interface Body {
  prompt: string
  options?: string[]
  correct: string
}

function bodyOf(item: Item): Body {
  const prompt = item.prompt.ro
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer': {
      const right = item.options.find((o) => o.id === item.correctId)
      return { prompt, options: item.options.map(cardText), correct: right ? cardText(right) : '' }
    }
    case 'true-false':
      return { prompt, options: ['Adevărat', 'Fals'], correct: item.correct ? 'Adevărat' : 'Fals' }
    case 'number-input':
      return { prompt, correct: String(item.correct) }
    case 'fill-gap':
      return {
        prompt: `${prompt} ${item.template.ro}`.trim(),
        options: item.options,
        correct: item.correct,
      }
    case 'order': {
      const byId = new Map(item.cards.map((c) => [c.id, c]))
      const ordered = item.correctOrder.map((id) => cardText(byId.get(id) ?? { id }))
      return { prompt, options: item.cards.map(cardText), correct: ordered.join(' → ') }
    }
    case 'sort': {
      const label = new Map(item.categories.map((c) => [c.id, c.label.ro]))
      return {
        prompt,
        options: item.cards.map(cardText),
        correct: item.cards.map((c) => `${cardText(c)} → ${label.get(c.categoryId) ?? c.categoryId}`).join('; '),
      }
    }
    case 'match': {
      const pairs = item.pairs.map((p) => `${cardText(p.left)} = ${cardText(p.right)}`)
      return { prompt, options: pairs, correct: pairs.join('; ') }
    }
    case 'hotspot': {
      const right = item.regions.find((r) => r.id === item.correctId)
      return {
        prompt,
        options: item.regions.map((r) => r.label?.ro ?? r.id),
        correct: right?.label?.ro ?? item.correctId,
      }
    }
    case 'read-and-answer': {
      const qs = item.questions
      return {
        prompt: `${item.passage.ro} ${prompt}`.trim(),
        options: qs.map((q) => q.prompt.ro),
        correct: qs
          .map((q) => {
            if (q.type === 'true-false') return q.correct ? 'Adevărat' : 'Fals'
            const right = q.options.find((o) => o.id === q.correctId)
            return right ? cardText(right) : ''
          })
          .join(' | '),
      }
    }
  }
}

/** Build a trimmed snapshot of an item. Returns undefined when the skill is unknown. */
export function buildReportSnapshot(
  item: Item,
  context?: ReportContext,
  route: string = currentRoute(),
): ReportSnapshot | undefined {
  const skill = getSkill(item.skillId)
  if (!skill) return undefined
  const body = bodyOf(item)
  const vk = item.visual?.kind
  return sanitizeSnapshot({
    type: item.type,
    prompt: body.prompt,
    ...(body.options ? { options: body.options } : {}),
    correct: body.correct,
    ...(vk ? { visualKind: vk } : {}),
    skillId: item.skillId,
    subject: skill.subject,
    grade: skill.grade,
    context: context ?? contextFromRoute(route),
    route,
  })
}

/** Validate and trim an unknown value into a snapshot. Pure; never throws. Invalid input gives undefined. */
export function sanitizeSnapshot(raw: unknown): ReportSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === 'string' ? cut(v.trim(), max) : undefined

  const type = str(r.type, SNAPSHOT_MAX_SHORT_LENGTH)
  const prompt = str(r.prompt, SNAPSHOT_MAX_PROMPT_LENGTH)
  const correct = str(r.correct, SNAPSHOT_MAX_CORRECT_LENGTH)
  const skillId = str(r.skillId, 100)
  const route = str(r.route, SNAPSHOT_MAX_ROUTE_LENGTH)
  if (!type || prompt === undefined || correct === undefined || !skillId || !route) return undefined
  if (!SUBJECTS.includes(r.subject as SubjectId)) return undefined
  if (typeof r.grade !== 'number' || !Number.isInteger(r.grade) || r.grade < 0 || r.grade > 8) return undefined
  if (!(REPORT_CONTEXTS as readonly string[]).includes(r.context as string)) return undefined

  let options: string[] | undefined
  if (Array.isArray(r.options)) {
    options = r.options
      .filter((o): o is string => typeof o === 'string')
      .slice(0, SNAPSHOT_MAX_OPTIONS)
      .map((o) => cut(o.trim(), SNAPSHOT_MAX_OPTION_LENGTH))
  }
  const visualKind = str(r.visualKind, SNAPSHOT_MAX_SHORT_LENGTH)

  // Built field by field: unknown keys (e.g. profile ids, answers) never get through.
  return {
    type,
    prompt,
    ...(options && options.length ? { options } : {}),
    correct,
    ...(visualKind ? { visualKind } : {}),
    skillId,
    subject: r.subject as SubjectId,
    grade: r.grade,
    context: r.context as ReportContext,
    route,
  }
}
