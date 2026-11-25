import { createHash, webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const setDoc = vi.fn(async (..._a: unknown[]) => {})
const updateDoc = vi.fn(async (..._a: unknown[]) => {})
const deleteDoc = vi.fn(async (..._a: unknown[]) => {})
const docFn = vi.fn((_db: unknown, coll: string, id: string) => ({ path: `${coll}/${id}` }))
vi.mock('firebase/firestore', () => ({
  doc: (...a: [unknown, string, string]) => docFn(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
}))
vi.mock('@/services/firebase', () => ({ db: { fake: true }, firebaseEnabled: true }))
const ensureAnonymousAuth = vi.fn(async () => null)
vi.mock('@/services/authService', () => ({ ensureAnonymousAuth: () => ensureAnonymousAuth() }))

import {
  PUSH_COLLECTION,
  PushError,
  getStatus,
  isPushSupported,
  isValidHour,
  localDay,
  markPlayedToday,
  sha256Hex,
  subscribe,
  unsubscribe,
  updateSettings,
  urlBase64ToUint8Array,
} from '@/services/pushService'
import { PUSH_STATE_KEY, isIos, needsInstall, readPushState } from '@/services/pushAvailability'

const ENDPOINT = 'https://push.example.com/send/abc123'
const ENDPOINT_ID = createHash('sha256').update(ENDPOINT).digest('hex')
const VAPID = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

let permission: NotificationPermission
let existingSub: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null
const pmSubscribe = vi.fn()
const getSubscription = vi.fn()

function makeSub() {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'P256DH', auth: 'AUTH' }, expirationTime: null }),
    unsubscribe: vi.fn(async () => true),
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID)
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'key')
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj')
  vi.stubGlobal('crypto', webcrypto)
  permission = 'default'
  existingSub = null
  for (const fn of [setDoc, updateDoc, deleteDoc, docFn, ensureAnonymousAuth, pmSubscribe, getSubscription]) fn.mockClear()
  getSubscription.mockImplementation(async () => existingSub)
  pmSubscribe.mockImplementation(async () => (existingSub = makeSub()))
  const registration = { pushManager: { getSubscription, subscribe: pmSubscribe } }
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(registration) } })
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal(
    'Notification',
    class {
      static get permission() {
        return permission
      }
      static requestPermission = vi.fn(async () => permission)
    },
  )
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  // @ts-expect-error cleanup of the stubbed property
  delete navigator.serviceWorker
})

describe('helpers', () => {
  it('sha256Hex is the lowercase hex SHA-256 of the endpoint', async () => {
    expect(await sha256Hex(ENDPOINT)).toBe(ENDPOINT_ID)
    expect(ENDPOINT_ID).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hours are integers from 8 to 20', () => {
    expect([7, 8, 17, 20, 21, 8.5, NaN].map(isValidHour)).toEqual([false, true, true, true, false, false, false])
    expect(isValidHour('9')).toBe(false)
  })

  it('localDay is the local calendar day', () => {
    expect(localDay(new Date(2026, 10, 5, 23, 59).getTime())).toBe('2026-11-05')
  })

  it('decodes the VAPID key from base64url', () => {
    const bytes = urlBase64ToUint8Array(VAPID)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04) // uncompressed P-256 point
  })
})

describe('availability', () => {
  it('is hidden without a VAPID key, without Firebase, or without Push support', () => {
    expect(isPushSupported()).toBe(true)
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', '')
    expect(isPushSupported()).toBe(false)
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID)
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '')
    expect(isPushSupported()).toBe(false)
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj')
    vi.stubGlobal('PushManager', undefined)
    delete (window as unknown as Record<string, unknown>).PushManager
    expect(isPushSupported()).toBe(false)
  })

  it('asks iOS users to add the app to the Home Screen first', () => {
    const ua = vi.spyOn(navigator, 'userAgent', 'get')
    ua.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
    expect(isIos()).toBe(true)
    expect(needsInstall()).toBe(true)
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('standalone') }))
    expect(needsInstall()).toBe(false)
    ua.mockReturnValue('Mozilla/5.0 (Linux; Android 14) Chrome/124')
    expect(isIos()).toBe(false)
    ua.mockRestore()
  })
})

