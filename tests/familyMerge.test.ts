import { describe, expect, it } from 'vitest'
import type { Mission, PlacementRecord } from '@/learner/contract'
import type { ChildProfile, ProfileProgress, SkillProgress } from '@/profiles/types'
import { MISSIONS_KEPT } from '@/profiles/types'
import {
  merge,
  mergeProgress,
  parseChildDoc,
  progressStamp,
  sameContent,
  sameData,
  stableStringify,
  toCloudProfile,
  toFamilyChild,
  toTombstone,
} from '@/family/merge'
import type { FamilyChildDoc } from '@/family/types'

const ID = 'child-1'

const sk = (o: Partial<SkillProgress> = {}): SkillProgress => ({
  state: 'learning',
  pMastery: 0.5,
  attempts: 4,
  correct: 3,
  lastSeen: 1000,
  ...o,
})

const prog = (o: Partial<ProfileProgress> = {}): ProfileProgress => ({
  profileId: ID,
  skills: {},
  stars: 0,
  stickers: [],
  playDays: [],
  ...o,
})

const child = (o: Partial<FamilyChildDoc> & { progress?: Partial<ProfileProgress> } = {}): FamilyChildDoc => {
  const { progress, ...rest } = o
  return {
    profile: { id: ID, nickname: 'Matei', avatar: '🦊', grade: 3, language: 'ro', createdAt: 10, updatedAt: 100 },
    progress: prog(progress),
    updatedAt: 100,
    deviceId: 'dev-a',
    ...rest,
  }
}

const placement = (o: Partial<PlacementRecord> = {}): PlacementRecord => ({
  subject: 'mat',
  target: { grade: 3, semester: 1 },
  state: {},
  startedAt: 1,
  updatedAt: 10,
  ...o,
})

const mission = (day: string, done: number, o: Partial<Mission> = {}): Mission => ({
  day,
  subject: 'mat',
  steps: [0, 1, 2].map((i) => ({ kind: 'practice', skillId: `s${i}`, itemCount: 3, done: i < done }) as Mission['steps'][number]),
  estimatedSeconds: 300,
  ...o,
})

describe('merge: idempotence and shape', () => {
  it('merge(a, a) equals a', () => {
    const a = child({
      progress: {
        skills: { x: sk(), y: sk({ lastSeen: 5 }) },
        stars: 7,
        stickers: ['s1', 's2'],
        playDays: ['2026-11-01', '2026-11-02'],
        placements: { mat: placement({ completedAt: 20 }) },
        levelHistory: { mat: [{ at: 5, level: { grade: 2, semester: 2 }, missingCount: 3 }] },
        missions: [mission('2026-11-01', 1), mission('2026-11-02', 3, { completedAt: 9 })],
      },
    })
    expect(merge(a, a)).toEqual(a)
  })

  it('does not alias or mutate its inputs', () => {
    const a = child({ progress: { skills: { x: sk() }, stickers: ['a'] } })
    const b = child({ progress: { skills: { y: sk() }, stickers: ['b'] } })
    const snapA = JSON.stringify(a)
    const snapB = JSON.stringify(b)
    const m = merge(a, b)
    m.progress.skills.x.attempts = 999
    m.progress.stickers.push('zzz')
    expect(JSON.stringify(a)).toBe(snapA)
    expect(JSON.stringify(b)).toBe(snapB)
  })

  it('is commutative on content', () => {
    const a = child({
      deviceId: 'a',
      updatedAt: 200,
      profile: { ...child().profile, nickname: 'Matei', updatedAt: 200 },
      progress: {
        skills: { x: sk({ lastSeen: 50, attempts: 9 }), only: sk() },
        stars: 3,
        stickers: ['s1'],
        playDays: ['2026-11-03'],
        placements: { mat: placement({ updatedAt: 30 }) },
        missions: [mission('2026-11-01', 1)],
      },
    })
    const b = child({
      deviceId: 'b',
      updatedAt: 150,
      progress: {
        skills: { x: sk({ lastSeen: 60, attempts: 5, correct: 5 }), other: sk() },
        stars: 9,
        stickers: ['s2'],
        playDays: ['2026-11-01'],
        placements: { mat: placement({ updatedAt: 40 }), rom: placement({ subject: 'rom' }) },
        missions: [mission('2026-11-01', 2), mission('2026-11-02', 0)],
      },
    })
    expect(sameContent(merge(a, b), merge(b, a))).toBe(true)
    expect(merge(a, b).deviceId).toBe(merge(b, a).deviceId)
  })

  it('is associative on content for three devices', () => {
    const mk = (d: string, stars: number, sticker: string, at: number) =>
      child({ deviceId: d, updatedAt: at, progress: { stars, stickers: [sticker], skills: { x: sk({ lastSeen: at, attempts: at }) } } })
    const a = mk('a', 1, 's1', 10)
    const b = mk('b', 5, 's2', 20)
    const c = mk('c', 3, 's3', 30)
    expect(sameContent(merge(merge(a, b), c), merge(a, merge(b, c)))).toBe(true)
  })
})

