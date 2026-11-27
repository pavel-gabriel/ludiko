import { readFileSync } from 'node:fs'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n/config'
import { getAllSkills, getItemsForSkill } from '@/engine/content/registry'
import { generateItems } from '@/engine/items/generators'
import type { CardContent, Item } from '@/engine/types'
import {
  SNAPSHOT_MAX_OPTIONS,
  SNAPSHOT_MAX_OPTION_LENGTH,
  buildReportSnapshot,
  contextFromRoute,
  sanitizeSnapshot,
} from '@/services/reportSnapshot'
import { validateReportInput } from '@/services/reportService'
import { reconstructSnapshot } from '@/components/admin/reconstructItem'
import ContentReportsSection from '@/components/admin/ContentReportsSection'

const fb = vi.hoisted(() => ({ docs: [] as { id: string; data: () => unknown }[] }))

vi.mock('@/services/firebase', () => ({ db: {}, firebaseEnabled: true }))
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: fb.docs })),
  query: vi.fn((r: unknown) => r),
  updateDoc: vi.fn(),
  where: vi.fn(),
}))

const skill = getAllSkills().find((s) => s.itemSources.some((x) => 'generator' in x))!
const base = {
  skillId: skill.id,
  difficulty: 1,
  reviewStatus: 'auto-checked',
  provenance: { id: 'x', kind: 'item', title: 't', author: 'Ludiko', source: 'own', licence: 'OWN' },
} as const
const card = (id: string, ro: string): CardContent => ({ id, text: { ro } })

const items: Record<string, { item: Item; correct: string; options?: string[] }> = {
  choice: {
    item: { ...base, id: 'c1', type: 'choice', prompt: { ro: 'Cât face 2+2?' }, visual: { kind: 'clock', hours: 1, minutes: 0 }, options: [card('a', '3'), card('b', '4')], correctId: 'b' } as Item,
    correct: '4',
    options: ['3', '4'],
  },
  'number-input': {
    item: { ...base, id: 'n1', type: 'number-input', prompt: { ro: 'Scrie 5' }, correct: 5 } as Item,
    correct: '5',
  },
  'fill-gap': {
    item: { ...base, id: 'f1', type: 'fill-gap', prompt: { ro: 'Completează' }, template: { ro: '{{gap}} + 7 = 15' }, options: ['8', '9'], correct: '8' } as Item,
    correct: '8',
    options: ['8', '9'],
  },
  order: {
    item: { ...base, id: 'o1', type: 'order', prompt: { ro: 'Ordonează' }, cards: [card('x', 'doi'), card('y', 'unu')], correctOrder: ['y', 'x'] } as Item,
    correct: 'unu → doi',
    options: ['doi', 'unu'],
  },
  sort: {
    item: { ...base, id: 's1', type: 'sort', prompt: { ro: 'Sortează' }, categories: [{ id: 'p', label: { ro: 'Pare' } }], cards: [{ ...card('k', '2'), categoryId: 'p' }] } as Item,
    correct: '2 → Pare',
    options: ['2'],
  },
  match: {
    item: { ...base, id: 'm1', type: 'match', prompt: { ro: 'Potrivește' }, pairs: [{ left: card('l', '1'), right: card('r', 'unu') }] } as Item,
    correct: '1 = unu',
    options: ['1 = unu'],
  },
  'read-and-answer': {
    item: {
      ...base, id: 'r1', type: 'read-and-answer', prompt: { ro: 'Citește' }, passage: { ro: 'Ana are un măr.' },
      questions: [{ ...base, id: 'q', type: 'choice', prompt: { ro: 'Ce are Ana?' }, options: [card('a', 'măr'), card('b', 'pară')], correctId: 'a' }],
    } as Item,
    correct: 'măr',
    options: ['Ce are Ana?'],
  },
}

