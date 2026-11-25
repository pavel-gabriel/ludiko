import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import { setClassroomApi } from '@/classroom/api'
import { createFakeApi, DEV_CLASS_ID, DEV_TEACHER_UID } from '@/classroom/dev/fakeApi'
import { ClassCodesView } from '@/components/teacher/classes/ClassCodesPage'
import { ClassView } from '@/components/teacher/classes/ClassPage'
import ClassesPage from '@/components/teacher/classes/ClassesPage'
import Heatmap from '@/components/teacher/classes/Heatmap'
import type { ClassroomApi, SeatDoc, SeatProgressDoc } from '@/classroom/types'
import type { HeatSkill } from '@/classroom/heatmap'
import { useAuthStore } from '@/store/authStore'

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

let api: ClassroomApi

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useAuthStore.setState({ uid: DEV_TEACHER_UID, loading: false })
  api = createFakeApi()
  setClassroomApi(api)
})

afterEach(() => {
  cleanup()
  setClassroomApi(null)
})

describe('Heatmap', () => {
  const SK: HeatSkill[] = [
    { id: 'mat.count.10', grade: 0, semester: 1, prerequisites: [] },
    { id: 'mat.add.10', grade: 0, semester: 2, prerequisites: ['mat.count.10'] },
    { id: 'mat.add.carry.20', grade: 1, semester: 2, prerequisites: ['mat.add.10'] },
  ]
  const seats: SeatDoc[] = [
    { id: 'S1', label: 'A.M.', joinCode: 'S1', linked: true },
    { id: 'S2', label: 'B.C.', joinCode: 'S2', linked: true },
  ]
  const doc = (skills: SeatProgressDoc['subjects']['mat'] extends infer T ? NonNullable<T>['skills'] : never): SeatProgressDoc => ({
    subjects: { mat: { skills } },
    playDaysThisWeek: 1,
    updatedAt: 1,
  })

  it('renders one cell per seat and skill, each with a state, a glyph and a text label', () => {
    render(
      <Heatmap
        seats={seats}
        progress={{ S1: doc({ 'mat.count.10': 'mastered', 'mat.add.10': 'gap', 'mat.add.carry.20': 'learning' }) }}
        subject="mat"
        maxGrade={1}
        skills={SK}
      />,
    )
    const cell = (seat: string, skill: string) => screen.getByTestId(`cell-${seat}-${skill}`)
    expect(cell('S1', 'mat.count.10')).toHaveAttribute('data-state', 'mastered')
    expect(cell('S1', 'mat.add.10')).toHaveAttribute('data-state', 'gap')
    expect(cell('S1', 'mat.add.carry.20')).toHaveAttribute('data-state', 'learning')
    // a seat without a summary is all "unknown"
    expect(cell('S2', 'mat.add.10')).toHaveAttribute('data-state', 'unknown')
    expect(screen.getByText('fără rezumat')).toBeInTheDocument()
    // never colour alone: glyph (decorative) + text label (for screen readers)
    expect(within(cell('S1', 'mat.add.10')).getByText('!')).toBeInTheDocument()
    expect(within(cell('S1', 'mat.add.10')).getByText('Lacună')).toHaveClass('sr-only')
    // grade group headers and a legend with all five states
    expect(screen.getByText('Clasa pregătitoare')).toBeInTheDocument()
    expect(screen.getByText('Clasa I')).toBeInTheDocument()
    const legend = screen.getByRole('list', { name: 'Legendă' })
    for (const label of ['Necunoscut', 'Lacună', 'Învață', 'Exersat', 'Stăpânit']) expect(within(legend).getByText(label)).toBeInTheDocument()
  })

  it('scrolls inside its own box (the page itself does not scroll sideways)', () => {
    render(<Heatmap seats={seats} progress={{}} subject="mat" maxGrade={1} skills={SK} />)
    const region = screen.getByRole('region', { name: 'Harta competențelor' })
    expect(region.className).toMatch(/overflow-auto/)
    expect(region).toHaveAttribute('tabindex', '0') // keyboard users can scroll it
  })

  it('"only gaps" keeps just the columns where somebody has a gap', () => {
    render(
      <Heatmap seats={seats} progress={{ S1: doc({ 'mat.add.10': 'gap' }) }} subject="mat" maxGrade={1} skills={SK} />,
    )
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(3)
    fireEvent.click(screen.getByTestId('heatmap-only-gaps'))
    expect(screen.queryByTestId('cell-S1-mat.count.10')).toBeNull()
    expect(screen.getByTestId('cell-S1-mat.add.10')).toBeInTheDocument()
  })

  it('clicking a skill header offers it for an assignment', () => {
    const onPick = vi.fn()
    render(<Heatmap seats={seats} progress={{}} subject="mat" maxGrade={1} skills={SK} onPickSkill={onPick} />)
    fireEvent.click(screen.getAllByRole('button', { name: /Dă temă:/ })[1])
    expect(onPick).toHaveBeenCalledWith('mat.add.10')
  })
})

