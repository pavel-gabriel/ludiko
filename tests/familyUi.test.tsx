import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n/config'
import { setFamilyApi } from '@/family/api'
import { clearFamilyState, readFamilyState, startFamilySession, updateFamilyState } from '@/family/familyState'
import { FamilyError, type FamilyApi, type RemoteChildInfo } from '@/family/types'
import { _resetMemoryForTests } from '@/profiles/db'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import FamilyAccountCard from '@/components/family/FamilyAccountCard'
import FamilyImportPrompt from '@/components/family/FamilyImportPrompt'
import ProfilePickerPage from '@/components/profiles/ProfilePickerPage'

function makeApi(over: Partial<FamilyApi> = {}): FamilyApi & { [K in keyof FamilyApi]: ReturnType<typeof vi.fn> } {
  const api = {
    createAccount: vi.fn(async (email: string) => startFamilySession('u1', email, true)),
    signIn: vi.fn(async (email: string) => ({ session: startFamilySession('u1', email, false), needsConsent: false })),
    recordConsent: vi.fn(async () => {}),
    signOut: vi.fn(async () => clearFamilyState()),
    resetPassword: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {
      updateFamilyState({ lastSync: Date.now() })
      return { at: Date.now(), pushed: 0, pulled: 0, removed: 0, pending: [] }
    }),
    listRemoteChildren: vi.fn(async (): Promise<RemoteChildInfo[]> => []),
    importRemoteChild: vi.fn(async (id: string) => ({ id }) as ChildProfile),
    deleteCloudAccount: vi.fn(async (password?: string) => {
      if (password === 'wrong') throw new FamilyError('wrong-credentials')
      clearFamilyState()
    }),
    exportAll: vi.fn(async () => ({ app: 'ludiko', kind: 'family-export', version: 1, exportedAt: 1, family: null, children: {} })),
    ...over,
  }
  return api as never
}

const remote = (id: string, nickname: string): RemoteChildInfo => ({ id, nickname, avatar: '🦊', grade: 3, updatedAt: 1 })

async function addLocal(nickname: string) {
  const p = await useProfileStore.getState().create({ nickname, avatar: '🐼', grade: 2, language: 'ro' })
  return p
}

beforeAll(async () => {
  await i18n.changeLanguage('ro')
})

beforeEach(() => {
  _resetMemoryForTests()
  localStorage.clear()
  useProfileStore.setState({ profiles: [], activeProfile: null, loaded: false })
})

afterEach(() => {
  cleanup()
  setFamilyApi(null)
})

describe('FamilyAccountCard: availability', () => {
  it('renders nothing where accounts cannot work (no Firebase configured), unless asked to explain', () => {
    const { container } = render(<FamilyAccountCard />)
    expect(container).toBeEmptyDOMElement()
    cleanup()
    render(<FamilyAccountCard showUnavailable />)
    expect(screen.getByText(/nu sunt disponibile/i)).toBeInTheDocument()
  })
})

