import { vi } from 'vitest'
import type {
  LearnerService,
  LevelHistoryEntry,
  Mission,
  ParentSummary,
  PlacementDone,
  PlacementRecord,
  PlacementSummary,
  ProbeRequest,
  SkillMapNode,
} from '@/learner'

/**
 * In-memory stand-in for `learnerService` (src/learner/contract.ts), for UI tests:
 *   vi.mock('@/learner', async () => ({ learnerService: (await import('./helpers/fakeLearner')).fakeLearner }))
 * It follows the contract's behaviour (placement resumes, the mission is stored, steps complete in place)
 * with scripted data instead of the engine. Every method is a vi.fn, so tests can assert on calls.
 */
export const SUMMARY: PlacementSummary = {
  subject: 'mat',
  level: { grade: 1, semester: 2 },
  gaps: ['mat.add.carry.20'],
  missingCount: 4,
  estimatedWeeks: 3,
  statement: {
    ro: 'Matematică: nivel clasa I, semestrul 2. Clasa reală: a II-a. Lipsesc 4 competențe — estimat 3 săptămâni de misiuni.',
    en: 'Maths: level grade I, semester 2. Actual grade: II. 4 competences missing, about 3 weeks of missions.',
  },
}

export interface FakeState {
  placement: PlacementRecord | undefined
  /** Probes handed out by placementNext, in order; when empty the placement is done */
  probes: ProbeRequest[]
  /** Probes answered so far: [skillId, results] */
  recorded: [string, boolean[]][]
  mission: Mission | undefined
  map: SkillMapNode[]
  summary: ParentSummary
  history: LevelHistoryEntry[]
  /** What applyMasteryCheck answers */
  checkPassed: boolean
}

export function freshState(): FakeState {
  return {
    placement: undefined,
    probes: [],
    recorded: [],
    mission: undefined,
    map: [],
    summary: {
      profileId: 'p1',
      subjects: [
        {
          subject: 'mat',
          improved: [],
          nextUp: [],
          masteredCount: 0,
          totalSkills: 18,
        },
      ],
      playDaysThisWeek: 0,
      tip: { ro: 'Numărați banii la cumpărături.', en: 'Count the money when shopping.' },
    },
    history: [],
    checkPassed: true,
  }
}

export const state: FakeState = freshState()

const record = (completed: boolean): PlacementRecord => ({
  subject: 'mat',
  target: { grade: 2, semester: 1 },
  state: {},
  startedAt: 1,
  updatedAt: 1,
  ...(completed ? { completedAt: 2, summary: SUMMARY } : {}),
})

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export const fakeLearner = {
  schoolSemester: vi.fn(() => 1 as const),
  recordItemResult: vi.fn(async () => {}),
  applyMasteryCheck: vi.fn(async () => ({ passed: state.checkPassed })),
  getPlacement: vi.fn(async () => (state.placement ? clone(state.placement) : undefined)),
  placementNext: vi.fn(async (): Promise<ProbeRequest | PlacementDone> => {
    const next = state.probes.shift()
    if (next) {
      state.placement ??= record(false)
      return next
    }
    state.placement = record(true)
    return { done: true, summary: SUMMARY }
  }),
  placementRecord: vi.fn(async (_p: string, _s: string, skillId: string, results: boolean[]) => {
    state.recorded.push([skillId, results])
  }),
  resetPlacement: vi.fn(async () => {
    state.placement = undefined
  }),
  getTodayMission: vi.fn(async () => (state.mission ? clone(state.mission) : undefined)),
  completeMissionStep: vi.fn(async (_p: string, _s: string, _day: string, index: number, accuracy: number) => {
    const m = state.mission!
    m.steps[index] = { ...m.steps[index], done: true, accuracy }
    if (m.steps.every((s) => s.done)) m.completedAt = 3
    return clone(m)
  }),
  getSkillMap: vi.fn(async () => clone(state.map)),
  getLevelHistory: vi.fn(async () => clone(state.history)),
  getParentSummary: vi.fn(async () => clone(state.summary)),
} satisfies LearnerService

/** Reset scripted data and call history between tests */
export function resetFake(patch: Partial<FakeState> = {}) {
  Object.assign(state, freshState(), patch)
  for (const fn of Object.values(fakeLearner)) fn.mockClear()
}
