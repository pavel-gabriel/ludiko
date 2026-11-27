import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import ro from '@/i18n/ro.json'
import en from '@/i18n/en.json'
import { getSkillsBySubject } from '@/engine/content/registry'
import { buildFamilyRow, buildProgressHistory } from '@/learner/historyModels'
import { MASCOT_LOOKS } from '@/learner/extrasUnlocks'
import { toDayString } from '@/profiles/profileService'
import type { ChildProfile, ProfileProgress } from '@/profiles/types'
import FamilyOverview from '@/ui/family/FamilyOverview'
import ProgressHistoryView from '@/ui/family/ProgressHistory'
import { MascotSvg } from '@/ui/mascot/Mascot'
import MascotLookPicker from '@/ui/mascot/MascotLookPicker'
import { getLook } from '@/ui/mascot/lookStore'
import { stickerName } from '@/ui/album/AlbumView'

const DAY = 86_400_000
const NOW = new Date(2026, 10, 27, 12).getTime()
const day = (ago: number) => toDayString(NOW - ago * DAY)
const mat = getSkillsBySubject('mat')

const progress: ProfileProgress = {
  profileId: 'p1',
  skills: {
    [mat[0].id]: { state: 'mastered', pMastery: 0.95, attempts: 5, correct: 5, lastSeen: NOW, stateChangedAt: NOW - 2 * DAY },
  },
  stars: 4,
  stickers: [],
  playDays: [day(0), day(1), day(9)],
  levelHistory: {
    mat: [
      { at: NOW - 40 * DAY, level: { grade: 2, semester: 1 }, missingCount: 6 },
      { at: NOW - 3 * DAY, level: { grade: 2, semester: 1 }, missingCount: 0 },
    ],
  },
}

const child = (id: string, nickname: string): ChildProfile => ({
  id,
  nickname,
  avatar: '🦊',
  grade: 2,
  language: 'ro',
  createdAt: 0,
  updatedAt: 0,
  recoveryCode: 'X',
})

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})
beforeEach(() => localStorage.clear())
afterEach(() => cleanup())

describe('ProgressHistoryView', () => {
  it('shows the month in words, the weekly chart, check timeline, calendar and time estimate (ro)', () => {
    render(<ProgressHistoryView history={buildProgressHistory(progress, NOW)} name="Ana" />)
    expect(screen.getByText('Ce s-a schimbat luna aceasta')).toBeTruthy()
    const month = screen.getByTestId('history-month')
    expect(within(month).getByText('A stăpânit o insulă nouă.')).toBeTruthy()
    expect(within(month).getByText(/cu 6 lacune mai puține/)).toBeTruthy()
    expect(within(month).getByText(/S-a jucat în 3 zile/)).toBeTruthy()

    const weekly = screen.getByTestId('history-weekly')
    const bars = within(weekly).getByRole('img')
    expect(bars.getAttribute('aria-label')).toContain('Insule stăpânite pe săptămâni')
    expect(bars.querySelectorAll('rect')).toHaveLength(1)

    const mathBlock = screen.getByTestId('history-mat')
    const timeline = within(mathBlock).getByTestId('check-timeline')
    expect(within(timeline).getAllByRole('listitem')).toHaveLength(2)
    expect(timeline.textContent).toContain('nicio lacună')
    expect(timeline.textContent).toContain('clasa 2, semestrul 1')

    const cal = screen.getByTestId('play-calendar')
    expect(cal.querySelectorAll('[data-level]')).toHaveLength(56)
    expect(cal.querySelectorAll('[data-level="1"], [data-level="2"], [data-level="3"]')).toHaveLength(3)
    expect(screen.getByTestId('history-time').textContent).toContain('Aproximativ 15 minute')
  })

  it('speaks English with correct plurals', async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
    render(<ProgressHistoryView history={buildProgressHistory(progress, NOW)} name="Ana" />)
    expect(screen.getByText('What changed this month')).toBeTruthy()
    expect(screen.getByText('Mastered one new island.')).toBeTruthy()
    expect(screen.getByText(/6 gaps fewer/)).toBeTruthy()
    cleanup()
    await act(async () => {
      await i18n.changeLanguage('ro')
    })
  })

  it('prints through window.print', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<ProgressHistoryView history={buildProgressHistory(progress, NOW)} name="Ana" />)
    fireEvent.click(screen.getByTestId('print-history'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Printează \/ Salvează PDF/ })).toBeTruthy()
    print.mockRestore()
  })

  it('has a quiet-month sentence and no bars for a fresh profile', () => {
    const fresh: ProfileProgress = { profileId: 'p2', skills: {}, stars: 0, stickers: [], playDays: [] }
    render(<ProgressHistoryView history={buildProgressHistory(fresh, NOW)} name="Dan" />)
    expect(screen.getByText(/Luna aceasta a fost liniștită/)).toBeTruthy()
    expect(screen.getByTestId('history-weekly').querySelectorAll('rect')).toHaveLength(0)
  })
})