describe('FamilyAccountCard: creating an account needs the consent checkbox', () => {
  it('lists what is stored and what never is, before anything is submitted', async () => {
    const api = makeApi()
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-create'))
    const consent = screen.getByTestId('family-consent')
    expect(within(consent).getByText(/porecla, avatarul, clasa și limba/i)).toBeInTheDocument()
    expect(within(consent).getByText(/stelele, autocolantele, zilele jucate/i)).toBeInTheDocument()
    expect(within(consent).getByText(/numele real, data nașterii/i)).toBeInTheDocument()
    expect(within(consent).getByText(/Politica de confidențialitate/i)).toBeInTheDocument()
    expect(within(consent).getByText(/Cum ștergi contul/i)).toBeInTheDocument()
    expect(api.createAccount).not.toHaveBeenCalled()
  })

  it('cannot be submitted without the checkbox, by button or by form submit', async () => {
    const api = makeApi()
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-create'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'parola123' } })

    const submit = screen.getByTestId('family-create-submit')
    expect(submit).toBeDisabled()
    expect(screen.getByTestId('family-consent-checkbox')).not.toBeChecked()
    fireEvent.click(submit)
    fireEvent.submit(screen.getByTestId('family-create-form'))
    await act(async () => {})
    expect(api.createAccount).not.toHaveBeenCalled()
    expect(readFamilyState()).toBeNull()

    // ticking and un-ticking again blocks it again
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    expect(submit).toBeEnabled()
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    expect(submit).toBeDisabled()
    fireEvent.submit(screen.getByTestId('family-create-form'))
    await act(async () => {})
    expect(api.createAccount).not.toHaveBeenCalled()
  })

  it('needs a valid-looking email and a 6+ character password as well', () => {
    setFamilyApi(makeApi())
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-create'))
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    const submit = screen.getByTestId('family-create-submit')
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: '12345' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: '123456' } })
    expect(submit).toBeEnabled()
  })

  it('with the box ticked it creates the account with consent = true and ends up signed in', async () => {
    const api = makeApi()
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-create'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'parola123' } })
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    fireEvent.click(screen.getByTestId('family-create-submit'))
    await waitFor(() => expect(screen.getByTestId('family-email-shown')).toHaveTextContent('mama@example.com'))
    expect(api.createAccount).toHaveBeenCalledWith('mama@example.com', 'parola123', true)
    await waitFor(() => expect(api.syncNow).toHaveBeenCalled())
  })

  it('shows a friendly message when the service refuses', async () => {
    setFamilyApi(makeApi({ createAccount: vi.fn(async () => { throw new FamilyError('email-in-use') }) }))
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-create'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'parola123' } })
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    fireEvent.click(screen.getByTestId('family-create-submit'))
    expect(await screen.findByTestId('family-error')).toHaveTextContent(/există deja un cont/i)
  })
})

describe('FamilyAccountCard: sign in, consent catch-up, password reset', () => {
  it('signs in and syncs', async () => {
    const api = makeApi()
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-signin'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'parola123' } })
    fireEvent.click(screen.getByTestId('family-signin-submit'))
    await waitFor(() => expect(screen.getByTestId('family-email-shown')).toBeInTheDocument())
    expect(api.signIn).toHaveBeenCalledWith('mama@example.com', 'parola123')
    await waitFor(() => expect(api.syncNow).toHaveBeenCalled())
  })

  it('a wrong password shows an error and stays on the form', async () => {
    setFamilyApi(makeApi({ signIn: vi.fn(async () => { throw new FamilyError('wrong-credentials') }) }))
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-signin'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('family-signin-submit'))
    expect(await screen.findByTestId('family-error')).toHaveTextContent(/email sau parolă greșite/i)
    expect(screen.queryByTestId('family-email-shown')).toBeNull()
  })

  it('an account without a consent record is asked for it (checkbox again) before syncing', async () => {
    const api = makeApi({
      signIn: vi.fn(async (email: string) => ({ session: startFamilySession('u1', email, false), needsConsent: true })),
    })
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-signin'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.change(screen.getByTestId('family-password'), { target: { value: 'parola123' } })
    fireEvent.click(screen.getByTestId('family-signin-submit'))
    const accept = await screen.findByTestId('family-accept')
    expect(accept).toBeDisabled()
    fireEvent.click(accept)
    expect(api.recordConsent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('family-consent-checkbox'))
    fireEvent.click(accept)
    await waitFor(() => expect(api.recordConsent).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('family-email-shown')).toBeInTheDocument())
  })

  it('a sync that reports missing consent switches to the consent screen', async () => {
    startFamilySession('u1', 'mama@example.com', true)
    setFamilyApi(makeApi({ syncNow: vi.fn(async () => { throw new FamilyError('consent-required') }) }))
    render(<FamilyAccountCard />)
    expect(await screen.findByTestId('family-accept')).toBeInTheDocument()
  })

  it('forgot password sends the reset and says so without revealing anything', async () => {
    const api = makeApi()
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    fireEvent.click(screen.getByTestId('family-signin'))
    fireEvent.click(screen.getByText('Am uitat parola'))
    fireEvent.change(screen.getByTestId('family-email'), { target: { value: 'mama@example.com' } })
    fireEvent.submit(screen.getByTestId('family-forgot-form'))
    expect(await screen.findByText(/Dacă există un cont pentru această adresă/i)).toBeInTheDocument()
    expect(api.resetPassword).toHaveBeenCalledWith('mama@example.com')
  })
})