describe('buildReportSnapshot', () => {
  for (const [type, c] of Object.entries(items)) {
    it(`builds a snapshot for ${type}`, () => {
      const snap = buildReportSnapshot(c.item, 'bit', '/learn/bit/mat/1')!
      expect(snap.type).toBe(type)
      expect(snap.correct).toBe(c.correct)
      expect(snap.options).toEqual(c.options)
      expect(snap.skillId).toBe(skill.id)
      expect(snap.subject).toBe(skill.subject)
      expect(snap.grade).toBe(skill.grade)
      expect(snap.context).toBe('bit')
      expect(snap.route).toBe('/learn/bit/mat/1')
    })
  }

  it('includes visualKind, joins fill-gap template and read passage in the prompt', () => {
    expect(buildReportSnapshot(items.choice.item, 'practice', '/practice/x')!.visualKind).toBe('clock')
    expect(buildReportSnapshot(items['fill-gap'].item, 'practice', '/')!.prompt).toContain('{{gap}} + 7 = 15')
    expect(buildReportSnapshot(items['read-and-answer'].item, 'practice', '/')!.prompt).toContain('Ana are un măr.')
  })

  it('trims options and long texts, and has no personal fields', () => {
    const many = Array.from({ length: 15 }, (_, i) => card(`o${i}`, 'x'.repeat(300)))
    const item = { ...items.choice.item, visual: undefined, options: many, correctId: 'o0', prompt: { ro: 'p'.repeat(900) } } as Item
    const snap = buildReportSnapshot(item, 'game', '/game')!
    expect(snap.options).toHaveLength(SNAPSHOT_MAX_OPTIONS)
    expect(snap.options!.every((o) => o.length <= SNAPSHOT_MAX_OPTION_LENGTH)).toBe(true)
    expect(snap.prompt.length).toBeLessThanOrEqual(500)
    expect(snap.correct.length).toBeLessThanOrEqual(200)
    expect(Object.keys(snap).sort()).toEqual(
      ['context', 'correct', 'grade', 'options', 'prompt', 'route', 'skillId', 'subject', 'type'].sort(),
    )
  })

  it('sanitizeSnapshot drops unknown keys (profile ids, answers) and rejects bad input', () => {
    const good = buildReportSnapshot(items['number-input'].item, 'exam', '/learn/exam/a/b')!
    const dirty = sanitizeSnapshot({ ...good, profileId: 'p1', childAnswer: 7 })!
    expect(dirty).not.toHaveProperty('profileId')
    expect(dirty).not.toHaveProperty('childAnswer')
    expect(sanitizeSnapshot({ ...good, context: 'nope' })).toBeUndefined()
    expect(sanitizeSnapshot({ ...good, grade: 12 })).toBeUndefined()
    expect(sanitizeSnapshot('x')).toBeUndefined()
  })

  it('validateReportInput keeps a valid snapshot and drops an invalid one without failing', () => {
    const snap = buildReportSnapshot(items['number-input'].item, 'practice', '/practice/a')!
    const ok = validateReportInput({ itemId: 'n1', reason: 'typo', snapshot: snap })
    expect(ok.ok && ok.value.snapshot).toEqual(snap)
    const bad = validateReportInput({ itemId: 'n1', reason: 'typo', snapshot: { junk: 1 } as never })
    expect(bad.ok).toBe(true)
    expect(bad.ok && bad.value.snapshot).toBeUndefined()
  })

  it('derives the context from the route', () => {
    expect(contextFromRoute('/learn/check/mat')).toBe('placement')
    expect(contextFromRoute('/learn/mission/mat')).toBe('mission')
    expect(contextFromRoute('/learn/bit/mat/2')).toBe('bit')
    expect(contextFromRoute('/learn/exam/en/1')).toBe('exam')
    expect(contextFromRoute('/game')).toBe('game')
    expect(contextFromRoute('/practice/x')).toBe('practice')
  })
})

