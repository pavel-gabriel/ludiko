/**
 * Pure helpers for the SVG visual kit (no React, easy to unit-test).
 */

/* ---------------------------- Clock ---------------------------------- */

export interface ClockAngles {
  /** Degrees clockwise from 12 o'clock */
  hour: number
  minute: number
}

/** Hour hand creeps forward with the minutes (30° per hour + 0.5° per minute). */
export function clockAngles(hours: number, minutes: number): ClockAngles {
  const h = ((hours % 12) + 12) % 12
  const m = ((minutes % 60) + 60) % 60
  return { hour: h * 30 + m * 0.5, minute: m * 6 }
}

/** Hour shown in words (1–12, never 0). */
export function clockHourLabel(hours: number): number {
  const h = ((Math.round(hours) % 12) + 12) % 12
  return h === 0 ? 12 : h
}

/** Point at `angle` degrees clockwise from 12 o'clock on a circle around (cx, cy). */
export function polar(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}

/* -------------------------- Number line ------------------------------- */

const round = (n: number) => Math.round(n * 1e6) / 1e6

/** Tick values from `from` to `to` (inclusive) every `step`. Capped so a bad spec cannot freeze a phone. */
export function numberLineTicks(from: number, to: number, step = 1, maxTicks = 200): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return []
  const lo = Math.min(from, to)
  const hi = Math.max(from, to)
  let s = step > 0 && Number.isFinite(step) ? step : 1
  while ((hi - lo) / s + 1 > maxTicks) s *= 2
  const n = Math.floor((hi - lo) / s + 1e-9)
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(round(lo + i * s))
  if (out[out.length - 1] < hi - 1e-9) out.push(round(hi))
  return out
}

const NICE_STRIDES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

/**
 * Decide which ticks get a text label so labels never overlap.
 * Returns the set of tick indexes to label. `forced` indexes (marks, jump ends,
 * the first and last tick) are always kept; regular labels that would touch
 * a forced one are dropped.
 */
export function labelIndexes(
  ticks: number[],
  pxPerTick: number,
  labelPx: number,
  step: number,
  forced: number[] = [],
): Set<number> {
  const count = ticks.length
  const result = new Set<number>()
  if (count === 0) return result
  const raw = Math.max(1, Math.ceil(labelPx / Math.max(pxPerTick, 0.001)))
  const stride = NICE_STRIDES.find((s) => s >= raw) ?? raw
  const strong = new Set<number>(forced.filter((i) => i >= 0 && i < count))
  const near = (i: number, set: Set<number>) => {
    for (const f of set) if (f !== i && Math.abs(f - i) < raw) return true
    return false
  }
  // The two ends are labelled unless a marked number is right next to them
  const kept = new Set<number>(strong)
  for (const end of [0, count - 1]) if (!near(end, strong)) kept.add(end)
  for (let i = 0; i < count; i++) {
    if (kept.has(i)) continue
    const units = Math.round(ticks[i] / (step || 1))
    if (units % stride !== 0) continue
    if (!near(i, kept)) result.add(i)
  }
  kept.forEach((i) => result.add(i))
  return result
}

/** Index of the tick closest to `value`, or -1 when the value is off the line. */
export function tickIndexOf(ticks: number[], value: number): number {
  if (ticks.length === 0) return -1
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1
  let best = -1
  let bestD = Infinity
  ticks.forEach((t, i) => {
    const d = Math.abs(t - value)
    if (d < bestD) { bestD = d; best = i }
  })
  return bestD <= step / 2 + 1e-9 ? best : -1
}

/* ------------------------------ Money --------------------------------- */

export interface MoneyGroup {
  /** value of one piece, in bani */
  value: number
  count: number
}

/** Group pieces by value, biggest value first. Ignores non-positive values. */
export function groupMoney(amounts: number[]): MoneyGroup[] {
  const map = new Map<number, number>()
  for (const a of amounts) {
    const v = Math.round(a)
    if (!(v > 0)) continue
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.value - a.value)
}

/** Below 1 leu we draw a coin (bani), from 1 leu up a note (lei). */
export const isCoin = (value: number) => value < 100

export function splitMoney(value: number): { lei: number; bani: number } {
  const v = Math.round(value)
  return { lei: Math.floor(v / 100), bani: v % 100 }
}

/* --------------------------- Misc layout ------------------------------ */

export function clampCount(n: number | undefined, max: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), max)
}

/** Split `count` objects into `groups` boxes (remainder goes to the first boxes). */
export function splitIntoGroups(count: number, groups: number): number[] {
  const g = Math.max(1, Math.floor(groups))
  const base = Math.floor(count / g)
  const extra = count % g
  return Array.from({ length: g }, (_, i) => base + (i < extra ? 1 : 0))
}

/** Flow-layout boxes left to right, wrapping at `maxWidth`. Returns positions + total size. */
export function flowLayout(
  boxes: { w: number; h: number }[],
  maxWidth: number,
  gapX: number,
  gapY: number,
): { positions: { x: number; y: number; rowH: number }[]; width: number; height: number } {
  const raw: { x: number; y: number }[] = []
  let x = 0
  let y = 0
  let rowH = 0
  let width = 0
  for (const b of boxes) {
    if (x > 0 && x + b.w > maxWidth) {
      x = 0
      y += rowH + gapY
      rowH = 0
    }
    raw.push({ x, y })
    x += b.w + gapX
    rowH = Math.max(rowH, b.h)
    width = Math.max(width, x - gapX)
  }
  // every box learns its row height so callers can bottom-align boxes in a row
  const rows = new Map<number, number>()
  raw.forEach((p, i) => rows.set(p.y, Math.max(rows.get(p.y) ?? 0, boxes[i].h)))
  return { positions: raw.map((p) => ({ ...p, rowH: rows.get(p.y) ?? 0 })), width, height: y + rowH }
}
