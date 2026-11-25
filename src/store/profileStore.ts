import { create } from 'zustand'
import type { ChildProfile } from '@/profiles/types'
import * as svc from '@/profiles/profileService'
import { initDb } from '@/profiles/db'

interface ProfileState {
  profiles: ChildProfile[]
  activeProfile: ChildProfile | null
  loaded: boolean
  load: () => Promise<void>
  create: (input: svc.ProfileInput) => Promise<ChildProfile>
  update: (id: string, patch: Partial<svc.ProfileInput>) => Promise<void>
  remove: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  importBackup: (text: string) => Promise<ChildProfile>
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profiles: [],
  activeProfile: null,
  loaded: false,
  load: async () => {
    await initDb()
    const profiles = await svc.listProfiles()
    const activeId = svc.getActiveProfileId()
    set({ profiles, activeProfile: profiles.find((p) => p.id === activeId) ?? null, loaded: true })
  },
  create: async (input) => {
    const profile = await svc.createProfile(input)
    set({ profiles: await svc.listProfiles() })
    return profile
  },
  update: async (id, patch) => {
    const updated = await svc.updateProfile(id, patch)
    const active = get().activeProfile
    set({
      profiles: await svc.listProfiles(),
      activeProfile: active?.id === id ? updated : active,
    })
  },
  remove: async (id) => {
    await svc.deleteProfile(id)
    const active = get().activeProfile
    set({ profiles: await svc.listProfiles(), activeProfile: active?.id === id ? null : active })
  },
  setActive: (id) => {
    svc.setActiveProfileId(id)
    set({ activeProfile: get().profiles.find((p) => p.id === id) ?? null })
  },
  importBackup: async (text) => {
    const profile = await svc.importProfile(text)
    const profiles = await svc.listProfiles()
    const active = get().activeProfile
    set({ profiles, activeProfile: active?.id === profile.id ? profile : active })
    return profile
  },
}))
