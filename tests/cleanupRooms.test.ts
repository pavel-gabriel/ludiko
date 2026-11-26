import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error plain .mjs script, no types
import { cleanupRooms, parseArgs, staleKeys } from '../scripts/privacy/cleanup-rooms.mjs'

const HOUR = 3600 * 1000
const NOW = 1_800_000_000_000

function fakeDb(data: Record<string, unknown>) {
  const update = vi.fn(async () => {})
  return {
    update,
    db: {
      ref: (path?: string) => ({
        once: async () => ({ val: () => data[path ?? ''] ?? null }),
        update,
      }),
    },
  }
}

describe('scripts/privacy/cleanup-rooms.mjs', () => {
  it('staleKeys picks entries older than the limit and entries without a createdAt', () => {
    expect(staleKeys({ a: { createdAt: NOW - 25 * HOUR }, b: { createdAt: NOW - HOUR }, c: {} }, NOW, 24 * HOUR).sort()).toEqual(['a', 'c'])
    expect(staleKeys(null, NOW, 24 * HOUR)).toEqual([])
  })

  it('parses --dry-run and --max-age-hours (default 24)', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, maxAgeMs: 24 * HOUR })
    expect(parseArgs(['--dry-run', '--max-age-hours=48'])).toEqual({ dryRun: true, maxAgeMs: 48 * HOUR })
    expect(() => parseArgs(['--max-age-hours=0'])).toThrow()
  })

  it('--dry-run reports and deletes nothing', async () => {
    const { db, update } = fakeDb({ rooms: { old: { createdAt: NOW - 30 * HOUR }, fresh: { createdAt: NOW } }, roomCodes: { ABC234: { createdAt: NOW - 30 * HOUR } } })
    const r = await cleanupRooms(db, { dryRun: true, maxAgeMs: 24 * HOUR, now: NOW })
    expect(r).toEqual({ rooms: 2, staleRooms: 1, codes: 1, staleCodes: 1 })
    expect(update).not.toHaveBeenCalled()
  })

  it('deletes old rooms and their codes in one multi-path update, keeps fresh ones', async () => {
    const { db, update } = fakeDb({ rooms: { old: { createdAt: NOW - 30 * HOUR }, fresh: { createdAt: NOW } }, roomCodes: { ABC234: { createdAt: NOW - 30 * HOUR }, XYZ789: { createdAt: NOW } } })
    await cleanupRooms(db, { dryRun: false, maxAgeMs: 24 * HOUR, now: NOW })
    expect(update).toHaveBeenCalledWith({ 'rooms/old': null, 'roomCodes/ABC234': null })
  })
})