describe('FamilyAccountCard: signed in', () => {
  async function renderSignedIn(over: Partial<FamilyApi> = {}) {
    const ana = await addLocal('Ana')
    const bob = await addLocal('Bob')
    startFamilySession('u1', 'mama@example.com', true)
    updateFamilyState({ lastSync: new Date(2026, 10, 25, 9, 30).getTime(), syncedIds: [ana.id] })
    const api = makeApi({ syncNow: vi.fn(async () => ({ at: 1, pushed: 0, pulled: 0, removed: 0, pending: [] })), ...over })
    setFamilyApi(api)
    render(<FamilyAccountCard />)
    await act(async () => {}) // the opening sync settles
    return { api, ana, bob }
  }

  it('shows the email, the children with their sync status and the last sync', async () => {
    await renderSignedIn()
    expect(screen.getByTestId('family-email-shown')).toHaveTextContent('mama@example.com')
    const list = await screen.findByTestId('family-children')
    expect(within(list).getByText('Ana').closest('li')).toHaveTextContent(/sincronizat/)
    expect(within(list).getByText('Ana').closest('li')).not.toHaveTextContent(/nesincronizat/)
    expect(within(list).getByText('Bob').closest('li')).toHaveTextContent(/încă nesincronizat/)
    expect(screen.getByTestId('family-last-sync')).toHaveTextContent(/Ultima sincronizare/)
  })

  it('"Sincronizează acum" syncs and reports it', async () => {
    const { api } = await renderSignedIn()
    await waitFor(() => expect(api.syncNow).toHaveBeenCalledTimes(1)) // on opening
    fireEvent.click(screen.getByTestId('family-sync'))
    await waitFor(() => expect(api.syncNow).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Sincronizat.')).toBeInTheDocument()
  })

  it('a failing sync shows a calm error', async () => {
    await renderSignedIn({ syncNow: vi.fn(async () => { throw new FamilyError('offline') }) })
    expect(await screen.findByTestId('family-error')).toHaveTextContent(/Nu ne putem conecta/i)
  })

  it('sign out returns to the signed-out card and leaves the children alone', async () => {
    const { api } = await renderSignedIn()
    fireEvent.click(screen.getByTestId('family-signout'))
    await waitFor(() => expect(api.signOut).toHaveBeenCalled())
    expect(await screen.findByTestId('family-create')).toBeInTheDocument()
    expect(screen.queryByText('mama@example.com')).toBeNull()
    expect(useProfileStore.getState().profiles).toHaveLength(2)
  })

  it('export downloads the account data', async () => {
    const created: Blob[] = []
    const original = { c: URL.createObjectURL, r: URL.revokeObjectURL }
    URL.createObjectURL = (b: Blob | MediaSource) => {
      created.push(b as Blob)
      return 'blob:x'
    }
    URL.revokeObjectURL = () => {}
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { api } = await renderSignedIn()
    fireEvent.click(screen.getByTestId('family-export'))
    await waitFor(() => expect(api.exportAll).toHaveBeenCalled())
    await waitFor(() => expect(click).toHaveBeenCalled())
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.readAsText(created[0])
    })
    expect(JSON.parse(text)).toMatchObject({ kind: 'family-export' })
    expect(await screen.findByText(/Fișierul a fost descărcat/)).toBeInTheDocument()
    click.mockRestore()
    URL.createObjectURL = original.c
    URL.revokeObjectURL = original.r
  })

  it('deleting the cloud account needs a confirmation and the password', async () => {
    const { api } = await renderSignedIn()
    expect(screen.queryByTestId('family-delete-dialog')).toBeNull()
    fireEvent.click(screen.getByTestId('family-delete'))
    const dialog = screen.getByTestId('family-delete-dialog')
    expect(within(dialog).getByText(/Datele de pe acest dispozitiv rămân/)).toBeInTheDocument()
    expect(api.deleteCloudAccount).not.toHaveBeenCalled()
    const yes = screen.getByTestId('family-delete-yes')
    expect(yes).toBeDisabled()

    // wrong password: error, still signed in, nothing deleted
    fireEvent.change(screen.getByTestId('family-delete-password'), { target: { value: 'wrong' } })
    fireEvent.click(yes)
    await waitFor(() => expect(api.deleteCloudAccount).toHaveBeenCalledWith('wrong'))
    expect(await within(screen.getByTestId('family-delete-dialog')).findByTestId('family-error')).toHaveTextContent(/Email sau parolă greșite/)
    expect(readFamilyState()).not.toBeNull()

    // right password: back to the signed-out card, local children stay
    fireEvent.change(screen.getByTestId('family-delete-password'), { target: { value: 'parola123' } })
    fireEvent.click(screen.getByTestId('family-delete-yes'))
    await waitFor(() => expect(api.deleteCloudAccount).toHaveBeenLastCalledWith('parola123'))
    expect(await screen.findByText(/Contul a fost șters/)).toBeInTheDocument()
    expect(screen.getByTestId('family-create')).toBeInTheDocument()
    expect(useProfileStore.getState().profiles).toHaveLength(2)
  })

  it('cancelling the deletion closes the dialog without calling anything', async () => {
    const { api } = await renderSignedIn()
    fireEvent.click(screen.getByTestId('family-delete'))
    fireEvent.click(screen.getByText('Renunță'))
    expect(screen.queryByTestId('family-delete-dialog')).toBeNull()
    expect(api.deleteCloudAccount).not.toHaveBeenCalled()
  })
})

