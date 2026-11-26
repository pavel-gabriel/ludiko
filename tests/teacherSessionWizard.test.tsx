import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import { useAuthStore } from '@/store/authStore'
import type { ClassroomSession } from '@/utils/types'

const svc = vi.hoisted(() => ({
  createSession: vi.fn(async () => 'new1'),
  getSession: vi.fn(),
  updateSession: vi.fn(async () => {}),
  generateStudentCodes: (n: number) =>
    Array.from({ length: n }, (_, i) => ({ code: `CODE-${10 + i}`, label: `Student ${i + 1}` })),
}))
vi.mock('@/services/teacherService', () => svc)
const start = vi.hoisted(() => ({
  startClassroomSession: vi.fn(async () => ({ id: 'room1', players: [{ id: 'u1', name: 'T' }] })),
}))
vi.mock('@/services/classroomStart', () => start)

import SessionConfig from '@/components/teacher/SessionConfig'
import {
  classIssue,
  draftToSession,
  firstBlockedTeacherStep,
  newDraft,
  repeatDraft,
  resizeCodes,
  teacherStepsFor,
  choicesFromSettings,
} from '@/components/teacher/sessionDraft'

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ uid: 'teacher1', loading: false })
  svc.createSession.mockClear()
  svc.updateSession.mockClear()
  svc.getSession.mockReset()
  start.startClassroomSession.mockClear()
})
afterEach(cleanup)

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teacher/session/new" element={<SessionConfig />} />
        <Route path="/teacher/session/:sessionId/edit" element={<SessionConfig />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

const heading = () => screen.getByRole('heading', { level: 2 }).textContent
const next = () => fireEvent.click(screen.getByTestId('setup-next'))
const back = () => fireEvent.click(screen.getByRole('button', { name: /Înapoi/ }))
const pickPreset = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const typeTitle = (v: string) => fireEvent.change(screen.getByLabelText('Titlul sesiunii'), { target: { value: v } })

const past: ClassroomSession = {
  id: 's1',
  teacherUid: 'teacher1',
  title: 'Test adunare',
  settings: {
    gameType: 'mathRace', gameMode: 'raceToFinish', difficulty: 'hard', operations: ['+'], rounds: 12, timePerRound: 20,
    skillIds: ['mat.add.nocarry.20', 'mat.add.carry.20'], subject: 'mat',
  },
  classroomMode: 'teacherControlled',
  globalTimer: 120,
  studentCodes: [{ code: 'LION-11', label: 'A.M.' }, { code: 'BEAR-22', label: 'B.C.' }],
  status: 'finished',
  createdAt: 1,
}

describe('teacher session model', () => {
  it('memory skips "Ce exersăm?"', () => {
    expect(teacherStepsFor('race')).toEqual(['mode', 'practice', 'class', 'ready'])
    expect(teacherStepsFor('sprint')).toEqual(['mode', 'practice', 'class', 'ready'])
    expect(teacherStepsFor('memory')).toEqual(['mode', 'class', 'ready'])
  })

  it('validation: practice first, then a title and at least one student', () => {
    const d = newDraft()
    expect(firstBlockedTeacherStep(d)).toBe('practice')
    const ok = { ...d, title: 'Ora 1', choices: { ...d.choices, classic: true } }
    expect(firstBlockedTeacherStep(ok)).toBeNull()
    expect(classIssue({ ...ok, title: '  ' })).toBe('title')
    expect(classIssue({ ...ok, studentCodes: [] })).toBe('students')
    expect(firstBlockedTeacherStep({ ...ok, title: '' })).toBe('class')
    /* memory needs no practice */
    expect(firstBlockedTeacherStep({ ...d, title: 'x', choices: { ...d.choices, mode: 'memory' } })).toBeNull()
  })

  it('builds the session settings like the game wizard (skills, sprint, memory = pictures)', () => {
    const d = newDraft()
    const skills = draftToSession({ ...d, title: ' T ', choices: { ...d.choices, skillIds: ['mat.add.nocarry.20'], rounds: 8 } })
    expect(skills.title).toBe('T')
    expect(skills.settings).toMatchObject({ gameType: 'mathRace', gameMode: 'raceToFinish', rounds: 8, skillIds: ['mat.add.nocarry.20'], subject: 'mat' })
    const sprint = draftToSession({ ...d, choices: { ...d.choices, mode: 'sprint', classic: true } })
    expect(sprint.settings).toMatchObject({ gameType: 'mathRace', gameMode: 'timedSprint' })
    const mem = draftToSession({ ...d, choices: { ...d.choices, mode: 'memory', skillIds: ['mat.add.nocarry.20'] } })
    expect(mem.settings.gameType).toBe('memoryGame')
    expect(mem.settings).not.toHaveProperty('skillIds')
    expect(mem.classroomMode).toBe('selfPaced')
    expect(mem.globalTimer).toBe(300)
    expect(mem.studentCodes).toHaveLength(10)
  })

  it('resizeCodes keeps the first students and adds unique new ones', () => {
    const d = newDraft()
    const more = resizeCodes(d.studentCodes, 14)
    expect(more).toHaveLength(14)
    expect(more.slice(0, 10)).toEqual(d.studentCodes)
    expect(new Set(more.map((c) => c.code)).size).toBe(14)
    expect(resizeCodes(more, 3)).toEqual(d.studentCodes.slice(0, 3))
    expect(resizeCodes(more, 999)).toHaveLength(30)
  })

  it('repeat: same title, settings and labels, new codes', () => {
    const d = repeatDraft(past)
    expect(d.title).toBe('Test adunare')
    expect(d.classroomMode).toBe('teacherControlled')
    expect(d.globalTimer).toBe(120)
    expect(d.studentCodes.map((c) => c.label)).toEqual(['A.M.', 'B.C.'])
    expect(d.studentCodes.map((c) => c.code)).not.toEqual(['LION-11', 'BEAR-22'])
    expect(d.choices).toMatchObject({ mode: 'race', skillIds: past.settings.skillIds, difficulty: 'hard', rounds: 12, timePerRound: 20, classic: false })
    expect(draftToSession(d).settings).toMatchObject({ ...past.settings })
  })

  it('old v1 sessions load into the wizard (classic game, memory with skills = pictures)', () => {
    expect(choicesFromSettings({ gameType: 'equations', gameMode: 'raceToFinish', difficulty: 'easy', operations: ['×'], rounds: 10, timePerRound: 15 }))
      .toMatchObject({ mode: 'race', classic: true, classicType: 'equations', operations: ['×'] })
    expect(choicesFromSettings({ gameType: 'memoryGame', gameMode: 'raceToFinish', difficulty: 'easy', operations: ['+'], rounds: 8, timePerRound: 90, skillIds: ['mat.add.nocarry.20'] }))
      .toMatchObject({ mode: 'memory', skillIds: [], classic: false })
  })
})

describe('teacher session wizard', () => {
  it('goes Ce jucăm? -> Ce exersăm? -> Clasa -> Gata? and creates a session', async () => {
    renderAt('/teacher/session/new')
    expect(heading()).toBe('Ce jucăm?')
    expect(screen.getAllByTestId('step-dot')).toHaveLength(4)
    next()
    expect(heading()).toBe('Ce exersăm?')
    expect(screen.getByRole('group', { name: 'Clasa elevilor' })).toBeInTheDocument()
    expect(screen.getByTestId('setup-next')).toBeDisabled()
    /* the class grade filters the presets (grade 1: addition to 20 yes, big multiplication no) */
    fireEvent.click(screen.getByRole('button', { name: 'I' }))
    expect(screen.getByRole('button', { name: /Adunare până la 20/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Înmulțire/ })).toBeNull()
    pickPreset(/Adunare până la 20/)
    next()
    expect(heading()).toBe('Clasa')
    /* a title is needed */
    expect(screen.getByTestId('setup-next')).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Scrie un titlu')
    typeTitle('Ora de mate')
    fireEvent.click(screen.getByRole('button', { name: 'Controlat de profesor' }))
    expect(screen.getByText(/Etichetele le vezi doar tu/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Eticheta pentru codul CODE-10'), { target: { value: 'A.M.' } })
    next()
    expect(heading()).toBe('Gata?')
    expect(screen.getByText('Ora de mate')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('teacher-save'))
    await waitFor(() => expect(svc.createSession).toHaveBeenCalled())
    const args = svc.createSession.mock.calls[0] as unknown as unknown[]
    expect(args[0]).toBe('teacher1')
    expect(args[1]).toBe('Ora de mate')
    expect(args[2]).toMatchObject({ gameType: 'mathRace', gameMode: 'raceToFinish', skillIds: ['mat.add.nocarry.20', 'mat.add.carry.20'] })
    expect(args[3]).toBe('teacherControlled')
    expect(args[4]).toBe(300)
    expect((args[5] as { label: string }[])[0].label).toBe('A.M.')
    expect((args[5] as unknown[]).length).toBe(10)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/teacher/session/new1'))
    expect(start.startClassroomSession).not.toHaveBeenCalled()
  })

  it('memory: no practice step, pictures, and "Pornește sesiunea" saves then starts', async () => {
    renderAt('/teacher/session/new')
    fireEvent.click(screen.getByRole('button', { name: /Memorie/ }))
    next()
    expect(heading()).toBe('Clasa')
    expect(screen.getAllByTestId('step-dot')).toHaveLength(3)
    typeTitle('Memorie 1')
    next()
    expect(heading()).toBe('Gata?')
    expect(screen.queryByRole('button', { name: /Schimbă: Exersăm/ })).toBeNull()
    fireEvent.click(screen.getByTestId('teacher-start'))
    await waitFor(() => expect(start.startClassroomSession).toHaveBeenCalled())
    const settings = (svc.createSession.mock.calls[0] as unknown as unknown[])[2] as Record<string, unknown>
    expect(settings.gameType).toBe('memoryGame')
    expect(settings).not.toHaveProperty('skillIds')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/teacher/live/new1'))
  })

  it('"Repetă sesiunea" opens a new session prefilled from a past one', async () => {
    svc.getSession.mockResolvedValue(past)
    renderAt('/teacher/session/new?from=s1')
    await screen.findByRole('heading', { level: 2 })
    expect(heading()).toBe('Ce jucăm?')
    next()
    /* the chosen skills are one of the presets: still selected */
    expect(screen.getByRole('button', { name: /Adunare până la 20/ })).toHaveAttribute('aria-pressed', 'true')
    next()
    expect((screen.getByLabelText('Titlul sesiunii') as HTMLInputElement).value).toBe('Test adunare')
    expect(screen.getAllByLabelText(/Eticheta pentru codul/).map((i) => (i as HTMLInputElement).value)).toEqual(['A.M.', 'B.C.'])
    next()
    fireEvent.click(screen.getByTestId('teacher-save'))
    await waitFor(() => expect(svc.createSession).toHaveBeenCalled())
    const args = svc.createSession.mock.calls[0] as unknown as unknown[]
    expect(svc.updateSession).not.toHaveBeenCalled()
    expect(args[1]).toBe('Test adunare')
    expect(args[3]).toBe('teacherControlled')
    expect(args[4]).toBe(120)
    const codes = args[5] as { code: string; label: string }[]
    expect(codes.map((c) => c.label)).toEqual(['A.M.', 'B.C.'])
    expect(codes.map((c) => c.code)).not.toContain('LION-11')
  })

  it('editing an existing session updates it (and keeps its codes)', async () => {
    svc.getSession.mockResolvedValue({ ...past, status: 'draft' })
    renderAt('/teacher/session/s1/edit')
    await screen.findByRole('heading', { level: 2 })
    next(); next(); next()
    expect(heading()).toBe('Gata?')
    fireEvent.click(screen.getByTestId('teacher-save'))
    await waitFor(() => expect(svc.updateSession).toHaveBeenCalled())
    const [id, payload] = svc.updateSession.mock.calls[0] as unknown as [string, { studentCodes: { code: string }[] }]
    expect(id).toBe('s1')
    expect(payload.studentCodes.map((c) => c.code)).toEqual(['LION-11', 'BEAR-22'])
    expect(svc.createSession).not.toHaveBeenCalled()
  })

  it('Back returns through the steps', () => {
    renderAt('/teacher/session/new')
    next()
    back()
    expect(heading()).toBe('Ce jucăm?')
  })
})

describe('templates and custom questions are gone', () => {
  it('no source file refers to TemplatesPage, saveTemplate or custom questions any more', async () => {
    const { execSync } = await import('node:child_process')
    const hits = execSync(
      "grep -rnE 'TemplatesPage|saveTemplate|CustomQuestion|SessionTemplate|customQuestions' src || true",
      { encoding: 'utf8' },
    )
    expect(hits.trim()).toBe('')
    expect(readFileSync('src/app/AppRoutes.tsx', 'utf8')).not.toContain('/teacher/templates')
  })
})