describe('merge: profile fields', () => {
  it('the newer updatedAt wins, both ways', () => {
    const older = child({ profile: { ...child().profile, nickname: 'Vechi', avatar: '🐻', updatedAt: 50 } })
    const newer = child({ profile: { ...child().profile, nickname: 'Nou', avatar: '🦁', grade: 4, updatedAt: 90 } })
    for (const [l, r] of [[older, newer], [newer, older]]) {
      const m = merge(l, r)
      expect(m.profile.nickname).toBe('Nou')
      expect(m.profile.avatar).toBe('🦁')
      expect(m.profile.grade).toBe(4)
      expect(m.profile.updatedAt).toBe(90)
    }
  })

  it('keeps the earliest createdAt and the latest entry updatedAt', () => {
    const a = child({ updatedAt: 500, profile: { ...child().profile, createdAt: 30 } })
    const b = child({ updatedAt: 700, profile: { ...child().profile, createdAt: 20 } })
    const m = merge(a, b)
    expect(m.profile.createdAt).toBe(20)
    expect(m.updatedAt).toBe(700)
  })

  it('an equal updatedAt resolves the same way whichever side is local', () => {
    const a = child({ profile: { ...child().profile, nickname: 'Alfa' } })
    const b = child({ profile: { ...child().profile, nickname: 'Beta' } })
    expect(merge(a, b).profile).toEqual(merge(b, a).profile)
  })

  it('never carries recoveryCode or classLink, even if a caller passes them', () => {
    const dirty = {
      ...child().profile,
      recoveryCode: 'AAAA-BBBB-CCCC',
      classLink: { classId: 'c', seatId: 's', joinCode: 'ABC234', className: 'X' },
    } as unknown as ChildProfile
    const cloud = toCloudProfile(dirty)
    expect(Object.keys(cloud).sort()).toEqual(['avatar', 'createdAt', 'grade', 'id', 'language', 'nickname', 'updatedAt'])
    const m = merge(child({ profile: dirty as never }), child())
    expect(Object.keys(m.profile)).not.toContain('recoveryCode')
    expect(Object.keys(m.profile)).not.toContain('classLink')
  })
})

describe('merge: skills', () => {
  it('keeps the record with the later lastSeen', () => {
    const a = child({ progress: { skills: { x: sk({ lastSeen: 100, state: 'practised', attempts: 5 }) } } })
    const b = child({ progress: { skills: { x: sk({ lastSeen: 200, state: 'mastered', attempts: 4, pMastery: 0.9 }) } } })
    expect(merge(a, b).progress.skills.x.state).toBe('mastered')
    expect(merge(b, a).progress.skills.x.state).toBe('mastered')
  })

  it('compares attempts when lastSeen is equal', () => {
    const a = child({ progress: { skills: { x: sk({ lastSeen: 100, attempts: 8, correct: 6, state: 'practised' }) } } })
    const b = child({ progress: { skills: { x: sk({ lastSeen: 100, attempts: 5, correct: 5, state: 'gap' }) } } })
    expect(merge(a, b).progress.skills.x.state).toBe('practised')
    expect(merge(b, a).progress.skills.x.state).toBe('practised')
  })

  it('never lowers attempts or correct, even when the winning record has fewer', () => {
    // b is newer (wins) but a counted more attempts and more correct answers
    const a = child({ progress: { skills: { x: sk({ lastSeen: 100, attempts: 20, correct: 18 }) } } })
    const b = child({ progress: { skills: { x: sk({ lastSeen: 300, attempts: 6, correct: 2, state: 'gap' }) } } })
    for (const m of [merge(a, b), merge(b, a)]) {
      const s = m.progress.skills.x
      expect(s.state).toBe('gap')
      expect(s.attempts).toBe(20)
      expect(s.correct).toBe(18)
      expect(s.correct).toBeLessThanOrEqual(s.attempts)
      expect(s.lastSeen).toBe(300)
    }
  })

  it('unions skill ids and keeps optional fields of the winner', () => {
    const a = child({ progress: { skills: { x: sk({ lastSeen: 1 }), a: sk({ nextReview: 5, reviewStep: 2 }) } } })
    const b = child({ progress: { skills: { x: sk({ lastSeen: 9, checkFailedAt: 7 }), b: sk() } } })
    const m = merge(a, b)
    expect(Object.keys(m.progress.skills).sort()).toEqual(['a', 'b', 'x'])
    expect(m.progress.skills.x.checkFailedAt).toBe(7)
    expect(m.progress.skills.a.reviewStep).toBe(2)
  })

  it('a total tie is still deterministic', () => {
    const a = child({ progress: { skills: { x: sk({ pMastery: 0.2 }) } } })
    const b = child({ progress: { skills: { x: sk({ pMastery: 0.7 }) } } })
    expect(merge(a, b).progress.skills.x).toEqual(merge(b, a).progress.skills.x)
  })
})

