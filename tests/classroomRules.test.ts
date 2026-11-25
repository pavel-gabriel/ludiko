import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JOIN_CODE_PATTERN } from '@/classroom/joinCode'
import { ASSIGNMENT_SKILLS_MAX, ASSIGNMENT_TITLE_MAX, CLASS_NAME_MAX, CLASS_SUBJECTS, SEAT_LABEL_MAX, SKILLS_PER_SUBJECT_MAX } from '@/classroom/types'

/**
 * Security rules cannot be emulated here (no emulator in CI). These checks keep the Classroom section of
 * firestore.rules in step with the client constants and catch an unbalanced edit.
 */
const rules = readFileSync('firestore.rules', 'utf8')
const section = rules.slice(rules.indexOf('===== BEGIN Classroom'), rules.indexOf('===== END Classroom'))

describe('firestore.rules: Classroom section', () => {
  it('exists and is delimited', () => {
    expect(section.length).toBeGreaterThan(500)
  })

  it('braces and parentheses are balanced in the whole file', () => {
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      expect(rules.split(open).length, `${open}${close}`).toBe(rules.split(close).length)
    }
  })

  it('uses the same limits as the client', () => {
    expect(section).toContain(`d.label.size() <= ${SEAT_LABEL_MAX}`)
    expect(section).toContain(`d.name.size() <= ${CLASS_NAME_MAX}`)
    expect(section).toContain(`d.title.size() <= ${ASSIGNMENT_TITLE_MAX}`)
    expect(section).toContain(`d.skillIds.size() <= ${ASSIGNMENT_SKILLS_MAX}`)
    expect(section).toContain(`s.skills.size() <= ${SKILLS_PER_SUBJECT_MAX}`)
  })

  it('uses the same join-code pattern and subject list', () => {
    expect(section).toContain(`'${JOIN_CODE_PATTERN.source}'`.replace('^', '^').replace('$', '$'))
    expect(section).toContain(`[${CLASS_SUBJECTS.map((s) => `'${s}'`).join(', ')}]`)
  })

  it('joinCodes cannot be listed or updated, and the child join may only flip linked/linkedAt', () => {
    expect(section).toMatch(/match \/joinCodes\/\{code\}[\s\S]*allow list: if false;[\s\S]*allow update: if false;/)
    expect(section).toContain(".affectedKeys().hasOnly(['linked', 'linkedAt'])")
    expect(section).toContain('resource.data.linked == false')
  })

  it('progress allows only the contract keys', () => {
    expect(section).toContain("d.keys().hasOnly(['subjects', 'playDaysThisWeek', 'updatedAt'])")
    const code = section.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/nickname|avatar|recoveryCode/)
  })

  it('other collections\' rules are untouched: the default deny is still first', () => {
    expect(rules.indexOf('match /{document=**}')).toBeLessThan(rules.indexOf('BEGIN Classroom'))
  })
})
