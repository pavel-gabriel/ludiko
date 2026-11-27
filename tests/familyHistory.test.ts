import { describe, expect, it } from 'vitest'
import { getSkillsBySubject } from '@/engine/content/registry'
import {
  CALENDAR_WEEKS,
  DEFAULT_DAY_MINUTES,
  HISTORY_WEEKS,
  buildFamilyRow,
  buildProgressHistory,
  estimateDayMinutes,
  mondayOf,
  monthChangeMessages,
} from '@/learner/historyModels'
import {
  MASCOT_LOOKS,
  earnedMilestones,
  extraStickerId,
  parseExtraSticker,
  unlockedLooks,
} from '@/learner/extrasUnlocks'
import { dueSpecialStickers } from '@/ui/album/earning'
import { parseSpecial, stickerEmoji } from '@/ui/album/stickerSets'
import { toDayString } from '@/profiles/profileService'
import type { ChildProfile, ProfileProgress, SkillProgress } from '@/profiles/types'

const DAY = 86_400_000
// Friday 27 Nov 2026, noon local time
const NOW = new Date(2026, 10, 27, 12).getTime()
const day = (ago: number) => toDayString(NOW - ago * DAY)

const mat = getSkillsBySubject('mat')
const rom = getSkillsBySubject('rom')

const rec = (state: SkillProgress['state'], stateChangedAt?: number): SkillProgress => ({
  state,
  pMastery: state === 'mastered' ? 0.95 : 0.4,
  attempts: 5,
  correct: 4,
  lastSeen: NOW,
  ...(stateChangedAt !== undefined ? { stateChangedAt } : {}),
})

const progress = (patch: Partial<ProfileProgress> = {}): ProfileProgress => ({
  profileId: 'p1',
  skills: {},
  stars: 3,
  stickers: [],
  playDays: [],
  ...patch,
})

const profile = (patch: Partial<ChildProfile> = {}): ChildProfile => ({
  id: 'p1',
  nickname: 'Ana',
  avatar: '🦊',
  grade: 2,
  language: 'ro',
  createdAt: 0,
  updatedAt: 0,
  recoveryCode: 'X',
  ...patch,
})

