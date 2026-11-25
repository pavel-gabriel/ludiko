/**
 * What this device remembers about the parent account (docs/PARENT_SYNC.md). Firebase-free and tiny:
 * the gate, the profile service and the screens read it to decide whether the (lazy) service is needed.
 * Nothing secret lives here: no password, no token (Firebase Auth keeps its own session).
 */
import type { CloudProfile, FamilySession } from './types'

export const FAMILY_STATE_KEY = 'ludiko.family.v1'
export const FAMILY_DEVICE_KEY = 'ludiko.family.device'
export const FAMILY_CHANGE_EVENT = 'ludiko-family-change'

/** A child deleted on this device while signed in: kept until the deletion reached the cloud */
export interface LocalTombstone {
  at: number
  profile: CloudProfile
}

interface StoredState extends FamilySession {
  tombstones: Record<string, LocalTombstone>
}

/** Build-time: Firebase is configured, so accounts can work at all */
export function familyConfigured(): boolean {
  const env = import.meta.env
  return Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID)
}

function readStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(FAMILY_STATE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<StoredState>
    if (typeof v.uid !== 'string' || !v.uid || typeof v.email !== 'string') return null
    return {
      uid: v.uid,
      email: v.email,
      lastSync: typeof v.lastSync === 'number' ? v.lastSync : 0,
      syncedIds: Array.isArray(v.syncedIds) ? v.syncedIds.filter((x): x is string => typeof x === 'string') : [],
      accepted: v.accepted === true,
      tombstones: v.tombstones && typeof v.tombstones === 'object' ? v.tombstones : {},
    }
  } catch {
    return null
  }
}

function writeStored(state: StoredState | null): void {
  try {
    if (state) localStorage.setItem(FAMILY_STATE_KEY, JSON.stringify(state))
    else localStorage.removeItem(FAMILY_STATE_KEY)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(FAMILY_CHANGE_EVENT))
  } catch {
    /* storage unavailable: the device just forgets the account */
  }
}

/** The signed-in parent as far as this device knows, or null */
export function readFamilyState(): FamilySession | null {
  const s = readStored()
  if (!s) return null
  const { tombstones: _t, ...session } = s
  void _t
  return session
}

export function isFamilySignedIn(): boolean {
  return readStored() !== null
}

/** Start (or replace) the session; tombstones of a previous account are dropped */
export function startFamilySession(uid: string, email: string, accepted: boolean): FamilySession {
  const prev = readStored()
  const state: StoredState = {
    uid,
    email,
    lastSync: prev?.uid === uid ? prev.lastSync : 0,
    syncedIds: prev?.uid === uid ? prev.syncedIds : [],
    accepted,
    tombstones: prev?.uid === uid ? prev.tombstones : {},
  }
  writeStored(state)
  return readFamilyState()!
}

export function updateFamilyState(patch: Partial<Omit<StoredState, 'uid' | 'email'>>): void {
  const s = readStored()
  if (!s) return
  writeStored({ ...s, ...patch })
}

/** The parent answered the "found N children" question: later children from other devices import by themselves */
export function acceptFamilyImport(): void {
  updateFamilyState({ accepted: true })
}

export function clearFamilyState(): void {
  writeStored(null)
}

export function readTombstones(): Record<string, LocalTombstone> {
  return readStored()?.tombstones ?? {}
}

/** Remember a deletion made on this device so the next sync can propagate it (only while signed in) */
export function addTombstone(profile: CloudProfile, at: number): boolean {
  const s = readStored()
  if (!s) return false
  writeStored({ ...s, tombstones: { ...s.tombstones, [profile.id]: { at, profile } } })
  return true
}

export function removeTombstones(ids: string[]): void {
  const s = readStored()
  if (!s || ids.length === 0) return
  const tombstones = { ...s.tombstones }
  for (const id of ids) delete tombstones[id]
  writeStored({ ...s, tombstones })
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join('')
}

/** Random per-install id; written to synced documents for debugging conflicts only */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(FAMILY_DEVICE_KEY)
    if (existing) return existing
    const id = randomId()
    localStorage.setItem(FAMILY_DEVICE_KEY, id)
    return id
  } catch {
    return 'unknown'
  }
}

/** Re-render hook for screens: called on every change of the stored state (this tab only) */
export function subscribeFamilyState(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(FAMILY_CHANGE_EVENT, cb)
  return () => window.removeEventListener(FAMILY_CHANGE_EVENT, cb)
}