describe('import prompt ("Am găsit N copii în cont")', () => {
  it('offers the children of the account that this device does not have, and imports them', async () => {
    const matei = await addLocal('Matei')
    startFamilySession('u1', 'mama@example.com', false)
    const api = makeApi({
      listRemoteChildren: vi.fn(async () => [remote(matei.id, 'Matei'), remote('r2', 'Ana'), remote('r3', 'Tudor')]),
      importRemoteChild: vi.fn(async (id: string) => ({ id }) as ChildProfile),
    })
    setFamilyApi(api)
    render(<FamilyImportPrompt />)
    const prompt = await screen.findByTestId('family-import')
    expect(prompt).toHaveTextContent('Am găsit 2 copii în cont')
    expect(prompt).toHaveTextContent('Ana')
    expect(prompt).toHaveTextContent('Tudor')
    expect(prompt).not.toHaveTextContent('Matei')

    fireEvent.click(screen.getByTestId('family-import-all'))
    await waitFor(() => expect(api.importRemoteChild).toHaveBeenCalledTimes(2))
    expect(api.importRemoteChild).toHaveBeenCalledWith('r2')
    expect(api.importRemoteChild).toHaveBeenCalledWith('r3')
    expect(await screen.findByText(/copiii au fost importați/i)).toBeInTheDocument()
    expect(readFamilyState()?.accepted).toBe(true) // from now on sync imports by itself
  })

  it('uses the singular for one child', async () => {
    startFamilySession('u1', 'mama@example.com', false)
    setFamilyApi(makeApi({ listRemoteChildren: vi.fn(async () => [remote('r2', 'Ana')]) }))
    render(<FamilyImportPrompt />)
    expect(await screen.findByTestId('family-import')).toHaveTextContent('Am găsit 1 copil în cont')
  })

  it('"Nu acum" hides it without importing', async () => {
    startFamilySession('u1', 'mama@example.com', false)
    const api = makeApi({ listRemoteChildren: vi.fn(async () => [remote('r2', 'Ana')]) })
    setFamilyApi(api)
    render(<FamilyImportPrompt />)
    await screen.findByTestId('family-import')
    fireEvent.click(screen.getByText('Nu acum'))
    expect(screen.queryByTestId('family-import')).toBeNull()
    expect(api.importRemoteChild).not.toHaveBeenCalled()
    expect(readFamilyState()?.accepted).toBe(false)
  })

  it('does not appear (and does not even ask the cloud) when signed out or already accepted', async () => {
    const api = makeApi({ listRemoteChildren: vi.fn(async () => [remote('r2', 'Ana')]) })
    setFamilyApi(api)
    const { rerender } = render(<FamilyImportPrompt />)
    await act(async () => {})
    expect(screen.queryByTestId('family-import')).toBeNull()

    await act(async () => {
      startFamilySession('u1', 'mama@example.com', true)
      rerender(<FamilyImportPrompt />)
    })
    expect(screen.queryByTestId('family-import')).toBeNull()
    expect(api.listRemoteChildren).not.toHaveBeenCalled()
  })

  it('does not appear when every child of the account is already here', async () => {
    const matei = await addLocal('Matei')
    startFamilySession('u1', 'mama@example.com', false)
    setFamilyApi(makeApi({ listRemoteChildren: vi.fn(async () => [remote(matei.id, 'Matei')]) }))
    render(<FamilyImportPrompt />)
    await waitFor(() => expect(useProfileStore.getState().loaded).toBe(true))
    await act(async () => {})
    expect(screen.queryByTestId('family-import')).toBeNull()
  })

  it('a failing import keeps the prompt and says so', async () => {
    startFamilySession('u1', 'mama@example.com', false)
    setFamilyApi(
      makeApi({
        listRemoteChildren: vi.fn(async () => [remote('r2', 'Ana')]),
        importRemoteChild: vi.fn(async () => { throw new FamilyError('offline') }),
      }),
    )
    render(<FamilyImportPrompt />)
    await screen.findByTestId('family-import')
    fireEvent.click(screen.getByTestId('family-import-all'))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('family-import')).toBeInTheDocument()
    expect(readFamilyState()?.accepted).toBe(false)
  })
})