describe('firestore.rules contentReports', () => {
  const rules = readFileSync('firestore.rules', 'utf8')
  const start = rules.indexOf('match /contentReports/')
  const section = rules.slice(start, rules.indexOf('allow update', start))

  it('allows exactly the snapshot keys, with size limits', () => {
    expect(section).toContain("'appVersion', 'snapshot'])")
    expect(section).toContain("['type', 'prompt', 'options', 'correct', 'visualKind',")
    expect(section).toContain("'skillId', 'subject', 'grade', 'context', 'route'])")
    expect(section).toContain('snapshot.prompt.size() <= 500')
    expect(section).toContain('snapshot.options.size() <= 10')
    expect(section).toContain("['practice', 'bit', 'mission', 'exam', 'game', 'placement']")
    expect(section).not.toMatch(/snapshot\.(uid|profile|answer)/i)
  })
})

describe('reconstructSnapshot (old reports)', () => {
  it('rebuilds a generated item id deterministically', () => {
    const generated = generateItems(skill, 4, { seed: 12345 })
    const target = generated[3]
    expect(target.id).toBe(`gen.${skill.id}.12345.3`)
    const a = reconstructSnapshot(target.id, skill.id)
    const b = reconstructSnapshot(target.id)
    expect(a).toBeDefined()
    expect(a).toEqual(b)
    expect(a!.prompt).toBe(buildReportSnapshot(target, 'practice', '/')!.prompt)
  })

  it('looks up a static bank item', () => {
    const s = getAllSkills().find((x) => getItemsForSkill(x.id).length > 0)!
    const it0 = getItemsForSkill(s.id)[0]
    const snap = reconstructSnapshot(it0.id, s.id)
    expect(snap?.skillId).toBe(s.id)
    expect(snap?.type).toBe(it0.type)
  })

  it('returns undefined for unknown ids', () => {
    expect(reconstructSnapshot('nope-1', skill.id)).toBeUndefined()
    expect(reconstructSnapshot('gen.no-skill.1.1')).toBeUndefined()
    expect(reconstructSnapshot('nope-1')).toBeUndefined()
  })
})

describe('ContentReportsSection', () => {
  const doc = (id: string, data: Record<string, unknown>) => ({
    id,
    data: () => ({ reason: 'wrong-answer', createdAt: 1, status: 'open', ...data }),
  })

  beforeEach(async () => {
    await i18n.changeLanguage('ro')
  })

  const renderIt = () =>
    render(
      <MemoryRouter>
        <ContentReportsSection />
      </MemoryRouter>,
    )

  it('shows the snapshot with the correct option marked and an open-exercise link', async () => {
    const snap = buildReportSnapshot(items.choice.item, 'mission', '/learn/mission/mat')!
    fb.docs = [doc('1', { itemId: 'c1', skillId: skill.id, snapshot: snap })]
    renderIt()
    await waitFor(() => expect(screen.getByText('Cât face 2+2?')).toBeTruthy())
    expect(screen.getByText('(răspuns corect)')).toBeTruthy()
    expect(screen.queryByText('reconstruit')).toBeNull()
    expect(screen.getByTestId('report-item-details').textContent).toContain('Misiune')
    // never a link to a NEW practice session; this fixture item is not in the registry, so no exact preview
    expect(screen.queryByRole('link', { name: /exerci/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Deschide exact această întrebare' })).toBeNull()
  })

  it('reconstructs an old generated report and marks it', async () => {
    const target = generateItems(skill, 2, { seed: 99 })[1]
    fb.docs = [doc('2', { itemId: target.id, skillId: skill.id })]
    renderIt()
    await waitFor(() => expect(screen.getByText('reconstruit')).toBeTruthy())
    expect(screen.getByTestId('report-item-details').textContent).toContain(
      buildReportSnapshot(target, 'practice', '/')!.prompt.slice(0, 20),
    )
    // the admin can open exactly that question, inline
    screen.getByRole('button', { name: 'Deschide exact această întrebare' }).click()
    await waitFor(() => expect(screen.getByTestId('report-exact-item')).toBeTruthy())
  })

  it('falls back to "fără detalii"', async () => {
    fb.docs = [doc('3', { itemId: 'gone-1', skillId: skill.id })]
    renderIt()
    await waitFor(() => expect(screen.getByText('fără detalii')).toBeTruthy())
  })
})
