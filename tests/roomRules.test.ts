import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Security rules cannot be run here (no emulator in CI). These checks pin the properties docs/PRIVACY_DATA_MAP.md
 * F2 and F3 promise, so a later edit cannot quietly reopen the holes. Verify with the Firebase emulator before deploy.
 */
type Node = { [k: string]: unknown }
const rtdbText = readFileSync('database.rules.json', 'utf8')
const rtdb = JSON.parse(rtdbText.replace(/\/\*[\s\S]*?\*\//g, '')).rules as Node
const rooms = rtdb.rooms as Node
const room = rooms.$roomId as Node
const roomCodes = rtdb.roomCodes as Node
const fs = readFileSync('firestore.rules', 'utf8')
const section = (name: string) => {
  const from = fs.indexOf(`match /${name}/`)
  expect(from, name).toBeGreaterThan(-1)
  const next = fs.indexOf('\n    match /', from + 10)
  const nextBlock = fs.indexOf('\n    // =====', from + 10)
  const ends = [next, nextBlock].filter((n) => n > 0)
  return fs.slice(from, Math.min(...ends, fs.length))
}

describe('database.rules.json: rooms (F2)', () => {
  it('nothing can be listed: no .read at /rooms, /roomCodes, or the root', () => {
    expect(rtdb['.read']).toBeUndefined()
    expect(rooms['.read']).toBeUndefined()
    expect(roomCodes['.read']).toBeUndefined()
    expect(rooms['.write']).toBeUndefined()
  })

  it('no query index on the join code any more (the code is found through roomCodes)', () => {
    expect(JSON.stringify(rooms['.indexOn'])).not.toContain('code')
  })

  it('a room is readable only by signed-in devices that know its id', () => {
    expect(room['.read']).toBe('auth != null')
  })

  it('only the host writes the room: creator becomes hostId, later writes need hostId == uid', () => {
    const w = room['.write'] as string
    expect(w).toContain("newData.child('hostId').val() == auth.uid")
    expect(w).toContain("data.child('hostId').val() == auth.uid")
    expect((room.hostId as Node)['.validate']).toContain('newData.val() == auth.uid')
  })

  it('players write only their own entry (key == uid or `{uid}_2`) and cannot make themselves host', () => {
    const player = (room.players as Node).$playerId as Node
    const w = player['.write'] as string
    expect(w).toContain('$playerId == auth.uid')
    expect(w).toContain("$playerId.beginsWith(auth.uid + '_')")
    expect(w).toContain("newData.child('isHost').val() == false")
    expect(player.$other).toEqual({ '.validate': false })
    expect((player.name as Node)['.validate']).toContain('length <= 30')
  })

  it('joining needs a waiting room younger than 6 hours', () => {
    const w = ((room.players as Node).$playerId as Node)['.write'] as string
    expect(w).toContain("child('status').val() == 'waiting'")
    expect(w).toContain('now - 21600000')
  })

  it('progress and finish times are per-player keys; a guest can only finish the game, the host controls the rest', () => {
    const game = room.game as Node
    expect(game['.write']).toContain('!newData.exists()') /* guests: clear only */
    expect((game.phase as Node)['.write']).toContain("newData.val() == 'finished'")
    for (const k of ['progress', 'finishTimes']) {
      const w = ((game[k] as Node).$playerId as Node)['.write'] as string
      expect(w).toContain('$playerId == auth.uid')
    }
    expect(game).not.toHaveProperty('currentIndex')
    expect((room.status as Node)['.write']).toContain("newData.val() == 'waiting'")
  })

  it('unknown keys are rejected on the room and on settings', () => {
    expect(room.$other).toEqual({ '.validate': false })
    expect((room.settings as Node).$other).toEqual({ '.validate': false })
  })

  it('roomCodes/{CODE}: exact-key read, owner-only write, fixed shape, code pattern', () => {
    const code = roomCodes.$code as Node
    expect(code['.read']).toBe('auth != null')
    const w = code['.write'] as string
    expect(w).toContain('[A-HJ-NP-Z2-9]{6}')
    expect(w).toContain("data.child('hostId').val() == auth.uid")
    expect(w).toContain('now - 21600000') /* an expired code can be taken over */
    expect(code.$other).toEqual({ '.validate': false })
    expect(Object.keys(code).filter((k) => !k.startsWith('.') && k !== '$other').sort()).toEqual(['createdAt', 'hostId', 'roomId'])
  })

  it('the room code pattern matches what the client generates', () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const re = /^[A-HJ-NP-Z2-9]{6}$/
    for (let i = 0; i < alphabet.length; i++) expect(re.test(alphabet[i].repeat(6))).toBe(true)
    expect(re.test('ABCDEI')).toBe(false)
    expect(re.test('ABCDE0')).toBe(false)
  })

  it('braces are balanced', () => {
    expect(rtdbText.split('{').length).toBe(rtdbText.split('}').length)
  })
})

describe('firestore.rules: v1 teacher sessions (F3)', () => {
  it('sessions and templates are readable only by their teacher', () => {
    for (const name of ['sessions', 'templates']) {
      const s = section(name)
      expect(s).toMatch(/allow read: if request\.auth != null && resource\.data\.teacherUid == request\.auth\.uid;/)
      expect(s).not.toMatch(/allow read: if request\.auth != null;/)
    }
  })

  it('templates (legacy): the owner can read and delete old documents, nobody can create or update', () => {
    const s = section('templates')
    expect(s).toMatch(/allow delete: if request\.auth != null && resource\.data\.teacherUid == request\.auth\.uid;/)
    expect(s).not.toMatch(/allow[^;\n]*\b(create|update|write)\b/)
  })

  it('sessionResults: only the session teacher reads (get() on sessions); students never read', () => {
    const s = section('sessionResults')
    expect(fs).toMatch(/function isSessionTeacher\(sessionId\)[\s\S]*get\(\/databases\/\$\(database\)\/documents\/sessions\/\$\(sessionId\)\)\.data\.teacherUid == request\.auth\.uid/)
    expect(s).toContain('allow read: if isSessionTeacher(resultSession());')
    expect(s).not.toMatch(/allow read, write: if request\.auth != null/)
  })

  it('sessionResults: students may create/update only a code-derived document with strict fields and an existing code', () => {
    const s = section('sessionResults')
    expect(s).toContain("resultId == resultSession() + '_' + d.studentCode")
    expect(s).toContain("d.keys().hasOnly(['studentCode', 'score', 'totalQuestions', 'accuracy', 'timeTaken', 'updatedAt'])")
    expect(s).toContain('exists(/databases/$(database)/documents/sessionCodes/$(resultId))')
    expect(s).toMatch(/allow delete: if isSessionTeacher/)
    expect(s).not.toMatch(/allow (read|list|get)[^;]*request\.auth != null;/)
  })

  it('sessionCodes: get by exact key only, no list, no label, written by the owning (non-anonymous) teacher', () => {
    const s = section('sessionCodes')
    expect(s).toContain('allow get: if request.auth != null;')
    expect(s).toContain('allow list: if false;')
    expect(s).toContain("keys().hasOnly(['sessionId', 'teacherUid', 'code'])")
    expect(s).not.toContain('label')
    expect(s).toContain("sign_in_provider != 'anonymous'")
    expect(s).toContain('isSessionTeacher(request.resource.data.sessionId)')
  })

  it('braces and parentheses are balanced', () => {
    for (const [o, c] of [['{', '}'], ['(', ')'], ['[', ']']]) expect(fs.split(o).length, o).toBe(fs.split(c).length)
  })
})