describe('class page', () => {
  it('opens on the summary: counts, top gaps with "N elevi au lacune la …", and suggested groups', async () => {
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    const summary = await screen.findByTestId('class-summary')
    expect(screen.getByRole('heading', { name: 'Clasa a III-a B' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rezumat' })).toHaveAttribute('aria-selected', 'true')
    // Scăderea cu împrumut până la 100: five seeded seats have this gap
    const gap = within(summary).getByTestId('gap-mat.sub.borrow.100')
    expect(gap).toHaveTextContent(/5 elevi au lacune la/)
    expect(within(summary).getByTestId('count-with-gaps')).toHaveTextContent('9')
    expect(within(summary).getByTestId('group-mat.sub.borrow.100')).toHaveTextContent(/Grupa 1/)
  })

  it('switching to the map shows the heatmap for every seat', async () => {
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('tab-map'))
    expect(await screen.findByTestId('heatmap')).toBeInTheDocument()
    expect(screen.getAllByRole('rowheader').length).toBe((await api.listSeats(DEV_CLASS_ID)).length)
    expect(screen.getAllByTestId(/^cell-/).some((c) => c.getAttribute('data-state') === 'gap')).toBe(true)
  })

  it('creates an assignment from a gap in the summary: composer opens prefilled, then the service gets the exact input', async () => {
    const create = vi.spyOn(api, 'createAssignment')
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    const gap = await screen.findByTestId('gap-mat.sub.borrow.100')
    fireEvent.click(within(gap).getByRole('button', { name: 'Dă temă' }))

    const composer = await screen.findByTestId('assign-composer')
    expect(screen.getByRole('tab', { name: 'Teme' })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByTestId('assign-picked')).getByText('Scăderea până la 100, cu împrumut')).toBeInTheDocument()
    expect(screen.getByTestId('assign-title')).toHaveValue('Recuperare: Scăderea până la 100, cu împrumut')

    fireEvent.change(screen.getByTestId('assign-due'), { target: { value: '2026-12-15' } })
    fireEvent.change(screen.getByTestId('assign-title'), { target: { value: 'Tema de vineri' } })
    fireEvent.click(within(composer).getByTestId('assign-submit'))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create).toHaveBeenCalledWith(DEV_CLASS_ID, {
      subject: 'mat',
      skillIds: ['mat.sub.borrow.100'],
      title: 'Tema de vineri',
      dueDay: '2026-12-15',
    })
    // the composer closes and the new assignment is listed with its completion
    await waitFor(() => expect(screen.queryByTestId('assign-composer')).toBeNull())
    expect(await screen.findByText('Tema de vineri')).toBeInTheDocument()
  })

  it('cannot send an assignment without a skill', async () => {
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('tab-assignments'))
    fireEvent.click(await screen.findByTestId('assign-new'))
    expect(await screen.findByTestId('assign-submit')).toBeDisabled()
  })

  it('shows completion per seat for an existing assignment', async () => {
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('tab-assignments'))
    const item = await screen.findByTestId('assignment-as1')
    // in the seeded class 4 pupils have practised or mastered the skill; 5 have a gap
    expect(within(item).getByTestId('assignment-as1-done')).toHaveTextContent('4 din 14 au terminat')
  })

  it('seats: labels typed one per line are added; the codes page is linked', async () => {
    const add = vi.spyOn(api, 'addSeat')
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('tab-seats'))
    fireEvent.change(await screen.findByTestId('seat-labels'), { target: { value: 'N.P.\nQ.R., 7' } })
    expect(screen.getByTestId('seat-add')).toHaveTextContent('Adaugă 3 locuri')
    fireEvent.click(screen.getByTestId('seat-add'))
    await waitFor(() => expect(add).toHaveBeenCalledTimes(3))
    expect(add.mock.calls.map((c) => c[1])).toEqual(['N.P.', 'Q.R.', '7'])
    expect(screen.getByTestId('link-codes')).toHaveAttribute('href', `/teacher/classes/${DEV_CLASS_ID}/codes`)
  })

  it('unlink asks first, then the seat gets a new code', async () => {
    const unlink = vi.spyOn(api, 'unlinkSeat')
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('tab-seats'))
    const seats = await api.listSeats(DEV_CLASS_ID)
    const linked = seats.find((s) => s.linked)!
    const before = (await screen.findByTestId(`code-${linked.id}`)).textContent
    expect(before).toContain(linked.joinCode.slice(0, 3))
    fireEvent.click(screen.getByTestId(`unlink-${linked.id}`))
    expect(unlink).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('seat-confirm'))
    await waitFor(() => expect(unlink).toHaveBeenCalledWith(DEV_CLASS_ID, linked.id))
    await waitFor(() => expect(screen.queryByTestId(`seat-${linked.id}`)).toBeNull()) // replaced by the seat with the new code
  })

  it('exports the heatmap as CSV with labels only', async () => {
    const urls: Blob[] = []
    const createObjectURL = vi.fn((b: Blob) => {
      urls.push(b)
      return 'blob:x'
    })
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderPage(<ClassView classId={DEV_CLASS_ID} />)
    await screen.findByTestId('class-summary')
    fireEvent.click(screen.getByTestId('export-csv'))
    expect(click).toHaveBeenCalled()
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.readAsText(urls[0])
    })
    const lines = text.split('\n')
    expect(lines[0].startsWith('Elev,')).toBe(true)
    expect(lines).toHaveLength(15) // header + 14 seats
    expect(lines[1].startsWith('12,')).toBe(true) // numbers sort before letters
    expect(lines.some((l) => l.startsWith('A.M.,'))).toBe(true)
    expect(text).not.toMatch(/Ursulet|recovery/i)
    click.mockRestore()
  })
})

