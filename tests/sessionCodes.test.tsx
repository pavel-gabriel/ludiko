import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from '@/i18n/config'
import { firestoreMock, resetFirestore, store } from './helpers/fakeFirestore'

vi.mock('firebase/firestore', async () => (await import('./helpers/fakeFirestore')).firestoreMock)
vi.mock('@/services/firebase', () => ({ db: {}, rtdb: {}, firebaseEnabled: true }))

const live = vi.hoisted(() => ({
  room: null as unknown,
  state: null as unknown,
  csv: [] as { name: string; content: string }[],
}))
vi.mock('@/services/roomManager', () => ({
  listenToRoom: (_id: string, cb: (r: unknown) => void) => { cb(live.room); return () => {} },
  updateRoomStatus: vi.fn(async () => {}),
}))
vi.mock('@/services/gameSession', () => ({
  listenToGameState: (_id: string, cb: (s: unknown) => void) => { cb(live.state); return () => {} },
  setGamePhase: vi.fn(async () => {}),
  advanceQuestion: vi.fn(async () => {}),
}))
vi.mock('@/services/roomGame', () => ({ initRoomGame: vi.fn(async () => {}) }))
vi.mock('@/services/teacherService', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/teacherService')>()
  return { ...real, downloadCSV: (name: string, content: string) => live.csv.push({ name, content }) }
})

import {
  createSession,
  deleteSession,
  isStudentCodeValid,
  labelForStudentCode,
  publishStudentCodes,
  studentCodeKey,
  updateSession,
} from '@/services/teacherService'
import TeacherLiveDashboard from '@/components/teacher/TeacherLiveDashboard'
import { useAuthStore } from '@/store/authStore'
import type { StudentCode } from '@/utils/types'

const CODES: StudentCode[] = [
  { code: 'LION-42', label: 'Maria P.' },
  { code: 'BEAR-15', label: 'Student 2' },
]

beforeAll(async () => {
  void firestoreMock
  await i18n.changeLanguage('en')
})
beforeEach(() => {
  resetFirestore()
  live.csv.length = 0
})

describe('student-code index (sessionCodes)', () => {
  it('keys are `{sessionId}_{CODE}` and carry no label', async () => {
    const id = await createSession('teacher1', 'Class 3A', { gameType: 'mathRace' } as never, 'selfPaced', 0, CODES)
    expect(studentCodeKey(id, 'lion-42')).toBe(`${id}_LION-42`)
    expect(store.get(`sessionCodes/${id}_LION-42`)).toEqual({ sessionId: id, teacherUid: 'teacher1', code: 'LION-42' })
    expect(JSON.stringify([...store.entries()].filter(([k]) => k.startsWith('sessionCodes')))).not.toContain('Maria')
  })

  it('a student device validates a code with one exact-key read', async () => {
    const id = await createSession('teacher1', 'Class 3A', { gameType: 'mathRace' } as never, 'selfPaced', 0, CODES)
    expect(await isStudentCodeValid(id, 'lion-42')).toBe(true)
    expect(await isStudentCodeValid(id, 'Maria Popescu')).toBe(false)
    expect(await isStudentCodeValid('otherSession', 'LION-42')).toBe(false)
    expect(await isStudentCodeValid(id, '')).toBe(false)
    const reads = firestoreMock.getDoc.mock.calls.map((c) => (c[0] as { path: string }).path)
    expect(reads.filter((p) => p.startsWith('sessions/'))).toHaveLength(0)
  })

  it('publishStudentCodes is idempotent (re-published when a draft session starts) and can remove codes', async () => {
    await publishStudentCodes('s1', 't1', CODES)
    await publishStudentCodes('s1', 't1', CODES)
    expect([...store.keys()].filter((k) => k.startsWith('sessionCodes/'))).toHaveLength(2)
    await publishStudentCodes('s1', 't1', [CODES[0]], CODES)
    expect([...store.keys()].filter((k) => k.startsWith('sessionCodes/'))).toEqual(['sessionCodes/s1_LION-42'])
  })

  it('updating the code list and deleting the session keep the index in step', async () => {
    const id = await createSession('teacher1', 'Class 3A', { gameType: 'mathRace' } as never, 'selfPaced', 0, CODES)
    await updateSession(id, { studentCodes: [CODES[1]] })
    expect([...store.keys()].filter((k) => k.startsWith('sessionCodes/'))).toEqual([`sessionCodes/${id}_BEAR-15`])
    await deleteSession(id)
    expect([...store.keys()].filter((k) => k.startsWith('sessionCodes/'))).toHaveLength(0)
    expect(store.has(`sessions/${id}`)).toBe(false)
  })
})

describe('studentLabel is the teacher\'s label, never what the child typed', () => {
  it('labelForStudentCode', () => {
    expect(labelForStudentCode(CODES, 'lion-42')).toBe('Maria P.')
    expect(labelForStudentCode(CODES, 'BEAR-15')).toBe('Student 2')
    expect(labelForStudentCode(CODES, 'UNKNOWN')).toBe('UNKNOWN')
  })

  it('the live dashboard saves and exports the teacher label for each student code', async () => {
    store.set('sessions/s1', {
      teacherUid: 'teacher1', title: 'Class 3A', classroomMode: 'selfPaced', globalTimer: 0, status: 'active', roomId: 'room1',
      settings: { gameType: 'mathRace', rounds: 10 }, studentCodes: CODES, createdAt: 1,
    })
    live.room = {
      id: 'room1', code: 'ABC234', hostId: 't', status: 'playing',
      players: [
        { id: 't', name: 'Profesor', avatar: '👩‍🏫', isHost: true, isReady: true, score: 0 },
        { id: 'u1', name: 'LION-42', avatar: '🦁', isHost: false, isReady: true, score: 0 },
        { id: 'u2', name: 'BEAR-15', avatar: '🐻', isHost: false, isReady: true, score: 0 },
      ],
    }
    live.state = { phase: 'finished', progress: { u1: 8, u2: 5 }, finishTimes: { u1: 1 }, currentIndex: 0 }
    useAuthStore.setState({ uid: 'teacher1' })

    render(
      <MemoryRouter initialEntries={['/teacher/live/s1']}>
        <Routes><Route path="/teacher/live/:sessionId" element={<TeacherLiveDashboard />} /></Routes>
      </MemoryRouter>,
    )
    /* the teacher sees the code and their own label */
    await screen.findByText('LION-42')
    expect(screen.getByText('(Maria P.)')).toBeTruthy()

    fireEvent.click(await screen.findByRole('button', { name: /CSV/i }))
    await waitFor(() => expect(store.has('sessionResults/s1')).toBe(true))
    const saved = (store.get('sessionResults/s1') as { results: { studentCode: string; studentLabel: string }[] }).results
    expect(saved.map((r) => [r.studentCode, r.studentLabel])).toEqual([['LION-42', 'Maria P.'], ['BEAR-15', 'Student 2']])
    expect(live.csv[0].content).toContain('LION-42,Maria P.')
  })
})