describe('buildProgressHistory', () => {
  it('buckets mastered skills by the week of their last state change, oldest week first', () => {
    const p = progress({
      skills: {
        [mat[0].id]: rec('mastered', NOW - 1 * DAY), // this week
        [mat[1].id]: rec('mastered', NOW - 8 * DAY), // last week
        [mat[2].id]: rec('mastered', NOW - 9 * DAY), // last week
        [rom[0].id]: rec('mastered', NOW - 200 * DAY), // too old for 12 weeks
        [rom[1].id]: rec('mastered'), // known from the level check: no date, not weekly progress
        [rom[2].id]: rec('practised', NOW - DAY), // not mastered
      },
    })
    const h = buildProgressHistory(p, NOW)
    expect(h.weeklyMastered).toHaveLength(HISTORY_WEEKS)
    expect(h.weeklyMastered[HISTORY_WEEKS - 1]).toBe(1)
    expect(h.weeklyMastered[HISTORY_WEEKS - 2]).toBe(2)
    expect(h.weeklyMastered.reduce((a, b) => a + b, 0)).toBe(3)
    const m = h.subjects.find((s) => s.subject === 'mat')!
    expect(m.masteredTotal).toBe(3)
    expect(m.weeklyMastered[HISTORY_WEEKS - 2]).toBe(2)
    const r = h.subjects.find((s) => s.subject === 'rom')!
    expect(r.masteredTotal).toBe(2) // the known skill still counts as mastered in total
    expect(h.weekStarts).toHaveLength(HISTORY_WEEKS)
    expect(h.weekStarts[HISTORY_WEEKS - 1]).toBe(toDayString(mondayOf(NOW).getTime()))
  })

  it('draws an 8-week Monday-first calendar with levels and no missed-day marks for the future', () => {
    const p = progress({
      playDays: [day(0), day(1), day(10)],
      missions: [
        { day: day(1), subject: 'mat', estimatedSeconds: 600, steps: [{ kind: 'new', skillId: 'a', itemCount: 4, done: true }] },
        {
          day: day(0),
          subject: 'mat',
          estimatedSeconds: 300,
          steps: [{ kind: 'new', skillId: 'a', itemCount: 4, done: true }],
        },
        {
          day: day(0),
          subject: 'rom',
          estimatedSeconds: 300,
          steps: [{ kind: 'new', skillId: 'b', itemCount: 4, done: true }],
        },
      ],
    })
    const h = buildProgressHistory(p, NOW)
    expect(h.calendar).toHaveLength(CALENDAR_WEEKS)
    expect(h.calendar.every((w) => w.length === 7)).toBe(true)
    const flat = h.calendar.flat()
    expect(new Date(flat[0].day + 'T12:00:00').getDay()).toBe(1) // Monday first
    const byDay = new Map(flat.map((c) => [c.day, c]))
    expect(byDay.get(day(0))!.level).toBe(3) // two missions worked on
    expect(byDay.get(day(1))!.level).toBe(2)
    expect(byDay.get(day(10))!.level).toBe(1)
    expect(byDay.get(day(2))!.level).toBe(0)
    // Saturday and Sunday of the current week are still to come
    expect(flat.filter((c) => c.future)).toHaveLength(2)
    expect(h.playDaysInCalendar).toBe(3)
  })

  it('estimates practice time from stored missions, else a flat guess per play day', () => {
    const p = progress({
      playDays: [day(0), day(3)],
      missions: [
        {
          day: day(0),
          subject: 'mat',
          estimatedSeconds: 600,
          steps: [
            { kind: 'new', skillId: 'a', itemCount: 4, done: true },
            { kind: 'review', skillId: 'b', itemCount: 4, done: false },
          ],
        },
      ],
    })
    expect(estimateDayMinutes(p, day(0))).toBe(5) // half of a 10-minute mission
    expect(estimateDayMinutes(p, day(3))).toBe(DEFAULT_DAY_MINUTES)
    const h = buildProgressHistory(p, NOW)
    expect(h.practice.daysCounted).toBe(2)
    expect(h.practice.totalMinutes).toBe(5 + DEFAULT_DAY_MINUTES)
    expect(h.practice.weeklyMinutes).toHaveLength(CALENDAR_WEEKS)
    expect(h.practice.weeklyMinutes[CALENDAR_WEEKS - 1]).toBeGreaterThan(0)
  })

  it('keeps level-check timelines per subject, oldest first', () => {
    const entries = [
      { at: NOW - 40 * DAY, level: { grade: 2, semester: 1 } as const, missingCount: 6 },
      { at: NOW - 5 * DAY, level: { grade: 2, semester: 2 } as const, missingCount: 2 },
    ]
    const h = buildProgressHistory(progress({ levelHistory: { mat: entries } }), NOW)
    expect(h.subjects.find((s) => s.subject === 'mat')!.checks).toEqual(entries)
    expect(h.subjects.find((s) => s.subject === 'rom')!.checks).toEqual([])
  })

  it('describes the month in plain words: new islands, fewer gaps, play days, no "worse" language', () => {
    const p = progress({
      skills: {
        [mat[0].id]: rec('mastered', NOW - 3 * DAY),
        [mat[1].id]: rec('mastered', NOW - 5 * DAY),
        [rom[0].id]: rec('mastered', NOW - 6 * DAY),
      },
      levelHistory: {
        mat: [
          { at: NOW - 50 * DAY, level: { grade: 2, semester: 1 }, missingCount: 7 },
          { at: NOW - 4 * DAY, level: { grade: 2, semester: 1 }, missingCount: 3 },
        ],
      },
      playDays: [day(1), day(2), day(3), day(40)],
    })
    const h = buildProgressHistory(p, NOW)
    expect(h.month.newlyMastered).toBe(3)
    expect(h.month.playDays).toBe(3)
    expect(h.month.playDaysBefore).toBe(1)
    const msgs = monthChangeMessages(h.month)
    const keys = msgs.map((m) => m.key)
    expect(keys).toContain('mastered')
    expect(keys).toContain('subjectMastered')
    expect(keys).toContain('playDaysMore')
    expect(msgs.find((m) => m.key === 'mastered')!.vars.count).toBe(3)
    const gaps = msgs.find((m) => m.key === 'gapsDown')!
    expect(gaps.vars).toEqual({ subject: 'mat', count: 4 })
  })

  it('says a quiet month is just quiet', () => {
    const h = buildProgressHistory(progress(), NOW)
    expect(monthChangeMessages(h.month)).toEqual([{ key: 'none', vars: {} }])
  })
})

