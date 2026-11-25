import { beforeEach, describe, expect, it, vi } from 'vitest'
import ro from '@/i18n/ro.json'
import en from '@/i18n/en.json'
import { ALL_STICKERS, STICKER_SETS, skillStickerId, streakStickerId } from '@/ui/album/stickerSets'

const store = vi.hoisted(() => ({ progress: { profileId: 'p1', skills: {}, stars: 0, stickers: [], playDays: [] } as Record<string, unknown> }))

vi.mock('@/profiles/profileService', () => ({
  getProgress: vi.fn(async () => store.progress),
  addSticker: vi.fn(async (_id: string, sticker: string) => {
    const list = store.progress.stickers as string[]
    if (!list.includes(sticker)) list.push(sticker)
    return store.progress
  }),
}))

import { awardMissionBonus, awardSpecials, loadSeenCount, saveSeenCount } from '@/ui/album/albumService'

const sp = (state: string) => ({ state, pMastery: 0.9, attempts: 5, correct: 5, lastSeen: 0 })

beforeEach(() => {
  store.progress = { profileId: 'p1', skills: {}, stars: 0, stickers: [], playDays: [] }
  localStorage.clear()
})

describe('albumService', () => {
  it('awards island, play-day and collection stickers once, and only what is due', async () => {
    store.progress = {
      ...store.progress,
      skills: { 'mat.a': sp('mastered'), 'mat.b': sp('learning') },
      playDays: ['2026-01-01', '2026-01-02', '2026-01-05'],
      stickers: STICKER_SETS[0].stickers.map((s) => s.id),
    }
    const added = await awardSpecials('p1')
    expect(added).toEqual([skillStickerId('mat.a'), streakStickerId(3), 'set:animals'])
    expect(await awardSpecials('p1')).toEqual([])
  })

  it('mission bonus adds one regular sticker from the set being completed', async () => {
    store.progress = { ...store.progress, stickers: STICKER_SETS[1].stickers.slice(0, 9).map((s) => s.id) }
    const { bonus, specials } = await awardMissionBonus('p1', 0)
    expect(bonus).toBe(STICKER_SETS[1].stickers[9].id)
    expect(specials).toEqual(['set:fruits'])
  })

  it('remembers how many stickers were seen, and survives blocked storage', () => {
    expect(loadSeenCount('p1')).toBeNull()
    saveSeenCount('p1', 4)
    expect(loadSeenCount('p1')).toBe(4)
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadSeenCount('p1')).toBeNull()
    spy.mockRestore()
  })
})

describe('album i18n', () => {
  it('every sticker and set has a name in Romanian and English', () => {
    for (const dict of [ro.album, en.album] as const) {
      for (const x of ALL_STICKERS) expect((dict.names as Record<string, string>)[x.key], x.key).toBeTruthy()
      for (const set of STICKER_SETS) expect((dict.sets as Record<string, string>)[set.id], set.id).toBeTruthy()
    }
  })
})