describe('merge: stars, stickers, play days', () => {
  it('stars: max', () => {
    expect(merge(child({ progress: { stars: 4 } }), child({ progress: { stars: 11 } })).progress.stars).toBe(11)
    expect(merge(child({ progress: { stars: 11 } }), child({ progress: { stars: 4 } })).progress.stars).toBe(11)
  })

  it('stickers: union, no duplicates, local order first', () => {
    const m = merge(child({ progress: { stickers: ['b', 'a'] } }), child({ progress: { stickers: ['a', 'c'] } }))
    expect(m.progress.stickers).toEqual(['b', 'a', 'c'])
    expect(new Set(merge(child({ progress: { stickers: ['a', 'c'] } }), child({ progress: { stickers: ['b', 'a'] } })).progress.stickers))
      .toEqual(new Set(m.progress.stickers))
  })

  it('playDays: union, sorted, unique', () => {
    const m = merge(
      child({ progress: { playDays: ['2026-11-03', '2026-11-01'] } }),
      child({ progress: { playDays: ['2026-11-02', '2026-11-03'] } }),
    )
    expect(m.progress.playDays).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
  })
})

describe('merge: placements', () => {
  it('a completed placement beats an in-progress one, even an older completed over a newer in-progress', () => {
    const done = placement({ updatedAt: 10, completedAt: 10 })
    const running = placement({ updatedAt: 99 })
    for (const [l, r] of [[done, running], [running, done]]) {
      const m = merge(child({ progress: { placements: { mat: l } } }), child({ progress: { placements: { mat: r } } }))
      expect(m.progress.placements?.mat).toEqual(done)
    }
  })

  it('otherwise the newer updatedAt wins', () => {
    const a = placement({ updatedAt: 10, startedAt: 1 })
    const b = placement({ updatedAt: 20, startedAt: 2 })
    expect(merge(child({ progress: { placements: { mat: a } } }), child({ progress: { placements: { mat: b } } })).progress.placements?.mat).toEqual(b)
    const doneOld = placement({ updatedAt: 10, completedAt: 10 })
    const doneNew = placement({ updatedAt: 30, completedAt: 30 })
    expect(merge(child({ progress: { placements: { mat: doneNew } } }), child({ progress: { placements: { mat: doneOld } } })).progress.placements?.mat).toEqual(doneNew)
  })

  it('merges per subject and keeps subjects present on one side only', () => {
    const m = merge(
      child({ progress: { placements: { mat: placement() } } }),
      child({ progress: { placements: { rom: placement({ subject: 'rom' }) } } }),
    )
    expect(Object.keys(m.progress.placements ?? {}).sort()).toEqual(['mat', 'rom'])
  })

  it('leaves the optional fields absent when neither side has them', () => {
    const m = merge(child(), child())
    expect(m.progress).not.toHaveProperty('placements')
    expect(m.progress).not.toHaveProperty('levelHistory')
    expect(m.progress).not.toHaveProperty('missions')
  })
})

describe('merge: levelHistory', () => {
  const e = (at: number, grade = 2, missingCount = 1) => ({ at, level: { grade, semester: 1 as const }, missingCount }) as never
  it('unions by `at`, sorted, without duplicates', () => {
    const m = merge(
      child({ progress: { levelHistory: { mat: [e(30), e(10)] } } }),
      child({ progress: { levelHistory: { mat: [e(20), e(30)], rom: [e(5)] } } }),
    )
    expect(m.progress.levelHistory?.mat?.map((x) => x.at)).toEqual([10, 20, 30])
    expect(m.progress.levelHistory?.rom?.map((x) => x.at)).toEqual([5])
  })

  it('two entries with the same `at` but different content resolve deterministically', () => {
    const a = child({ progress: { levelHistory: { mat: [e(10, 2)] } } })
    const b = child({ progress: { levelHistory: { mat: [e(10, 3)] } } })
    expect(merge(a, b).progress.levelHistory).toEqual(merge(b, a).progress.levelHistory)
    expect(merge(a, b).progress.levelHistory?.mat).toHaveLength(1)
  })
})