describe('/profiles (child screen): badge and prompt, never the account', () => {
  const renderPicker = () =>
    render(
      <MemoryRouter>
        <ProfilePickerPage />
      </MemoryRouter>,
    )

  it('marks synced profiles with a cloud badge, shows no email and no account card', async () => {
    const ana = await addLocal('Ana')
    await addLocal('Bob')
    startFamilySession('u1', 'mama@example.com', true)
    updateFamilyState({ syncedIds: [ana.id] })
    setFamilyApi(makeApi())
    renderPicker()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByTestId(`cloud-badge-${ana.id}`)).toHaveAttribute('aria-label', 'Sincronizat în cloud')
    expect(document.querySelectorAll('[data-testid^="cloud-badge-"]')).toHaveLength(1)
    expect(screen.queryByTestId('family-card')).toBeNull()
    expect(screen.queryByText(/mama@example\.com/)).toBeNull()
    expect(screen.queryByText(/Cont de părinte/)).toBeNull()
  })

  it('shows the import prompt after signing in on a device that lacks the children', async () => {
    startFamilySession('u1', 'mama@example.com', false)
    setFamilyApi(makeApi({ listRemoteChildren: vi.fn(async () => [remote('r2', 'Ana'), remote('r3', 'Tudor')]) }))
    renderPicker()
    expect(await screen.findByText('Am găsit 2 copii în cont')).toBeInTheDocument()
    expect(screen.queryByText(/mama@example\.com/)).toBeNull()
  })

  it('no badges and no prompt when nobody is signed in; the only hint is a link on a brand-new device', async () => {
    setFamilyApi(makeApi())
    renderPicker()
    await waitFor(() => expect(useProfileStore.getState().loaded).toBe(true))
    expect(document.querySelectorAll('[data-testid^="cloud-badge-"]')).toHaveLength(0)
    expect(screen.queryByTestId('family-import')).toBeNull()
    expect(screen.getByTestId('family-profiles-link')).toHaveAttribute('href', '/learn/account')
    cleanup()

    await addLocal('Ana')
    useProfileStore.setState({ loaded: false })
    renderPicker()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.queryByTestId('family-profiles-link')).toBeNull()
  })
})