describe('FamilyOverview', () => {
  it('lists every child with a one-line summary and a link to the detail', () => {
    const rows = [
      buildFamilyRow(child('a', 'Ana'), progress, NOW),
      buildFamilyRow(child('b', 'Bogdan'), { ...progress, profileId: 'b', skills: {}, playDays: [], levelHistory: {} }, NOW),
    ]
    render(
      <MemoryRouter>
        <FamilyOverview rows={rows} />
      </MemoryRouter>,
    )
    const ana = screen.getByTestId('family-row-a')
    expect(within(ana).getByTestId('family-line').textContent).toBe(
      'clasa 2: 2 zile de joacă săptămâna asta, o insulă stăpânită, nicio verificare de nivel',
    )
    expect(within(ana).getByRole('link').getAttribute('href')).toBe('/learn/parent/history?profile=a')
    const bogdan = screen.getByTestId('family-row-b')
    expect(within(bogdan).getByTestId('family-line').textContent).toContain('nicio zi de joacă săptămâna asta, nicio insulă stăpânită')
    expect(within(bogdan).getByText('Încă nu a jucat')).toBeTruthy()
  })
})

describe('mascot looks', () => {
  it('draws the chosen look and keeps the classic one as default', () => {
    const { container, rerender } = render(<MascotSvg look="crown" />)
    expect(container.querySelector('[data-look="crown"] [data-look-part="crown"]')).toBeTruthy()
    rerender(<MascotSvg />)
    expect(container.querySelector('svg')!.getAttribute('data-look')).toBe('classic')
    rerender(<MascotSvg look="mint" />)
    expect(container.querySelector('[data-look-part]')).toBeNull() // a colour variant has no accessory
  })

  it('lets the child pick only unlocked looks and remembers the pick on this device', () => {
    render(<MascotLookPicker profileId="p1" earned={['island:mat', 'days7']} />)
    fireEvent.click(screen.getByTestId('toggle-looks'))
    for (const l of MASCOT_LOOKS) expect(screen.getByTestId(`look-${l.id}`)).toBeTruthy()

    // locked: explained, not selectable
    const crown = screen.getByTestId('look-crown')
    expect(crown.getAttribute('aria-disabled')).toBe('true')
    expect(crown.textContent).toContain('încă blocată')
    fireEvent.click(crown)
    expect(getLook('p1')).toBe('classic')

    fireEvent.click(screen.getByTestId('look-glasses'))
    expect(getLook('p1')).toBe('glasses')
    expect(screen.getByTestId('look-glasses').getAttribute('aria-checked')).toBe('true')
    expect(localStorage.getItem('ludiko-mascot-look-p1')).toBe('glasses')

    // a new Ludi anywhere uses the active profile's look
    localStorage.setItem('ludiko-active-profile', 'p1')
    const { container } = render(<MascotSvg />)
    expect(container.querySelector('svg[data-look="glasses"]')).toBeTruthy()
  })

  it('ignores a stored look that does not exist', () => {
    localStorage.setItem('ludiko-mascot-look-p9', 'rainbow-unicorn')
    expect(getLook('p9')).toBe('classic')
  })
})

describe('family strings', () => {
  it('has the same family.extras keys in ro and en (plural forms may differ)', () => {
    const flat = (o: unknown, prefix = ''): string[] =>
      Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k.replace(/_(zero|one|few|many|other)$/, '')}`],
      )
    const base = (list: string[]) => [...new Set(list)].sort()
    expect(base(flat(en.family.extras))).toEqual(base(flat(ro.family.extras)))
  })

  it('names extra stickers in the album', () => {
    const t = i18n.t.bind(i18n)
    expect(stickerName(t, 'extra:island:mat')).toBe('Prima insulă la Matematică')
    expect(stickerName(t, 'extra:days7')).toBe('7 zile de joacă')
    expect(stickerName(t, 'extra:checksAll')).toBe('Toate verificările făcute')
  })
})
