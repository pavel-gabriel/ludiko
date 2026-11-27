import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSkillsBySubject } from '@/engine/content/registry'

const store = vi.hoisted(() => ({
  progress: { profileId: 'p1', skills: {}, stars: 0, stickers: [], playDays: [] } as Record<string, unknown>,
  grade: 2 as number | undefined,
}))

vi.mock('@/profiles/profileService', () => ({
  getProgress: vi.fn(async () => store.progress),
  getProfile: vi.fn(async () => (store.grade === undefined ? undefined : { id: 'p1', grade: store.grade })),
  addSticker: vi.fn(async (_id: string, sticker: string) => {
    const list = store.progress.stickers as string[]
    if (!list.includes(sticker)) list.push(sticker)
    return store.progress
  }),
}))

import { awardSpecials } from '@/ui/album/albumService'

const mastered = { state: 'mastered', pMastery: 0.9, attempts: 5, correct: 5, lastSeen: 0 }

beforeEach(() => {
  store.progress = { profileId: 'p1', skills: {}, stars: 0, stickers: [], playDays: [] }
  store.grade = 2
})

describe('awardSpecials: family-milestone stickers', () => {
  it('awards the first-island extra sticker once, next to the island sticker', async () => {
    const id = getSkillsBySubject('mat')[0].id
    store.progress = { ...store.progress, skills: { [id]: mastered } }
    const added = await awardSpecials('p1')
    expect(added).toEqual([`skill:${id}`, 'extra:island:mat'])
    expect(await awardSpecials('p1')).toEqual([])
  })

  it('awards the 7-play-days extra sticker (not for six days)', async () => {
    const days = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06']
    store.progress = { ...store.progress, playDays: days }
    expect(await awardSpecials('p1')).not.toContain('extra:days7')
    store.progress.playDays = [...days, '2026-01-09']
    expect(await awardSpecials('p1')).toContain('extra:days7')
  })

  it('still works when the profile cannot be read (only the all-checks sticker waits)', async () => {
    store.grade = undefined
    const id = getSkillsBySubject('mat')[0].id
    store.progress = { ...store.progress, skills: { [id]: mastered } }
    expect(await awardSpecials('p1')).toContain('extra:island:mat')
  })
})
