/**
 * "Șterge tot" (docs/PRIVACY_DATA_MAP.md F8): one confirmed action that erases everything Ludiko holds about
 * this family, across systems, by calling the existing services (no logic is duplicated here):
 *   classes -> leaveClass for each local profile (deletes the child's own class progress document, best effort)
 *   push    -> unsubscribe this device and delete its pushSubscriptions document (best effort)
 *   family  -> deleteCloudAccount (families/{uid}/** and the Auth user)
 *   local   -> (only when asked) every child profile and its progress on this device
 *   signout -> sign the parent out of this device
 * Nothing is queued: whatever could not be done (offline, login too old) is reported so the parent can retry.
 * Lazy: import this module from the UI only when the parent confirms.
 */
import type { ChildProfile } from '@/profiles/types'

export type EraseStepId = 'classes' | 'push' | 'family' | 'local' | 'signout'
export type EraseStatus = 'done' | 'skipped' | 'partial' | 'failed'

export interface EraseStepResult {
  id: EraseStepId
  status: EraseStatus
  /** Error code (e.g. 'reauth-required') or short reason, never user content */
  detail?: string
}

export interface EraseOptions {
  /** Also delete every local profile and its progress on this device */
  deleteLocal: boolean
  /** Password of the parent account, to re-authenticate the cloud deletion */
  password?: string
}

export interface EraseDeps {
  listProfiles(): Promise<ChildProfile[]>
  leaveClass(profileId: string): Promise<void>
  unsubscribePush(): Promise<void>
  isFamilySignedIn(): boolean
  deleteCloudAccount(password?: string): Promise<void>
  signOut(): Promise<void>
  deleteProfile(id: string): Promise<void>
  isOnline(): boolean
}

async function defaultDeps(): Promise<EraseDeps> {
  const [profiles, classroom, push, state, api] = await Promise.all([
    import('@/profiles/profileService'),
    import('@/classroom/classroomService'),
    import('@/services/pushService'),
    import('@/family/familyState'),
    import('@/family/api'),
  ])
  return {
    listProfiles: profiles.listProfiles,
    leaveClass: classroom.leaveClass,
    unsubscribePush: push.unsubscribe,
    isFamilySignedIn: state.isFamilySignedIn,
    deleteCloudAccount: async (pw) => (await api.getFamilyApi()).deleteCloudAccount(pw),
    signOut: async () => (await api.getFamilyApi()).signOut(),
    deleteProfile: (id) => profiles.deleteProfile(id),
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  }
}

const codeOf = (e: unknown): string => {
  const c = (e as { code?: unknown } | null)?.code
  return typeof c === 'string' ? c : 'failed'
}

export async function eraseAll(opts: EraseOptions, injected?: EraseDeps): Promise<EraseStepResult[]> {
  const d = injected ?? (await defaultDeps())
  const results: EraseStepResult[] = []

  let profiles: ChildProfile[] = []
  try {
    profiles = await d.listProfiles()
  } catch {
    /* local database unavailable: the steps that need profiles report nothing to do */
  }

  // (b) leave classes: the service deletes the child's own progress document best effort
  const linked = profiles.filter((p) => p.classLink)
  if (linked.length === 0) {
    results.push({ id: 'classes', status: 'skipped' })
  } else {
    let failed = 0
    for (const p of linked) {
      try {
        await d.leaveClass(p.id)
      } catch {
        failed++
      }
    }
    if (failed === linked.length) results.push({ id: 'classes', status: 'failed' })
    else if (failed > 0) results.push({ id: 'classes', status: 'partial', detail: 'failed' })
    else if (!d.isOnline()) results.push({ id: 'classes', status: 'partial', detail: 'offline' })
    else results.push({ id: 'classes', status: 'done' })
  }

  // (c) push
  try {
    await d.unsubscribePush()
    results.push(d.isOnline() ? { id: 'push', status: 'done' } : { id: 'push', status: 'partial', detail: 'offline' })
  } catch (e) {
    results.push({ id: 'push', status: 'failed', detail: codeOf(e) })
  }

  // (a) parent cloud account
  let accountGone = false
  if (!d.isFamilySignedIn()) {
    results.push({ id: 'family', status: 'skipped' })
  } else {
    try {
      await d.deleteCloudAccount(opts.password || undefined)
      accountGone = true
      results.push({ id: 'family', status: 'done' })
    } catch (e) {
      results.push({ id: 'family', status: 'failed', detail: codeOf(e) })
    }
  }

  // (d) local wipe, only when asked
  if (!opts.deleteLocal) {
    results.push({ id: 'local', status: 'skipped' })
  } else {
    let failed = 0
    for (const p of profiles) {
      try {
        await d.deleteProfile(p.id)
      } catch {
        failed++
      }
    }
    const status: EraseStatus = failed === 0 ? 'done' : failed === profiles.length ? 'failed' : 'partial'
    results.push({ id: 'local', status })
  }

  // (e) sign out (deleting the account already signs the user out)
  if (accountGone) {
    results.push({ id: 'signout', status: 'done' })
  } else if (!d.isFamilySignedIn()) {
    results.push({ id: 'signout', status: 'skipped' })
  } else {
    try {
      await d.signOut()
      results.push({ id: 'signout', status: 'done' })
    } catch (e) {
      results.push({ id: 'signout', status: 'failed', detail: codeOf(e) })
    }
  }

  return results
}
