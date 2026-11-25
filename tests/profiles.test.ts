import { beforeEach, describe, expect, it } from 'vitest'
import {
  addStars,
  createProfile,
  deleteProfile,
  exportProfile,
  generateRecoveryCode,
  getActiveProfileId,
  getProgress,
  importProfile,
  isPersistent,
  isValidRecoveryCode,
  listProfiles,
  recordAttempt,
  setActiveProfileId,
  toDayString,
  updateProfile,
} from '@/profiles/profileService'
import { _resetMemoryForTests } from '@/profiles/db'

const input = { nickname: 'Ursulet', avatar: '🐼', grade: 2 as const, language: 'ro' as const }

beforeEach(() => {
  _resetMemoryForTests()
  localStorage.clear()
})

describe('recovery code', () => {
  it('has 3 groups of 4 unambiguous chars and validates', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRecoveryCode()
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
      expect(code).not.toMatch(/[01OIL]/)
      expect(isValidRecoveryCode(code)).toBe(true)
    }
  })

  it('is case/dash/space tolerant', () => {
    const code = generateRecoveryCode()
    expect(isValidRecoveryCode(code.toLowerCase().replace(/-/g, ' '))).toBe(true)
  })

  it('detects every single-character typo', () => {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    const code = generateRecoveryCode()
    const raw = code.replace(/-/g, '')
    for (let i = 0; i < raw.length; i++) {
      for (const c of alphabet) {
        if (c === raw[i]) continue
        const bad = raw.slice(0, i) + c + raw.slice(i + 1)
        expect(isValidRecoveryCode(bad)).toBe(false)
      }
    }
  })

  it('rejects wrong length and ambiguous chars', () => {
    expect(isValidRecoveryCode('')).toBe(false)
    expect(isValidRecoveryCode('ABCD-EFGH')).toBe(false)
    expect(isValidRecoveryCode('0000-0000-0000')).toBe(false)
  })
})

describe('profile CRUD (in-memory fallback)', () => {
  it('is not persistent without IndexedDB', () => {
    expect(isPersistent()).toBe(false)
  })

  it('creates, lists, updates and deletes', async () => {
    const p = await createProfile(input)
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(isValidRecoveryCode(p.recoveryCode)).toBe(true)
    expect(Object.keys(p).sort()).toEqual(
      ['avatar', 'createdAt', 'grade', 'id', 'language', 'nickname', 'recoveryCode', 'updatedAt'],
    )
    expect(await listProfiles()).toHaveLength(1)

    const u = await updateProfile(p.id, { nickname: 'Ana', grade: 3 })
    expect(u.nickname).toBe('Ana')
    expect(u.grade).toBe(3)
    expect(u.recoveryCode).toBe(p.recoveryCode)

    setActiveProfileId(p.id)
    expect(getActiveProfileId()).toBe(p.id)
    await deleteProfile(p.id)
    expect(await listProfiles()).toEqual([])
    expect(getActiveProfileId()).toBeNull()
    expect((await getProgress(p.id)).stars).toBe(0)
  })

  it('validates nickname', async () => {
    await expect(createProfile({ ...input, nickname: '   ' })).rejects.toThrow()
    const p = await createProfile({ ...input, nickname: 'x'.repeat(40) })
    expect(p.nickname).toHaveLength(20)
  })
})

describe('progress', () => {
  it('recordAttempt updates counters and playDays', async () => {
    const p = await createProfile(input)
    const t1 = new Date(2026, 0, 5, 10).getTime()
    const t2 = new Date(2026, 0, 6, 10).getTime()
    await recordAttempt(p.id, 'mat.add.1', true, t1)
    await recordAttempt(p.id, 'mat.add.1', false, t1 + 1000)
    const prog = await recordAttempt(p.id, 'mat.add.1', true, t2)
    const s = prog.skills['mat.add.1']
    expect(s.attempts).toBe(3)
    expect(s.correct).toBe(2)
    expect(s.lastSeen).toBe(t2)
    expect(s.state).toBe('unknown')
    expect(prog.playDays).toEqual(['2026-01-05', '2026-01-06'])
    expect(toDayString(t1)).toBe('2026-01-05')
  })
})

describe('backup export/import', () => {
  it('round-trips profile and progress', async () => {
    const p = await createProfile(input)
    await recordAttempt(p.id, 'mat.add.1', true)
    await addStars(p.id, 5)
    const backup = await exportProfile(p.id)
    const text = JSON.stringify(backup)
    await deleteProfile(p.id)
    expect(await listProfiles()).toHaveLength(0)

    const restored = await importProfile(text)
    expect(restored.id).toBe(p.id)
    expect(restored.recoveryCode).toBe(p.recoveryCode)
    const prog = await getProgress(p.id)
    expect(prog.stars).toBe(5)
    expect(prog.skills['mat.add.1'].attempts).toBe(1)
  })

  it('rejects invalid backups', async () => {
    await expect(importProfile('not json')).rejects.toThrow()
    await expect(importProfile('{"app":"other"}')).rejects.toThrow()
    const p = await createProfile(input)
    const b = await exportProfile(p.id)
    b.profile.recoveryCode = 'AAAA-AAAA-AAAA'
    await expect(importProfile(JSON.stringify(b))).rejects.toThrow()
  })
})
