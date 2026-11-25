import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setFamilyApi } from '@/family/api'
import { _resetFamilyGateForTests, initFamilyGate, noteProfileDeleted, triggerFamilySync } from '@/family/familyGate'
import { clearFamilyState, readTombstones, startFamilySession, updateFamilyState } from '@/family/familyState'
import { FAMILY_SYNC_MIN_INTERVAL_MS, type FamilyApi } from '@/family/types'
import { _resetMemoryForTests } from '@/profiles/db'
import { createProfile, deleteProfile, updateProfile, updateProgress } from '@/profiles/profileService'

const syncNow = vi.fn(async () => ({ at: Date.now(), pushed: 0, pulled: 0, removed: 0, pending: [] }))
const api = { syncNow } as unknown as FamilyApi

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 25, 10, 0, 0))
  _resetFamilyGateForTests()
  _resetMemoryForTests()
  localStorage.clear()
  syncNow.mockClear()
  setFamilyApi(api)
})

afterEach(() => {
  setFamilyApi(null)
  vi.useRealTimers()
})

describe('familyGate: only with a signed-in parent', () => {
  it('does nothing without a family session (and never touches the API)', async () => {
    triggerFamilySync()
    initFamilyGate()
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('saving progress, creating, editing and deleting profiles do not sync when signed out', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🐼', grade: 1, language: 'ro' })
    await updateProgress(p.id, (g) => {
      g.stars = 1
    })
    await updateProfile(p.id, { nickname: 'Ana M.' })
    await deleteProfile(p.id)
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(syncNow).not.toHaveBeenCalled()
    expect(readTombstones()).toEqual({})
  })
})

describe('familyGate: throttle', () => {
  beforeEach(() => {
    startFamilySession('u1', 'mama@example.com', true)
  })

  it('syncs a couple of seconds after the first change, not immediately', async () => {
    triggerFamilySync()
    await flush()
    expect(syncNow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('a burst of changes makes one sync', async () => {
    for (let i = 0; i < 20; i++) triggerFamilySync()
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('at most one sync per minute: later changes share one trailing sync', async () => {
    triggerFamilySync()
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)

    // changes during the next minute
    for (let t = 0; t < 5; t++) {
      await vi.advanceTimersByTimeAsync(5000)
      triggerFamilySync()
    }
    expect(syncNow).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS - 30_000)
    expect(syncNow).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(syncNow).toHaveBeenCalledTimes(2)

    // never two syncs closer than a minute
    const gaps: number[] = []
    let last = 0
    syncNow.mockImplementation(async () => {
      if (last) gaps.push(Date.now() - last)
      last = Date.now()
      return { at: last, pushed: 0, pulled: 0, removed: 0, pending: [] }
    })
    for (let i = 0; i < 40; i++) {
      triggerFamilySync()
      await vi.advanceTimersByTimeAsync(7000)
    }
    expect(gaps.length).toBeGreaterThan(2)
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(FAMILY_SYNC_MIN_INTERVAL_MS - 1)
    syncNow.mockImplementation(async () => ({ at: Date.now(), pushed: 0, pulled: 0, removed: 0, pending: [] }))
  })

  it('counts the last successful sync (even one done by the sync button) toward the minute', async () => {
    updateFamilyState({ lastSync: Date.now() - 10_000 })
    triggerFamilySync()
    await vi.advanceTimersByTimeAsync(40_000)
    expect(syncNow).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(11_000)
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('a failing sync never throws into the caller and is not retried in a loop', async () => {
    syncNow.mockRejectedValueOnce(new Error('offline'))
    triggerFamilySync()
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(50_000)
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('signing out cancels nothing but the next trigger is a no-op', async () => {
    clearFamilyState()
    triggerFamilySync()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(syncNow).not.toHaveBeenCalled()
  })
})

describe('familyGate: where it is wired', () => {
  beforeEach(() => {
    startFamilySession('u1', 'mama@example.com', true)
  })

  it('progress saved through updateProgress triggers a sync; the sync itself (silent) does not', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🐼', grade: 1, language: 'ro' })
    await vi.advanceTimersByTimeAsync(2100)
    syncNow.mockClear()
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS)

    await updateProgress(p.id, (g) => {
      g.stars = 3
    })
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)

    syncNow.mockClear()
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS)
    await updateProgress(p.id, (g) => {
      g.stars = 4
    }, { silent: true })
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('creating and editing a profile trigger a sync', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🐼', grade: 1, language: 'ro' })
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS)
    await updateProfile(p.id, { nickname: 'Ana M.' })
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })

  it('deleting a profile records a tombstone (no recovery code or class link in it) and triggers a sync', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🐼', grade: 1, language: 'ro' })
    await vi.advanceTimersByTimeAsync(2100)
    syncNow.mockClear()
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS)
    await deleteProfile(p.id)
    const t = readTombstones()[p.id]
    expect(t.profile.nickname).toBe('Ana')
    expect(JSON.stringify(t)).not.toContain('recoveryCode')
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1)
  })

  it('a deletion applied by the sync (fromSync) is not recorded again', async () => {
    const p = await createProfile({ nickname: 'Ana', avatar: '🐼', grade: 1, language: 'ro' })
    await deleteProfile(p.id, { fromSync: true })
    expect(readTombstones()).toEqual({})
  })

  it('noteProfileDeleted is a no-op when signed out', () => {
    clearFamilyState()
    noteProfileDeleted({ id: 'x', nickname: 'X', avatar: '🐼', grade: 1, language: 'ro', createdAt: 1, updatedAt: 1 })
    expect(readTombstones()).toEqual({})
  })

  it('coming back online and app start trigger a sync', async () => {
    initFamilyGate()
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(1) // app start
    await vi.advanceTimersByTimeAsync(FAMILY_SYNC_MIN_INTERVAL_MS)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(2100)
    expect(syncNow).toHaveBeenCalledTimes(2)
  })
})