describe('merge: missions', () => {
  it('keys by (day, subject) and keeps the one with more steps done', () => {
    const m = merge(
      child({ progress: { missions: [mission('2026-11-01', 1)] } }),
      child({ progress: { missions: [mission('2026-11-01', 3, { completedAt: 7 })] } }),
    )
    expect(m.progress.missions).toHaveLength(1)
    expect(m.progress.missions![0].completedAt).toBe(7)
    const back = merge(
      child({ progress: { missions: [mission('2026-11-01', 3, { completedAt: 7 })] } }),
      child({ progress: { missions: [mission('2026-11-01', 1)] } }),
    )
    expect(back.progress.missions).toEqual(m.progress.missions)
  })

  it('different subjects on the same day are different missions', () => {
    const m = merge(
      child({ progress: { missions: [mission('2026-11-01', 1)] } }),
      child({ progress: { missions: [mission('2026-11-01', 1, { subject: 'rom' })] } }),
    )
    expect(m.progress.missions?.map((x) => x.subject).sort()).toEqual(['mat', 'rom'])
  })

  it('keeps the last 14, oldest first', () => {
    const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`
    const a = Array.from({ length: 10 }, (_, i) => mission(day(i + 1), 1))
    const b = Array.from({ length: 10 }, (_, i) => mission(day(i + 8), 2))
    const m = merge(child({ progress: { missions: a } }), child({ progress: { missions: b } }))
    expect(m.progress.missions).toHaveLength(MISSIONS_KEPT)
    expect(m.progress.missions![0].day).toBe(day(4))
    expect(m.progress.missions![13].day).toBe(day(17))
  })
})

describe('merge: tombstones', () => {
  const tomb = (at: number) => toTombstone(child().profile, at, 'dev-b')

  it('a deletion newer than the other side deletes, both ways', () => {
    const alive = child({ updatedAt: 100, progress: { stars: 5 } })
    for (const [l, r] of [[alive, tomb(200)], [tomb(200), alive]]) {
      const m = merge(l, r)
      expect(m.deleted).toBe(true)
      expect(m.progress.stars).toBe(0) // no progress data in a tombstone
    }
  })

  it('a deletion at the same time still wins', () => {
    expect(merge(child({ updatedAt: 200 }), tomb(200)).deleted).toBe(true)
  })

  it('an edit after the deletion keeps the child', () => {
    const alive = child({ updatedAt: 300, progress: { stars: 5 } })
    for (const m of [merge(alive, tomb(200)), merge(tomb(200), alive)]) {
      expect(m.deleted).toBeUndefined()
      expect(m.progress.stars).toBe(5)
    }
  })

  it('two tombstones keep the newer', () => {
    expect(merge(tomb(100), tomb(300)).updatedAt).toBe(300)
    expect(merge(tomb(300), tomb(100)).updatedAt).toBe(300)
  })

  it('idempotent for tombstones', () => {
    expect(merge(tomb(100), tomb(100))).toEqual(tomb(100))
  })
})

describe('merge: evidence never goes down (property check)', () => {
  // small deterministic generator, no extra dependency
  let seed = 12345
  const rnd = (n: number) => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed % n
  }
  const randomChild = (): FamilyChildDoc => {
    const skills: Record<string, SkillProgress> = {}
    for (let i = 0; i < rnd(5); i++) {
      const attempts = rnd(30)
      skills[`s${rnd(6)}`] = sk({ attempts, correct: Math.min(attempts, rnd(30)), lastSeen: rnd(500) })
    }
    return child({
      updatedAt: rnd(1000),
      progress: {
        skills,
        stars: rnd(50),
        stickers: Array.from({ length: rnd(5) }, () => `k${rnd(8)}`).filter((v, i, arr) => arr.indexOf(v) === i),
        playDays: Array.from({ length: rnd(5) }, () => `2026-11-0${1 + rnd(9)}`).filter((v, i, arr) => arr.indexOf(v) === i).sort(),
      },
    })
  }

  it('holds for 200 random pairs', () => {
    for (let i = 0; i < 200; i++) {
      const a = randomChild()
      const b = randomChild()
      const m = merge(a, b)
      expect(sameContent(m, merge(b, a))).toBe(true)
      expect(merge(m, a).progress).toEqual(mergeProgress(m.progress, a.progress)) // idempotent absorption
      expect(sameData(merge(m, m), m)).toBe(true)
      for (const src of [a, b]) {
        expect(m.progress.stars).toBeGreaterThanOrEqual(src.progress.stars)
        for (const s of src.progress.stickers) expect(m.progress.stickers).toContain(s)
        for (const d of src.progress.playDays) expect(m.progress.playDays).toContain(d)
        for (const [id, rec] of Object.entries(src.progress.skills)) {
          expect(m.progress.skills[id].attempts).toBeGreaterThanOrEqual(rec.attempts)
          expect(m.progress.skills[id].correct).toBeGreaterThanOrEqual(rec.correct)
          expect(m.progress.skills[id].correct).toBeLessThanOrEqual(m.progress.skills[id].attempts)
        }
      }
    }
  })
})

describe('entry helpers', () => {
  it('toFamilyChild strips local-only fields and dates the entry by profile and progress', () => {
    const profile: ChildProfile = {
      ...child().profile,
      recoveryCode: 'AAAA-BBBB-CCCC',
      classLink: { classId: 'c', seatId: 's', joinCode: 'ABC234', className: 'X' },
    }
    const e = toFamilyChild(profile, prog({ skills: { x: sk({ lastSeen: 5000 }) } }), 'dev-z')
    expect(e.profile).not.toHaveProperty('recoveryCode')
    expect(e.profile).not.toHaveProperty('classLink')
    expect(e.updatedAt).toBe(5000)
    expect(e.deviceId).toBe('dev-z')
    expect(e.deleted).toBeUndefined()
  })

  it('progressStamp looks at skills, placements, history, missions and play days', () => {
    expect(progressStamp(prog())).toBe(0)
    expect(progressStamp(prog({ placements: { mat: placement({ updatedAt: 70, completedAt: 90 }) } }))).toBe(90)
    expect(progressStamp(prog({ missions: [mission('2026-11-01', 3, { completedAt: 123 })] }))).toBe(123)
    expect(progressStamp(prog({ playDays: ['2026-11-01'] }))).toBeGreaterThan(0)
  })

  it('stableStringify ignores key order and undefined', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(stableStringify({ a: [2, { c: undefined, d: 1 }], b: 1 }))
  })

  it('sameData ignores sticker order, updatedAt and deviceId', () => {
    const a = child({ progress: { stickers: ['a', 'b'] }, updatedAt: 1, deviceId: 'x' })
    const b = child({ progress: { stickers: ['b', 'a'] }, updatedAt: 2, deviceId: 'y' })
    expect(sameData(a, b)).toBe(true)
    expect(sameContent(a, b)).toBe(false)
  })
})

describe('parseChildDoc (remote data is untrusted)', () => {
  const good = () => JSON.parse(JSON.stringify(child())) as Record<string, unknown>

  it('accepts a well-formed document', () => {
    expect(parseChildDoc(ID, good())).toEqual(child())
  })

  it('rejects documents that are not shaped like a child', () => {
    expect(parseChildDoc(ID, null)).toBeNull()
    expect(parseChildDoc(ID, { ...good(), profile: 'x' })).toBeNull()
    expect(parseChildDoc('other-id', good())).toBeNull() // profile.id must match the document id
    const bad = good()
    ;(bad.profile as Record<string, unknown>).grade = 12
    expect(parseChildDoc(ID, bad)).toBeNull()
    const noNick = good()
    ;(noNick.profile as Record<string, unknown>).nickname = '   '
    expect(parseChildDoc(ID, noNick)).toBeNull()
  })

  it('drops malformed skills and caps missions', () => {
    const d = good()
    ;(d.progress as Record<string, unknown>).skills = { ok: sk(), bad: { state: 1 }, worse: 'x' }
    ;(d.progress as Record<string, unknown>).missions = Array.from({ length: 30 }, (_, i) => mission(`2026-10-${String((i % 28) + 1).padStart(2, '0')}`, 0))
    const parsed = parseChildDoc(ID, d)!
    expect(Object.keys(parsed.progress.skills)).toEqual(['ok'])
    expect(parsed.progress.missions).toHaveLength(MISSIONS_KEPT)
  })

  it('keeps the tombstone flag', () => {
    expect(parseChildDoc(ID, { ...good(), deleted: true })?.deleted).toBe(true)
  })
})
