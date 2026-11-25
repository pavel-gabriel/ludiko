import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import { fakeLearner, resetFake } from './helpers/fakeLearner'
import { useProfileStore } from '@/store/profileStore'
import ParentPage from '@/ui/learn/ParentPage'

vi.mock('@/learner', async () => ({
  learnerService: (await import('./helpers/fakeLearner')).fakeLearner,
}))

class FakePushError extends Error {
  constructor(public code: string) {
    super(code)
  }
}
const svc = {
  getStatus: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(async () => {}),
  updateSettings: vi.fn(),
}
vi.mock('@/services/pushService', () => ({
  PUSH_DEFAULT_HOUR: 17,
  PUSH_HOUR_MIN: 8,
  PUSH_HOUR_MAX: 20,
  PushError: class extends Error {
    constructor(public code: string) {
      super(code)
    }
  },
  getStatus: () => svc.getStatus(),
  subscribe: (...a: unknown[]) => svc.subscribe(...a),
  unsubscribe: () => svc.unsubscribe(),
  updateSettings: (...a: unknown[]) => svc.updateSettings(...a),
}))

const profile = { id: 'p1', nickname: 'Matei', avatar: '🦊', grade: 2 as const, language: 'ro' as const, createdAt: 1, updatedAt: 1, recoveryCode: 'A-B' }

const renderParent = () =>
  render(
    <MemoryRouter initialEntries={['/learn/parent']}>
      <ParentPage />
    </MemoryRouter>,
  )
const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

function enableBrowserPush() {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BKEY')
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj')
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', class {})
}

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})
beforeEach(() => {
  resetFake()
  svc.getStatus.mockReset().mockResolvedValue({ state: 'off', hour: 17, lang: 'ro' })
  svc.subscribe.mockReset().mockResolvedValue({ state: 'on', hour: 17, lang: 'ro' })
  svc.unsubscribe.mockClear()
  svc.updateSettings.mockReset()
  useProfileStore.setState({ profiles: [profile], activeProfile: profile, loaded: true })
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  // @ts-expect-error cleanup of the stubbed property
  delete navigator.serviceWorker
})

describe('parent page: Mementouri zilnice', () => {
  it('is hidden when push is not configured (no VAPID key)', async () => {
    renderParent()
    await settle()
    expect(fakeLearner.getParentSummary).toHaveBeenCalled()
    expect(screen.getByTestId('tip')).toBeInTheDocument()
    expect(screen.queryByTestId('reminders')).toBeNull()
    expect(svc.getStatus).not.toHaveBeenCalled()
  })

  it('shows the consent text, hour 08–20 (default 17) and an off switch', async () => {
    enableBrowserPush()
    renderParent()
    await screen.findByTestId('reminders')
    expect(screen.getByRole('heading', { name: /Mementouri zilnice/ })).toBeInTheDocument()
    const consent = screen.getByTestId('reminders-consent')
    expect(consent).toHaveTextContent(/adresa tehnică a acestui dispozitiv/)
    expect(consent).toHaveTextContent(/ora aleasă, fusul orar, limba și data ultimei zile de joacă/)
    expect(consent).toHaveTextContent(/Nu păstrăm numele, clasa sau progresul copilului/)
    expect(consent).toHaveTextContent(/ștergem tot ce am păstrat/)

    const select = screen.getByTestId('reminders-hour') as HTMLSelectElement
    expect(select.value).toBe('17')
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'])
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('reminders-status')).toHaveTextContent('Oprit')
    expect(screen.queryByTestId('reminders-pause')).toBeNull()
  })

  it('turning it on subscribes with the chosen hour and the app language', async () => {
    enableBrowserPush()
    renderParent()
    await screen.findByTestId('reminders')
    fireEvent.change(screen.getByTestId('reminders-hour'), { target: { value: '9' } })
    expect(svc.updateSettings).not.toHaveBeenCalled() // not subscribed yet: only the choice changes
    svc.subscribe.mockResolvedValue({ state: 'on', hour: 9, lang: 'ro' })
    svc.getStatus.mockResolvedValue({ state: 'on', hour: 9, lang: 'ro' })
    fireEvent.click(screen.getByRole('switch'))
    await settle()
    await settle()
    expect(svc.subscribe).toHaveBeenCalledWith(9, 'ro')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('reminders-status')).toHaveTextContent('la 9:00')
  })

  it('pause, hour change and turning off go through the service', async () => {
    enableBrowserPush()
    svc.getStatus.mockResolvedValue({ state: 'on', hour: 17, lang: 'ro' })
    svc.updateSettings.mockResolvedValueOnce({ state: 'paused', hour: 17, lang: 'ro' })
    renderParent()
    await screen.findByTestId('reminders-pause')
    fireEvent.click(screen.getByTestId('reminders-pause'))
    await settle()
    await settle()
    expect(svc.updateSettings).toHaveBeenCalledWith({ active: false })
    expect(screen.getByTestId('reminders-status')).toHaveTextContent('Pe pauză')
    expect(screen.getByTestId('reminders-pause')).toHaveTextContent('Reia mementourile')

    svc.updateSettings.mockResolvedValueOnce({ state: 'paused', hour: 12, lang: 'ro' })
    fireEvent.change(screen.getByTestId('reminders-hour'), { target: { value: '12' } })
    await settle()
    expect(svc.updateSettings).toHaveBeenLastCalledWith({ hour: 12 })

    svc.getStatus.mockResolvedValue({ state: 'off', hour: 12, lang: 'ro' })
    fireEvent.click(screen.getByRole('switch'))
    await settle()
    await settle()
    expect(svc.unsubscribe).toHaveBeenCalled()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('explains a blocked permission and a failed save, kindly', async () => {
    enableBrowserPush()
    const { PushError } = await import('@/services/pushService')
    svc.subscribe.mockRejectedValueOnce(new (PushError as unknown as new (c: string) => Error)('denied'))
    svc.getStatus.mockResolvedValue({ state: 'denied', hour: 17, lang: 'ro' })
    renderParent()
    await screen.findByTestId('reminders-error')
    expect(screen.getByTestId('reminders-error')).toHaveTextContent('Notificările sunt blocate')
    fireEvent.click(screen.getByRole('switch'))
    await settle()
    await settle()
    expect(screen.getByTestId('reminders-error')).toHaveTextContent('Notificările sunt blocate')

    svc.subscribe.mockRejectedValueOnce(new FakePushError('failed'))
    fireEvent.click(screen.getByRole('switch'))
    await settle()
    await settle()
    expect(screen.getByTestId('reminders-error')).toHaveTextContent('Nu am putut salva setarea')
  })

  it('shows the "Adaugă pe ecranul principal" hint on iOS Safari instead of the controls', async () => {
    enableBrowserPush()
    vi.stubGlobal('PushManager', undefined)
    delete (window as unknown as Record<string, unknown>).PushManager
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148')
    svc.getStatus.mockResolvedValue({ state: 'needs-install', hour: 17, lang: 'ro' })
    renderParent()
    const hint = await screen.findByTestId('reminders-install')
    expect(hint).toHaveTextContent('ecranul principal')
    expect(screen.queryByRole('switch')).toBeNull()
    vi.restoreAllMocks()
  })
})
