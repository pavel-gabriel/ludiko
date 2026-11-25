/**
 * Parent account + cross-device sync (docs/PARENT_SYNC.md). Firebase Auth (email/password) + Firestore.
 * Import it ONLY dynamically (see `api.ts` and `familyGate.ts`), never from a module of the initial bundle.
 *
 * Data (see firestore.rules, section "Families"):
 *   families/{uid}                    { consentAt, consentVersion, createdAt, updatedAt }
 *   families/{uid}/children/{id}      { profile, progress, updatedAt, deviceId, deleted? }
 * Never in the cloud: recoveryCode, classLink, real names, birth dates, photos, per-item answers.
 */
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { auth, db, firebaseEnabled } from '@/services/firebase'
import { dbPut } from '@/profiles/db'
import {
  deleteProfile,
  generateRecoveryCode,
  getProfile,
  getProgress,
  listProfiles,
  updateProgress,
} from '@/profiles/profileService'
import type { ChildProfile, ProfileProgress } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import {
  clearFamilyState,
  getDeviceId,
  readFamilyState,
  readTombstones,
  removeTombstones,
  startFamilySession,
  updateFamilyState,
} from './familyState'
import { clone, merge, mergeProgress, parseChildDoc, sameContent, sameData, stableStringify, toFamilyChild, toTombstone } from './merge'
import {
  CONSENT_VERSION,
  FamilyError,
  PROGRESS_MAX_BYTES,
  type FamilyApi,
  type FamilyChildDoc,
  type FamilyDoc,
  type FamilyExport,
  type FamilySession,
  type RemoteChildInfo,
  type SyncResult,
} from './types'

/** A Firestore request that cannot reach the server may never settle by itself: give up after this long */
const REQUEST_TIMEOUT_MS = 15_000
const BATCH_LIMIT = 400

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function requireFirebase(): void {
  if (!firebaseEnabled) throw new FamilyError('unavailable')
}

const errCode = (e: unknown): string => (typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '')

function toFamilyError(e: unknown): FamilyError {
  if (e instanceof FamilyError) return e
  switch (errCode(e)) {
    case 'auth/email-already-in-use':
      return new FamilyError('email-in-use', e)
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return new FamilyError('invalid-email', e)
    case 'auth/weak-password':
      return new FamilyError('weak-password', e)
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/user-disabled':
      return new FamilyError('wrong-credentials', e)
    case 'auth/too-many-requests':
      return new FamilyError('too-many-requests', e)
    case 'auth/requires-recent-login':
      return new FamilyError('reauth-required', e)
    case 'auth/network-request-failed':
    case 'unavailable':
    case 'deadline-exceeded':
      return new FamilyError('offline', e)
    default:
      return new FamilyError('failed', e)
  }
}

function withTimeout<T>(p: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new FamilyError('offline')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/** Run a Firebase call, mapping its errors to FamilyError */
async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw toFamilyError(e)
  }
}

/** The signed-in (non-anonymous) parent whose uid matches what this device remembers */
async function requireUser(): Promise<User> {
  requireFirebase()
  await auth.authStateReady?.()
  const user = auth.currentUser
  const session = readFamilyState()
  if (!user || user.isAnonymous || !session || session.uid !== user.uid) {
    if (session) clearFamilyState()
    throw new FamilyError('signed-out')
  }
  return user
}

const familyRef = (uid: string) => doc(db, 'families', uid)
const childrenRef = (uid: string) => collection(db, 'families', uid, 'children')
const childRef = (uid: string, id: string) => doc(db, 'families', uid, 'children', id)

async function writeFamilyDoc(uid: string): Promise<void> {
  const now = Date.now()
  const existing = await withTimeout(getDoc(familyRef(uid)))
  const prev = existing.exists() ? (existing.data() as Partial<FamilyDoc>) : undefined
  const data: FamilyDoc = {
    consentAt: now,
    consentVersion: CONSENT_VERSION,
    createdAt: typeof prev?.createdAt === 'number' ? prev.createdAt : now,
    updatedAt: now,
  }
  await withTimeout(setDoc(familyRef(uid), data))
}

async function hasConsent(uid: string): Promise<boolean> {
  const snap = await withTimeout(getDoc(familyRef(uid)))
  if (!snap.exists()) return false
  const d = snap.data() as Partial<FamilyDoc> | undefined
  return typeof d?.consentAt === 'number' && typeof d.consentVersion === 'string'
}

async function readRemoteChildren(uid: string): Promise<Map<string, FamilyChildDoc>> {
  const snap = await withTimeout(getDocs(childrenRef(uid)))
  const out = new Map<string, FamilyChildDoc>()
  for (const d of snap.docs) {
    const parsed = parseChildDoc(d.id, d.data())
    if (parsed) out.set(d.id, parsed)
  }
  return out
}