describe('subscribe', () => {
  it('writes exactly the contract document: no personal fields, id = sha256(endpoint)', async () => {
    permission = 'granted'
    const status = await subscribe(17, 'ro-RO')

    expect(pmSubscribe).toHaveBeenCalledTimes(1)
    const opts = pmSubscribe.mock.calls[0][0]
    expect(opts.userVisibleOnly).toBe(true)
    expect(Array.from(opts.applicationServerKey as Uint8Array)).toEqual(Array.from(urlBase64ToUint8Array(VAPID)))

    expect(ensureAnonymousAuth).toHaveBeenCalled()
    expect(docFn).toHaveBeenCalledWith({ fake: true }, PUSH_COLLECTION, ENDPOINT_ID)
    expect(PUSH_COLLECTION).toBe('pushSubscriptions')
    expect(setDoc).toHaveBeenCalledTimes(1)
    const [ref, data, options] = setDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>, unknown]
    expect(ref.path).toBe(`pushSubscriptions/${ENDPOINT_ID}`)
    expect(options).toEqual({ merge: true }) // keeps the sender's lastSentDay on a returning device

    expect(Object.keys(data).sort()).toEqual(
      ['active', 'createdAt', 'endpoint', 'hour', 'keys', 'lang', 'timezone', 'updatedAt'].sort(),
    )
    expect(data).toMatchObject({
      endpoint: ENDPOINT,
      keys: { p256dh: 'P256DH', auth: 'AUTH' },
      hour: 17,
      lang: 'ro',
      active: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    expect(typeof data.createdAt).toBe('number')
    expect(typeof data.updatedAt).toBe('number')
    expect(data).not.toHaveProperty('lastSentDay')
    expect(data).not.toHaveProperty('lastPlayedDay')
    expect(Object.keys(data as object).some((k) => /profile|nick|name|grade|progress|uid/i.test(k))).toBe(false)

    expect(status).toEqual({ state: 'on', hour: 17, lang: 'ro' })
    expect(readPushState()).toEqual({ id: ENDPOINT_ID, hour: 17, lang: 'ro', active: true })
  })

  it('reuses an existing browser subscription and maps English to "en"', async () => {
    permission = 'granted'
    existingSub = makeSub()
    await subscribe(8, 'en-GB')
    expect(pmSubscribe).not.toHaveBeenCalled()
    expect((setDoc.mock.calls[0][1] as { lang: string }).lang).toBe('en')
  })

  it('rejects hours outside 08–20 before asking for anything', async () => {
    permission = 'granted'
    for (const h of [7, 21, 12.5]) await expect(subscribe(h, 'ro')).rejects.toMatchObject({ code: 'invalid-hour' })
    expect(pmSubscribe).not.toHaveBeenCalled()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it('stores nothing when the parent denies the permission', async () => {
    permission = 'denied'
    await expect(subscribe(17, 'ro')).rejects.toMatchObject({ code: 'denied' })
    expect(pmSubscribe).not.toHaveBeenCalled()
    expect(setDoc).not.toHaveBeenCalled()
    expect(localStorage.getItem(PUSH_STATE_KEY)).toBeNull()
  })

  it('fails with a PushError and no local state when Firestore rejects the write', async () => {
    permission = 'granted'
    setDoc.mockRejectedValueOnce(new Error('offline'))
    await expect(subscribe(17, 'ro')).rejects.toBeInstanceOf(PushError)
    expect(readPushState()).toBeNull()
  })

  it('is unsupported without the Push API', async () => {
    delete (window as unknown as Record<string, unknown>).PushManager
    await expect(subscribe(17, 'ro')).rejects.toMatchObject({ code: 'unsupported' })
  })
})

describe('settings, played day and unsubscribe', () => {
  async function subscribed() {
    permission = 'granted'
    await subscribe(17, 'ro')
    setDoc.mockClear()
    ensureAnonymousAuth.mockClear()
    docFn.mockClear()
  }

  it('updateSettings changes hour / pause / language only (plus updatedAt)', async () => {
    await subscribed()
    expect(await updateSettings({ hour: 9 })).toEqual({ state: 'on', hour: 9, lang: 'ro' })
    expect(updateDoc).toHaveBeenLastCalledWith(
      { path: `pushSubscriptions/${ENDPOINT_ID}` },
      { hour: 9, lang: 'ro', active: true, updatedAt: expect.any(Number) },
    )
    expect((await updateSettings({ active: false })).state).toBe('paused')
    expect((updateDoc.mock.calls.at(-1)![1] as { active: boolean }).active).toBe(false)
    expect(readPushState()).toMatchObject({ hour: 9, active: false })
    expect((await updateSettings({ lang: 'en-US' })).lang).toBe('en')
  })

  it('updateSettings enforces the hour bounds and needs a subscription', async () => {
    await expect(updateSettings({ hour: 10 })).rejects.toBeInstanceOf(PushError)
    await subscribed()
    updateDoc.mockClear()
    for (const hour of [7, 21]) await expect(updateSettings({ hour })).rejects.toMatchObject({ code: 'invalid-hour' })
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('markPlayedToday writes the local day, and only on a subscribed device', async () => {
    await markPlayedToday()
    expect(updateDoc).not.toHaveBeenCalled()

    await subscribed()
    const now = new Date(2026, 10, 25, 18, 30).getTime()
    await markPlayedToday(now)
    expect(updateDoc).toHaveBeenCalledWith({ path: `pushSubscriptions/${ENDPOINT_ID}` }, { lastPlayedDay: '2026-11-25', updatedAt: now })
  })

  it('markPlayedToday never throws (offline, document gone)', async () => {
    await subscribed()
    updateDoc.mockRejectedValueOnce(new Error('not-found'))
    await expect(markPlayedToday()).resolves.toBeUndefined()
  })

  it('unsubscribe deletes the document, unsubscribes the browser and forgets the state', async () => {
    await subscribed()
    const sub = existingSub!
    await unsubscribe()
    expect(deleteDoc).toHaveBeenCalledWith({ path: `pushSubscriptions/${ENDPOINT_ID}` })
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(readPushState()).toBeNull()
  })

  it('unsubscribe still unsubscribes the browser when the delete fails', async () => {
    await subscribed()
    const sub = existingSub!
    deleteDoc.mockRejectedValueOnce(new Error('offline'))
    await unsubscribe()
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(readPushState()).toBeNull()
  })
})

describe('getStatus', () => {
  it('reports off / on / paused / denied / unsupported', async () => {
    expect((await getStatus()).state).toBe('off')

    permission = 'granted'
    await subscribe(18, 'ro')
    expect(await getStatus()).toEqual({ state: 'on', hour: 18, lang: 'ro' })
    await updateSettings({ active: false })
    expect((await getStatus()).state).toBe('paused')

    permission = 'denied'
    expect((await getStatus()).state).toBe('denied')

    delete (window as unknown as Record<string, unknown>).PushManager
    expect((await getStatus()).state).toBe('unsupported')
  })

  it('forgets a subscription the browser no longer has', async () => {
    permission = 'granted'
    await subscribe(18, 'ro')
    existingSub = null
    expect((await getStatus()).state).toBe('off')
    expect(readPushState()).toBeNull()
  })
})