describe('buildFamilyRow', () => {
  it('summarises one child for the family dashboard', () => {
    const p = progress({
      skills: { [mat[0].id]: rec('mastered', NOW - DAY), [mat[1].id]: rec('practised', NOW) },
      playDays: [day(0), day(2), day(20)],
      placements: {
        mat: { subject: 'mat', target: { grade: 2, semester: 1 }, state: {}, startedAt: 0, updatedAt: 0, completedAt: 5 },
        rom: { subject: 'rom', target: { grade: 2, semester: 1 }, state: {}, startedAt: 0, updatedAt: 0 },
      },
    })
    const row = buildFamilyRow(profile({ nickname: 'Ioana' }), p, NOW)
    expect(row).toMatchObject({
      nickname: 'Ioana',
      grade: 2,
      playDaysThisWeek: 2,
      masteredTotal: 1,
      checksDone: 1,
      stars: 3,
      lastPlayDay: day(0),
    })
  })

  it('has no last play day for a child who has not played', () => {
    expect(buildFamilyRow(profile(), progress(), NOW).lastPlayDay).toBeUndefined()
  })
})

describe('milestones, looks and extra stickers', () => {
  const placed = (subject: 'mat' | 'rom' | 'eng') => ({
    subject,
    target: { grade: 2 as const, semester: 1 as const },
    state: {},
    startedAt: 0,
    updatedAt: 0,
    completedAt: 1,
  })

  it('earns a first-island milestone per subject, never from merely practised skills', () => {
    const m = earnedMilestones(progress({ skills: { [mat[0].id]: rec('mastered'), [rom[0].id]: rec('practised') } }), profile())
    expect(m).toContain('island:mat')
    expect(m).not.toContain('island:rom')
  })

  it('earns the 7-play-days milestone from distinct days, not a streak', () => {
    const days = [0, 2, 3, 9, 15, 21].map(day)
    expect(earnedMilestones(progress({ playDays: days }), profile())).not.toContain('days7')
    expect(earnedMilestones(progress({ playDays: [...days, day(0), day(0)] }), profile())).not.toContain('days7')
    expect(earnedMilestones(progress({ playDays: [...days, day(30)] }), profile())).toContain('days7')
  })

  it('earns "all level checks" only when every subject available at the grade has a finished check', () => {
    const p0 = profile({ grade: 0 })
    const one = progress({ placements: { mat: placed('mat') } })
    expect(earnedMilestones(one, p0)).not.toContain('checksAll')
    // a grade-0 child has no content beyond what the registry offers for grade 0: check every such subject
    const subjects = ['mat', 'rom', 'eng', 'stiinte', 'ist', 'geo', 'civ', 'logic', 'bio', 'fiz', 'chim'] as const
    const all = progress({
      placements: Object.fromEntries(subjects.map((s) => [s, { ...placed('mat'), subject: s }])),
    })
    expect(earnedMilestones(all, p0)).toContain('checksAll')
    expect(earnedMilestones(all, undefined)).not.toContain('checksAll')
  })

  it('unlocks looks by milestone only; the classic look is always there', () => {
    expect(unlockedLooks([])).toEqual(['classic'])
    const earned = ['island:mat', 'days7', 'checksAll'] as const
    expect(unlockedLooks(earned)).toEqual(['classic', 'mint', 'glasses', 'crown'])
    expect(MASCOT_LOOKS.filter((l) => l.unlock).length).toBeGreaterThanOrEqual(5)
  })

  it('gives each milestone one extra sticker, only once, alongside the regular specials', () => {
    const due = dueSpecialStickers([], { masteredSkillIds: [], playDays: 0, milestones: ['island:mat', 'days7'] })
    expect(due).toEqual([extraStickerId('island:mat'), extraStickerId('days7')])
    expect(dueSpecialStickers(due, { masteredSkillIds: [], playDays: 0, milestones: ['island:mat', 'days7'] })).toEqual([])
  })

  it('parses extra sticker ids and rejects made-up ones', () => {
    expect(parseExtraSticker('extra:island:mat')).toBe('island:mat')
    expect(parseExtraSticker('extra:days7')).toBe('days7')
    expect(parseExtraSticker('extra:island:nope')).toBeUndefined()
    expect(parseExtraSticker('extra:gold')).toBeUndefined()
    expect(parseSpecial('extra:checksAll')).toMatchObject({ kind: 'extra', ref: 'checksAll' })
    expect(stickerEmoji('extra:island:mat')).toBeTruthy()
    expect(parseSpecial('extra:bogus')).toBeUndefined()
  })
})