const info = (c: FamilyChildDoc): RemoteChildInfo => ({
  id: c.profile.id,
  nickname: c.profile.nickname,
  avatar: c.profile.avatar,
  grade: c.profile.grade,
  updatedAt: c.updatedAt,
})

/** Replace the contents of a progress object in place (the caller saves it) */
function replaceProgress(target: ProfileProgress, next: ProfileProgress): void {
  for (const k of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[k]
  Object.assign(target, clone(next))
}

/* ------------------------------------------------------------------ */
/*  Account                                                           */
/* ------------------------------------------------------------------ */

async function createAccount(email: string, password: string, consent: boolean): Promise<FamilySession> {
  if (consent !== true) throw new FamilyError('consent-required')
  requireFirebase()
  const cred = await guard(() => createUserWithEmailAndPassword(auth, email.trim(), password))
  try {
    await writeFamilyDoc(cred.user.uid)
  } catch (e) {
    // no consent on record: do not keep an account the parent never completed
    await deleteUser(cred.user).catch(() => {})
    clearFamilyState()
    throw toFamilyError(e)
  }
  // a brand-new account has no children in the cloud yet, so later ones from other devices import silently
  return startFamilySession(cred.user.uid, cred.user.email ?? email.trim(), true)
}

async function signIn(email: string, password: string): Promise<{ session: FamilySession; needsConsent: boolean }> {
  requireFirebase()
  const cred = await guard(() => signInWithEmailAndPassword(auth, email.trim(), password))
  const needsConsent = !(await guard(() => hasConsent(cred.user.uid)))
  const session = startFamilySession(cred.user.uid, cred.user.email ?? email.trim(), false)
  return { session, needsConsent }
}

async function recordConsent(): Promise<void> {
  const user = await requireUser()
  await guard(() => writeFamilyDoc(user.uid))
}

async function signOut(): Promise<void> {
  clearFamilyState()
  if (!firebaseEnabled) return
  await guard(() => fbSignOut(auth))
}

async function resetPassword(email: string): Promise<void> {
  requireFirebase()
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (e) {
    // do not reveal whether an account exists for this address
    if (errCode(e) === 'auth/user-not-found') return
    throw toFamilyError(e)
  }
}

/* ------------------------------------------------------------------ */
/*  Sync                                                              */
/* ------------------------------------------------------------------ */

let inFlight: Promise<SyncResult> | null = null

/** Pull the cloud, merge with this device, save locally, push what changed. One run at a time. */
function syncNow(): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = runSync().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function runSync(): Promise<SyncResult> {
  const user = await requireUser()
  const uid = user.uid
  const session = readFamilyState()!
  const deviceId = getDeviceId()

  if (!(await guard(() => hasConsent(uid)))) throw new FamilyError('consent-required')
  const remote = await guard(() => readRemoteChildren(uid))

  const locals = new Map<string, { profile: ChildProfile; entry: FamilyChildDoc }>()
  for (const profile of await listProfiles()) {
    locals.set(profile.id, { profile, entry: toFamilyChild(profile, await getProgress(profile.id), deviceId) })
  }
  const tombstones = readTombstones()

  const result: SyncResult = { at: Date.now(), pushed: 0, pulled: 0, removed: 0, pending: [] }
  const inCloud = new Set<string>()
  const settled: string[] = [] // tombstones that reached the cloud
  let tooLarge = false
  let localChanged = false

  const ids = new Set([...locals.keys(), ...remote.keys(), ...Object.keys(tombstones)])
  for (const id of ids) {
    const local = locals.get(id)
    const tomb = tombstones[id] ? toTombstone(tombstones[id].profile, tombstones[id].at, deviceId) : undefined
    const mine = local && tomb ? merge(local.entry, tomb) : (local?.entry ?? tomb)
    const theirs = remote.get(id)
    const merged = mine && theirs ? merge(mine, theirs) : (mine ?? theirs)!

    if (!merged.deleted && !local) {
      // only in the cloud: import it now if the parent already said yes on this device, else offer it
      if (session.accepted) {
        await importChild(merged)
        result.pulled++
        localChanged = true
        inCloud.add(id)
      } else {
        result.pending.push(info(merged))
      }
      if (tomb) settled.push(id) // an edit elsewhere outranked our old deletion
      continue
    }

    if (merged.deleted && local) {
      await deleteProfile(id, { fromSync: true })
      result.removed++
      localChanged = true
    }

    if (!merged.deleted && local && !sameData(merged, local.entry)) {
      // the cloud (or the merge) has something this device lacks
      await applyToLocal(local.profile, merged)
      result.pulled++
      localChanged = true
    }

    if (!theirs || !sameContent(merged, theirs)) {
      const doc: FamilyChildDoc = { ...clone(merged), deviceId }
      if (doc.deleted !== true) delete doc.deleted
      if (new TextEncoder().encode(JSON.stringify(doc.progress)).length > PROGRESS_MAX_BYTES) {
        tooLarge = true
        continue
      }
      await guard(() => withTimeout(setDoc(childRef(uid, id), doc)))
      result.pushed++
    }
    if (tomb) settled.push(id)
    if (!merged.deleted) inCloud.add(id)
  }

  removeTombstones(settled)
  const here = new Set((await listProfiles()).map((p) => p.id))
  updateFamilyState({
    lastSync: result.at,
    syncedIds: [...inCloud].filter((id) => here.has(id)),
    // nothing waiting for an answer: from now on children created on other devices arrive by themselves
    accepted: session.accepted || result.pending.length === 0,
  })

  if (localChanged) await useProfileStore.getState().load().catch(() => {})
  if (tooLarge) throw new FamilyError('too-large')
  return result
}

/** Save the merged child on this device; keeps local-only fields (recoveryCode, classLink) */
async function applyToLocal(local: ChildProfile, merged: FamilyChildDoc): Promise<void> {
  const next: ChildProfile = { ...local, ...merged.profile }
  if (stableStringify(next) !== stableStringify(local)) await dbPut('profiles', next)
  // merge again with the progress as it is right now: a bit saved during the sync is not lost
  await updateProgress(
    local.id,
    (p) => {
      replaceProgress(p, mergeProgress(p, merged.progress))
    },
    { silent: true },
  )
}

/** Create a child that only existed in the cloud (new recovery code; no class link) */
async function importChild(doc: FamilyChildDoc): Promise<ChildProfile> {
  const profile: ChildProfile = { ...doc.profile, recoveryCode: generateRecoveryCode() }
  await dbPut('profiles', profile)
  await dbPut('progress', { ...clone(doc.progress), profileId: profile.id })
  return profile
}

async function listRemoteChildren(): Promise<RemoteChildInfo[]> {
  const user = await requireUser()
  const remote = await guard(() => readRemoteChildren(user.uid))
  return [...remote.values()].filter((c) => !c.deleted).map(info).sort((a, b) => a.updatedAt - b.updatedAt)
}

async function importRemoteChild(id: string): Promise<ChildProfile> {
  const user = await requireUser()
  const remote = await guard(() => readRemoteChildren(user.uid))
  const doc = remote.get(id)
  if (!doc || doc.deleted) throw new FamilyError('not-found')
  const existing = await getProfile(id)
  const profile = existing ?? (await importChild(doc))
  const state = readFamilyState()
  if (state && !state.syncedIds.includes(id)) updateFamilyState({ syncedIds: [...state.syncedIds, id] })
  return profile
}

/* ------------------------------------------------------------------ */
/*  Delete and export                                                 */
/* ------------------------------------------------------------------ */

async function deleteCloudAccount(password?: string): Promise<void> {
  const user = await requireUser()
  if (password !== undefined) {
    if (!user.email) throw new FamilyError('failed')
    await guard(() => reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email!, password)))
  }
  await guard(async () => {
    const snap = await withTimeout(getDocs(childrenRef(user.uid)))
    for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db)
      for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(childRef(user.uid, d.id))
      await withTimeout(batch.commit())
    }
    await withTimeout(deleteDoc(familyRef(user.uid)))
  })
  await guard(() => deleteUser(user)) // 'reauth-required' when the login is too old and no password was given
  clearFamilyState()
}

async function exportAll(): Promise<FamilyExport> {
  const user = await requireUser()
  return guard(async () => {
    const fam = await withTimeout(getDoc(familyRef(user.uid)))
    const snap = await withTimeout(getDocs(childrenRef(user.uid)))
    const children: Record<string, FamilyChildDoc> = {}
    for (const d of snap.docs) children[d.id] = d.data() as FamilyChildDoc
    return {
      app: 'ludiko' as const,
      kind: 'family-export' as const,
      version: 1 as const,
      exportedAt: Date.now(),
      family: fam.exists() ? (fam.data() as FamilyDoc) : null,
      children,
    }
  })
}

export const familyApi: FamilyApi = {
  createAccount,
  signIn,
  recordConsent,
  signOut,
  resetPassword,
  syncNow,
  listRemoteChildren,
  importRemoteChild,
  deleteCloudAccount,
  exportAll,
}

export { createAccount, signIn, recordConsent, signOut, resetPassword, syncNow, listRemoteChildren, importRemoteChild, deleteCloudAccount, exportAll }