describe('classes list and codes page', () => {
  it('lists the classes and creates a new one', async () => {
    const create = vi.spyOn(api, 'createClass')
    renderPage(<ClassesPage />)
    expect(await screen.findByText('Clasa a III-a B')).toBeInTheDocument()
    expect(screen.getByTestId('class-create')).toBeDisabled()
    fireEvent.change(screen.getByTestId('class-name'), { target: { value: 'Clasa a II-a A' } })
    fireEvent.change(screen.getByTestId('class-grade'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('class-create'))
    await waitFor(() => expect(create).toHaveBeenCalledWith(DEV_TEACHER_UID, { name: 'Clasa a II-a A', grade: 2 }))
    expect(await screen.findByText('Clasa a II-a A')).toBeInTheDocument()
  })

  it('prints one card per seat with the label and the code, nothing else', async () => {
    renderPage(<ClassCodesView classId={DEV_CLASS_ID} />)
    const grid = await screen.findByTestId('codes-grid')
    const seats = await api.listSeats(DEV_CLASS_ID)
    expect(within(grid).getAllByRole('listitem')).toHaveLength(seats.length)
    expect(screen.getByTestId(`print-code-${seats[0].id}`)).toHaveTextContent(seats[0].joinCode.slice(0, 3))
  })
})
