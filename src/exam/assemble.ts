/**
 * Assembles one exam paper from a blueprint: pure and reproducible (same blueprint + seed + content
 * => identical test). Items come from the skills' own generators and static banks via
 * `generateItems`; nothing is copied from real exam papers.
 */
import { getItemsForSkill, getAllSkills, getSkill } from '@/engine/content/registry'
import { generateItems } from '@/engine/items/generators'
import { mulberry32, shuffle } from '@/engine/items/generators/util'
import type { Item, ItemType, LocalizedText, Skill } from '@/engine/types'
import type { AssembledSection, AssembledTest, ExamBlueprint, ExamPart, SkillSelector } from './types'

/** True when a skill can produce items right now (generator or authored bank) */
function canProduce(skill: Skill): boolean {
  return skill.itemSources.some((s) => 'generator' in s) || getItemsForSkill(skill.id).length > 0
}

/**
 * Resolve a selector to skills that exist AND have items. Pattern selectors (e.g. subject 'stiinte')
 * simply yield nothing when that content has not shipped, so the caller can skip the section.
 */
export function resolveSkills(selector: SkillSelector): Skill[] {
  if ('ids' in selector) {
    return selector.ids.map((id) => getSkill(id)).filter((s): s is Skill => s !== undefined && canProduce(s))
  }
  return getAllSkills()
    .filter(
      (s) =>
        s.subject === selector.subject &&
        selector.grades.includes(s.grade) &&
        (selector.idPrefix === undefined || s.id.startsWith(selector.idPrefix)) &&
        canProduce(s),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
}

const text = (t: LocalizedText | undefined) => t?.ro ?? ''

/**
 * Identity of an item's CONTENT (not its id): two items asking the same question with the same
 * answer have the same key, however their options happen to be shuffled.
 */
export function contentKey(item: Item): string {
  const parts: unknown[] = [item.type, text(item.prompt), item.visual ?? null]
  switch (item.type) {
    case 'choice':
    case 'picture-choice':
    case 'listen-and-answer': {
      const label = (o: { text?: LocalizedText; visual?: unknown }) => `${text(o.text)}|${JSON.stringify(o.visual ?? null)}`
      parts.push(item.options.map(label).sort(), label(item.options.find((o) => o.id === item.correctId) ?? { text: { ro: '?' } }))
      break
    }
    case 'true-false':
      parts.push(item.correct)
      break
    case 'number-input':
      parts.push(item.correct)
      break
    case 'fill-gap':
      parts.push(text(item.template), item.correct)
      break
    case 'read-and-answer':
      parts.push(text(item.passage), item.questions.map((q) => contentKey(q)))
      break
    default:
      parts.push(JSON.stringify(item, (k, v) => (['id', 'provenance', 'explanationId', 'reviewStatus', 'skillId', 'difficulty'].includes(k) ? undefined : v)))
  }
  return JSON.stringify(parts)
}

const mix = (a: number, b: number) => (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(b + 1, 0xc2b2ae35)) >>> 0

interface Ctx {
  allowed: ReadonlySet<ItemType>
  seenKeys: Set<string>
  seenIds: Set<string>
}

function accept(item: Item, ctx: Ctx): boolean {
  if (!ctx.allowed.has(item.type)) return false
  const key = contentKey(item)
  if (ctx.seenKeys.has(key) || ctx.seenIds.has(item.id)) return false
  ctx.seenKeys.add(key)
  ctx.seenIds.add(item.id)
  return true
}

/** Up to `k` new items of one skill */
function collect(skill: Skill, k: number, part: ExamPart, seed: number, ctx: Ctx): Item[] {
  const out: Item[] = []
  if (k <= 0) return out
  const hasGenerator = skill.itemSources.some((s) => 'generator' in s)
  if (!hasGenerator) {
    const bank = [...getItemsForSkill(skill.id)].sort((a, b) => a.id.localeCompare(b.id))
    for (const item of shuffle(mulberry32(seed), bank)) {
      if (out.length >= k) break
      if (accept(item, ctx)) out.push(item)
    }
    return out
  }
  for (let round = 0; round < 8 && out.length < k; round++) {
    const batch = generateItems(skill, (k - out.length) * 2 + 2, { difficulty: part.difficulty, seed: mix(seed, round) })
    for (const item of batch) {
      if (out.length >= k) break
      if (accept(item, ctx)) out.push(item)
    }
  }
  return out
}

/** `count` items for a part, spread over its skills (shuffled by the seed), topped up from any skill if one runs short */
function assemblePart(part: ExamPart, skills: Skill[], seed: number, ctx: Ctx): Item[] {
  const order = shuffle(mulberry32(mix(seed, 777)), skills)
  const quota = order.map((_, i) => Math.floor(part.count / order.length) + (i < part.count % order.length ? 1 : 0))
  const items: Item[] = []
  order.forEach((skill, i) => items.push(...collect(skill, quota[i], part, mix(seed, i + 1), ctx)))
  for (let pass = 0; items.length < part.count && pass < 3; pass++) {
    for (const [i, skill] of order.entries()) {
      if (items.length >= part.count) break
      items.push(...collect(skill, part.count - items.length, part, mix(seed, 100 + pass * 10 + i), ctx))
    }
  }
  return items.slice(0, part.count)
}

export interface AssembleOptions {
  /** PRNG seed: same blueprint + seed => identical test. Default: random. */
  seed?: number
}

export function assembleTest(blueprint: ExamBlueprint, opts: AssembleOptions = {}): AssembledTest {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0
  const ctx: Ctx = { allowed: new Set(blueprint.allowedTypes), seenKeys: new Set(), seenIds: new Set() }
  const sections: AssembledSection[] = []
  const skippedSections: string[] = []
  const shortfalls: AssembledTest['shortfalls'] = []

  blueprint.sections.forEach((section, si) => {
    const items: Item[] = []
    let resolvedAny = false
    section.parts.forEach((part, pi) => {
      const skills = resolveSkills(part.skills)
      if (skills.length === 0) return
      resolvedAny = true
      const got = assemblePart(part, skills, mix(seed, si * 100 + pi), ctx)
      if (got.length < part.count) shortfalls.push({ partId: part.id, wanted: part.count, got: got.length })
      items.push(...got)
    })
    if (!resolvedAny || items.length === 0) {
      if (section.optional) skippedSections.push(section.id)
      else shortfalls.push(...section.parts.map((p) => ({ partId: p.id, wanted: p.count, got: 0 })))
      return
    }
    // easy -> hard; stable, so equal difficulties keep the blueprint's part order
    const sorted = items.map((item, i) => ({ item, i })).sort((a, b) => a.item.difficulty - b.item.difficulty || a.i - b.i)
    sections.push({ id: section.id, title: section.title, intro: section.intro, items: sorted.map((e) => e.item) })
  })

  return {
    blueprintId: blueprint.id,
    exam: blueprint.exam,
    test: blueprint.test,
    seed,
    title: blueprint.title,
    timeLimitMin: blueprint.timeLimitMin,
    sections,
    skippedSections,
    shortfalls,
  }
}

/** Flat list of every item in play order */
export const testItems = (test: AssembledTest): Item[] => test.sections.flatMap((s) => s.items)
