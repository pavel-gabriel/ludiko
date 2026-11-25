import { describe, expect, it } from 'vitest'
import {
  STICKER_MIN_STARS,
  dueSpecialStickers,
  knownStickers,
  migrateStickers,
  missionBonusSticker,
  newStickerIds,
  pickSticker,
  sessionSticker,
  setProgress,
} from '@/ui/album/earning'
import { masteredSkillIds } from '@/ui/album/albumService'
import {
  ALL_STICKER_IDS,
  LEGACY_STICKERS,
  STICKER_SETS,
  findSticker,
  parseSpecial,
  setStickerId,
  skillStickerId,
  stickerEmoji,
  streakStickerId,
} from '@/ui/album/stickerSets'
import type { SkillProgress } from '@/profiles/types'

describe('sticker sets', () => {
  it('has five themed sets of 8-10 stickers, with unique ids', () => {
    expect(STICKER_SETS.map((s) => s.id)).toEqual(['animals', 'fruits', 'space', 'sea', 'sport'])
    for (const set of STICKER_SETS) {
      expect(set.stickers.length).toBeGreaterThanOrEqual(8)
      expect(set.stickers.length).toBeLessThanOrEqual(10)
    }
    expect(new Set(ALL_STICKER_IDS).size).toBe(ALL_STICKER_IDS.length)
  })

  it('migration: every id of the first twelve-sticker version is a member of a new set and stays valid', () => {
    expect(LEGACY_STICKERS).toHaveLength(12)
    for (const old of LEGACY_STICKERS) {
      expect(findSticker(old), old).toBeDefined()
      expect(stickerEmoji(old)).toBe(old)
    }
    // old data is kept as is (order kept, duplicates dropped), unknown ids are kept but never shown
    const stored = ['🦊', '🐙', '🦊', '🐢']
    expect(migrateStickers(stored)).toEqual(['🦊', '🐙', '🐢'])
    expect(knownStickers([...stored, '❓'])).toEqual(['🦊', '🐙', '🐢'])
    // a legacy sticker counts towards its new set
    const sea = setProgress(stored).find((p) => p.set.id === 'sea')!
    expect(sea.owned).toBe(1)
  })
})

describe('earning rules', () => {
  it('rule 1: a finished session with at least 2 stars gives a new sticker, nothing below that or when abandoned', () => {
    expect(STICKER_MIN_STARS).toBe(2)
    expect(sessionSticker([], { completed: true, stars: 2 }, 0)).toBe(ALL_STICKER_IDS[0])
    expect(sessionSticker([], { completed: true, stars: 3 }, 0)).toBeDefined()
    expect(sessionSticker([], { completed: true, stars: 1 }, 0)).toBeUndefined()
    expect(sessionSticker([], { completed: false, stars: 3 }, 0)).toBeUndefined()
  })

  it('rule 1: never repeats a sticker the child owns; none left once every set is complete', () => {
    expect(pickSticker([ALL_STICKER_IDS[0]], 0)).toBe(ALL_STICKER_IDS[1])
    expect(pickSticker([...ALL_STICKER_IDS], 5)).toBeUndefined()
    // the rotating start differs per seed
    expect(pickSticker([], 3)).not.toBe(pickSticker([], 4))
  })

  it('rule 2: the mission bonus helps the set closest to completion', () => {
    const animals = STICKER_SETS[0].stickers.map((s) => s.id)
    const fruits = STICKER_SETS[1].stickers.map((s) => s.id)
    const owned = [...animals.slice(0, 8), ...fruits.slice(0, 2)]
    const bonus = missionBonusSticker(owned, 0)!
    expect(animals.slice(8)).toContain(bonus)
    // empty album: first set; everything owned: nothing
    expect(missionBonusSticker([], 0)).toBe(animals[0])
    expect(missionBonusSticker([...ALL_STICKER_IDS], 0)).toBeUndefined()
  })

  it('rule 3: every mastered skill gives its own island sticker, once', () => {
    const due = dueSpecialStickers([], { masteredSkillIds: ['mat.a', 'mat.b'], playDays: 0 })
    expect(due).toEqual([skillStickerId('mat.a'), skillStickerId('mat.b')])
    expect(dueSpecialStickers(due, { masteredSkillIds: ['mat.a', 'mat.b'], playDays: 0 })).toEqual([])
    expect(parseSpecial(due[0])).toMatchObject({ kind: 'skill', ref: 'mat.a' })
  })

  it('rule 4: completing a set gives the collection sticker', () => {
    const space = STICKER_SETS[2].stickers.map((s) => s.id)
    expect(dueSpecialStickers(space.slice(1), { masteredSkillIds: [], playDays: 0 })).toEqual([])
    expect(dueSpecialStickers(space, { masteredSkillIds: [], playDays: 0 })).toEqual([setStickerId('space')])
  })

  it('rule 5: play days add up (never in a row) and nothing is taken away', () => {
    const at = (days: number, owned: string[] = []) => dueSpecialStickers(owned, { masteredSkillIds: [], playDays: days })
    expect(at(2)).toEqual([])
    expect(at(3)).toEqual([streakStickerId(3)])
    expect(at(14)).toEqual([streakStickerId(3), streakStickerId(7), streakStickerId(14)])
    expect(at(30, [streakStickerId(3), streakStickerId(7), streakStickerId(14)])).toEqual([streakStickerId(30)])
    // fewer play days than before (e.g. an older backup) never removes or re-asks anything
    expect(at(1, [streakStickerId(3)])).toEqual([])
  })

  it('reads mastered skills from the progress record', () => {
    const sp = (state: SkillProgress['state']): SkillProgress => ({ state, pMastery: 0.5, attempts: 1, correct: 1, lastSeen: 0 })
    expect(masteredSkillIds({ skills: { b: sp('mastered'), a: sp('mastered'), c: sp('learning') } })).toEqual(['a', 'b'])
  })

  it('"new" stickers are those earned after the last visit; with no memory only the latest few', () => {
    expect(newStickerIds(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
    expect(newStickerIds(['a', 'b'], 5)).toEqual([])
    expect(newStickerIds(['a', 'b', 'c', 'd', 'e'], null)).toEqual(['c', 'd', 'e'])
  })
})
