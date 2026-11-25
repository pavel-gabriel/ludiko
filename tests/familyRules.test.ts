import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, FAMILY_LIMITS } from '@/family/types'
import { MISSIONS_KEPT, NICKNAME_MAX } from '@/profiles/types'

/**
 * Security rules cannot be emulated here (no emulator in CI). These checks keep the Families section of
 * firestore.rules in step with the client constants and with docs/PARENT_SYNC.md §3, and catch an unbalanced edit.
 */
const rules = readFileSync('firestore.rules', 'utf8')
const start = rules.indexOf('===== BEGIN Families')
const end = rules.indexOf('===== END Families')
const section = rules.slice(start, end)

describe('firestore.rules: Families section', () => {
  it('exists, is delimited and sits inside the documents match', () => {
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    expect(rules.indexOf('===== END Classroom')).toBeLessThan(start)
  })

  it('braces, parentheses and brackets are balanced in the whole file', () => {
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      expect(rules.split(open).length, `${open}${close}`).toBe(rules.split(close).length)
    }
  })

  it('only the parent themself, with an email/password login, can touch families/{uid}/**', () => {
    expect(section).toContain('request.auth.uid == uid')
    expect(section).toContain("request.auth.token.firebase.sign_in_provider == 'password'")
    expect(section).not.toMatch(/allow [a-z, ]+: if (true|request\.auth != null);/)
    // every allow line names the owner check
    const allows = section.split('\n').filter((l) => l.trim().startsWith('allow '))
    expect(allows.length).toBeGreaterThanOrEqual(6)
    for (const l of allows) expect(l, l).toContain('isFamilyOwner(uid)')
    expect(section).not.toContain('allow read, write: if false') // (the global default deny stays at the top)
  })

  it('the family document has exactly the §3 fields', () => {
    expect(section).toContain("hasAll(['consentAt', 'consentVersion', 'createdAt', 'updatedAt'])")
    expect(section).toContain("hasOnly(['consentAt', 'consentVersion', 'createdAt', 'updatedAt'])")
    expect(section).toContain(`d.consentVersion.size() <= ${FAMILY_LIMITS.consentVersion}`)
    expect(CONSENT_VERSION.length).toBeLessThanOrEqual(FAMILY_LIMITS.consentVersion)
    expect(section).toContain('request.resource.data.createdAt == resource.data.createdAt')
  })

  it('a child document has exactly the §3 fields, and no recoveryCode or classLink anywhere', () => {
    expect(section).toContain("hasAll(['profile', 'progress', 'updatedAt', 'deviceId'])")
    expect(section).toContain("hasOnly(['profile', 'progress', 'updatedAt', 'deviceId', 'deleted'])")
    expect(section).toContain("hasOnly(['id', 'nickname', 'avatar', 'grade', 'language', 'createdAt', 'updatedAt'])")
    expect(section).toContain('p.id == childId')
    expect(section).toContain('g.profileId == childId')
    // the words only appear in explanatory comments, never in an allowlist
    const code = section.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/recoveryCode|classLink/)
  })

  it('uses the same limits as the client', () => {
    expect(section).toContain(`p.nickname.size() <= ${NICKNAME_MAX}`)
    expect(section).toContain(`p.avatar.size() <= ${FAMILY_LIMITS.avatar}`)
    expect(section).toContain(`d.deviceId.size() <= ${FAMILY_LIMITS.deviceId}`)
    expect(section).toContain(`g.skills.size() <= ${FAMILY_LIMITS.skills}`)
    expect(section).toContain(`g.stickers.size() <= ${FAMILY_LIMITS.stickers}`)
    expect(section).toContain(`g.playDays.size() <= ${FAMILY_LIMITS.playDays}`)
    expect(section).toContain(`g.missions.size() <= ${MISSIONS_KEPT}`)
    expect(FAMILY_LIMITS.missions).toBe(MISSIONS_KEPT)
    expect(section).toContain("p.language in ['ro', 'en']")
    expect(section).toContain('p.grade >= 0 && p.grade <= 8')
  })

  it('subjects in placements/levelHistory are limited to the known ones', () => {
    const subjects = "['mat', 'rom', 'stiinte', 'ist', 'geo', 'civ', 'logic']"
    expect(section.split(subjects).length - 1).toBe(2)
  })

  it('the global default deny and the other sections are still there', () => {
    expect(rules).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/)
    expect(rules).toContain('===== BEGIN Classroom')
    expect(rules).toContain('===== ADMIN AUTH (begin)')
  })
})
