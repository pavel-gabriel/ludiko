import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import i18n from '@/i18n/config'
import type { Grade } from '@/engine/types'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { fakeLearner, resetFake, state } from './helpers/fakeLearner'
import BitPage from '@/ui/learn/BitPage'
import LearnHomePage from '@/ui/learn/LearnHomePage'
import MissionPage from '@/ui/learn/MissionPage'
import PlacementPage from '@/ui/learn/PlacementPage'
import SkillMapPage from '@/ui/learn/SkillMapPage'

/* Real subject list here (no mock): the home must show only the subjects of the child's grade */
vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

function profileOf(grade: Grade): ChildProfile {
  return { id: 'p1', nickname: 'Matei', avatar: '🦊', grade, language: 'ro', createdAt: 1, updatedAt: 1, recoveryCode: 'AAAA-BBBB' }
}

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname + loc.search}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn" element={<LearnHomePage />} />
        <Route path="/learn/check/:subject" element={<PlacementPage />} />
        <Route path="/learn/mission/:subject" element={<MissionPage />} />
        <Route path="/learn/bit/:subject/:index" element={<BitPage />} />
        <Route path="/learn/map/:subject" element={<SkillMapPage />} />
        <Route path="/profiles" element={<p>profile picker</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)))
const withGrade = (grade: Grade) => useProfileStore.setState({ profiles: [profileOf(grade)], activeProfile: profileOf(grade), loaded: true })

beforeAll(async () => {
  await i18n.changeLanguage('ro')
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
})
beforeEach(() => {
  vi.useFakeTimers()
  resetFake()
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** The "Toate materiile" panel, opened */
function openAllSubjects() {
  fireEvent.click(screen.getByTestId('toggle-subjects'))
  return screen.getByTestId('all-subjects')
}
const subjectsListed = () => Array.from(screen.getByTestId('all-subjects').children).map((li) => li.getAttribute('data-testid'))

describe('/learn shows only the subjects of the child\'s grade', () => {
  it.each([
    [0, ['subject-mat', 'subject-rom', 'subject-stiinte', 'subject-logic'], /Istorie, Geografie: de la clasa a IV-a/],
    [1, ['subject-mat', 'subject-rom', 'subject-stiinte', 'subject-logic'], /Istorie, Geografie: de la clasa a IV-a/],
    [3, ['subject-mat', 'subject-rom', 'subject-stiinte', 'subject-civ', 'subject-logic'], /Istorie, Geografie: de la clasa a IV-a/],
  ] as const)('grade %i: playable list, and a non-clickable teaser for the rest', async (grade, listed, teaser) => {
    withGrade(grade)
    renderAt('/learn')
    await settle()
    openAllSubjects()
    expect(subjectsListed()).toEqual(listed)
    expect(screen.queryByTestId('subject-geo')).toBeNull()
    const teasers = screen.getAllByTestId('locked-teaser')
    expect(teasers.some((t) => teaser.test(t.textContent ?? ''))).toBe(true)
    for (const t of teasers) {
      expect(t.closest('a')).toBeNull() // a teaser is never a door
      expect(within(t).queryByRole('link')).toBeNull()
    }
    expect(document.querySelector('a[href*="/geo"]')).toBeNull()
  })

  it('grade IV: everything is playable and there is no teaser', async () => {
    withGrade(4)
    renderAt('/learn')
    await settle()
    openAllSubjects()
    expect(subjectsListed()).toEqual(['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic'].map((s) => `subject-${s}`))
    expect(screen.queryByTestId('locked-teaser')).toBeNull()
  })

  it('the exam card is only for grades II–IV', async () => {
    for (const [grade, expected] of [[0, false], [1, false], [2, true], [3, true], [4, true]] as const) {
      withGrade(grade)
      const { unmount } = renderAt('/learn')
      await settle()
      expect(screen.queryByTestId('card-exam') !== null).toBe(expected)
      unmount()
    }
  })

  it('the daily plan on the home never links to a subject above the grade', async () => {
    withGrade(1)
    state.plan = {
      day: '2026-11-25',
      bits: [
        { index: 0, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: false, subject: 'mat', source: 'placement' },
        { index: 1, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: false, subject: 'rom', source: 'placement' },
        { index: 2, kind: 'island', day: '2026-11-25', steps: [], itemCount: 6, done: false, subject: 'stiinte', source: 'placement' },
      ],
    }
    renderAt('/learn')
    await settle()
    const hrefs = Array.from(screen.getByTestId('card-plan').querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/learn/check/mat?plan=1', '/learn/check/rom?plan=1', '/learn/check/stiinte?plan=1'])
  })
})

describe('screens of an unavailable subject send the child home with a friendly note', () => {
  it.each(['/learn/check/geo', '/learn/mission/geo', '/learn/map/geo', '/learn/bit/geo/0', '/learn/check/ist?plan=1'])(
    'grade I opening %s',
    async (path) => {
      withGrade(1)
      renderAt(path)
      await settle()
      const subject = path.split('/')[3].split('?')[0]
      expect(screen.getByTestId('where')).toHaveTextContent(`/learn?locked=${subject}`)
      const note = screen.getByTestId('locked-note')
      expect(note).toHaveTextContent(subject === 'geo' ? 'Geografie începe de la clasa a IV-a' : 'Istorie începe de la clasa a IV-a')
      expect(note).toHaveTextContent('Până atunci, hai să descoperim altceva!')
      // nothing was started or "completed"
      expect(fakeLearner.placementNext).not.toHaveBeenCalled()
      expect(fakeLearner.getTodayMission).not.toHaveBeenCalled()
      expect(fakeLearner.getTodayBits).not.toHaveBeenCalled()
      expect(fakeLearner.getSkillMap).not.toHaveBeenCalled()
    },
  )

  it('grade IV can open geography', async () => {
    withGrade(4)
    state.probes = [{ done: false, skillId: 'geo.x', itemCount: 3, progress: 0.1 }]
    renderAt('/learn/check/geo')
    await settle()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn/check/geo')
    expect(screen.queryByTestId('locked-note')).toBeNull()
  })

  it('the note is not shown for a subject the child can play (a stale link)', async () => {
    withGrade(4)
    renderAt('/learn?locked=geo')
    await settle()
    expect(screen.queryByTestId('locked-note')).toBeNull()
  })

  it('a placement the service calls unavailable goes home with the note instead of "finishing"', async () => {
    withGrade(4)
    state.unavailable = ['mat']
    renderAt('/learn/check/mat')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Să începem!' }))
    await settle()
    expect(fakeLearner.placementNext).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Bravo, exploratorule!' })).toBeNull()
    expect(screen.getByTestId('where')).toHaveTextContent('/learn')
  })
})
