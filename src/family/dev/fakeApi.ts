/**
 * In-memory stand-in for the family service, used by the /dev/family fixture (Firebase is not configured
 * in dev). It keeps the real session bookkeeping (familyState) so the badges and prompts behave as live.
 */
import { dbPut } from '@/profiles/db'
import { generateRecoveryCode, getProfile, listProfiles } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'
import { acceptFamilyImport, clearFamilyState, readFamilyState, startFamilySession, updateFamilyState } from '../familyState'
import { FamilyError, type FamilyApi, type FamilyExport, type RemoteChildInfo } from '../types'

export const DEV_UID = 'dev-parent'
export const DEV_EMAIL = 'mama@example.com'

export function createFakeFamilyApi(remote: RemoteChildInfo[] = [], opts: { needsConsent?: boolean } = {}): FamilyApi {
  const cloud = [...remote]
  let consented = !opts.needsConsent
  const syncAll = async () => {
    if (!consented) throw new FamilyError('consent-required')
    const ids = (await listProfiles()).map((p) => p.id)
    const at = Date.now()
    updateFamilyState({ lastSync: at, syncedIds: ids })
    const pending = cloud.filter((c) => !ids.includes(c.id))
    if (pending.length === 0) acceptFamilyImport()
    return { at, pushed: ids.length, pulled: 0, removed: 0, pending }
  }
  return {
    async createAccount(email, _password, consent) {
      if (consent !== true) throw new FamilyError('consent-required')
      return startFamilySession(DEV_UID, email.trim(), true)
    },
    async signIn(email, password) {
      if (password === 'wrong') throw new FamilyError('wrong-credentials')
      return { session: startFamilySession(DEV_UID, email.trim(), false), needsConsent: false }
    },
    async recordConsent() {
      consented = true
    },
    async signOut() {
      clearFamilyState()
    },
    async resetPassword() {},
    syncNow: syncAll,
    async listRemoteChildren() {
      return cloud
    },
    async importRemoteChild(id): Promise<ChildProfile> {
      const found = cloud.find((c) => c.id === id)
      if (!found) throw new FamilyError('not-found')
      const existing = await getProfile(id)
      if (existing) return existing
      const profile: ChildProfile = {
        id,
        nickname: found.nickname,
        avatar: found.avatar,
        grade: found.grade,
        language: 'ro',
        createdAt: found.updatedAt,
        updatedAt: found.updatedAt,
        recoveryCode: generateRecoveryCode(),
      }
      await dbPut('profiles', profile)
      await dbPut('progress', { profileId: id, skills: {}, stars: 0, stickers: [], playDays: [] })
      const s = readFamilyState()
      if (s) updateFamilyState({ syncedIds: [...s.syncedIds, id] })
      return profile
    },
    async deleteCloudAccount(password) {
      if (password === 'wrong') throw new FamilyError('wrong-credentials')
      clearFamilyState()
    },
    async exportAll(): Promise<FamilyExport> {
      return { app: 'ludiko', kind: 'family-export', version: 1, exportedAt: Date.now(), family: null, children: {} }
    },
  }
}
